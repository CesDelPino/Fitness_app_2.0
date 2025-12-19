import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { analyzeFoodFromText, analyzeFoodFromImage, identifyFoodFromImage, estimateActivityMET, analyzeCheckIn } from "./ai-service";
import * as aiService from "./ai-service";
import { validateSupabaseToken, type SupabaseUser, createAuthUser, updateAuthUserPassword, listAuthUsers } from "./supabase-admin";
import * as supabaseAdmin from "./supabase-admin";
import * as supabaseData from "./supabase-data"; // All food/activity data (Supabase)
import * as adminData from "./supabase-admin-data"; // Admin panel data (Supabase)
import multer from "multer";
import { z } from "zod";
import session from "express-session";
import createMemoryStore from "memorystore";
import cookieParser from "cookie-parser";
import * as portalContext from "./portal-context";
import * as routineData from "./supabase-routine-data";
import * as checkinData from "./supabase-checkin-data";
import * as messagingData from "./supabase-messaging-data";
import { initWebSocket, notifyNewMessage, notifyMessageDelivered, notifyUnreadUpdate, isUserConnected } from "./websocket";
import { getUserFeatures, hasFeature, requireFeature, filterNutrientsForUser, invalidateFeatureCache, type FeatureCode, getQuotaStatus, assertQuota, requireQuota, type QuotaFeatureCode, getActiveAiProgram, setActiveAiProgram, getTeaserUsageStatus, assertTeaserQuota } from "./feature-access";
import type Stripe from "stripe";
import * as storefrontData from "./supabase-storefront-data";

const upload = multer({ storage: multer.memoryStorage() });
const MemoryStore = createMemoryStore(session);

interface AuthenticatedRequest extends Request {
  supabaseUser?: SupabaseUser;
  portalContext?: {
    mode: 'pro' | 'client';
    profileId: string;
  };
}

// Extend express-session types
declare module "express-session" {
  interface SessionData {
    userId?: string;
    adminId?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Seed LOBAFIT admin user on startup
  await adminData.seedLobafitAdmin();

  // Cookie parser middleware for portal context cookies
  app.use(cookieParser());

  // Configure session middleware with memory store
  app.use(
    session({
      store: new MemoryStore({
        checkPeriod: 86400000, // Prune expired entries every 24h
      }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
    })
  );

  // Supabase JWT auth middleware - validates Bearer token from Authorization header
  const requireSupabaseAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const user = await validateSupabaseToken(token);
      
      if (user) {
        req.supabaseUser = user;
        return next();
      }
    }

    return res.status(401).json({ error: "Not authenticated" });
  };

  // Admin auth middleware
  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.session.adminId) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    next();
  };

  // Client portal context middleware - requires client portal context with ownership verification (Phase 5 - P5.6)
  const requireClientPortalContext = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Enforce portal context - must be in client mode
    const portalHeader = req.headers['x-portal-context'];
    if (portalHeader !== 'client') {
      return res.status(403).json({ error: "Client portal context required" });
    }

    const context = portalContext.extractPortalContext(req);
    if (!context || context.mode !== 'client') {
      return res.status(403).json({ error: "Invalid portal context" });
    }

    // Verify the portal context belongs to the authenticated user
    const userId = req.supabaseUser?.id;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isOwner = await portalContext.verifyProfileOwnership(userId, context.mode, context.profileId);
    if (!isOwner) {
      return res.status(403).json({ error: "Portal context does not belong to authenticated user" });
    }

    req.portalContext = {
      mode: context.mode,
      profileId: context.profileId,
    };

    next();
  };

  // =============================================================================
  // ADMIN AUTH ROUTES - for legacy admin panel
  // =============================================================================
  
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      // Use Supabase admin data for authentication
      const admin = await adminData.verifyAdminPassword(username, password);
      if (!admin) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Regenerate session to prevent session fixation attacks
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regenerate error:", err);
          return res.status(500).json({ error: "Login failed" });
        }
        req.session.adminId = admin.id;
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            return res.status(500).json({ error: "Login failed" });
          }
          res.json({ id: admin.id, username: admin.username });
        });
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Admin logout error:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/admin/me", requireAdmin, async (req, res) => {
    try {
      const admin = await adminData.getAdminById(req.session.adminId!);
      if (!admin) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      res.json({ id: admin.id, username: admin.username });
    } catch (error) {
      console.error("Get admin error:", error);
      res.status(500).json({ error: "Failed to get admin" });
    }
  });

  // =============================================================================
  // PORTAL CONTEXT ROUTES - Role detection and context switching
  // =============================================================================

  app.get("/api/auth/available-roles", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Prevent caching of user-specific data to avoid stale responses when switching accounts
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const userId = req.supabaseUser!.id;
      const roles = await portalContext.getAvailableRoles(userId);
      res.json(roles);
    } catch (error) {
      console.error("Get available roles error:", error);
      res.status(500).json({ error: "Failed to get available roles" });
    }
  });

  app.post("/api/auth/set-portal-context", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const { mode, profileId } = req.body;

      if (!mode || !['pro', 'client'].includes(mode)) {
        return res.status(400).json({ error: "Invalid portal mode" });
      }

      if (!profileId) {
        return res.status(400).json({ error: "Profile ID is required" });
      }

      const isOwner = await portalContext.verifyProfileOwnership(userId, mode, profileId);
      if (!isOwner) {
        return res.status(403).json({ error: "Profile does not belong to authenticated user" });
      }

      const existingContext = portalContext.extractPortalContext(req);
      const fromPortal = existingContext?.mode || null;

      const expires = portalContext.setCookieOnResponse(res, mode, profileId);

      const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] || 
                        req.socket.remoteAddress || null;
      await portalContext.logPortalSwitch(userId, fromPortal, mode, ipAddress);

      res.json({ success: true, mode, profileId, expires });
    } catch (error) {
      console.error("Set portal context error:", error);
      res.status(500).json({ error: "Failed to set portal context" });
    }
  });

  app.post("/api/auth/refresh-portal-context", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const existingContext = portalContext.extractPortalContext(req);

      if (!existingContext) {
        return res.status(401).json({ error: "No portal context to refresh", requiresRoleSelection: true });
      }

      const isOwner = await portalContext.verifyProfileOwnership(
        userId, 
        existingContext.mode, 
        existingContext.profileId
      );

      if (!isOwner) {
        portalContext.clearCookieOnResponse(res);
        return res.status(403).json({ error: "Invalid portal context", requiresRoleSelection: true });
      }

      const expires = portalContext.setCookieOnResponse(res, existingContext.mode, existingContext.profileId);

      res.json({ 
        success: true, 
        mode: existingContext.mode, 
        profileId: existingContext.profileId,
        expires 
      });
    } catch (error) {
      console.error("Refresh portal context error:", error);
      res.status(500).json({ error: "Failed to refresh portal context" });
    }
  });

  app.post("/api/auth/clear-portal-context", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      portalContext.clearCookieOnResponse(res);
      res.json({ success: true });
    } catch (error) {
      console.error("Clear portal context error:", error);
      res.status(500).json({ error: "Failed to clear portal context" });
    }
  });

  app.get("/api/auth/portal-context", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Prevent caching of user-specific data to avoid stale responses when switching accounts
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const userId = req.supabaseUser!.id;
      const existingContext = portalContext.extractPortalContext(req);

      if (!existingContext) {
        return res.json({ hasContext: false, requiresRoleSelection: true });
      }

      const isOwner = await portalContext.verifyProfileOwnership(
        userId, 
        existingContext.mode, 
        existingContext.profileId
      );

      if (!isOwner) {
        portalContext.clearCookieOnResponse(res);
        return res.json({ hasContext: false, requiresRoleSelection: true });
      }

      let expires = existingContext.expires;
      if (portalContext.isNearExpiry(existingContext.expires)) {
        expires = portalContext.setCookieOnResponse(res, existingContext.mode, existingContext.profileId);
      }

      res.json({ 
        hasContext: true, 
        mode: existingContext.mode, 
        profileId: existingContext.profileId,
        expires 
      });
    } catch (error) {
      console.error("Get portal context error:", error);
      res.status(500).json({ error: "Failed to get portal context" });
    }
  });

  // =============================================================================
  // SUPABASE USER MANAGEMENT ROUTES (Admin panel - for Supabase Auth users)
  // =============================================================================

  app.get("/api/admin/supabase-users", requireAdmin, async (req, res) => {
    try {
      const { users, error } = await supabaseAdmin.listAuthUsers();
      if (error) {
        return res.status(500).json({ error });
      }
      res.json(users);
    } catch (error) {
      console.error("Get Supabase users error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  app.post("/api/admin/supabase-users", requireAdmin, async (req, res) => {
    try {
      const createUserSchema = z.object({
        email: z.string().email("Valid email is required"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        displayName: z.string().optional(),
        gender: z.enum(["M", "F"]).optional(),
        age: z.number().min(1).max(120).optional(),
        heightCm: z.number().min(50).max(300).optional(),
        currentWeightKg: z.number().min(10).max(500).optional(),
      });
      
      const validatedData = createUserSchema.parse(req.body);
      
      let birthdate: string | undefined;
      if (validatedData.age) {
        const today = new Date();
        const birthYear = today.getFullYear() - validatedData.age;
        birthdate = `${birthYear}-01-01`;
      }

      const { user, error } = await supabaseAdmin.createAuthUser({
        email: validatedData.email,
        password: validatedData.password,
        displayName: validatedData.displayName,
        gender: validatedData.gender,
        birthdate,
        heightCm: validatedData.heightCm,
        currentWeightKg: validatedData.currentWeightKg,
        activityMultiplier: 1.55,
      });

      if (error) {
        return res.status(400).json({ error });
      }

      res.json(user);
    } catch (error) {
      console.error("Create Supabase user error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/admin/supabase-users/:id/password", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const { success, error } = await supabaseAdmin.updateAuthUserPassword(id, password);

      if (!success) {
        return res.status(400).json({ error: error || "Failed to update password" });
      }

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Update Supabase password error:", error);
      res.status(500).json({ error: "Failed to update password" });
    }
  });

  // =============================================================================
  // ADMIN USER MANAGEMENT - Premium override, search, delete
  // =============================================================================

  // GET /api/admin/users - Search and list users with pagination
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { 
        search = '', 
        role = '', 
        premiumStatus = '', 
        page = '1', 
        perPage = '20' 
      } = req.query as Record<string, string>;

      const pageNum = Math.max(1, parseInt(page) || 1);
      const perPageNum = Math.min(100, Math.max(1, parseInt(perPage) || 20));

      // First get all auth users
      const { data: authData, error: authError } = await supabaseAdmin.supabaseAdmin.auth.admin.listUsers();
      if (authError) {
        return res.status(500).json({ error: authError.message });
      }

      const userIds = authData.users.map(u => u.id);

      // Build profile query with filters
      let profileQuery = supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('id, display_name, role, subscription_plan_id, admin_premium_override, deleted_at')
        .in('id', userIds)
        .is('deleted_at', null);

      if (role && role !== 'all') {
        profileQuery = profileQuery.eq('role', role);
      }

      const { data: profiles, error: profileError } = await profileQuery;

      if (profileError) {
        console.error("Profile query error:", profileError);
      }

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Get subscription data
      const { data: subscriptions } = await supabaseAdmin.supabaseAdmin
        .from('user_subscriptions')
        .select('user_id, status')
        .in('user_id', userIds);

      const subMap = new Map(subscriptions?.map(s => [s.user_id, s]) || []);

      // Get premium plan ID for comparison
      const { data: premiumPlan } = await supabaseAdmin.supabaseAdmin
        .from('subscription_plans')
        .select('id')
        .eq('code', 'premium')
        .single();

      // Combine and filter users
      let users = authData.users.map(user => {
        const profile = profileMap.get(user.id);
        const subscription = subMap.get(user.id);
        const adminOverride = profile?.admin_premium_override as any;
        
        const isPremium = 
          (subscription?.status === 'active' || subscription?.status === 'trialing') ||
          (adminOverride?.active && (!adminOverride?.expires_at || new Date(adminOverride.expires_at) > new Date()));
        
        const hasAdminOverride = adminOverride?.active || false;

        return {
          id: user.id,
          email: user.email || '',
          displayName: profile?.display_name || user.user_metadata?.display_name,
          role: profile?.role || 'client',
          createdAt: user.created_at,
          lastSignIn: user.last_sign_in_at,
          isPremium,
          hasAdminOverride,
          subscriptionStatus: subscription?.status || null,
          adminOverrideDetails: hasAdminOverride ? {
            grantedBy: adminOverride?.granted_by,
            grantedAt: adminOverride?.granted_at,
            expiresAt: adminOverride?.expires_at,
            reason: adminOverride?.reason,
          } : null,
        };
      }).filter(user => profileMap.has(user.id)); // Only include users with profiles

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        users = users.filter(user => 
          user.email.toLowerCase().includes(searchLower) ||
          (user.displayName && user.displayName.toLowerCase().includes(searchLower))
        );
      }

      // Apply premium status filter
      if (premiumStatus === 'premium') {
        users = users.filter(user => user.isPremium);
      } else if (premiumStatus === 'free') {
        users = users.filter(user => !user.isPremium);
      } else if (premiumStatus === 'override') {
        users = users.filter(user => user.hasAdminOverride);
      }

      // Sort by created date descending
      users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Paginate
      const total = users.length;
      const startIndex = (pageNum - 1) * perPageNum;
      const paginatedUsers = users.slice(startIndex, startIndex + perPageNum);

      res.json({
        users: paginatedUsers,
        total,
        page: pageNum,
        perPage: perPageNum,
        totalPages: Math.ceil(total / perPageNum),
      });
    } catch (error) {
      console.error("Admin users search error:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  // POST /api/admin/users/:id/premium - Grant or revoke premium access
  app.post("/api/admin/users/:id/premium", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { action, reason, expiresAt } = req.body;

      if (!['grant', 'revoke'].includes(action)) {
        return res.status(400).json({ error: "Action must be 'grant' or 'revoke'" });
      }

      // Verify user exists
      const { data: profile, error: profileError } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('id, display_name, admin_premium_override')
        .eq('id', id)
        .single();

      if (profileError || !profile) {
        return res.status(404).json({ error: "User not found" });
      }

      const adminSession = (req as any).session;
      const adminUsername = adminSession?.adminUser?.username || 'admin';

      if (action === 'grant') {
        const overrideData = {
          active: true,
          granted_by: adminUsername,
          granted_at: new Date().toISOString(),
          expires_at: expiresAt || null,
          reason: reason || 'Admin granted premium access',
        };

        const { error: updateError } = await supabaseAdmin.supabaseAdmin
          .from('profiles')
          .update({ admin_premium_override: overrideData })
          .eq('id', id);

        if (updateError) {
          console.error("Grant premium error:", updateError);
          return res.status(500).json({ error: "Failed to grant premium access" });
        }

        // Invalidate feature cache
        const { invalidateFeatureCache } = await import('./feature-access');
        invalidateFeatureCache(id);

        console.log(`[admin] Premium access granted to user ${id} by ${adminUsername}`);
        res.json({ 
          success: true, 
          message: "Premium access granted",
          override: overrideData 
        });
      } else {
        // Revoke
        const { error: updateError } = await supabaseAdmin.supabaseAdmin
          .from('profiles')
          .update({ admin_premium_override: null })
          .eq('id', id);

        if (updateError) {
          console.error("Revoke premium error:", updateError);
          return res.status(500).json({ error: "Failed to revoke premium access" });
        }

        // Invalidate feature cache
        const { invalidateFeatureCache } = await import('./feature-access');
        invalidateFeatureCache(id);

        console.log(`[admin] Premium access revoked from user ${id} by ${adminUsername}`);
        res.json({ success: true, message: "Premium access revoked" });
      }
    } catch (error) {
      console.error("Admin premium action error:", error);
      res.status(500).json({ error: "Failed to update premium status" });
    }
  });

  // GET /api/admin/users/:id/dependencies - Get user's data dependencies before deletion
  app.get("/api/admin/users/:id/dependencies", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Verify user exists
      const { data: profile } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('id, display_name, role')
        .eq('id', id)
        .single();

      if (!profile) {
        return res.status(404).json({ error: "User not found" });
      }

      // Count dependencies
      const [
        { count: messagesCount },
        { count: conversationsCount },
        { count: purchasesCount },
        { count: productsCount },
        { data: subscription },
      ] = await Promise.all([
        supabaseAdmin.supabaseAdmin.from('messages').select('*', { count: 'exact', head: true }).eq('sender_id', id),
        supabaseAdmin.supabaseAdmin.from('conversation_participants').select('*', { count: 'exact', head: true }).eq('user_id', id),
        supabaseAdmin.supabaseAdmin.from('trainer_purchases').select('*', { count: 'exact', head: true }).eq('client_id', id),
        supabaseAdmin.supabaseAdmin.from('trainer_products').select('*', { count: 'exact', head: true }).eq('trainer_id', id),
        supabaseAdmin.supabaseAdmin.from('user_subscriptions').select('status').eq('user_id', id).single(),
      ]);

      const warnings = [];
      if (subscription?.status === 'active' || subscription?.status === 'trialing') {
        warnings.push('User has an active subscription - will be cancelled');
      }
      if (profile.role === 'professional') {
        warnings.push('User is a professional - their products and storefront will be archived');
      }

      res.json({
        userId: id,
        displayName: profile.display_name,
        role: profile.role,
        dependencies: {
          messages: messagesCount || 0,
          conversations: conversationsCount || 0,
          purchases: purchasesCount || 0,
          products: productsCount || 0,
        },
        warnings,
      });
    } catch (error) {
      console.error("Get user dependencies error:", error);
      res.status(500).json({ error: "Failed to get user dependencies" });
    }
  });

  // DELETE /api/admin/users/:id - Soft delete a user
  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { confirm, reason } = req.body;

      if (!confirm) {
        return res.status(400).json({ 
          error: "Confirmation required",
          message: "Set confirm=true to proceed with deletion" 
        });
      }

      // Verify user exists
      const { data: profile } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('id, display_name, role')
        .eq('id', id)
        .single();

      if (!profile) {
        return res.status(404).json({ error: "User not found" });
      }

      const adminSession = (req as any).session;
      const adminUsername = adminSession?.adminUser?.username || 'admin';

      // 1. Cancel any active Stripe subscription
      const { data: subscription } = await supabaseAdmin.supabaseAdmin
        .from('user_subscriptions')
        .select('stripe_subscription_id, status')
        .eq('user_id', id)
        .single();

      if (subscription?.stripe_subscription_id && 
          (subscription.status === 'active' || subscription.status === 'trialing')) {
        try {
          const { initializeStripeClient } = await import('./stripeClient');
          const stripe = await initializeStripeClient();
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
          console.log(`[admin] Cancelled subscription ${subscription.stripe_subscription_id} for user ${id}`);
        } catch (stripeError) {
          console.error("Stripe cancellation error:", stripeError);
          // Continue with deletion even if Stripe fails
        }
      }

      // 2. Soft delete the profile
      const { error: profileUpdateError } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: adminUsername,
          deleted_reason: reason || 'Deleted by admin',
        })
        .eq('id', id);

      if (profileUpdateError) {
        console.error("Profile soft delete error:", profileUpdateError);
        return res.status(500).json({ error: "Failed to delete user profile" });
      }

      // 3. Archive trainer products if professional
      if (profile.role === 'professional') {
        await supabaseAdmin.supabaseAdmin
          .from('trainer_products')
          .update({ status: 'archived' })
          .eq('trainer_id', id);

        await supabaseAdmin.supabaseAdmin
          .from('trainer_storefronts')
          .update({ is_published: false })
          .eq('trainer_id', id);
      }

      // 4. Delete Supabase auth user
      try {
        await supabaseAdmin.supabaseAdmin.auth.admin.deleteUser(id);
        console.log(`[admin] Deleted auth user ${id}`);
      } catch (authError) {
        console.error("Auth user deletion error:", authError);
        // Profile is already soft-deleted, so we can continue
      }

      // 5. Invalidate feature cache
      const { invalidateFeatureCache } = await import('./feature-access');
      invalidateFeatureCache(id);

      console.log(`[admin] User ${id} (${profile.display_name}) deleted by ${adminUsername}`);
      res.json({ 
        success: true, 
        message: `User ${profile.display_name || id} has been deleted`,
        deletedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Admin user deletion error:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // GET /api/admin/foods - List all cached foods with pagination and search
  app.get("/api/admin/foods", requireAdmin, async (req, res) => {
    try {
      const { 
        search = '', 
        dataSource = '', 
        limit = '25', 
        offset = '0' 
      } = req.query as Record<string, string>;

      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 25));
      const offsetNum = Math.max(0, parseInt(offset) || 0);

      // Build query
      let query = supabaseAdmin.supabaseAdmin
        .from('food_items')
        .select(`
          id,
          fdc_id,
          description,
          brand_name,
          data_type,
          gtin_upc,
          serving_size_description,
          serving_size_grams,
          household_serving_text,
          times_used,
          fetch_timestamp,
          created_at,
          updated_at
        `, { count: 'exact' });

      // Apply search filter
      if (search.trim()) {
        query = query.or(`description.ilike.%${search}%,brand_name.ilike.%${search}%,gtin_upc.ilike.%${search}%`);
      }

      // Apply data source filter
      if (dataSource && dataSource !== 'all') {
        query = query.eq('data_type', dataSource);
      }

      // Apply pagination and ordering
      query = query
        .order('times_used', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offsetNum, offsetNum + limitNum - 1);

      const { data: foods, count, error } = await query;

      if (error) {
        console.error("List foods error:", error);
        return res.status(500).json({ error: "Failed to list foods" });
      }

      // Get portion counts for each food
      const foodIds = foods?.map(f => f.id) || [];
      let portionCounts: Record<string, number> = {};
      
      if (foodIds.length > 0) {
        const { data: portions } = await supabaseAdmin.supabaseAdmin
          .from('food_item_portions')
          .select('food_item_id')
          .in('food_item_id', foodIds);
        
        if (portions) {
          for (const p of portions) {
            portionCounts[p.food_item_id] = (portionCounts[p.food_item_id] || 0) + 1;
          }
        }
      }

      // Add portion count to each food
      const foodsWithPortions = foods?.map(f => ({
        ...f,
        portion_count: portionCounts[f.id] || 0
      })) || [];

      res.json({
        foods: foodsWithPortions,
        total: count || 0,
        limit: limitNum,
        offset: offsetNum,
      });
    } catch (error) {
      console.error("List foods error:", error);
      res.status(500).json({ error: "Failed to list foods" });
    }
  });

  // GET /api/admin/foods/:id - Get detailed food info with portions and nutrients
  app.get("/api/admin/foods/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Get food item
      const { data: food, error: foodError } = await supabaseAdmin.supabaseAdmin
        .from('food_items')
        .select('*')
        .eq('id', id)
        .single();

      if (foodError || !food) {
        return res.status(404).json({ error: "Food not found" });
      }

      // Get portions
      const { data: portions } = await supabaseAdmin.supabaseAdmin
        .from('food_item_portions')
        .select('*')
        .eq('food_item_id', id)
        .order('is_default', { ascending: false })
        .order('sequence', { ascending: true });

      // Get nutrients with definitions
      const { data: nutrients } = await supabaseAdmin.supabaseAdmin
        .from('food_item_nutrients')
        .select(`
          id,
          amount_per_100g,
          amount_per_serving,
          nutrient_definitions (
            id,
            fdc_nutrient_id,
            name,
            unit,
            nutrient_group,
            is_core_macro
          )
        `)
        .eq('food_item_id', id)
        .order('nutrient_definitions(display_order)', { ascending: true });

      res.json({
        ...food,
        portions: portions || [],
        nutrients: nutrients || [],
      });
    } catch (error) {
      console.error("Get food details error:", error);
      res.status(500).json({ error: "Failed to get food details" });
    }
  });

  // POST /api/admin/foods/backfill-portions - Backfill portions for existing foods
  app.post("/api/admin/foods/backfill-portions", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.body.limit as string) || 50;
      
      const { getFoodsWithoutPortions, cachePortionsForFood } = await import('./fda-cache');
      const foodsToBackfill = await getFoodsWithoutPortions(limit);
      
      if (foodsToBackfill.length === 0) {
        return res.json({ 
          success: true, 
          message: "All foods already have portions cached",
          backfilled: 0,
          remaining: 0
        });
      }
      
      const { fdaService } = await import('./fda-service');
      let backfilledCount = 0;
      const errors: string[] = [];
      
      for (const food of foodsToBackfill) {
        try {
          // Fetch fresh data from FDA with portions
          const details = await fdaService.getFoodDetails(food.fdcId, { includePortions: true });
          
          if (details?.portions && details.portions.length > 0) {
            const portionsForCache = details.portions.map((p: { id?: number; amount: number; gramWeight: number; modifier: string; measureUnit?: string; portionDescription?: string }) => ({
              id: p.id,
              amount: p.amount,
              gramWeight: p.gramWeight,
              modifier: p.modifier,
              measureUnit: p.measureUnit,
              portionDescription: p.portionDescription,
            }));
            
            const success = await cachePortionsForFood(food.id, portionsForCache, details.dataType);
            if (success) {
              backfilledCount++;
            }
          }
        } catch (error: any) {
          errors.push(`FDC ${food.fdcId}: ${error.message}`);
        }
        
        // Rate limit: small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Get remaining count
      const remaining = await getFoodsWithoutPortions(1000);
      
      console.log(`[admin] Backfilled portions for ${backfilledCount}/${foodsToBackfill.length} foods`);
      res.json({
        success: true,
        message: `Backfilled portions for ${backfilledCount} foods`,
        backfilled: backfilledCount,
        attempted: foodsToBackfill.length,
        remaining: remaining.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      });
    } catch (error) {
      console.error("Backfill portions error:", error);
      res.status(500).json({ error: "Failed to backfill portions" });
    }
  });

  // =============================================================================
  // PROFILE PROVISIONING - Ensures profile exists for authenticated user
  // =============================================================================

  app.post("/api/auth/ensure-profile", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check if profile already exists
      const { supabaseAdmin: adminClient } = await import('./supabase-admin');
      const { data: existingProfile, error: fetchError } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (existingProfile) {
        return res.json({ profile: existingProfile, created: false });
      }

      // Profile doesn't exist, create it using admin role
      const userMetadata = req.supabaseUser?.user_metadata || {};
      const displayName = userMetadata.display_name || 
                         userMetadata.full_name || 
                         req.supabaseUser?.email?.split('@')[0] || 
                         'User';

      const { data: newProfile, error: insertError } = await adminClient
        .from('profiles')
        .insert({
          id: userId,
          display_name: displayName,
          role: 'client',
          timezone: 'UTC',
        })
        .select()
        .single();

      if (insertError) {
        // Handle duplicate key error (race condition with trigger)
        if (insertError.code === '23505') {
          // Profile was created by trigger - refetch it
          const { data: raceProfile } = await adminClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          
          if (raceProfile) {
            return res.json({ profile: raceProfile, created: false });
          }
        }
        console.error("Profile creation error:", insertError);
        return res.status(500).json({ error: "Failed to create profile" });
      }

      res.json({ profile: newProfile, created: true });
    } catch (error) {
      console.error("Ensure profile error:", error);
      res.status(500).json({ error: "Failed to ensure profile exists" });
    }
  });

  // =============================================================================
  // AI USAGE QUOTA ROUTES
  // =============================================================================

  app.get("/api/quota/status", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const featureCode = req.query.feature as QuotaFeatureCode | undefined;
      
      const status = await getQuotaStatus(userId, featureCode);
      res.json({ quotas: status });
    } catch (error) {
      console.error("Quota status error:", error);
      res.status(500).json({ error: "Failed to get quota status" });
    }
  });

  app.get("/api/quota/active-program", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const activeProgram = await getActiveAiProgram(userId);
      res.json({ activeProgram });
    } catch (error) {
      console.error("Active program error:", error);
      res.status(500).json({ error: "Failed to get active AI program" });
    }
  });

  // =============================================================================
  // AI FOOD ANALYSIS ROUTES - Requires Supabase JWT auth + Quota enforcement
  // =============================================================================

  app.post("/api/analyze/text", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { description } = req.body;
      if (!description) {
        return res.status(400).json({ error: "Description is required" });
      }

      const result = await analyzeFoodFromText(description);
      res.json(result);
    } catch (error) {
      console.error("Text analysis error:", error);
      res.status(500).json({ error: "Failed to analyze food description" });
    }
  });

  app.post("/api/analyze/image", requireSupabaseAuth as any, upload.single("image"), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      
      if (!req.file) {
        return res.status(400).json({ error: "Image file is required" });
      }

      const quotaResult = await assertQuota(userId, 'ai_photo_recognition');
      
      if (!quotaResult.success) {
        return res.status(403).json({
          error: 'Quota exceeded',
          feature: 'ai_photo_recognition',
          message: quotaResult.error || 'Monthly usage limit reached',
          quota: {
            currentCount: quotaResult.currentCount,
            limit: quotaResult.limit,
            remaining: quotaResult.remaining,
          },
        });
      }

      const imageBase64 = req.file.buffer.toString("base64");
      const result = await analyzeFoodFromImage(imageBase64);
      
      res.json({
        ...result,
        quota: {
          currentCount: quotaResult.currentCount,
          limit: quotaResult.limit,
          remaining: quotaResult.remaining,
        },
      });
    } catch (error) {
      console.error("Image analysis error:", error);
      res.status(500).json({ error: "Failed to analyze food image" });
    }
  });

  app.post("/api/food/identify", requireSupabaseAuth as any, upload.single("image"), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      
      if (!req.file) {
        return res.status(400).json({ error: "Image file is required" });
      }

      const quotaResult = await assertQuota(userId, 'ai_photo_recognition');
      
      if (!quotaResult.success) {
        return res.status(403).json({
          error: 'Quota exceeded',
          feature: 'ai_photo_recognition',
          message: quotaResult.error || 'Monthly usage limit reached',
          quota: {
            currentCount: quotaResult.currentCount,
            limit: quotaResult.limit,
            remaining: quotaResult.remaining,
          },
        });
      }

      const imageBase64 = req.file.buffer.toString("base64");
      const result = await identifyFoodFromImage(imageBase64);
      
      res.json({
        ...result,
        quota: {
          currentCount: quotaResult.currentCount,
          limit: quotaResult.limit,
          remaining: quotaResult.remaining,
        },
      });
    } catch (error) {
      console.error("Food identification error:", error);
      res.status(500).json({ error: "Failed to identify food in image" });
    }
  });

  // =============================================================================
  // BARCODE LOOKUP - Uses Open Food Facts API with in-memory cache
  // =============================================================================

  const barcodeCache = new Map<string, { data: any; timestamp: number }>();
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  app.get("/api/food/barcode/:code", async (req, res) => {
    try {
      const barcode = req.params.code;
      console.log(`[Barcode Lookup] Searching for barcode: ${barcode}`);
      
      // 1. Check Supabase food database first (permanent cache)
      const localFood = await supabaseData.getFoodByBarcode(barcode);
      if (localFood) {
        console.log(`[Barcode Lookup] Found in database: ${localFood.canonical_name}`);
        const result = {
          barcode: barcode,
          foodName: localFood.canonical_name,
          brand: localFood.brand || "",
          servingSize: localFood.default_serving_size || "100g",
          caloriesPer100g: localFood.calories_per_100g || localFood.calories_per_serving || 0,
          proteinPer100g: localFood.protein_per_100g || localFood.protein_per_serving || 0,
          carbsPer100g: localFood.carbs_per_100g || localFood.carbs_per_serving || 0,
          fatPer100g: localFood.fat_per_100g || localFood.fat_per_serving || 0,
          fiberPer100g: localFood.fiber_per_100g || 0,
          sugarPer100g: localFood.sugar_per_100g || 0,
          imageUrl: null,
          source: "local_database",
        };
        return res.json(result);
      }
      
      // 2. Check in-memory cache (temporary, for API responses)
      const cached = barcodeCache.get(barcode);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Barcode Lookup] Memory cache hit for ${barcode}`);
        return res.json(cached.data);
      }

      // 3. Call Open Food Facts API
      const apiUrl = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;
      console.log(`[Barcode Lookup] Calling Open Food Facts API: ${apiUrl}`);
      const response = await fetch(apiUrl);
      const data = await response.json();

      console.log(`[Barcode Lookup] API response status: ${data.status}, has product: ${!!data.product}`);

      if (data.status === 0 || !data.product) {
        console.log(`[Barcode Lookup] Product not found for barcode ${barcode}`);
        return res.status(404).json({ error: "Product not found" });
      }

      const product = data.product;
      const nutriments = product.nutriments || {};
      
      const result = {
        barcode: barcode,
        foodName: product.product_name || "Unknown Product",
        brand: product.brands || "",
        servingSize: product.serving_size || "100g",
        caloriesPer100g: Math.round(nutriments["energy-kcal_100g"] || nutriments["energy-kcal"] || 0),
        proteinPer100g: nutriments.proteins_100g || nutriments.proteins || 0,
        carbsPer100g: nutriments.carbohydrates_100g || nutriments.carbohydrates || 0,
        fatPer100g: nutriments.fat_100g || nutriments.fat || 0,
        fiberPer100g: nutriments.fiber_100g || nutriments.fiber || 0,
        sugarPer100g: nutriments.sugars_100g || nutriments.sugars || 0,
        imageUrl: product.image_url || null,
        source: "open_food_facts",
      };

      // Cache in memory for this session
      barcodeCache.set(barcode, { data: result, timestamp: Date.now() });

      res.json(result);
    } catch (error) {
      console.error("Barcode lookup error:", error);
      res.status(500).json({ error: "Failed to lookup barcode" });
    }
  });

  // =============================================================================
  // AI MET ESTIMATION - For custom cardio activities
  // =============================================================================

  app.post("/api/estimate-activity-met", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const requestSchema = z.object({
        activityName: z.string().min(1).max(200),
      });
      const { activityName } = requestSchema.parse(req.body);
      
      const userId = req.supabaseUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }
      
      // Clamp MET values to a safe range (1.0 to 23.0)
      const clampMET = (met: number): number => Math.max(1.0, Math.min(23.0, met));
      
      // First check if we already have this cached for this user (Supabase)
      const cached = await supabaseData.getUserCustomActivity(userId, activityName);
      if (cached) {
        return res.json({ 
          estimatedMET: clampMET(cached.estimated_met), 
          cached: true,
          confidence: "high",
          reasoning: "Previously estimated for this user"
        });
      }
      
      // Check if it matches a standard activity (case-insensitive)
      const standardActivity = await supabaseData.getCardioActivityByName(activityName);
      if (standardActivity) {
        return res.json({ 
          estimatedMET: clampMET(standardActivity.base_met), 
          cached: false,
          isStandard: true,
          confidence: "high",
          reasoning: "Standard activity in database"
        });
      }
      
      // Call AI for estimation
      const aiResponse = await estimateActivityMET(activityName);
      
      const metResponseSchema = z.object({
        estimatedMET: z.number().min(1.0).max(23.0),
        confidence: z.enum(["high", "medium", "low"]),
        reasoning: z.string(),
      });
      
      let validatedResponse;
      try {
        validatedResponse = metResponseSchema.parse(aiResponse);
      } catch (validationError) {
        validatedResponse = {
          estimatedMET: clampMET(typeof aiResponse.estimatedMET === 'number' ? aiResponse.estimatedMET : 5.0),
          confidence: "low" as const,
          reasoning: aiResponse.reasoning || "Estimated based on activity name",
        };
      }
      
      // Cache the validated result for this user (Supabase)
      await supabaseData.createUserCustomActivity({
        userId,
        activityName: activityName.trim(),
        estimatedMET: validatedResponse.estimatedMET,
      });
      
      res.json({
        estimatedMET: validatedResponse.estimatedMET,
        cached: false,
        confidence: validatedResponse.confidence,
        reasoning: validatedResponse.reasoning,
      });
    } catch (error) {
      console.error("Estimate activity MET error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      res.status(500).json({ error: "Failed to estimate activity MET" });
    }
  });

  // =============================================================================
  // FOOD DATABASE CACHE ROUTES - Using Supabase
  // =============================================================================

  // Accept camelCase from frontend for backwards compatibility
  const createFoodRequestSchema = z.object({
    canonicalName: z.string().min(1),
    brand: z.string().optional().nullable(),
    source: z.enum(["barcode", "ai_text", "ai_image", "manual", "imported"]),
    verificationStatus: z.enum(["verified", "user_contributed", "pending"]).optional(),
    caloriesPer100g: z.number().optional().nullable(),
    proteinPer100g: z.number().optional().nullable(),
    carbsPer100g: z.number().optional().nullable(),
    fatPer100g: z.number().optional().nullable(),
    fiberPer100g: z.number().optional().nullable(),
    sugarPer100g: z.number().optional().nullable(),
    defaultServingSize: z.string().optional().nullable(),
    defaultServingGrams: z.number().optional().nullable(),
    caloriesPerServing: z.number().optional().nullable(),
    proteinPerServing: z.number().optional().nullable(),
    carbsPerServing: z.number().optional().nullable(),
    fatPerServing: z.number().optional().nullable(),
    barcode: z.string().optional(),
    aliases: z.array(z.string()).optional(),
  });

  // Map camelCase request to snake_case for Supabase
  function mapFoodRequestToSupabase(data: z.infer<typeof createFoodRequestSchema>) {
    return {
      canonical_name: data.canonicalName,
      brand: data.brand,
      source: data.source,
      verification_status: data.verificationStatus,
      calories_per_100g: data.caloriesPer100g,
      protein_per_100g: data.proteinPer100g,
      carbs_per_100g: data.carbsPer100g,
      fat_per_100g: data.fatPer100g,
      fiber_per_100g: data.fiberPer100g,
      sugar_per_100g: data.sugarPer100g,
      default_serving_size: data.defaultServingSize,
      default_serving_grams: data.defaultServingGrams,
      calories_per_serving: data.caloriesPerServing,
      protein_per_serving: data.proteinPerServing,
      carbs_per_serving: data.carbsPerServing,
      fat_per_serving: data.fatPerServing,
    };
  }

  // Map Supabase snake_case response to camelCase for API
  function mapFoodToResponse(food: any) {
    return {
      id: food.id,
      canonicalName: food.canonical_name,
      brand: food.brand,
      source: food.source,
      verificationStatus: food.verification_status,
      caloriesPer100g: food.calories_per_100g,
      proteinPer100g: food.protein_per_100g,
      carbsPer100g: food.carbs_per_100g,
      fatPer100g: food.fat_per_100g,
      fiberPer100g: food.fiber_per_100g,
      sugarPer100g: food.sugar_per_100g,
      defaultServingSize: food.default_serving_size,
      defaultServingGrams: food.default_serving_grams,
      caloriesPerServing: food.calories_per_serving,
      proteinPerServing: food.protein_per_serving,
      carbsPerServing: food.carbs_per_serving,
      fatPerServing: food.fat_per_serving,
      // Supabase uses times_used and updated_at (not usage_count/last_used_at)
      usageCount: food.times_used ?? 0,
      lastUsedAt: food.updated_at,
      createdAt: food.created_at,
      // Include barcodes and aliases arrays if present
      barcodes: food.barcodes || [],
      aliases: food.aliases || [],
    };
  }

  app.get("/api/foods/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 20;
      
      if (!query || query.trim().length < 2) {
        return res.json([]);
      }
      
      const foods = await supabaseData.searchFoods(query.trim(), limit);
      // Map to camelCase for API consistency
      res.json(foods.map(mapFoodToResponse));
    } catch (error) {
      console.error("Search foods error:", error);
      res.status(500).json({ error: "Failed to search foods" });
    }
  });

  // Local food search endpoint - searches food_items table (FDA cache)
  // Used for instant typeahead without API calls
  app.get("/api/foods/local-search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 15;
      
      if (!query || query.trim().length < 2) {
        return res.json([]);
      }
      
      const { searchCachedFoods } = await import("./fda-cache");
      const foods = await searchCachedFoods(query.trim(), limit);
      
      // Map to format compatible with FDAFood interface
      res.json(foods.map(food => ({
        id: food.id,
        fdcId: food.fdcId,
        description: food.description,
        dataType: food.dataType,
        brandOwner: food.brandName,
        brandName: food.brandName,
        servingSize: food.servingSizeGrams,
        servingSizeUnit: 'g',
        householdServingFullText: food.householdServingText || food.servingSizeDescription,
        gtinUpc: food.gtinUpc,
        timesUsed: food.timesUsed,
        nutrients: food.nutrients.map(n => ({
          fdcNutrientId: n.fdcNutrientId,
          name: n.name,
          unit: n.unit,
          amountPer100g: n.amountPer100g,
          amountPerServing: n.amountPerServing,
        })),
        portions: (food.portions || []).map(p => ({
          id: p.id,
          sourcePortionId: p.sourcePortionId,
          description: p.description,
          amount: p.amount,
          gramWeight: p.gramWeight,
          unit: p.unit,
          sequence: p.sequence,
          modifier: p.modifier,
          isDefault: p.isDefault,
        })),
        isLocalResult: true,
      })));
    } catch (error) {
      console.error("Local food search error:", error);
      res.status(500).json({ error: "Failed to search local foods" });
    }
  });

  app.get("/api/foods/barcode/:barcode", async (req, res) => {
    try {
      const { barcode } = req.params;
      
      if (!barcode || barcode.trim().length === 0) {
        return res.status(400).json({ error: "Barcode is required" });
      }
      
      const food = await supabaseData.getFoodByBarcode(barcode.trim());
      
      if (!food) {
        return res.status(404).json({ 
          error: "Food not found", 
          cached: false,
          message: "Barcode not in cache - proceed to external API lookup"
        });
      }
      
      // Map to camelCase for API consistency
      res.json({ ...mapFoodToResponse(food), cached: true });
    } catch (error) {
      console.error("Barcode lookup error:", error);
      res.status(500).json({ error: "Failed to lookup barcode" });
    }
  });

  app.get("/api/foods/popular", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const foods = await supabaseData.getPopularFoods(limit);
      // Map to camelCase for API consistency
      res.json(foods.map(mapFoodToResponse));
    } catch (error) {
      console.error("Get popular foods error:", error);
      res.status(500).json({ error: "Failed to get popular foods" });
    }
  });

  app.get("/api/foods/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const foods = await supabaseData.getRecentFoods(limit);
      // Map to camelCase for API consistency
      res.json(foods.map(mapFoodToResponse));
    } catch (error) {
      console.error("Get recent foods error:", error);
      res.status(500).json({ error: "Failed to get recent foods" });
    }
  });

  app.post("/api/foods", async (req, res) => {
    try {
      const validatedData = createFoodRequestSchema.parse(req.body);
      const { barcode, aliases, ...foodData } = validatedData;
      
      // Map camelCase request to snake_case for Supabase
      const supabaseFoodData = mapFoodRequestToSupabase(foodData as any);
      
      const food = await supabaseData.createFood(supabaseFoodData);
      
      // Critical: Return 500 if food creation failed before attempting barcode/alias
      if (!food) {
        return res.status(500).json({ error: "Failed to create food in database" });
      }
      
      // Track barcodes and aliases added for response
      const addedBarcodes: string[] = [];
      const addedAliases: string[] = [];
      
      // Only add barcode/alias after confirmed food insert
      if (barcode) {
        const barcodeResult = await supabaseData.addFoodBarcode(food.id, barcode);
        if (barcodeResult) {
          addedBarcodes.push(barcode);
        }
      }
      
      if (aliases && aliases.length > 0) {
        for (const alias of aliases) {
          const aliasResult = await supabaseData.addFoodAlias(food.id, alias);
          if (aliasResult) {
            addedAliases.push(alias);
          }
        }
      }
      
      // Build complete response with all data including barcodes and aliases
      const responseFood = {
        ...food,
        barcodes: addedBarcodes,
        aliases: addedAliases,
      };
      
      // Return camelCase response with complete data for API consistency
      res.status(201).json(mapFoodToResponse(responseFood));
    } catch (error) {
      console.error("Create food error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid food data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create food" });
    }
  });

  app.post("/api/foods/:id/barcode", async (req, res) => {
    try {
      const { id } = req.params;
      const { barcode } = req.body;
      
      if (!barcode || barcode.trim().length === 0) {
        return res.status(400).json({ error: "Barcode is required" });
      }
      
      const food = await supabaseData.getFoodById(id);
      if (!food) {
        return res.status(404).json({ error: "Food not found" });
      }
      
      const result = await supabaseData.addFoodBarcode(id, barcode.trim());
      if (!result) {
        return res.status(500).json({ error: "Failed to add barcode" });
      }
      res.status(201).json(result);
    } catch (error) {
      console.error("Add barcode error:", error);
      res.status(500).json({ error: "Failed to add barcode" });
    }
  });

  app.post("/api/foods/:id/alias", async (req, res) => {
    try {
      const { id } = req.params;
      const { aliasText } = req.body;
      
      if (!aliasText || aliasText.trim().length === 0) {
        return res.status(400).json({ error: "Alias text is required" });
      }
      
      const food = await supabaseData.getFoodById(id);
      if (!food) {
        return res.status(404).json({ error: "Food not found" });
      }
      
      const result = await supabaseData.addFoodAlias(id, aliasText.trim());
      if (!result) {
        return res.status(500).json({ error: "Failed to add alias" });
      }
      res.status(201).json(result);
    } catch (error) {
      console.error("Add alias error:", error);
      res.status(500).json({ error: "Failed to add alias" });
    }
  });

  app.post("/api/foods/:id/use", async (req, res) => {
    try {
      const { id } = req.params;
      
      const food = await supabaseData.getFoodById(id);
      if (!food) {
        return res.status(404).json({ error: "Food not found" });
      }
      
      await supabaseData.incrementFoodUsage(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Increment usage error:", error);
      res.status(500).json({ error: "Failed to increment usage" });
    }
  });

  // =============================================================================
  // PUBLIC EQUIPMENT & GOALS ROUTES (for pros and clients)
  // =============================================================================

  app.get("/api/equipment-options", async (req, res) => {
    try {
      const equipment = await routineData.getEquipmentOptions();
      res.json(equipment.filter((e: any) => e.is_active !== false));
    } catch (error) {
      console.error("Get equipment options error:", error);
      res.status(500).json({ error: "Failed to get equipment options" });
    }
  });

  app.get("/api/goal-types", async (req, res) => {
    try {
      const goals = await routineData.getGoalTypes();
      res.json(goals.filter((g: any) => g.is_active !== false));
    } catch (error) {
      console.error("Get goal types error:", error);
      res.status(500).json({ error: "Failed to get goal types" });
    }
  });

  // =============================================================================
  // ADMIN EQUIPMENT OPTIONS ROUTES
  // =============================================================================

  app.get("/api/admin/equipment", requireAdmin, async (req, res) => {
    try {
      const equipment = await routineData.getEquipmentOptions();
      res.json(equipment);
    } catch (error) {
      console.error("Get equipment error:", error);
      res.status(500).json({ error: "Failed to get equipment options" });
    }
  });

  app.post("/api/admin/equipment", requireAdmin, async (req, res) => {
    try {
      const equipmentSchema = z.object({
        name: z.string().min(1),
        category: z.string().min(1),
        display_order: z.number().default(0),
        is_active: z.boolean().default(true),
      });
      
      const data = equipmentSchema.parse(req.body);
      const equipment = await routineData.createEquipmentOption(data);
      res.status(201).json(equipment);
    } catch (error) {
      console.error("Create equipment error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to create equipment option" });
    }
  });

  app.put("/api/admin/equipment/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        category: z.string().min(1).optional(),
        display_order: z.number().optional(),
        is_active: z.boolean().optional(),
      });
      
      const data = updateSchema.parse(req.body);
      const equipment = await routineData.updateEquipmentOption(id, data);
      res.json(equipment);
    } catch (error) {
      console.error("Update equipment error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to update equipment option" });
    }
  });

  app.delete("/api/admin/equipment/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await routineData.deleteEquipmentOption(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete equipment error:", error);
      res.status(500).json({ error: "Failed to delete equipment option" });
    }
  });

  // =============================================================================
  // ADMIN GOAL TYPES ROUTES
  // =============================================================================

  app.get("/api/admin/goals", requireAdmin, async (req, res) => {
    try {
      const goals = await routineData.getGoalTypes();
      res.json(goals);
    } catch (error) {
      console.error("Get goals error:", error);
      res.status(500).json({ error: "Failed to get goal types" });
    }
  });

  app.post("/api/admin/goals", requireAdmin, async (req, res) => {
    try {
      const goalSchema = z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        default_rep_range: z.string().nullable().optional(),
        default_rest_seconds: z.number().nullable().optional(),
        display_order: z.number().default(0),
        is_active: z.boolean().default(true),
      });
      
      const data = goalSchema.parse(req.body);
      const goal = await routineData.createGoalType(data);
      res.status(201).json(goal);
    } catch (error) {
      console.error("Create goal error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to create goal type" });
    }
  });

  app.put("/api/admin/goals/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        default_rep_range: z.string().nullable().optional(),
        default_rest_seconds: z.number().nullable().optional(),
        display_order: z.number().optional(),
        is_active: z.boolean().optional(),
      });
      
      const data = updateSchema.parse(req.body);
      const goal = await routineData.updateGoalType(id, data);
      res.json(goal);
    } catch (error) {
      console.error("Update goal error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to update goal type" });
    }
  });

  app.delete("/api/admin/goals/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await routineData.deleteGoalType(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete goal error:", error);
      res.status(500).json({ error: "Failed to delete goal type" });
    }
  });

  // =============================================================================
  // ADMIN EXERCISE LIBRARY ROUTES
  // =============================================================================

  app.get("/api/admin/exercises", requireAdmin, async (req, res) => {
    try {
      const { category, muscleGroup, equipment, isSystem, search, limit, offset } = req.query;
      
      const result = await routineData.getExercises({
        category: category as string,
        muscleGroup: muscleGroup as string,
        equipment: equipment as string,
        isSystem: isSystem === 'true' ? true : isSystem === 'false' ? false : undefined,
        search: search as string,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Get exercises error:", error);
      res.status(500).json({ error: "Failed to get exercises" });
    }
  });

  app.get("/api/admin/exercises/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const exercise = await routineData.getExerciseById(id);
      
      if (!exercise) {
        return res.status(404).json({ error: "Exercise not found" });
      }
      
      res.json(exercise);
    } catch (error) {
      console.error("Get exercise error:", error);
      res.status(500).json({ error: "Failed to get exercise" });
    }
  });

  app.post("/api/admin/exercises", requireAdmin, async (req, res) => {
    try {
      const exerciseSchema = z.object({
        name: z.string().min(1),
        category: z.string().min(1),
        muscle_groups: z.array(z.string()).default([]),
        equipment_tags: z.array(z.string()).default([]),
        difficulty_level: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
        instructions: z.string().nullable().optional(),
        video_url: z.string().nullable().optional(),
        thumbnail_url: z.string().nullable().optional(),
        demonstration_notes: z.string().nullable().optional(),
        is_system: z.boolean().default(true),
        created_by: z.string().nullable().optional(),
      });
      
      const data = exerciseSchema.parse(req.body);
      const exercise = await routineData.createExercise(data);
      res.status(201).json(exercise);
    } catch (error) {
      console.error("Create exercise error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to create exercise" });
    }
  });

  app.put("/api/admin/exercises/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        category: z.string().min(1).optional(),
        muscle_groups: z.array(z.string()).optional(),
        equipment_tags: z.array(z.string()).optional(),
        difficulty_level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
        instructions: z.string().nullable().optional(),
        video_url: z.string().nullable().optional(),
        thumbnail_url: z.string().nullable().optional(),
        demonstration_notes: z.string().nullable().optional(),
      });
      
      const data = updateSchema.parse(req.body);
      const exercise = await routineData.updateExercise(id, data);
      res.json(exercise);
    } catch (error) {
      console.error("Update exercise error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to update exercise" });
    }
  });

  app.delete("/api/admin/exercises/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await routineData.deleteExercise(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete exercise error:", error);
      res.status(500).json({ error: "Failed to delete exercise" });
    }
  });

  // =============================================================================
  // ADMIN NUTRITION ROUTES
  // =============================================================================

  // POST /api/admin/nutrition/seed-common - Pre-seed common foods from FDA
  app.post("/api/admin/nutrition/seed-common", requireAdmin, async (req, res) => {
    try {
      const { fdaService } = await import("./fda-service");
      const { COMMON_FOODS, getAllFdcIds } = await import("./fda-seed-data");
      
      const fdcIds = getAllFdcIds();
      console.log(`[admin] Starting FDA seed for ${fdcIds.length} common foods...`);
      
      const batchSize = 5;
      let seeded = 0;
      let failed = 0;
      const errors: string[] = [];
      
      for (let i = 0; i < fdcIds.length; i += batchSize) {
        const batch = fdcIds.slice(i, i + batchSize);
        try {
          const foods = await fdaService.batchGetFoods(batch);
          seeded += foods.length;
          failed += batch.length - foods.length;
          console.log(`[admin] Seeded batch ${Math.floor(i / batchSize) + 1}: ${foods.length}/${batch.length} foods`);
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          failed += batch.length;
          const msg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${msg}`);
          console.error(`[admin] Batch ${Math.floor(i / batchSize) + 1} failed:`, error);
        }
      }
      
      console.log(`[admin] FDA seed complete: ${seeded} seeded, ${failed} failed`);
      
      res.json({
        success: true,
        total: fdcIds.length,
        seeded,
        failed,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("Seed common foods error:", error);
      res.status(500).json({ error: "Failed to seed common foods" });
    }
  });

  // GET /api/admin/nutrition/seed-status - Check seeding status
  app.get("/api/admin/nutrition/seed-status", requireAdmin, async (req, res) => {
    try {
      const { count, error } = await supabaseAdmin.supabaseAdmin
        .from("food_items")
        .select("id", { count: "exact", head: true });
      
      if (error) {
        throw error;
      }
      
      const { COMMON_FOODS } = await import("./fda-seed-data");
      const totalItems = count || 0;
      
      res.json({
        totalFoodItems: totalItems,
        targetCommonFoods: COMMON_FOODS.length,
        percentSeeded: totalItems > 0 ? Math.round((totalItems / COMMON_FOODS.length) * 100) : 0,
      });
    } catch (error) {
      console.error("Get seed status error:", error);
      res.status(500).json({ error: "Failed to get seed status" });
    }
  });

  // POST /api/admin/nutrition/bulk-import - Bulk import FDA foods by FDC IDs
  // Uses fdaService.batchGetFoods which persists foods via fda-cache.ts cacheFood function
  app.post("/api/admin/nutrition/bulk-import", requireAdmin, async (req, res) => {
    try {
      const importSchema = z.object({
        fdcIds: z.array(z.number().int().positive()).min(1).max(100),
      });
      
      const { fdcIds } = importSchema.parse(req.body);
      console.log(`[admin] Starting bulk FDA import for ${fdcIds.length} foods...`);
      
      const { fdaService } = await import("./fda-service");
      
      const existingBefore = new Set<number>();
      for (const fdcId of fdcIds) {
        const { count } = await supabaseAdmin.supabaseAdmin
          .from('food_items')
          .select('id', { count: 'exact', head: true })
          .eq('fdc_id', fdcId);
        if (count && count > 0) {
          existingBefore.add(fdcId);
        }
      }
      
      const batchSize = 5;
      let imported = 0;
      let updated = 0;
      let failed = 0;
      const results: { fdcId: number; status: 'imported' | 'updated' | 'failed'; description?: string; error?: string }[] = [];
      
      for (let i = 0; i < fdcIds.length; i += batchSize) {
        const batch = fdcIds.slice(i, i + batchSize);
        try {
          const foods = await fdaService.batchGetFoods(batch);
          
          for (const fdcId of batch) {
            const food = foods.find(f => f.fdcId === fdcId);
            if (food) {
              if (existingBefore.has(fdcId)) {
                updated++;
                results.push({ fdcId, status: 'updated', description: food.description });
              } else {
                imported++;
                results.push({ fdcId, status: 'imported', description: food.description });
              }
            } else {
              failed++;
              results.push({ fdcId, status: 'failed', error: 'Not found in FDA database' });
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          for (const fdcId of batch) {
            failed++;
            results.push({ fdcId, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
          }
          console.error(`[admin] Bulk import batch failed:`, error);
        }
      }
      
      console.log(`[admin] Bulk import complete: ${imported} imported, ${updated} updated, ${failed} failed`);
      
      res.json({
        success: true,
        total: fdcIds.length,
        imported,
        updated,
        failed,
        results,
      });
    } catch (error) {
      console.error("Bulk import error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to bulk import foods" });
    }
  });

  // =============================================================================
  // ADMIN STAGING FOOD VERIFICATION ROUTES
  // =============================================================================

  // GET /api/admin/nutrition/staging - List staging foods by status
  app.get("/api/admin/nutrition/staging", requireAdmin, async (req, res) => {
    try {
      const { status = 'pending', limit = 20, offset = 0 } = req.query;
      
      const { data, error } = await supabaseAdmin.supabaseAdmin
        .from('staging_food_items')
        .select(`
          id,
          description,
          brand_name,
          serving_size_description,
          serving_size_grams,
          household_serving_text,
          status,
          rejection_reason,
          created_at,
          reviewed_at,
          submitted_by_user_id,
          reviewed_by_admin_id
        `)
        .eq('status', status as string)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);
      
      if (error) {
        console.error("List staging foods error:", error);
        return res.status(500).json({ error: "Failed to list staging foods" });
      }
      
      res.json(data || []);
    } catch (error) {
      console.error("List staging foods error:", error);
      res.status(500).json({ error: "Failed to list staging foods" });
    }
  });

  // GET /api/admin/nutrition/staging/count - Get counts by status
  app.get("/api/admin/nutrition/staging/count", requireAdmin, async (req, res) => {
    try {
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        supabaseAdmin.supabaseAdmin
          .from('staging_food_items')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabaseAdmin.supabaseAdmin
          .from('staging_food_items')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'approved'),
        supabaseAdmin.supabaseAdmin
          .from('staging_food_items')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'rejected'),
      ]);
      
      res.json({
        pending: pendingRes.count || 0,
        approved: approvedRes.count || 0,
        rejected: rejectedRes.count || 0,
      });
    } catch (error) {
      console.error("Get staging counts error:", error);
      res.status(500).json({ error: "Failed to get staging counts" });
    }
  });

  // GET /api/admin/nutrition/staging/:id - Get single staging food with nutrients
  app.get("/api/admin/nutrition/staging/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const { data: food, error: foodError } = await supabaseAdmin.supabaseAdmin
        .from('staging_food_items')
        .select('*')
        .eq('id', id)
        .single();
      
      if (foodError || !food) {
        return res.status(404).json({ error: "Staging food not found" });
      }
      
      const { data: nutrients, error: nutrientsError } = await supabaseAdmin.supabaseAdmin
        .from('staging_food_nutrients')
        .select(`
          nutrient_id,
          amount_per_100g,
          amount_per_serving,
          nutrient_definitions(id, fda_nutrient_id, name, unit, nutrient_group)
        `)
        .eq('staging_food_id', id);
      
      if (nutrientsError) {
        console.error("Get staging nutrients error:", nutrientsError);
      }
      
      res.json({
        ...food,
        nutrients: nutrients || [],
      });
    } catch (error) {
      console.error("Get staging food error:", error);
      res.status(500).json({ error: "Failed to get staging food" });
    }
  });

  // PATCH /api/admin/nutrition/staging/:id - Approve or reject staging food
  app.patch("/api/admin/nutrition/staging/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = req.session?.adminId;
      
      const reviewSchema = z.object({
        decision: z.enum(['approved', 'rejected']),
        rejectionReason: z.string().optional(),
      });
      
      const { decision, rejectionReason } = reviewSchema.parse(req.body);
      
      if (decision === 'rejected' && (!rejectionReason || rejectionReason.trim().length < 5)) {
        return res.status(400).json({ error: "Rejection reason must be at least 5 characters" });
      }
      
      const { data: food, error: foodError } = await supabaseAdmin.supabaseAdmin
        .from('staging_food_items')
        .select('*')
        .eq('id', id)
        .single();
      
      if (foodError || !food) {
        return res.status(404).json({ error: "Staging food not found" });
      }
      
      if (food.status !== 'pending') {
        return res.status(400).json({ error: "Food has already been reviewed" });
      }
      
      let approvedFoodItemId: string | null = null;
      
      if (decision === 'approved') {
        const { data: newFood, error: insertError } = await supabaseAdmin.supabaseAdmin
          .from('food_items')
          .insert({
            description: food.description,
            brand_name: food.brand_name,
            serving_size_g: food.serving_size_grams,
            serving_size_text: food.serving_size_description,
            household_serving_text: food.household_serving_text,
            data_source: 'ai_generated',
          })
          .select('id')
          .single();
        
        if (insertError) {
          console.error("Insert approved food error:", insertError);
          return res.status(500).json({ error: "Failed to create food item" });
        }
        
        approvedFoodItemId = newFood.id;
        
        const { data: stagingNutrients } = await supabaseAdmin.supabaseAdmin
          .from('staging_food_nutrients')
          .select('nutrient_id, amount_per_100g, amount_per_serving')
          .eq('staging_food_id', id);
        
        if (stagingNutrients && stagingNutrients.length > 0) {
          const nutrientInserts = stagingNutrients.map(n => ({
            food_item_id: approvedFoodItemId,
            nutrient_id: n.nutrient_id,
            amount_per_100g: n.amount_per_100g,
            amount_per_serving: n.amount_per_serving,
          }));
          
          const { error: nutrientError } = await supabaseAdmin.supabaseAdmin
            .from('food_item_nutrients')
            .insert(nutrientInserts);
          
          if (nutrientError) {
            console.error("Insert nutrients error:", nutrientError);
          }
        }
      }
      
      const { error: updateError } = await supabaseAdmin.supabaseAdmin
        .from('staging_food_items')
        .update({
          status: decision,
          rejection_reason: decision === 'rejected' ? rejectionReason : null,
          reviewed_by_admin_id: adminId,
          reviewed_at: new Date().toISOString(),
          approved_food_item_id: approvedFoodItemId,
        })
        .eq('id', id);
      
      if (updateError) {
        console.error("Update staging food error:", updateError);
        return res.status(500).json({ error: "Failed to update staging food" });
      }
      
      res.json({ 
        success: true, 
        decision,
        approvedFoodItemId,
      });
    } catch (error) {
      console.error("Review staging food error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to review staging food" });
    }
  });

  // =============================================================================
  // ADMIN FEATURE MANAGEMENT ROUTES
  // =============================================================================

  // GET /api/admin/features - List all features with plan counts
  app.get("/api/admin/features", requireAdmin, async (req, res) => {
    try {
      const { data: features, error } = await supabaseAdmin.supabaseAdmin
        .from('features')
        .select('*')
        .order('code');
      
      if (error) {
        console.error("Get features error:", error);
        return res.status(500).json({ error: "Failed to get features" });
      }

      const { data: planFeatureCounts, error: countError } = await supabaseAdmin.supabaseAdmin
        .from('plan_features')
        .select('feature_id');
      
      const planCountMap = new Map<string, number>();
      if (planFeatureCounts) {
        for (const pf of planFeatureCounts) {
          const count = planCountMap.get(pf.feature_id) || 0;
          planCountMap.set(pf.feature_id, count + 1);
        }
      }

      const featuresWithCounts = features?.map(f => ({
        ...f,
        plan_count: planCountMap.get(f.id) || 0,
      })) || [];

      res.json(featuresWithCounts);
    } catch (error) {
      console.error("Get features error:", error);
      res.status(500).json({ error: "Failed to get features" });
    }
  });

  // PATCH /api/admin/features/:id - Toggle feature is_active flag
  app.patch("/api/admin/features/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        is_active: z.boolean(),
      });
      
      const { is_active } = updateSchema.parse(req.body);
      
      const { data: feature, error } = await supabaseAdmin.supabaseAdmin
        .from('features')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error("Update feature error:", error);
        return res.status(500).json({ error: "Failed to update feature" });
      }

      res.json(feature);
    } catch (error) {
      console.error("Update feature error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to update feature" });
    }
  });

  // GET /api/admin/subscription-plans - List all plans with feature associations
  app.get("/api/admin/subscription-plans", requireAdmin, async (req, res) => {
    try {
      const { data: plans, error } = await supabaseAdmin.supabaseAdmin
        .from('subscription_plans')
        .select(`
          *,
          plan_features (
            feature_id,
            features (
              id,
              code,
              name
            )
          )
        `)
        .order('code');
      
      if (error) {
        console.error("Get subscription plans error:", error);
        return res.status(500).json({ error: "Failed to get subscription plans" });
      }

      const plansWithFeatures = plans?.map(plan => ({
        ...plan,
        features: plan.plan_features?.map((pf: any) => pf.features).filter(Boolean) || [],
      })) || [];

      res.json(plansWithFeatures);
    } catch (error) {
      console.error("Get subscription plans error:", error);
      res.status(500).json({ error: "Failed to get subscription plans" });
    }
  });

  // PATCH /api/admin/subscription-plans/:id/features - Bulk update features for a plan
  app.patch("/api/admin/subscription-plans/:id/features", requireAdmin, async (req, res) => {
    try {
      const { id: planId } = req.params;
      const updateSchema = z.object({
        feature_ids: z.array(z.string().uuid()),
      });
      
      const { feature_ids } = updateSchema.parse(req.body);

      const { error: deleteError } = await supabaseAdmin.supabaseAdmin
        .from('plan_features')
        .delete()
        .eq('plan_id', planId);
      
      if (deleteError) {
        console.error("Delete plan features error:", deleteError);
        return res.status(500).json({ error: "Failed to update plan features" });
      }

      if (feature_ids.length > 0) {
        const insertData = feature_ids.map(featureId => ({
          plan_id: planId,
          feature_id: featureId,
        }));

        const { error: insertError } = await supabaseAdmin.supabaseAdmin
          .from('plan_features')
          .insert(insertData);
        
        if (insertError) {
          console.error("Insert plan features error:", insertError);
          return res.status(500).json({ error: "Failed to update plan features" });
        }
      }

      const { data: updatedPlan, error: selectError } = await supabaseAdmin.supabaseAdmin
        .from('subscription_plans')
        .select(`
          *,
          plan_features (
            feature_id,
            features (
              id,
              code,
              name
            )
          )
        `)
        .eq('id', planId)
        .single();

      if (selectError) {
        console.error("Get updated plan error:", selectError);
        return res.status(500).json({ error: "Failed to get updated plan" });
      }

      res.json({
        ...updatedPlan,
        features: updatedPlan.plan_features?.map((pf: any) => pf.features).filter(Boolean) || [],
      });
    } catch (error) {
      console.error("Update plan features error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to update plan features" });
    }
  });

  // GET /api/admin/users/by-email - Lookup user by email
  app.get("/api/admin/users/by-email", requireAdmin, async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) {
        return res.status(400).json({ error: "Email query parameter required" });
      }

      const { data: profile, error } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select(`
          id,
          email,
          display_name,
          subscription_plan_id,
          subscription_plans (
            code,
            name
          )
        `)
        .ilike('email', email)
        .single();
      
      if (error || !profile) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(profile);
    } catch (error) {
      console.error("Get user by email error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // GET /api/admin/users/:userId/feature-overrides - Get user's feature overrides
  app.get("/api/admin/users/:userId/feature-overrides", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;

      const { data: overrides, error } = await supabaseAdmin.supabaseAdmin
        .from('user_feature_overrides')
        .select(`
          *,
          features (
            id,
            code,
            name
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Get user overrides error:", error);
        return res.status(500).json({ error: "Failed to get user overrides" });
      }

      res.json(overrides || []);
    } catch (error) {
      console.error("Get user overrides error:", error);
      res.status(500).json({ error: "Failed to get user overrides" });
    }
  });

  // POST /api/admin/users/:userId/feature-overrides - Create feature override
  app.post("/api/admin/users/:userId/feature-overrides", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const createSchema = z.object({
        feature_id: z.string().uuid(),
        is_enabled: z.boolean(),
        reason: z.string().nullable().optional(),
        expires_at: z.string().datetime().nullable().optional(),
      });
      
      const data = createSchema.parse(req.body);

      const { data: override, error } = await supabaseAdmin.supabaseAdmin
        .from('user_feature_overrides')
        .insert({
          user_id: userId,
          feature_id: data.feature_id,
          is_enabled: data.is_enabled,
          reason: data.reason || null,
          expires_at: data.expires_at || null,
        })
        .select(`
          *,
          features (
            id,
            code,
            name
          )
        `)
        .single();
      
      if (error) {
        console.error("Create override error:", error);
        return res.status(500).json({ error: "Failed to create override" });
      }

      const { invalidateFeatureCache } = await import("./feature-access");
      invalidateFeatureCache(userId);

      res.json(override);
    } catch (error) {
      console.error("Create override error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to create override" });
    }
  });

  // PATCH /api/admin/feature-overrides/:id - Update feature override
  app.patch("/api/admin/feature-overrides/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        is_enabled: z.boolean().optional(),
        reason: z.string().nullable().optional(),
        expires_at: z.string().datetime().nullable().optional(),
      });
      
      const data = updateSchema.parse(req.body);

      const { data: existingOverride, error: fetchError } = await supabaseAdmin.supabaseAdmin
        .from('user_feature_overrides')
        .select('user_id')
        .eq('id', id)
        .single();

      if (fetchError || !existingOverride) {
        return res.status(404).json({ error: "Override not found" });
      }

      const { data: override, error } = await supabaseAdmin.supabaseAdmin
        .from('user_feature_overrides')
        .update(data)
        .eq('id', id)
        .select(`
          *,
          features (
            id,
            code,
            name
          )
        `)
        .single();
      
      if (error) {
        console.error("Update override error:", error);
        return res.status(500).json({ error: "Failed to update override" });
      }

      const { invalidateFeatureCache } = await import("./feature-access");
      invalidateFeatureCache(existingOverride.user_id);

      res.json(override);
    } catch (error) {
      console.error("Update override error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to update override" });
    }
  });

  // DELETE /api/admin/feature-overrides/:id - Delete feature override
  app.delete("/api/admin/feature-overrides/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const { data: existingOverride, error: fetchError } = await supabaseAdmin.supabaseAdmin
        .from('user_feature_overrides')
        .select('user_id')
        .eq('id', id)
        .single();

      if (fetchError || !existingOverride) {
        return res.status(404).json({ error: "Override not found" });
      }

      const { error } = await supabaseAdmin.supabaseAdmin
        .from('user_feature_overrides')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error("Delete override error:", error);
        return res.status(500).json({ error: "Failed to delete override" });
      }

      const { invalidateFeatureCache } = await import("./feature-access");
      invalidateFeatureCache(existingOverride.user_id);

      res.json({ success: true });
    } catch (error) {
      console.error("Delete override error:", error);
      res.status(500).json({ error: "Failed to delete override" });
    }
  });

  // GET /api/admin/feature-analytics - Get feature usage analytics
  app.get("/api/admin/feature-analytics", requireAdmin, async (req, res) => {
    try {
      const { data: planDistribution, error: planError } = await supabaseAdmin.supabaseAdmin
        .from('subscription_plans')
        .select(`
          id,
          code,
          name,
          profiles (id)
        `);
      
      const planStats = planDistribution?.map(plan => ({
        planId: plan.id,
        planCode: plan.code,
        planName: plan.name,
        userCount: Array.isArray(plan.profiles) ? plan.profiles.length : 0,
      })) || [];

      const { data: featureStats, error: featureError } = await supabaseAdmin.supabaseAdmin
        .from('features')
        .select(`
          id,
          code,
          name,
          is_active,
          plan_features (id)
        `);
      
      const featureAdoption = featureStats?.map(feature => ({
        featureId: feature.id,
        featureCode: feature.code,
        featureName: feature.name,
        isActive: feature.is_active,
        planCount: Array.isArray(feature.plan_features) ? feature.plan_features.length : 0,
      })) || [];

      const { data: recentOverrides, error: overrideError } = await supabaseAdmin.supabaseAdmin
        .from('user_feature_overrides')
        .select(`
          id,
          is_enabled,
          reason,
          expires_at,
          created_at,
          profiles!user_feature_overrides_user_id_fkey (
            email,
            display_name
          ),
          features (
            code,
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      const formattedOverrides = recentOverrides?.map(o => ({
        id: o.id,
        isEnabled: o.is_enabled,
        reason: o.reason,
        expiresAt: o.expires_at,
        createdAt: o.created_at,
        userEmail: (o.profiles as any)?.email,
        userDisplayName: (o.profiles as any)?.display_name,
        featureCode: (o.features as any)?.code,
        featureName: (o.features as any)?.name,
      })) || [];

      const { count: totalUsers } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true });

      const { count: totalOverrides } = await supabaseAdmin.supabaseAdmin
        .from('user_feature_overrides')
        .select('id', { count: 'exact', head: true });

      res.json({
        summary: {
          totalUsers: totalUsers || 0,
          totalOverrides: totalOverrides || 0,
          totalPlans: planStats.length,
          totalFeatures: featureAdoption.length,
        },
        planDistribution: planStats,
        featureAdoption,
        recentOverrides: formattedOverrides,
      });
    } catch (error) {
      console.error("Get feature analytics error:", error);
      res.status(500).json({ error: "Failed to get feature analytics" });
    }
  });

  // =============================================================================
  // ADMIN ROUTINE BLUEPRINTS ROUTES
  // =============================================================================

  app.get("/api/admin/routines", requireAdmin, async (req, res) => {
    try {
      const blueprints = await routineData.getRoutineBlueprints({
        ownerType: 'platform',
        isArchived: false,
      });
      res.json(blueprints);
    } catch (error) {
      console.error("Get routines error:", error);
      res.status(500).json({ error: "Failed to get routines" });
    }
  });

  app.get("/api/admin/routines/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const routine = await routineData.getFullRoutine(id);
      
      if (!routine) {
        return res.status(404).json({ error: "Routine not found" });
      }
      
      res.json(routine);
    } catch (error) {
      console.error("Get routine error:", error);
      res.status(500).json({ error: "Failed to get routine" });
    }
  });

  app.post("/api/admin/routines", requireAdmin, async (req, res) => {
    try {
      const routineSchema = z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        goal_type_id: z.string().nullable().optional(),
        equipment_profile: z.array(z.string()).nullable().optional(),
        duration_weeks: z.number().nullable().optional(),
        sessions_per_week: z.number().nullable().optional(),
        is_template: z.boolean().default(true),
        creation_method: z.enum(['manual', 'template', 'ai_assisted']).default('manual'),
      });
      
      const data = routineSchema.parse(req.body);
      
      const blueprint = await routineData.createRoutineBlueprint({
        ...data,
        owner_type: 'platform',
        owner_id: null,
        created_for_client_id: null,
        source_blueprint_id: null,
        ai_prompt: null,
        ai_response: null,
        is_archived: false,
      });
      
      const version = await routineData.createRoutineVersion({
        blueprint_id: blueprint.id,
        version_number: 1,
        status: 'draft',
        notes: 'Initial version',
        published_at: null,
      });
      
      res.status(201).json({ blueprint, version });
    } catch (error) {
      console.error("Create routine error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to create routine" });
    }
  });

  app.put("/api/admin/routines/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        goal_type_id: z.string().nullable().optional(),
        equipment_profile: z.array(z.string()).nullable().optional(),
        duration_weeks: z.number().nullable().optional(),
        sessions_per_week: z.number().nullable().optional(),
        is_template: z.boolean().optional(),
        is_archived: z.boolean().optional(),
      });
      
      const data = updateSchema.parse(req.body);
      const blueprint = await routineData.updateRoutineBlueprint(id, data);
      res.json(blueprint);
    } catch (error) {
      console.error("Update routine error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to update routine" });
    }
  });

  // =============================================================================
  // ADMIN ROUTINE VERSION EXERCISES ROUTES
  // =============================================================================

  app.get("/api/admin/routines/:id/exercises", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { versionId } = req.query;
      
      let targetVersionId = versionId as string;
      
      if (!targetVersionId) {
        const versions = await routineData.getRoutineVersions(id);
        const latestVersion = versions[0];
        if (!latestVersion) {
          return res.status(404).json({ error: "No versions found for this routine" });
        }
        targetVersionId = latestVersion.id;
      }
      
      const exercises = await routineData.getRoutineVersionExercises(targetVersionId);
      res.json(exercises);
    } catch (error) {
      console.error("Get routine exercises error:", error);
      res.status(500).json({ error: "Failed to get routine exercises" });
    }
  });

  app.post("/api/admin/routines/:id/exercises", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const exerciseSchema = z.object({
        version_id: z.string(),
        exercise_id: z.string().nullable().optional(),
        custom_exercise_name: z.string().nullable().optional(),
        day_number: z.number().min(1),
        order_in_day: z.number().min(1),
        sets: z.number().min(1).default(3),
        reps_min: z.number().nullable().optional(),
        reps_max: z.number().nullable().optional(),
        rest_seconds: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
        superset_group: z.string().nullable().optional(),
        target_weight_kg: z.number().min(0).max(1000).nullable().optional(),
        entered_weight_value: z.number().min(0).max(2000).nullable().optional(),
        entered_weight_unit: z.enum(['kg', 'lbs']).nullable().optional(),
        load_directive: z.enum(['absolute', 'assisted', 'bodyweight', 'open']).default('open'),
        special_instructions: z.string().max(500).nullable().optional(),
      });
      
      const data = exerciseSchema.parse(req.body);
      
      const exercise = await routineData.createRoutineVersionExercise({
        routine_version_id: data.version_id,
        exercise_id: data.exercise_id || null,
        custom_exercise_name: data.custom_exercise_name || null,
        day_number: data.day_number,
        order_in_day: data.order_in_day,
        sets: data.sets,
        reps_min: data.reps_min ?? null,
        reps_max: data.reps_max ?? null,
        rest_seconds: data.rest_seconds ?? null,
        notes: data.notes ?? null,
        superset_group: data.superset_group ?? null,
        target_weight_kg: data.target_weight_kg ?? null,
        entered_weight_value: data.entered_weight_value ?? null,
        entered_weight_unit: data.entered_weight_unit ?? null,
        load_directive: data.load_directive,
        special_instructions: data.special_instructions ?? null,
      });
      
      res.status(201).json(exercise);
    } catch (error) {
      console.error("Create routine exercise error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to create routine exercise" });
    }
  });

  app.put("/api/admin/routines/:routineId/exercises/:exerciseId", requireAdmin, async (req, res) => {
    try {
      const { exerciseId } = req.params;
      const updateSchema = z.object({
        exercise_id: z.string().nullable().optional(),
        custom_exercise_name: z.string().nullable().optional(),
        day_number: z.number().min(1).optional(),
        order_in_day: z.number().min(1).optional(),
        sets: z.number().min(1).optional(),
        reps_min: z.number().nullable().optional(),
        reps_max: z.number().nullable().optional(),
        rest_seconds: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
        superset_group: z.string().nullable().optional(),
      });
      
      const data = updateSchema.parse(req.body);
      const exercise = await routineData.updateRoutineVersionExercise(exerciseId, data);
      res.json(exercise);
    } catch (error) {
      console.error("Update routine exercise error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to update routine exercise" });
    }
  });

  app.delete("/api/admin/routines/:routineId/exercises/:exerciseId", requireAdmin, async (req, res) => {
    try {
      const { exerciseId } = req.params;
      await routineData.deleteRoutineVersionExercise(exerciseId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete routine exercise error:", error);
      res.status(500).json({ error: "Failed to delete routine exercise" });
    }
  });

  // =============================================================================
  // ADMIN ROUTINE VERSION ROUTES
  // =============================================================================

  app.post("/api/admin/routines/:id/versions", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const versionSchema = z.object({
        notes: z.string().nullable().optional(),
      });
      
      const data = versionSchema.parse(req.body);
      
      const existingVersions = await routineData.getRoutineVersions(id);
      const newVersionNumber = existingVersions.length > 0 ? existingVersions[0].version_number + 1 : 1;
      
      const version = await routineData.createRoutineVersion({
        blueprint_id: id,
        version_number: newVersionNumber,
        status: 'draft',
        notes: data.notes || null,
        published_at: null,
      });
      
      res.status(201).json(version);
    } catch (error) {
      console.error("Create routine version error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to create routine version" });
    }
  });

  app.put("/api/admin/routines/:routineId/versions/:versionId", requireAdmin, async (req, res) => {
    try {
      const { versionId } = req.params;
      const updateSchema = z.object({
        status: z.enum(['draft', 'pending_review']).optional(),
        notes: z.string().nullable().optional(),
      });
      
      const data = updateSchema.parse(req.body);
      const version = await routineData.updateRoutineVersion(versionId, data);
      res.json(version);
    } catch (error) {
      console.error("Update routine version error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to update routine version" });
    }
  });

  // DELETE /api/admin/routines/:id - Archive blueprint (soft delete)
  app.delete("/api/admin/routines/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const blueprint = await routineData.deleteRoutineBlueprint(id);
      res.json(blueprint);
    } catch (error) {
      console.error("Delete routine error:", error);
      res.status(500).json({ error: "Failed to archive routine" });
    }
  });

  // POST /api/admin/routines/:id/clone - Clone blueprint
  app.post("/api/admin/routines/:id/clone", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await routineData.cloneRoutineBlueprint(id);
      res.status(201).json(result);
    } catch (error) {
      console.error("Clone routine error:", error);
      if (error instanceof Error && error.message === 'Source blueprint not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to clone routine" });
    }
  });

  // GET /api/admin/routines/:id/versions - List all versions
  app.get("/api/admin/routines/:id/versions", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const versions = await routineData.getRoutineVersions(id);
      res.json(versions);
    } catch (error) {
      console.error("Get routine versions error:", error);
      res.status(500).json({ error: "Failed to get routine versions" });
    }
  });

  // DELETE /api/admin/routines/versions/:versionId - Delete draft version
  app.delete("/api/admin/routines/versions/:versionId", requireAdmin, async (req, res) => {
    try {
      const { versionId } = req.params;
      await routineData.deleteRoutineVersion(versionId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete routine version error:", error);
      if (error instanceof Error) {
        if (error.message === 'Version not found') {
          return res.status(404).json({ error: error.message });
        }
        if (error.message === 'Cannot delete active version') {
          return res.status(409).json({ error: error.message });
        }
      }
      res.status(500).json({ error: "Failed to delete routine version" });
    }
  });

  // POST /api/admin/routines/versions/:versionId/activate - Activate version
  app.post("/api/admin/routines/versions/:versionId/activate", requireAdmin, async (req, res) => {
    try {
      const { versionId } = req.params;
      const version = await routineData.activateRoutineVersion(versionId);
      res.json(version);
    } catch (error) {
      console.error("Activate routine version error:", error);
      if (error instanceof Error && error.message === 'Version not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to activate routine version" });
    }
  });

  // GET /api/admin/routines/versions/:versionId/exercises - Get version exercises
  app.get("/api/admin/routines/versions/:versionId/exercises", requireAdmin, async (req, res) => {
    try {
      const { versionId } = req.params;
      const exercises = await routineData.getRoutineVersionExercises(versionId);
      res.json(exercises);
    } catch (error) {
      console.error("Get version exercises error:", error);
      res.status(500).json({ error: "Failed to get version exercises" });
    }
  });

  // PUT /api/admin/routines/versions/:versionId/exercises - Batch replace exercises
  app.put("/api/admin/routines/versions/:versionId/exercises", requireAdmin, async (req, res) => {
    try {
      const { versionId } = req.params;
      const exercisesSchema = z.array(z.object({
        exercise_id: z.string().uuid().nullable().optional(),
        custom_exercise_name: z.string().nullable().optional(),
        day_number: z.number().int().min(1),
        order_in_day: z.number().int().min(1),
        sets: z.number().int().min(1).max(20),
        reps_min: z.number().int().min(1).max(100).nullable().optional(),
        reps_max: z.number().int().min(1).max(100).nullable().optional(),
        rest_seconds: z.number().int().min(0).max(600).nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
        superset_group: z.string().max(50).nullable().optional(),
        target_weight_kg: z.number().min(0).max(1000).nullable().optional(),
        entered_weight_value: z.number().min(0).max(2000).nullable().optional(),
        entered_weight_unit: z.enum(['kg', 'lbs']).nullable().optional(),
        load_directive: z.enum(['absolute', 'assisted', 'bodyweight', 'open']).default('open'),
        special_instructions: z.string().max(500).nullable().optional(),
      }));

      const exercises = exercisesSchema.parse(req.body);
      const normalizedExercises = exercises.map(ex => ({
        exercise_id: ex.exercise_id ?? null,
        custom_exercise_name: ex.custom_exercise_name ?? null,
        day_number: ex.day_number,
        order_in_day: ex.order_in_day,
        sets: ex.sets,
        reps_min: ex.reps_min ?? null,
        reps_max: ex.reps_max ?? null,
        rest_seconds: ex.rest_seconds ?? null,
        notes: ex.notes ?? null,
        superset_group: ex.superset_group ?? null,
        target_weight_kg: ex.target_weight_kg ?? null,
        entered_weight_value: ex.entered_weight_value ?? null,
        entered_weight_unit: ex.entered_weight_unit ?? null,
        load_directive: ex.load_directive,
        special_instructions: ex.special_instructions ?? null,
      }));
      const result = await routineData.setVersionExercises(versionId, normalizedExercises);
      res.json(result);
    } catch (error) {
      console.error("Set version exercises error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to set version exercises" });
    }
  });

  // POST /api/admin/routines/ai-generate - AI-assisted routine generation
  app.post("/api/admin/routines/ai-generate", requireAdmin, async (req, res) => {
    try {
      const aiGenerateSchema = z.object({
        prompt_text: z.string().min(10).max(1000),
        equipment_selected: z.array(z.string()),
        goal_type_id: z.string().uuid().nullable().optional(),
        sessions_per_week: z.number().int().min(1).max(7).default(3),
        duration_weeks: z.number().int().min(1).max(12).default(4),
      });

      const data = aiGenerateSchema.parse(req.body);

      // Get goal details for the prompt
      const goals = await routineData.getGoalTypes();
      const goal = data.goal_type_id ? goals.find(g => g.id === data.goal_type_id) : null;
      const goalName = goal?.name || 'General Fitness';

      // Get equipment names
      const allEquipment = await routineData.getEquipmentOptions();
      const selectedEquipmentNames = data.equipment_selected.map(id => {
        const eq = allEquipment.find(e => e.id === id || e.name === id);
        return eq?.name || id;
      });

      // Build AI prompt
      const systemPrompt = `You are a certified personal trainer creating workout routines.
Generate a structured workout routine based on the user's requirements.
Use only exercises that can be performed with the specified equipment.

Output format: JSON with the following structure:
{
  "name": "Routine name",
  "description": "Brief description",
  "sessions_per_week": 3,
  "duration_weeks": 4,
  "days": [
    {
      "day_number": 1,
      "focus": "Upper Body Push",
      "exercises": [
        {
          "exercise_name": "Bench Press",
          "sets": 4,
          "reps_min": 8,
          "reps_max": 12,
          "rest_seconds": 90,
          "notes": "Focus on controlled eccentric"
        }
      ]
    }
  ]
}

IMPORTANT: Respond ONLY with the JSON object, no additional text.`;

      const userPrompt = `Create a workout routine with these specifications:
- Goal: ${goalName}
- Equipment available: ${selectedEquipmentNames.join(', ')}
- Sessions per week: ${data.sessions_per_week}
- Duration: ${data.duration_weeks} weeks
- Additional notes: ${data.prompt_text}`;

      // Call OpenAI
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      console.log("AI Generate - Sending prompt to OpenAI:", { goalName, equipment: selectedEquipmentNames, sessions: data.sessions_per_week, duration: data.duration_weeks });
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 4000,
      });

      const aiResponseText = completion.choices[0]?.message?.content || '';
      console.log("AI Generate - Received response:", aiResponseText.substring(0, 500));
      
      // Parse AI response
      let aiRoutine;
      try {
        aiRoutine = JSON.parse(aiResponseText);
      } catch (parseError) {
        console.error("Failed to parse AI response:", aiResponseText);
        return res.status(500).json({ error: 'AI generated invalid response format' });
      }

      // Get exercise library for matching
      const exerciseLib = await routineData.getExercises({ limit: 500, offset: 0 });
      const exercises = exerciseLib.exercises;

      // Create blueprint
      const blueprint = await routineData.createRoutineBlueprint({
        name: aiRoutine.name || 'AI Generated Routine',
        description: aiRoutine.description || null,
        owner_type: 'platform',
        creation_method: 'ai_assisted',
        goal_type_id: data.goal_type_id,
        equipment_profile: data.equipment_selected,
        duration_weeks: aiRoutine.duration_weeks || data.duration_weeks,
        sessions_per_week: aiRoutine.sessions_per_week || data.sessions_per_week,
        ai_prompt: data.prompt_text,
        ai_response: aiRoutine,
        is_template: true,
      });

      // Create version
      const version = await routineData.createRoutineVersion({
        blueprint_id: blueprint.id,
        version_number: 1,
        status: 'draft',
        notes: 'AI-generated initial version',
        published_at: null,
      });

      // Map AI exercises to exercise library
      const versionExercises: any[] = [];
      const warnings: string[] = [];

      for (const day of aiRoutine.days || []) {
        for (const [index, aiEx] of (day.exercises || []).entries()) {
          // Find matching exercise in library
          const match = exercises.find(e => 
            e.name.toLowerCase() === aiEx.exercise_name.toLowerCase() ||
            e.name.toLowerCase().includes(aiEx.exercise_name.toLowerCase()) ||
            aiEx.exercise_name.toLowerCase().includes(e.name.toLowerCase())
          );

          if (match) {
            versionExercises.push({
              exercise_id: match.id,
              custom_exercise_name: null,
              day_number: day.day_number,
              order_in_day: index + 1,
              sets: aiEx.sets || 3,
              reps_min: aiEx.reps_min || null,
              reps_max: aiEx.reps_max || null,
              rest_seconds: aiEx.rest_seconds || null,
              notes: aiEx.notes || null,
              superset_group: null,
            });
          } else {
            warnings.push(`Unknown exercise: ${aiEx.exercise_name}`);
            versionExercises.push({
              exercise_id: null,
              custom_exercise_name: aiEx.exercise_name,
              day_number: day.day_number,
              order_in_day: index + 1,
              sets: aiEx.sets || 3,
              reps_min: aiEx.reps_min || null,
              reps_max: aiEx.reps_max || null,
              rest_seconds: aiEx.rest_seconds || null,
              notes: aiEx.notes || null,
              superset_group: null,
            });
          }
        }
      }

      if (versionExercises.length > 0) {
        await routineData.setVersionExercises(version.id, versionExercises);
      }

      res.status(201).json({
        blueprint,
        version,
        warnings,
      });
    } catch (error) {
      console.error("AI generate routine error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to generate routine with AI" });
    }
  });

  // =============================================================================
  // ROUTINE ASSIGNMENT ROUTES
  // =============================================================================

  // GET /api/admin/assignments - List all assignments
  app.get("/api/admin/assignments", requireAdmin, async (req, res) => {
    try {
      const { client_id, assigned_by, status } = req.query;
      const assignments = await routineData.getRoutineAssignments({
        clientId: client_id as string | undefined,
        assignedByProId: assigned_by as string | undefined,
        status: status as 'active' | 'paused' | 'completed' | 'cancelled' | undefined,
      });
      res.json(assignments);
    } catch (error) {
      console.error("Get assignments error:", error);
      res.status(500).json({ error: "Failed to get assignments" });
    }
  });

  // GET /api/admin/assignments/:id - Get assignment with sessions
  app.get("/api/admin/assignments/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const assignmentWithSessions = await routineData.getAssignmentWithSessions(id);
      if (!assignmentWithSessions) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(assignmentWithSessions);
    } catch (error) {
      console.error("Get assignment error:", error);
      res.status(500).json({ error: "Failed to get assignment" });
    }
  });

  // POST /api/admin/assignments - Create new assignment
  app.post("/api/admin/assignments", requireAdmin, async (req, res) => {
    try {
      const createAssignmentSchema = z.object({
        routine_version_id: z.string().uuid(),
        client_id: z.string().uuid(),
        assigned_by_pro_id: z.string().uuid().nullable().optional(),
        status: z.enum(['active', 'paused', 'completed', 'cancelled']).default('active'),
        start_date: z.string().nullable().optional(),
        end_date: z.string().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      });

      const data = createAssignmentSchema.parse(req.body);
      const assignment = await routineData.createRoutineAssignment({
        routine_version_id: data.routine_version_id,
        client_id: data.client_id,
        assigned_by_pro_id: data.assigned_by_pro_id ?? null,
        status: data.status,
        start_date: data.start_date ?? null,
        end_date: data.end_date ?? null,
        notes: data.notes ?? null,
      });
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Create assignment error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create assignment" });
    }
  });

  // PUT /api/admin/assignments/:id - Update assignment
  app.put("/api/admin/assignments/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateAssignmentSchema = z.object({
        status: z.enum(['active', 'paused', 'completed', 'cancelled']).optional(),
        start_date: z.string().nullable().optional(),
        end_date: z.string().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      });

      const updates = updateAssignmentSchema.parse(req.body);
      const assignment = await routineData.updateRoutineAssignment(id, updates);
      res.json(assignment);
    } catch (error) {
      console.error("Update assignment error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update assignment" });
    }
  });

  // DELETE /api/admin/assignments/:id - Delete assignment
  app.delete("/api/admin/assignments/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await routineData.deleteRoutineAssignment(id);
      res.json({ message: "Assignment deleted successfully" });
    } catch (error) {
      console.error("Delete assignment error:", error);
      res.status(500).json({ error: "Failed to delete assignment" });
    }
  });

  // GET /api/admin/assignments/:id/sessions - Get derived sessions for an assignment
  app.get("/api/admin/assignments/:id/sessions", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const assignmentWithSessions = await routineData.getAssignmentWithSessions(id);
      if (!assignmentWithSessions) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(assignmentWithSessions.sessions);
    } catch (error) {
      console.error("Get assignment sessions error:", error);
      res.status(500).json({ error: "Failed to get assignment sessions" });
    }
  });

  // =============================================================================
  // ADMIN PERMISSION AUDIT LOG ROUTES (Phase 4.0)
  // =============================================================================

  // GET /api/admin/audit-log - Get permission audit log with filters
  app.get("/api/admin/audit-log", requireAdmin, async (req, res) => {
    try {
      const { 
        limit = '50', 
        offset = '0', 
        actor_type, 
        event_type, 
        client_id, 
        permission_slug,
        start_date,
        end_date 
      } = req.query;

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('get_audit_log', {
        p_limit: parseInt(limit as string),
        p_offset: parseInt(offset as string),
        p_actor_type: actor_type as string || null,
        p_event_type: event_type as string || null,
        p_client_id: client_id as string || null,
        p_permission_slug: permission_slug as string || null,
        p_start_date: start_date as string || null,
        p_end_date: end_date as string || null,
      });

      if (error) {
        console.error("Get audit log error:", error);
        return res.status(500).json({ error: "Failed to fetch audit log" });
      }

      res.json(data || []);
    } catch (error) {
      console.error("Get audit log error:", error);
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  // GET /api/admin/audit-log/count - Get total count for pagination
  app.get("/api/admin/audit-log/count", requireAdmin, async (req, res) => {
    try {
      const { 
        actor_type, 
        event_type, 
        client_id, 
        permission_slug,
        start_date,
        end_date 
      } = req.query;

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('count_audit_log', {
        p_actor_type: actor_type as string || null,
        p_event_type: event_type as string || null,
        p_client_id: client_id as string || null,
        p_permission_slug: permission_slug as string || null,
        p_start_date: start_date as string || null,
        p_end_date: end_date as string || null,
      });

      if (error) {
        console.error("Count audit log error:", error);
        return res.status(500).json({ error: "Failed to count audit log" });
      }

      res.json({ count: data || 0 });
    } catch (error) {
      console.error("Count audit log error:", error);
      res.status(500).json({ error: "Failed to count audit log" });
    }
  });

  // GET /api/admin/permission-definitions - Get all permission definitions for filter dropdown
  app.get("/api/admin/permission-definitions", requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.supabaseAdmin
        .from('permission_definitions')
        .select('slug, display_name, category, is_exclusive, is_enabled')
        .order('category')
        .order('display_name');

      if (error) {
        console.error("Get permission definitions error:", error);
        return res.status(500).json({ error: "Failed to fetch permission definitions" });
      }

      res.json(data || []);
    } catch (error) {
      console.error("Get permission definitions error:", error);
      res.status(500).json({ error: "Failed to fetch permission definitions" });
    }
  });

  // GET /api/admin/permissions/definitions - List all definitions with usage stats
  app.get("/api/admin/permissions/definitions", requireAdmin, async (req, res) => {
    try {
      // Get permission definitions
      const { data: definitions, error: defError } = await supabaseAdmin.supabaseAdmin
        .from('permission_definitions')
        .select('*')
        .order('category')
        .order('sort_order');

      if (defError) {
        console.error("Get permission definitions error:", defError);
        return res.status(500).json({ error: "Failed to fetch permission definitions" });
      }

      // Get usage stats for each permission
      const { data: stats, error: statsError } = await supabaseAdmin.supabaseAdmin
        .from('client_permissions')
        .select('permission_slug')
        .eq('status', 'granted');

      if (statsError) {
        console.error("Get permission stats error:", statsError);
        return res.status(500).json({ error: "Failed to fetch permission stats" });
      }

      // Calculate grant counts per permission
      const grantCounts: Record<string, number> = {};
      (stats || []).forEach(s => {
        grantCounts[s.permission_slug] = (grantCounts[s.permission_slug] || 0) + 1;
      });

      // Merge stats into definitions
      const definitionsWithStats = (definitions || []).map(def => ({
        ...def,
        grant_count: grantCounts[def.slug] || 0
      }));

      res.json(definitionsWithStats);
    } catch (error) {
      console.error("Get permission definitions with stats error:", error);
      res.status(500).json({ error: "Failed to fetch permission definitions" });
    }
  });

  // PATCH /api/admin/permissions/definitions/:slug - Update permission settings
  app.patch("/api/admin/permissions/definitions/:slug", requireAdmin, async (req, res) => {
    try {
      const { slug } = req.params;
      
      // Base schema for non-exclusivity updates
      const baseUpdateSchema = z.object({
        is_enabled: z.boolean().optional(),
        is_exclusive: z.boolean().optional(),
        requires_verification: z.boolean().optional(),
        description: z.string().optional(),
        reason: z.string().transform(s => s?.trim()).optional()
      });

      const parsed = baseUpdateSchema.parse(req.body);

      // If toggling exclusivity, require admin session and reason
      if (parsed.is_exclusive !== undefined) {
        const adminId = req.session?.adminId;
        
        if (!adminId) {
          return res.status(401).json({ error: "Admin session required for exclusivity changes" });
        }
        
        if (!parsed.reason || parsed.reason.length < 10) {
          return res.status(400).json({ error: "Reason is required (at least 10 characters) when toggling exclusivity" });
        }

        const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('toggle_permission_exclusivity', {
          p_permission_slug: slug,
          p_new_is_exclusive: parsed.is_exclusive,
          p_admin_id: adminId,
          p_reason: parsed.reason
        });

        if (error) {
          console.error("Toggle exclusivity error:", error);
          return res.status(500).json({ error: "Failed to toggle exclusivity" });
        }

        // Check for RPC-level failures (e.g., conflicts, service_role denied)
        if (data && !data.success) {
          // Map specific error types to appropriate HTTP status codes
          if (data.error?.includes('Access denied')) {
            return res.status(403).json({ error: data.error, details: data });
          }
          return res.status(400).json({ error: data.error, details: data });
        }
      }

      // Build updates for direct database update (excluding is_exclusive which was handled by RPC)
      const directUpdates: Record<string, unknown> = {};
      if (parsed.is_enabled !== undefined) directUpdates.is_enabled = parsed.is_enabled;
      if (parsed.requires_verification !== undefined) directUpdates.requires_verification = parsed.requires_verification;
      if (parsed.description !== undefined) directUpdates.description = parsed.description;

      // Apply remaining updates if any
      if (Object.keys(directUpdates).length > 0) {
        const { error } = await supabaseAdmin.supabaseAdmin
          .from('permission_definitions')
          .update(directUpdates)
          .eq('slug', slug);

        if (error) {
          console.error("Update permission definition error:", error);
          return res.status(500).json({ error: "Failed to update permission definition" });
        }
      }

      // Fetch updated definition
      const { data: updated, error: fetchError } = await supabaseAdmin.supabaseAdmin
        .from('permission_definitions')
        .select('*')
        .eq('slug', slug)
        .single();

      if (fetchError) {
        console.error("Fetch updated definition error:", fetchError);
        return res.status(500).json({ error: "Failed to fetch updated definition" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Update permission definition error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update permission definition" });
    }
  });

  // GET /api/admin/permissions/stats - Permission grant counts and active relationships
  app.get("/api/admin/permissions/stats", requireAdmin, async (req, res) => {
    try {
      // Get total grant counts by permission
      const { data: grantsByPermission, error: grantsError } = await supabaseAdmin.supabaseAdmin
        .from('client_permissions')
        .select('permission_slug, status')
        .eq('status', 'granted');

      if (grantsError) {
        console.error("Get grants error:", grantsError);
        return res.status(500).json({ error: "Failed to fetch grant stats" });
      }

      // Get active relationships count
      const { data: relationships, error: relError } = await supabaseAdmin.supabaseAdmin
        .from('professional_client_relationships')
        .select('id, status')
        .eq('status', 'active');

      if (relError) {
        console.error("Get relationships error:", relError);
        return res.status(500).json({ error: "Failed to fetch relationship stats" });
      }

      // Calculate stats
      const permissionCounts: Record<string, number> = {};
      (grantsByPermission || []).forEach(g => {
        permissionCounts[g.permission_slug] = (permissionCounts[g.permission_slug] || 0) + 1;
      });

      res.json({
        total_grants: (grantsByPermission || []).length,
        active_relationships: (relationships || []).length,
        grants_by_permission: permissionCounts
      });
    } catch (error) {
      console.error("Get permission stats error:", error);
      res.status(500).json({ error: "Failed to fetch permission stats" });
    }
  });

  // GET /api/admin/permissions/exclusivity-conflicts/:slug - Check for exclusivity conflicts
  app.get("/api/admin/permissions/exclusivity-conflicts/:slug", requireAdmin, async (req, res) => {
    try {
      const { slug } = req.params;

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('check_exclusivity_conflicts', {
        p_permission_slug: slug
      });

      if (error) {
        console.error("Check exclusivity conflicts error:", error);
        return res.status(500).json({ error: "Failed to check exclusivity conflicts" });
      }

      res.json({
        permission_slug: slug,
        has_conflicts: (data || []).length > 0,
        conflict_count: (data || []).length,
        conflicts: data || []
      });
    } catch (error) {
      console.error("Check exclusivity conflicts error:", error);
      res.status(500).json({ error: "Failed to check exclusivity conflicts" });
    }
  });

  // POST /api/admin/permissions/definitions/:slug/toggle-exclusivity - Toggle exclusivity with admin reason
  app.post("/api/admin/permissions/definitions/:slug/toggle-exclusivity", requireAdmin, async (req, res) => {
    try {
      const { slug } = req.params;
      const toggleSchema = z.object({
        is_exclusive: z.boolean(),
        reason: z.string().transform(s => s.trim()).refine(s => s.length >= 10, {
          message: "Reason must be at least 10 characters"
        })
      });

      const { is_exclusive, reason } = toggleSchema.parse(req.body);
      const adminId = req.session?.adminId;

      if (!adminId) {
        return res.status(401).json({ error: "Admin session required for exclusivity changes" });
      }

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('toggle_permission_exclusivity', {
        p_permission_slug: slug,
        p_new_is_exclusive: is_exclusive,
        p_admin_id: adminId,
        p_reason: reason
      });

      if (error) {
        console.error("Toggle exclusivity error:", error);
        return res.status(500).json({ error: "Failed to toggle exclusivity" });
      }

      // Check for RPC-level failures (e.g., conflicts, service_role denied)
      if (data && !data.success) {
        // Map specific error types to appropriate HTTP status codes
        if (data.error?.includes('Access denied')) {
          return res.status(403).json({ 
            error: data.error,
            details: data 
          });
        }
        return res.status(400).json({
          error: data.error,
          conflict_count: data.conflict_count,
          action_required: data.action_required
        });
      }

      res.json(data);
    } catch (error) {
      console.error("Toggle exclusivity error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to toggle exclusivity" });
    }
  });

  // =============================================================================
  // PHASE 4.3: PROFESSIONAL VERIFICATION ROUTES
  // =============================================================================

  // POST /api/professionals/verification/request - Professional submits verification request
  app.post("/api/professionals/verification/request", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const { document_ids } = req.body;

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('submit_verification_request', {
        p_document_ids: document_ids || null
      });

      if (error) {
        console.error("Submit verification error:", error);
        return res.status(500).json({ error: "Failed to submit verification request" });
      }

      if (!data.success) {
        return res.status(400).json({ error: data.error });
      }

      res.json(data);
    } catch (error) {
      console.error("Submit verification error:", error);
      res.status(500).json({ error: "Failed to submit verification request" });
    }
  });

  // GET /api/professionals/verification/status - Get current verification status
  app.get("/api/professionals/verification/status", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;

      const { data, error } = await supabaseAdmin.supabaseAdmin
        .from('professional_profiles')
        .select('verification_status, verification_submitted_at, verification_reviewed_at, verification_notes')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: "Professional profile not found" });
        }
        console.error("Get verification status error:", error);
        return res.status(500).json({ error: "Failed to get verification status" });
      }

      res.json(data);
    } catch (error) {
      console.error("Get verification status error:", error);
      res.status(500).json({ error: "Failed to get verification status" });
    }
  });

  // GET /api/professionals/verification/documents - Get professional's verification documents
  app.get("/api/professionals/verification/documents", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;

      const { data, error } = await supabaseAdmin.supabaseAdmin
        .from('verification_documents')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error("Get verification documents error:", error);
        return res.status(500).json({ error: "Failed to get verification documents" });
      }

      res.json(data || []);
    } catch (error) {
      console.error("Get verification documents error:", error);
      res.status(500).json({ error: "Failed to get verification documents" });
    }
  });

  // POST /api/professionals/verification/documents - Upload verification document metadata
  app.post("/api/professionals/verification/documents", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      
      const documentSchema = z.object({
        document_type: z.enum(['certification', 'license', 'id_verification', 'other']),
        file_path: z.string(),
        file_name: z.string(),
        file_size_bytes: z.number().optional(),
        mime_type: z.string().optional()
      });

      const documentData = documentSchema.parse(req.body);

      const { data, error } = await supabaseAdmin.supabaseAdmin
        .from('verification_documents')
        .insert({
          user_id: userId,
          ...documentData
        })
        .select()
        .single();

      if (error) {
        console.error("Create verification document error:", error);
        return res.status(500).json({ error: "Failed to create verification document" });
      }

      res.json(data);
    } catch (error) {
      console.error("Create verification document error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create verification document" });
    }
  });

  // DELETE /api/professionals/verification/documents/:id - Delete verification document
  app.delete("/api/professionals/verification/documents/:id", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const { id } = req.params;

      // Verify ownership before deleting
      const { data: existing } = await supabaseAdmin.supabaseAdmin
        .from('verification_documents')
        .select('user_id')
        .eq('id', id)
        .single();

      if (!existing || existing.user_id !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { error } = await supabaseAdmin.supabaseAdmin
        .from('verification_documents')
        .delete()
        .eq('id', id);

      if (error) {
        console.error("Delete verification document error:", error);
        return res.status(500).json({ error: "Failed to delete verification document" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete verification document error:", error);
      res.status(500).json({ error: "Failed to delete verification document" });
    }
  });

  // =============================================================================
  // ADMIN VERIFICATION ROUTES (Phase 4.3)
  // =============================================================================

  // GET /api/admin/verification/requests - List pending verification requests
  app.get("/api/admin/verification/requests", requireAdmin, async (req, res) => {
    try {
      const { status = 'pending', limit = 50, offset = 0 } = req.query;

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('list_pending_verifications', {
        p_status: status as string,
        p_limit: Number(limit),
        p_offset: Number(offset)
      });

      if (error) {
        console.error("List pending verifications error:", error);
        return res.status(500).json({ error: "Failed to list verification requests" });
      }

      res.json(data || []);
    } catch (error) {
      console.error("List pending verifications error:", error);
      res.status(500).json({ error: "Failed to list verification requests" });
    }
  });

  // GET /api/admin/verification/requests/count - Get count for pagination
  app.get("/api/admin/verification/requests/count", requireAdmin, async (req, res) => {
    try {
      const { status = 'pending' } = req.query;

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('count_pending_verifications', {
        p_status: status as string
      });

      if (error) {
        console.error("Count pending verifications error:", error);
        return res.status(500).json({ error: "Failed to count verification requests" });
      }

      res.json({ count: data || 0 });
    } catch (error) {
      console.error("Count pending verifications error:", error);
      res.status(500).json({ error: "Failed to count verification requests" });
    }
  });

  // GET /api/admin/verification/requests/:userId - Get verification details for a professional
  app.get("/api/admin/verification/requests/:userId", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('get_verification_details', {
        p_user_id: userId
      });

      if (error) {
        console.error("Get verification details error:", error);
        return res.status(500).json({ error: "Failed to get verification details" });
      }

      if (!data || data.length === 0) {
        return res.status(404).json({ error: "Professional not found" });
      }

      res.json(data[0]);
    } catch (error) {
      console.error("Get verification details error:", error);
      res.status(500).json({ error: "Failed to get verification details" });
    }
  });

  // POST /api/admin/verification/documents/:docId/signed-url - Generate signed URL for document
  app.post("/api/admin/verification/documents/:docId/signed-url", requireAdmin, async (req, res) => {
    try {
      const { docId } = req.params;

      // Get document details
      const { data: doc, error: docError } = await supabaseAdmin.supabaseAdmin
        .from('verification_documents')
        .select('file_path, file_name')
        .eq('id', docId)
        .single();

      if (docError || !doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Generate signed URL (60 minutes expiry)
      const { data, error } = await supabaseAdmin.supabaseAdmin.storage
        .from('verification-documents')
        .createSignedUrl(doc.file_path, 3600); // 60 minutes

      if (error) {
        console.error("Generate signed URL error:", error);
        return res.status(500).json({ error: "Failed to generate signed URL" });
      }

      res.json({ 
        signedUrl: data.signedUrl,
        fileName: doc.file_name,
        expiresIn: 3600
      });
    } catch (error) {
      console.error("Generate signed URL error:", error);
      res.status(500).json({ error: "Failed to generate signed URL" });
    }
  });

  // PATCH /api/admin/verification/requests/:userId - Review verification request
  app.patch("/api/admin/verification/requests/:userId", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const adminId = req.session?.adminId;

      const reviewSchema = z.object({
        decision: z.enum(['verified', 'rejected']),
        reason: z.string().transform(s => s.trim()).refine(s => s.length >= 10, {
          message: "Reason must be at least 10 characters"
        })
      });

      const { decision, reason } = reviewSchema.parse(req.body);

      if (!adminId) {
        return res.status(401).json({ error: "Admin session required" });
      }

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('review_verification_request', {
        p_user_id: userId,
        p_decision: decision,
        p_admin_id: adminId,
        p_reason: reason
      });

      if (error) {
        console.error("Review verification error:", error);
        return res.status(500).json({ error: "Failed to review verification request" });
      }

      if (!data.success) {
        return res.status(400).json({ error: data.error });
      }

      res.json(data);
    } catch (error) {
      console.error("Review verification error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to review verification request" });
    }
  });

  // =============================================================================
  // PHASE 4.4: PERMISSION PRESETS ROUTES
  // =============================================================================

  // GET /api/admin/permission-presets - List all permission presets
  app.get("/api/admin/permission-presets", requireAdmin, async (req, res) => {
    try {
      const { limit = 50, offset = 0, include_inactive = 'false' } = req.query;

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('list_permission_presets', {
        p_limit: Number(limit),
        p_offset: Number(offset),
        p_include_inactive: include_inactive === 'true'
      });

      if (error) {
        console.error("List permission presets error:", error);
        return res.status(500).json({ error: "Failed to list permission presets" });
      }

      res.json(data || []);
    } catch (error) {
      console.error("List permission presets error:", error);
      res.status(500).json({ error: "Failed to list permission presets" });
    }
  });

  // POST /api/admin/permission-presets - Create or update a permission preset
  app.post("/api/admin/permission-presets", requireAdmin, async (req, res) => {
    try {
      const adminId = req.session?.adminId;

      const presetSchema = z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        is_system: z.boolean().optional().default(false),
        permissions: z.array(z.object({
          slug: z.string(),
          is_enabled: z.boolean().optional().default(true)
        })),
        reason: z.string().transform(s => s.trim()).refine(s => s.length >= 10, {
          message: "Reason must be at least 10 characters"
        })
      });

      const { id, name, description, is_system, permissions, reason } = presetSchema.parse(req.body);

      if (!adminId) {
        return res.status(401).json({ error: "Admin session required" });
      }

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('upsert_permission_preset', {
        p_preset_id: id || null,
        p_name: name,
        p_description: description || null,
        p_is_system: is_system,
        p_permissions: JSON.stringify(permissions),
        p_admin_id: adminId,
        p_reason: reason
      });

      if (error) {
        console.error("Upsert permission preset error:", error);
        return res.status(500).json({ error: "Failed to save permission preset" });
      }

      if (!data.success) {
        return res.status(400).json({ error: data.error });
      }

      res.json(data);
    } catch (error) {
      console.error("Upsert permission preset error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save permission preset" });
    }
  });

  // DELETE /api/admin/permission-presets/:id - Delete (deactivate) a permission preset
  app.delete("/api/admin/permission-presets/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = req.session?.adminId;

      const deleteSchema = z.object({
        reason: z.string().transform(s => s.trim()).refine(s => s.length >= 10, {
          message: "Reason must be at least 10 characters"
        })
      });

      const { reason } = deleteSchema.parse(req.body);

      if (!adminId) {
        return res.status(401).json({ error: "Admin session required" });
      }

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('delete_permission_preset', {
        p_preset_id: id,
        p_admin_id: adminId,
        p_reason: reason
      });

      if (error) {
        console.error("Delete permission preset error:", error);
        return res.status(500).json({ error: "Failed to delete permission preset" });
      }

      if (!data.success) {
        return res.status(400).json({ error: data.error });
      }

      res.json(data);
    } catch (error) {
      console.error("Delete permission preset error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to delete permission preset" });
    }
  });

  // POST /api/admin/permission-presets/:id/apply - Apply a preset to a relationship
  app.post("/api/admin/permission-presets/:id/apply", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = req.session?.adminId;

      const applySchema = z.object({
        relationship_id: z.string().uuid(),
        reason: z.string().transform(s => s.trim()).refine(s => s.length >= 10, {
          message: "Reason must be at least 10 characters"
        })
      });

      const { relationship_id, reason } = applySchema.parse(req.body);

      if (!adminId) {
        return res.status(401).json({ error: "Admin session required" });
      }

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('apply_permission_preset', {
        p_relationship_id: relationship_id,
        p_preset_id: id,
        p_admin_id: adminId,
        p_reason: reason
      });

      if (error) {
        console.error("Apply permission preset error:", error);
        return res.status(500).json({ error: "Failed to apply permission preset" });
      }

      if (!data.success) {
        return res.status(400).json({ error: data.error });
      }

      res.json(data);
    } catch (error) {
      console.error("Apply permission preset error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to apply permission preset" });
    }
  });

  // =============================================================================
  // PHASE 4.5: ADMIN DASHBOARD ROUTES
  // =============================================================================

  // GET /api/admin/dashboard/kpis - Get admin dashboard KPIs
  app.get("/api/admin/dashboard/kpis", requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('get_admin_kpis');

      if (error) {
        console.error("Get admin KPIs error:", error);
        return res.status(500).json({ error: "Failed to get dashboard KPIs" });
      }

      res.json(data);
    } catch (error) {
      console.error("Get admin KPIs error:", error);
      res.status(500).json({ error: "Failed to get dashboard KPIs" });
    }
  });

  // GET /api/admin/dashboard/activity - Get permission activity feed
  app.get("/api/admin/dashboard/activity", requireAdmin, async (req, res) => {
    try {
      const { limit = 20, offset = 0 } = req.query;

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('get_permission_activity_feed', {
        p_limit: Number(limit),
        p_offset: Number(offset)
      });

      if (error) {
        console.error("Get activity feed error:", error);
        return res.status(500).json({ error: "Failed to get activity feed" });
      }

      res.json(data || []);
    } catch (error) {
      console.error("Get activity feed error:", error);
      res.status(500).json({ error: "Failed to get activity feed" });
    }
  });

  // GET /api/admin/dashboard/trends - Get permission trends for charts
  app.get("/api/admin/dashboard/trends", requireAdmin, async (req, res) => {
    try {
      const { interval = 'day', lookback = 30 } = req.query;

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('get_permission_trends', {
        p_interval: interval as string,
        p_lookback: Number(lookback)
      });

      if (error) {
        console.error("Get permission trends error:", error);
        return res.status(500).json({ error: "Failed to get permission trends" });
      }

      res.json(data || []);
    } catch (error) {
      console.error("Get permission trends error:", error);
      res.status(500).json({ error: "Failed to get permission trends" });
    }
  });

  // =============================================================================
  // PHASE 4.6: FORCE-CONNECTION ROUTES
  // =============================================================================

  // POST /api/admin/force-connect - Force create a professional-client connection
  app.post("/api/admin/force-connect", requireAdmin, async (req, res) => {
    try {
      const adminId = req.session?.adminId;

      const connectSchema = z.object({
        client_id: z.string().uuid(),
        professional_id: z.string().uuid(),
        preset_id: z.string().uuid().optional(),
        reason: z.string().transform(s => s.trim()).refine(s => s.length >= 10, {
          message: "Reason must be at least 10 characters"
        })
      });

      const { client_id, professional_id, preset_id, reason } = connectSchema.parse(req.body);

      if (!adminId) {
        return res.status(401).json({ error: "Admin session required" });
      }

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('force_connect', {
        p_client_id: client_id,
        p_professional_id: professional_id,
        p_admin_id: adminId,
        p_reason: reason,
        p_preset_id: preset_id || null,
        p_permissions: null
      });

      if (error) {
        console.error("Force connect error:", error);
        return res.status(500).json({ error: "Failed to force connect" });
      }

      if (!data.success) {
        return res.status(400).json({ error: data.error });
      }

      res.json(data);
    } catch (error) {
      console.error("Force connect error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to force connect" });
    }
  });

  // POST /api/admin/force-disconnect - Force terminate a relationship
  app.post("/api/admin/force-disconnect", requireAdmin, async (req, res) => {
    try {
      const adminId = req.session?.adminId;

      const disconnectSchema = z.object({
        relationship_id: z.string().uuid(),
        reason: z.string().transform(s => s.trim()).refine(s => s.length >= 10, {
          message: "Reason must be at least 10 characters"
        })
      });

      const { relationship_id, reason } = disconnectSchema.parse(req.body);

      if (!adminId) {
        return res.status(401).json({ error: "Admin session required" });
      }

      const { data, error } = await supabaseAdmin.supabaseAdmin.rpc('force_disconnect', {
        p_relationship_id: relationship_id,
        p_admin_id: adminId,
        p_reason: reason
      });

      if (error) {
        console.error("Force disconnect error:", error);
        return res.status(500).json({ error: "Failed to force disconnect" });
      }

      if (!data.success) {
        return res.status(400).json({ error: data.error });
      }

      res.json(data);
    } catch (error) {
      console.error("Force disconnect error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to force disconnect" });
    }
  });

  // GET /api/admin/relationships - List all relationships for force-connection management
  app.get("/api/admin/relationships", requireAdmin, async (req, res) => {
    try {
      const { limit = 50, offset = 0, status = 'active' } = req.query;

      const { data, error } = await supabaseAdmin.supabaseAdmin
        .from('professional_client_relationships')
        .select(`
          id,
          client_id,
          professional_id,
          status,
          forced_by_admin,
          forced_reason,
          forced_at,
          created_at,
          client:profiles!professional_client_relationships_client_id_fkey(id, full_name, email),
          professional:profiles!professional_client_relationships_professional_id_fkey(id, full_name, email)
        `)
        .eq('status', status as string)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (error) {
        console.error("List relationships error:", error);
        return res.status(500).json({ error: "Failed to list relationships" });
      }

      res.json(data || []);
    } catch (error) {
      console.error("List relationships error:", error);
      res.status(500).json({ error: "Failed to list relationships" });
    }
  });

  // GET /api/admin/users/clients - List clients for force-connection picker
  app.get("/api/admin/users/clients", requireAdmin, async (req, res) => {
    try {
      const { search = '', limit = 50 } = req.query;

      let query = supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('id, full_name, display_name, email')
        .eq('role', 'user')
        .order('full_name', { ascending: true })
        .limit(Number(limit));

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("List clients error:", error);
        return res.status(500).json({ error: "Failed to list clients" });
      }

      res.json(data || []);
    } catch (error) {
      console.error("List clients error:", error);
      res.status(500).json({ error: "Failed to list clients" });
    }
  });

  // GET /api/admin/users/professionals - List professionals for force-connection picker
  app.get("/api/admin/users/professionals", requireAdmin, async (req, res) => {
    try {
      const { search = '', limit = 50 } = req.query;

      let query = supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('id, full_name, display_name, email')
        .eq('role', 'professional')
        .order('full_name', { ascending: true })
        .limit(Number(limit));

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("List professionals error:", error);
        return res.status(500).json({ error: "Failed to list professionals" });
      }

      res.json(data || []);
    } catch (error) {
      console.error("List professionals error:", error);
      res.status(500).json({ error: "Failed to list professionals" });
    }
  });

  // GET /api/client/assignments - Get client's assignments with sessions
  app.get("/api/client/assignments", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const clientId = req.supabaseUser!.id;
      const assignments = await routineData.getClientAssignmentsWithSessions(clientId);
      res.json(assignments);
    } catch (error) {
      console.error("Get client assignments error:", error);
      res.status(500).json({ error: "Failed to get client assignments" });
    }
  });

  // GET /api/client/assignments/:id - Get specific assignment with sessions
  app.get("/api/client/assignments/:id", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const clientId = req.supabaseUser!.id;
      
      const assignmentWithSessions = await routineData.getAssignmentWithSessions(id);
      if (!assignmentWithSessions) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      
      // Verify the client owns this assignment
      if (assignmentWithSessions.assignment.client_id !== clientId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(assignmentWithSessions);
    } catch (error) {
      console.error("Get client assignment error:", error);
      res.status(500).json({ error: "Failed to get client assignment" });
    }
  });

  // PUT /api/client/assignments/:id/status - Update assignment status (client can pause/resume)
  app.put("/api/client/assignments/:id/status", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const clientId = req.supabaseUser!.id;
      
      const updateStatusSchema = z.object({
        status: z.enum(['active', 'paused']), // Clients can only active/pause, not complete/cancel
      });
      
      const { status } = updateStatusSchema.parse(req.body);
      
      // Verify client owns the assignment
      const existing = await routineData.getRoutineAssignmentById(id);
      if (!existing) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      if (existing.client_id !== clientId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const assignment = await routineData.updateRoutineAssignment(id, { status });
      res.json(assignment);
    } catch (error) {
      console.error("Update assignment status error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update assignment status" });
    }
  });

  // GET /api/client/programmes - Get client's pending and active programmes (Phase 5A)
  app.get("/api/client/programmes", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const clientId = req.supabaseUser!.id;
      const assignments = await routineData.getClientAssignments(clientId);
      res.json(assignments);
    } catch (error) {
      console.error("Get client programmes error:", error);
      res.status(500).json({ error: "Failed to get programmes" });
    }
  });

  // POST /api/client/programmes/:id/accept - Accept a pending programme (Phase 5A)
  app.post("/api/client/programmes/:id/accept", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const clientId = req.supabaseUser!.id;
      
      const result = await routineData.acceptAssignment(id, clientId);
      res.json(result);
    } catch (error: any) {
      console.error("Accept programme error:", error);
      if (error.message === 'Assignment not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Not authorized to accept this assignment') {
        return res.status(403).json({ error: error.message });
      }
      if (error.message === 'Assignment is not pending acceptance') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to accept programme" });
    }
  });

  // POST /api/client/programmes/:id/reject - Reject a pending programme (Phase 5A)
  app.post("/api/client/programmes/:id/reject", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const clientId = req.supabaseUser!.id;
      
      const rejectSchema = z.object({
        reason: z.string().optional(),
      });
      
      const { reason } = rejectSchema.parse(req.body || {});
      
      const assignment = await routineData.rejectAssignment(id, clientId, reason);
      res.json(assignment);
    } catch (error: any) {
      console.error("Reject programme error:", error);
      if (error.message === 'Assignment not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Not authorized to reject this assignment') {
        return res.status(403).json({ error: error.message });
      }
      if (error.message === 'Assignment is not pending acceptance') {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to reject programme" });
    }
  });

  // POST /api/client/programmes/:id/accept-update - Accept a pending programme update (Phase 5C)
  app.post("/api/client/programmes/:id/accept-update", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const clientId = req.supabaseUser!.id;
      
      const result = await routineData.acceptProgrammeUpdate(id, clientId);
      res.json({ ...result, message: "Update accepted" });
    } catch (error: any) {
      console.error("Accept programme update error:", error);
      if (error.message === 'Assignment not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Not authorized to accept this update') {
        return res.status(403).json({ error: error.message });
      }
      if (error.message === 'No pending update to accept') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to accept programme update" });
    }
  });

  // POST /api/client/programmes/:id/decline-update - Decline a pending programme update (Phase 5C)
  app.post("/api/client/programmes/:id/decline-update", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const clientId = req.supabaseUser!.id;
      
      const assignment = await routineData.declineProgrammeUpdate(id, clientId);
      res.json({ assignment, message: "Update declined, keeping current version" });
    } catch (error: any) {
      console.error("Decline programme update error:", error);
      if (error.message === 'Assignment not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Not authorized to decline this update') {
        return res.status(403).json({ error: error.message });
      }
      if (error.message === 'No pending update to decline') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to decline programme update" });
    }
  });

  // GET /api/client/tier - Get client's tier info for entitlements (Phase 5A)
  app.get("/api/client/tier", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const clientId = req.supabaseUser!.id;
      const tier = await routineData.getClientTier(clientId);
      const professional = tier === 'pro_connected' ? await routineData.getClientProfessional(clientId) : null;
      
      res.json({
        tier,
        professional,
        entitlements: {
          can_use_ai_programmes: tier === 'normal',
          ai_programmes_per_month: tier === 'normal' ? 1 : 0,
          can_receive_pro_assignments: tier === 'pro_connected',
        }
      });
    } catch (error) {
      console.error("Get client tier error:", error);
      res.status(500).json({ error: "Failed to get tier info" });
    }
  });

  // GET /api/client/my-pro - Get client's connected professional overview (Phase 5B)
  app.get("/api/client/my-pro", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const clientId = req.supabaseUser!.id;
      const tier = await routineData.getClientTier(clientId);
      
      if (tier !== 'pro_connected') {
        return res.json({ professional: null, relationshipSince: null, activeProgrammeCount: 0 });
      }
      
      const proInfo = await routineData.getClientProfessional(clientId);
      if (!proInfo) {
        return res.json({ professional: null, relationshipSince: null, activeProgrammeCount: 0 });
      }
      
      const assignments = await routineData.getClientAssignments(clientId);
      const activeProgrammeCount = assignments.active.length;
      
      res.json({
        professional: proInfo.professional,
        relationshipSince: proInfo.relationship_since,
        activeProgrammeCount,
      });
    } catch (error) {
      console.error("Get my-pro error:", error);
      res.status(500).json({ error: "Failed to get professional info" });
    }
  });

  // =============================================================================
  // PROFESSIONAL PORTAL ROUTES
  // =============================================================================

  interface ProfessionalRequest extends AuthenticatedRequest {
    professionalId?: string;
  }

  // Professional auth middleware - validates Supabase auth + professional profile + portal context
  const requireProfessional = async (req: ProfessionalRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const token = authHeader.split(' ')[1];
    const user = await validateSupabaseToken(token);
    
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.supabaseUser = user;

    // Enforce portal context - must be in pro mode
    const portalHeader = req.headers['x-portal-context'];
    if (portalHeader !== 'pro') {
      return res.status(403).json({ error: "Pro portal context required" });
    }

    const context = portalContext.extractPortalContext(req);
    if (!context || context.mode !== 'pro') {
      return res.status(403).json({ error: "Invalid portal context" });
    }

    // Verify the portal context belongs to the authenticated user
    const isOwner = await portalContext.verifyProfileOwnership(user.id, context.mode, context.profileId);
    if (!isOwner) {
      return res.status(403).json({ error: "Portal context does not belong to authenticated user" });
    }

    // Store portal context on request
    req.portalContext = {
      mode: context.mode,
      profileId: context.profileId,
    };

    // Check professional profile exists and is not suspended/rejected
    const proProfile = await routineData.getProfessionalProfile(user.id);
    if (!proProfile) {
      return res.status(403).json({ error: "Professional profile required" });
    }

    if (proProfile.verification_status === 'rejected') {
      return res.status(403).json({ error: "Professional account suspended" });
    }

    req.professionalId = user.id;
    next();
  };

  // GET /api/pro/routines - List professional's routines + system templates
  app.get("/api/pro/routines", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const includeTemplates = req.query.includeTemplates !== 'false';
      const includeArchived = req.query.includeArchived === 'true';

      const routines = await routineData.getProfessionalRoutines(req.professionalId!, {
        includeTemplates,
        includeArchived,
      });

      res.json(routines);
    } catch (error) {
      console.error("Get pro routines error:", error);
      res.status(500).json({ error: "Failed to get routines" });
    }
  });

  // GET /api/pro/routines/review-queue - Get routines pending review (draft/pending_review)
  // NOTE: Must come BEFORE /api/pro/routines/:id to avoid "review-queue" being parsed as UUID
  app.get("/api/pro/routines/review-queue", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const reviewQueue = await routineData.getProReviewQueue(req.professionalId!);
      res.json(reviewQueue);
    } catch (error) {
      console.error("Get pro review queue error:", error);
      res.status(500).json({ error: "Failed to get review queue" });
    }
  });

  // GET /api/pro/routines/:id - Get specific routine with details
  app.get("/api/pro/routines/:id", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      const routine = await routineData.getRoutineBlueprintById(id);
      
      if (!routine) {
        return res.status(404).json({ error: "Routine not found" });
      }

      // Check access: own routine or system template
      if (routine.owner_id !== req.professionalId && routine.owner_type !== 'platform') {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get versions and active/draft version exercises
      const versions = await routineData.getRoutineVersions(id);
      // Prefer active version, fallback to draft (AI-generated routines start as draft)
      const activeVersion = versions.find(v => v.status === 'active') 
        || versions.find(v => v.status === 'draft');
      
      let exercises: any[] = [];
      if (activeVersion) {
        exercises = await routineData.getRoutineVersionExercises(activeVersion.id);
      }

      res.json({
        routine,
        versions,
        activeVersion,
        exercises,
      });
    } catch (error) {
      console.error("Get pro routine error:", error);
      res.status(500).json({ error: "Failed to get routine" });
    }
  });

  // POST /api/pro/routines - Create new routine
  app.post("/api/pro/routines", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const createSchema = z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        goal_type_id: z.string().uuid().optional(),
        equipment_profile: z.array(z.string()).optional(),
        duration_weeks: z.number().int().min(1).max(52).optional(),
        sessions_per_week: z.number().int().min(1).max(7).optional(),
        creation_method: z.enum(['manual', 'template', 'ai_assisted']).default('manual'),
      });

      const data = createSchema.parse(req.body);
      const result = await routineData.createRoutineForPro(req.professionalId!, data);

      res.status(201).json(result);
    } catch (error) {
      console.error("Create pro routine error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create routine" });
    }
  });

  // POST /api/pro/routines/:id/clone - Clone a routine
  app.post("/api/pro/routines/:id/clone", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      const cloneSchema = z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
      });

      const overrides = cloneSchema.parse(req.body);
      const result = await routineData.cloneRoutineForPro(req.professionalId!, id, overrides);

      res.status(201).json(result);
    } catch (error) {
      console.error("Clone pro routine error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error instanceof Error && error.message === 'Source routine not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to clone routine" });
    }
  });

  // POST /api/pro/routines/ai-generate - AI-assisted routine generation for pros
  app.post("/api/pro/routines/ai-generate", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const aiGenerateSchema = z.object({
        prompt_text: z.string().min(10).max(1000),
        equipment_selected: z.array(z.string()),
        goal_type_id: z.string().uuid().nullable().optional(),
        sessions_per_week: z.number().int().min(1).max(7).default(3),
        duration_weeks: z.number().int().min(1).max(12).default(4),
      });

      const data = aiGenerateSchema.parse(req.body);

      const quotaResult = await assertQuota(req.professionalId!, 'ai_workout_builder');
      
      if (!quotaResult.success) {
        return res.status(403).json({
          error: 'Quota exceeded',
          feature: 'ai_workout_builder',
          message: quotaResult.error || 'Monthly AI workout generation limit reached',
          quota: {
            currentCount: quotaResult.currentCount,
            limit: quotaResult.limit,
            remaining: quotaResult.remaining,
          },
        });
      }

      const goals = await routineData.getGoalTypes();
      const goal = data.goal_type_id ? goals.find(g => g.id === data.goal_type_id) : null;
      const goalName = goal?.name || 'General Fitness';

      const allEquipment = await routineData.getEquipmentOptions();
      const selectedEquipmentNames = data.equipment_selected.map(id => {
        const eq = allEquipment.find(e => e.id === id || e.name === id);
        return eq?.name || id;
      });

      const systemPrompt = `You are a certified personal trainer creating workout routines.
Generate a structured workout routine based on the user's requirements.
Use only exercises that can be performed with the specified equipment.

Output format: JSON with the following structure:
{
  "name": "Routine name",
  "description": "Brief description",
  "sessions_per_week": 3,
  "duration_weeks": 4,
  "days": [
    {
      "day_number": 1,
      "focus": "Upper Body Push",
      "exercises": [
        {
          "exercise_name": "Bench Press",
          "sets": 4,
          "reps_min": 8,
          "reps_max": 12,
          "rest_seconds": 90,
          "notes": "Focus on controlled eccentric"
        }
      ]
    }
  ]
}

IMPORTANT: Respond ONLY with the JSON object, no additional text.`;

      const userPrompt = `Create a workout routine with these specifications:
- Goal: ${goalName}
- Equipment available: ${selectedEquipmentNames.join(', ')}
- Sessions per week: ${data.sessions_per_week}
- Duration: ${data.duration_weeks} weeks
- Additional notes: ${data.prompt_text}`;

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      console.log("Pro AI Generate - Sending prompt to OpenAI:", { 
        professionalId: req.professionalId,
        goalName, 
        equipment: selectedEquipmentNames, 
        sessions: data.sessions_per_week, 
        duration: data.duration_weeks 
      });
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 4000,
      });

      const aiResponseText = completion.choices[0]?.message?.content || '';
      console.log("Pro AI Generate - Received response:", aiResponseText.substring(0, 500));
      
      let aiRoutine;
      try {
        aiRoutine = JSON.parse(aiResponseText);
      } catch (parseError) {
        console.error("Failed to parse AI response:", aiResponseText);
        return res.status(500).json({ error: 'AI generated invalid response format' });
      }

      const exerciseLib = await routineData.getExercises({ limit: 500, offset: 0 });
      const exercises = exerciseLib.exercises;

      const blueprint = await routineData.createRoutineBlueprint({
        name: aiRoutine.name || 'AI Generated Routine',
        description: aiRoutine.description || null,
        owner_type: 'professional',
        owner_id: req.professionalId,
        creation_method: 'ai_assisted',
        goal_type_id: data.goal_type_id,
        equipment_profile: data.equipment_selected,
        duration_weeks: aiRoutine.duration_weeks || data.duration_weeks,
        sessions_per_week: aiRoutine.sessions_per_week || data.sessions_per_week,
        ai_prompt: data.prompt_text,
        ai_response: aiRoutine,
        is_template: false,
      });

      const version = await routineData.createRoutineVersion({
        blueprint_id: blueprint.id,
        version_number: 1,
        status: 'draft',
        notes: 'AI-generated initial version',
        published_at: null,
      });

      const versionExercises: any[] = [];
      const warnings: string[] = [];

      for (const day of aiRoutine.days || []) {
        for (const [index, aiEx] of (day.exercises || []).entries()) {
          const match = exercises.find(e => 
            e.name.toLowerCase() === aiEx.exercise_name.toLowerCase() ||
            e.name.toLowerCase().includes(aiEx.exercise_name.toLowerCase()) ||
            aiEx.exercise_name.toLowerCase().includes(e.name.toLowerCase())
          );

          if (match) {
            versionExercises.push({
              exercise_id: match.id,
              custom_exercise_name: null,
              day_number: day.day_number,
              order_in_day: index + 1,
              sets: aiEx.sets || 3,
              reps_min: aiEx.reps_min || null,
              reps_max: aiEx.reps_max || null,
              rest_seconds: aiEx.rest_seconds || null,
              notes: aiEx.notes || null,
              superset_group: null,
              load_directive: 'open',
            });
          } else {
            warnings.push(`Unknown exercise: ${aiEx.exercise_name}`);
            versionExercises.push({
              exercise_id: null,
              custom_exercise_name: aiEx.exercise_name,
              day_number: day.day_number,
              order_in_day: index + 1,
              sets: aiEx.sets || 3,
              reps_min: aiEx.reps_min || null,
              reps_max: aiEx.reps_max || null,
              rest_seconds: aiEx.rest_seconds || null,
              notes: aiEx.notes || null,
              superset_group: null,
              load_directive: 'open',
            });
          }
        }
      }

      if (versionExercises.length > 0) {
        await routineData.setVersionExercises(version.id, versionExercises);
      }

      const createdExercises = await routineData.getRoutineVersionExercises(version.id);

      await setActiveAiProgram(req.professionalId!, blueprint.id);

      res.status(201).json({
        blueprint,
        version,
        exercises: createdExercises,
        ai_response: aiRoutine,
        warnings,
        quota: {
          currentCount: quotaResult.currentCount,
          limit: quotaResult.limit,
          remaining: quotaResult.remaining,
        },
      });
    } catch (error) {
      console.error("Pro AI generate routine error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to generate AI routine" });
    }
  });

  // PUT /api/pro/routines/:id - Update routine (ownership check)
  app.put("/api/pro/routines/:id", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      
      // Verify ownership
      const routine = await routineData.getRoutineBlueprintById(id);
      if (!routine) {
        return res.status(404).json({ error: "Routine not found" });
      }
      if (routine.owner_id !== req.professionalId) {
        return res.status(403).json({ error: "Can only update your own routines" });
      }

      const updateSchema = z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        goal_type_id: z.string().uuid().optional(),
        equipment_profile: z.array(z.string()).optional(),
        duration_weeks: z.number().int().min(1).max(52).optional(),
        sessions_per_week: z.number().int().min(1).max(7).optional(),
        is_archived: z.boolean().optional(),
      });

      const updates = updateSchema.parse(req.body);
      const updated = await routineData.updateRoutineBlueprint(id, updates);

      res.json(updated);
    } catch (error) {
      console.error("Update pro routine error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update routine" });
    }
  });

  // DELETE /api/pro/routines/:id - Archive routine (soft delete)
  app.delete("/api/pro/routines/:id", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      
      // Verify ownership
      const routine = await routineData.getRoutineBlueprintById(id);
      if (!routine) {
        return res.status(404).json({ error: "Routine not found" });
      }
      if (routine.owner_id !== req.professionalId) {
        return res.status(403).json({ error: "Can only archive your own routines" });
      }

      await routineData.updateRoutineBlueprint(id, { is_archived: true });

      res.json({ message: "Routine archived" });
    } catch (error) {
      console.error("Archive pro routine error:", error);
      res.status(500).json({ error: "Failed to archive routine" });
    }
  });

  // POST /api/pro/routines/:id/exercises - Add exercise to routine
  app.post("/api/pro/routines/:id/exercises", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      
      // Verify ownership
      const routine = await routineData.getRoutineBlueprintById(id);
      if (!routine) {
        return res.status(404).json({ error: "Routine not found" });
      }
      if (routine.owner_id !== req.professionalId && routine.owner_type !== 'platform') {
        return res.status(403).json({ error: "Cannot modify this routine" });
      }

      // Get active version
      const versions = await routineData.getRoutineVersions(id);
      const activeVersion = versions.find(v => v.status === 'active' || v.status === 'draft');
      if (!activeVersion) {
        return res.status(400).json({ error: "No active version found" });
      }

      const exerciseSchema = z.object({
        exercise_id: z.string().uuid().nullable().optional(),
        custom_exercise_name: z.string().max(200).nullable().optional(),
        day_number: z.number().int().min(1).max(7),
        order_in_day: z.number().int().min(1).max(50),
        sets: z.number().int().min(1).max(20).default(3),
        reps_min: z.number().int().min(1).max(100).nullable().optional(),
        reps_max: z.number().int().min(1).max(100).nullable().optional(),
        rest_seconds: z.number().int().min(0).max(600).nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
        superset_group: z.string().max(50).nullable().optional(),
        target_weight_kg: z.number().min(0).max(1000).nullable().optional(),
        entered_weight_value: z.number().min(0).max(2000).nullable().optional(),
        entered_weight_unit: z.enum(['kg', 'lbs']).nullable().optional(),
        load_directive: z.enum(['absolute', 'assisted', 'bodyweight', 'open']).default('open'),
        special_instructions: z.string().max(500).nullable().optional(),
      });

      const data = exerciseSchema.parse(req.body);
      
      const exercise = await routineData.createRoutineVersionExercise({
        routine_version_id: activeVersion.id,
        exercise_id: data.exercise_id || null,
        custom_exercise_name: data.custom_exercise_name || null,
        day_number: data.day_number,
        order_in_day: data.order_in_day,
        sets: data.sets,
        reps_min: data.reps_min ?? null,
        reps_max: data.reps_max ?? null,
        rest_seconds: data.rest_seconds ?? null,
        notes: data.notes ?? null,
        superset_group: data.superset_group ?? null,
        target_weight_kg: data.target_weight_kg ?? null,
        entered_weight_value: data.entered_weight_value ?? null,
        entered_weight_unit: data.entered_weight_unit ?? null,
        load_directive: data.load_directive,
        special_instructions: data.special_instructions ?? null,
      });

      res.status(201).json(exercise);
    } catch (error) {
      console.error("Add pro routine exercise error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to add exercise" });
    }
  });

  // PUT /api/pro/routines/:id/exercises/:exerciseId - Update exercise
  app.put("/api/pro/routines/:id/exercises/:exerciseId", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id, exerciseId } = req.params;
      
      // Verify ownership
      const routine = await routineData.getRoutineBlueprintById(id);
      if (!routine) {
        return res.status(404).json({ error: "Routine not found" });
      }
      if (routine.owner_id !== req.professionalId && routine.owner_type !== 'platform') {
        return res.status(403).json({ error: "Cannot modify this routine" });
      }

      const updateSchema = z.object({
        exercise_id: z.string().uuid().nullable().optional(),
        custom_exercise_name: z.string().max(200).nullable().optional(),
        day_number: z.number().int().min(1).max(7).optional(),
        order_in_day: z.number().int().min(1).max(50).optional(),
        sets: z.number().int().min(1).max(20).optional(),
        reps_min: z.number().int().min(1).max(100).nullable().optional(),
        reps_max: z.number().int().min(1).max(100).nullable().optional(),
        rest_seconds: z.number().int().min(0).max(600).nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
        superset_group: z.string().max(50).nullable().optional(),
        target_weight_kg: z.number().min(0).max(1000).nullable().optional(),
        entered_weight_value: z.number().min(0).max(2000).nullable().optional(),
        entered_weight_unit: z.enum(['kg', 'lbs']).nullable().optional(),
        load_directive: z.enum(['absolute', 'assisted', 'bodyweight', 'open']).optional(),
        special_instructions: z.string().max(500).nullable().optional(),
      });

      const updates = updateSchema.parse(req.body);
      const exercise = await routineData.updateRoutineVersionExercise(exerciseId, updates);

      res.json(exercise);
    } catch (error) {
      console.error("Update pro routine exercise error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update exercise" });
    }
  });

  // DELETE /api/pro/routines/:id/exercises/:exerciseId - Remove exercise
  app.delete("/api/pro/routines/:id/exercises/:exerciseId", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id, exerciseId } = req.params;
      
      // Verify ownership
      const routine = await routineData.getRoutineBlueprintById(id);
      if (!routine) {
        return res.status(404).json({ error: "Routine not found" });
      }
      if (routine.owner_id !== req.professionalId && routine.owner_type !== 'platform') {
        return res.status(403).json({ error: "Cannot modify this routine" });
      }

      await routineData.deleteRoutineVersionExercise(exerciseId);

      res.json({ success: true });
    } catch (error) {
      console.error("Delete pro routine exercise error:", error);
      res.status(500).json({ error: "Failed to delete exercise" });
    }
  });

  // PUT /api/pro/routines/:id/exercises/reorder - Reorder exercises
  app.put("/api/pro/routines/:id/exercises/reorder", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      
      // Verify ownership
      const routine = await routineData.getRoutineBlueprintById(id);
      if (!routine) {
        return res.status(404).json({ error: "Routine not found" });
      }
      if (routine.owner_id !== req.professionalId && routine.owner_type !== 'platform') {
        return res.status(403).json({ error: "Cannot modify this routine" });
      }

      const reorderSchema = z.array(z.object({
        id: z.string().uuid(),
        day_number: z.number().int().min(1).max(7),
        order_in_day: z.number().int().min(1).max(50),
      }));

      const updates = reorderSchema.parse(req.body);
      
      // Update each exercise's position
      for (const update of updates) {
        await routineData.updateRoutineVersionExercise(update.id, {
          day_number: update.day_number,
          order_in_day: update.order_in_day,
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Reorder pro routine exercises error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to reorder exercises" });
    }
  });

  // POST /api/pro/routines/:id/approve - Approve a routine version (draft -> active)
  app.post("/api/pro/routines/:id/approve", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      
      // Verify ownership
      const routine = await routineData.getRoutineBlueprintById(id);
      if (!routine) {
        return res.status(404).json({ error: "Routine not found" });
      }
      if (routine.owner_id !== req.professionalId) {
        return res.status(403).json({ error: "Can only approve your own routines" });
      }

      // Get latest version
      const versions = await routineData.getRoutineVersions(id);
      const latestVersion = versions[0];
      if (!latestVersion) {
        return res.status(400).json({ error: "No version found to approve" });
      }
      if (latestVersion.status === 'active') {
        return res.json({ version: latestVersion, message: "Already active" });
      }
      if (latestVersion.status === 'archived') {
        return res.status(400).json({ error: "Cannot approve an archived version" });
      }

      const approveSchema = z.object({
        notes: z.string().max(500).optional(),
      });

      const data = approveSchema.parse(req.body || {});
      
      const approvedVersion = await routineData.approveRoutineVersion(latestVersion.id, data.notes);

      res.json({ version: approvedVersion, message: "Routine approved and activated" });
    } catch (error) {
      console.error("Approve routine error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to approve routine" });
    }
  });

  // GET /api/pro/assignments/:id/history - Get assignment event history
  app.get("/api/pro/assignments/:id/history", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      
      // Verify access - must be the pro who created the assignment
      const assignment = await routineData.getRoutineAssignmentById(id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      if (assignment.assigned_by_pro_id !== req.professionalId) {
        return res.status(403).json({ error: "Can only view history of your own assignments" });
      }

      const history = await routineData.getAssignmentEvents(id);
      res.json(history);
    } catch (error) {
      console.error("Get assignment history error:", error);
      res.status(500).json({ error: "Failed to get assignment history" });
    }
  });

  // GET /api/pro/clients/:clientId/history - Get full assignment history timeline for a client
  app.get("/api/pro/clients/:clientId/history", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { clientId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      
      // Verify relationship
      const hasRelationship = await routineData.verifyProClientRelationship(req.professionalId!, clientId);
      if (!hasRelationship) {
        return res.status(403).json({ error: "Not connected to this client" });
      }

      const history = await routineData.getClientAssignmentHistory(clientId, limit);
      res.json(history);
    } catch (error) {
      console.error("Get client history error:", error);
      res.status(500).json({ error: "Failed to get client history" });
    }
  });

  // GET /api/pro/clients - List professional's connected clients
  app.get("/api/pro/clients", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const clients = await routineData.getProClients(req.professionalId!);
      res.json(clients);
    } catch (error) {
      console.error("Get pro clients error:", error);
      res.status(500).json({ error: "Failed to get clients" });
    }
  });

  // POST /api/pro/routines/:id/assign - Assign routine to client
  app.post("/api/pro/routines/:id/assign", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      const assignSchema = z.object({
        client_id: z.string().uuid(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        notes: z.string().max(500).optional(),
      });

      const data = assignSchema.parse(req.body);
      
      const assignment = await routineData.assignRoutineToClient(
        req.professionalId!,
        id,
        data.client_id,
        {
          start_date: data.start_date,
          end_date: data.end_date,
          notes: data.notes,
        }
      );

      res.status(201).json(assignment);
    } catch (error) {
      console.error("Assign routine error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error instanceof Error) {
        if (error.message.includes('relationship')) {
          return res.status(403).json({ error: error.message });
        }
        if (error.message.includes('active version')) {
          return res.status(400).json({ error: error.message });
        }
      }
      res.status(500).json({ error: "Failed to assign routine" });
    }
  });

  // GET /api/pro/assignments - List professional's assignments
  app.get("/api/pro/assignments", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { client_id, status } = req.query;
      
      const assignments = await routineData.getProAssignments(req.professionalId!, {
        clientId: client_id as string | undefined,
        status: status as 'active' | 'paused' | 'completed' | 'cancelled' | undefined,
      });

      res.json(assignments);
    } catch (error) {
      console.error("Get pro assignments error:", error);
      res.status(500).json({ error: "Failed to get assignments" });
    }
  });

  // GET /api/pro/expired-updates - Get recent expired update notifications for pro
  app.get("/api/pro/expired-updates", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const expiredUpdates = await routineData.getProExpiredUpdates(req.professionalId!);
      res.json(expiredUpdates);
    } catch (error) {
      console.error("Get expired updates error:", error);
      res.status(500).json({ error: "Failed to get expired updates" });
    }
  });

  // GET /api/pro/clients/:clientId/assignments - Get assignments for specific client
  app.get("/api/pro/clients/:clientId/assignments", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { clientId } = req.params;
      
      // Verify relationship
      const hasRelationship = await routineData.verifyProClientRelationship(req.professionalId!, clientId);
      if (!hasRelationship) {
        return res.status(403).json({ error: "Not connected to this client" });
      }

      const assignments = await routineData.getProAssignments(req.professionalId!, {
        clientId,
      });

      res.json(assignments);
    } catch (error) {
      console.error("Get client assignments error:", error);
      res.status(500).json({ error: "Failed to get client assignments" });
    }
  });

  // GET /api/pro/clients/:clientId/nutrition/today - Get today's nutrition summary for a client
  app.get("/api/pro/clients/:clientId/nutrition/today", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { clientId } = req.params;
      
      // Verify relationship
      const hasRelationship = await routineData.verifyProClientRelationship(req.professionalId!, clientId);
      if (!hasRelationship) {
        return res.status(403).json({ error: "Not connected to this client" });
      }

      // Get today's date range
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabaseAdmin.supabaseAdmin
        .from("food_logs")
        .select("calories, protein, carbs, fat")
        .eq("user_id", clientId)
        .gte("logged_at", startOfDay.toISOString())
        .lte("logged_at", endOfDay.toISOString());

      if (error) throw error;

      type NutritionLog = { calories: number | null; protein: number | null; carbs: number | null; fat: number | null };
      type NutritionTotals = { calories: number; protein: number; carbs: number; fat: number; count: number };
      const totals = ((data || []) as NutritionLog[]).reduce<NutritionTotals>(
        (acc, log) => ({
          calories: acc.calories + (log.calories || 0),
          protein: acc.protein + (log.protein || 0),
          carbs: acc.carbs + (log.carbs || 0),
          fat: acc.fat + (log.fat || 0),
          count: acc.count + 1,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 }
      );

      res.json(totals);
    } catch (error) {
      console.error("Get client nutrition error:", error);
      res.status(500).json({ error: "Failed to get client nutrition" });
    }
  });

  // GET /api/pro/clients/:clientId/water - Get client's water intake for a specific date
  app.get("/api/pro/clients/:clientId/water", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { clientId } = req.params;
      const professionalId = req.professionalId!;
      const { date } = req.query;

      // Check view_nutrition permission (water is part of nutrition)
      const permissionModule = await import('./supabase-permissions');
      const hasViewPermission = await permissionModule.hasPermission(professionalId, clientId, 'view_nutrition');
      
      if (!hasViewPermission) {
        return res.status(403).json({ error: "You don't have permission to view this client's nutrition data" });
      }

      // Default to today if no date specified
      const targetDate = date ? String(date) : new Date().toISOString().split('T')[0];
      
      const waterData = await import('./supabase-water-data');
      const result = await waterData.getDailyWaterIntake(clientId, targetDate);

      res.json(result);
    } catch (error) {
      console.error("Get client water intake error:", error);
      res.status(500).json({ error: "Failed to get client water intake" });
    }
  });

  // GET /api/pro/clients/:clientId/water/history - Get client's water intake history
  app.get("/api/pro/clients/:clientId/water/history", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { clientId } = req.params;
      const professionalId = req.professionalId!;
      const { start, end, days } = req.query;

      // Check view_nutrition permission (water is part of nutrition)
      const permissionModule = await import('./supabase-permissions');
      const hasViewPermission = await permissionModule.hasPermission(professionalId, clientId, 'view_nutrition');
      
      if (!hasViewPermission) {
        return res.status(403).json({ error: "You don't have permission to view this client's nutrition data" });
      }

      // Calculate date range - default to last 7 days
      const endDate = end ? String(end) : new Date().toISOString().split('T')[0];
      let startDate: string;
      
      if (start) {
        startDate = String(start);
      } else {
        const daysBack = days ? parseInt(String(days), 10) : 7;
        const startDateTime = new Date();
        startDateTime.setDate(startDateTime.getDate() - daysBack + 1);
        startDate = startDateTime.toISOString().split('T')[0];
      }
      
      const waterData = await import('./supabase-water-data');
      const history = await waterData.getWaterHistory(clientId, startDate, endDate);

      res.json(history);
    } catch (error) {
      console.error("Get client water history error:", error);
      res.status(500).json({ error: "Failed to get client water history" });
    }
  });

  // PUT /api/pro/assignments/:id - Update assignment
  app.put("/api/pro/assignments/:id", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      
      // Verify ownership
      const existing = await routineData.getRoutineAssignmentById(id);
      if (!existing) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      if (existing.assigned_by_pro_id !== req.professionalId) {
        return res.status(403).json({ error: "Can only update your own assignments" });
      }

      const updateSchema = z.object({
        status: z.enum(['active', 'paused', 'completed', 'cancelled']).optional(),
        start_date: z.string().nullable().optional(),
        end_date: z.string().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      });

      const updates = updateSchema.parse(req.body);
      const assignment = await routineData.updateRoutineAssignment(id, updates);

      res.json(assignment);
    } catch (error) {
      console.error("Update pro assignment error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update assignment" });
    }
  });

  // POST /api/pro/assignments/:id/push-update - Push a programme update to client (Phase 5C)
  app.post("/api/pro/assignments/:id/push-update", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      
      const pushUpdateSchema = z.object({
        version_id: z.string().uuid(),
        notes: z.string().max(500).optional(),
      });
      
      const { version_id, notes } = pushUpdateSchema.parse(req.body);
      
      const assignment = await routineData.pushProgrammeUpdate(
        id,
        version_id,
        req.professionalId!,
        notes
      );
      
      res.json({ success: true, pending_version_id: assignment.pending_version_id });
    } catch (error: any) {
      console.error("Push programme update error:", error);
      if (error.message === 'Assignment not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Not authorized to update this assignment') {
        return res.status(403).json({ error: error.message });
      }
      if (error.message === 'Can only push updates to active assignments') {
        return res.status(400).json({ error: error.message });
      }
      if (error.message === 'Version not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Version does not belong to the assigned routine') {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to push programme update" });
    }
  });

  // DELETE /api/pro/assignments/:id - Cancel assignment
  app.delete("/api/pro/assignments/:id", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      
      // Verify ownership
      const existing = await routineData.getRoutineAssignmentById(id);
      if (!existing) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      if (existing.assigned_by_pro_id !== req.professionalId) {
        return res.status(403).json({ error: "Can only cancel your own assignments" });
      }

      await routineData.deleteRoutineAssignment(id);

      res.json({ message: "Assignment cancelled" });
    } catch (error) {
      console.error("Cancel pro assignment error:", error);
      res.status(500).json({ error: "Failed to cancel assignment" });
    }
  });

  // =============================================================================
  // CHECK-IN ROUTES - Phase 5.5: Weekly Check-in System
  // =============================================================================

  // ==================== TRAINER CHECK-IN ROUTES ====================

  // GET /api/pro/check-ins/templates - List trainer's templates
  app.get("/api/pro/check-ins/templates", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const templates = await checkinData.getProCheckInTemplates(req.professionalId!);
      
      // For each template, get the active version questions count
      const templatesWithDetails = await Promise.all(
        templates.map(async (template) => {
          let questionsCount = 0;
          if (template.active_version_id) {
            const questions = await checkinData.getVersionQuestions(template.active_version_id);
            questionsCount = questions.length;
          }
          return {
            ...template,
            questions_count: questionsCount,
          };
        })
      );

      res.json(templatesWithDetails);
    } catch (error) {
      console.error("Get check-in templates error:", error);
      res.status(500).json({ error: "Failed to fetch check-in templates" });
    }
  });

  // GET /api/pro/check-ins/templates/:id - Get template with version and questions
  app.get("/api/pro/check-ins/templates/:id", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      const template = await checkinData.getCheckInTemplate(id);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      if (template.professional_id !== req.professionalId) {
        return res.status(403).json({ error: "Not authorized to view this template" });
      }

      const versions = await checkinData.getTemplateVersions(id);
      let activeVersion = null;
      let questions: checkinData.CheckInQuestion[] = [];

      if (template.active_version_id) {
        activeVersion = versions.find(v => v.id === template.active_version_id);
        questions = await checkinData.getVersionQuestions(template.active_version_id);
      } else if (versions.length > 0) {
        // Get draft version if no active
        const draftVersion = versions.find(v => v.status === 'draft');
        if (draftVersion) {
          activeVersion = draftVersion;
          questions = await checkinData.getVersionQuestions(draftVersion.id);
        }
      }

      res.json({
        template,
        versions,
        active_version: activeVersion,
        questions,
      });
    } catch (error) {
      console.error("Get check-in template error:", error);
      res.status(500).json({ error: "Failed to fetch check-in template" });
    }
  });

  // POST /api/pro/check-ins/templates - Create new template
  app.post("/api/pro/check-ins/templates", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        cadence: z.enum(['weekly', 'biweekly']).optional(),
      });

      const parsed = schema.parse(req.body);

      const template = await checkinData.createCheckInTemplate({
        professional_id: req.professionalId!,
        name: parsed.name,
        description: parsed.description,
        cadence: parsed.cadence,
      });

      // Create initial draft version
      const version = await checkinData.createTemplateVersion(template.id);

      res.status(201).json({
        template,
        version,
      });
    } catch (error) {
      console.error("Create check-in template error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create check-in template" });
    }
  });

  // PATCH /api/pro/check-ins/templates/:id - Update template metadata
  app.patch("/api/pro/check-ins/templates/:id", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      
      const template = await checkinData.getCheckInTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      if (template.professional_id !== req.professionalId) {
        return res.status(403).json({ error: "Not authorized to update this template" });
      }

      const schema = z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        cadence: z.enum(['weekly', 'biweekly']).optional(),
        is_archived: z.boolean().optional(),
      });

      const parsed = schema.parse(req.body);
      const updated = await checkinData.updateCheckInTemplate(id, parsed);

      res.json(updated);
    } catch (error) {
      console.error("Update check-in template error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update check-in template" });
    }
  });

  // DELETE /api/pro/check-ins/templates/:id - Archive template
  app.delete("/api/pro/check-ins/templates/:id", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      
      const template = await checkinData.getCheckInTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      if (template.professional_id !== req.professionalId) {
        return res.status(403).json({ error: "Not authorized to delete this template" });
      }

      await checkinData.archiveCheckInTemplate(id);
      res.json({ message: "Template archived" });
    } catch (error) {
      console.error("Archive check-in template error:", error);
      res.status(500).json({ error: "Failed to archive check-in template" });
    }
  });

  // PUT /api/pro/check-ins/templates/:id/questions - Set questions for draft version
  app.put("/api/pro/check-ins/templates/:id/questions", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      
      const template = await checkinData.getCheckInTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      if (template.professional_id !== req.professionalId) {
        return res.status(403).json({ error: "Not authorized to update this template" });
      }

      // Find or create draft version
      const versions = await checkinData.getTemplateVersions(id);
      let draftVersion = versions.find(v => v.status === 'draft');
      
      if (!draftVersion) {
        draftVersion = await checkinData.createTemplateVersion(id);
      }

      const questionSchema = z.object({
        question_text: z.string().min(1).max(500),
        field_type: z.enum(['short_text', 'long_text', 'single_select', 'multi_select', 'scale_1_5', 'boolean']),
        options: z.array(z.string()).optional(),
        is_required: z.boolean().optional(),
        display_order: z.number().int().min(1).max(8),
      });

      const schema = z.array(questionSchema).max(8);
      const parsed = schema.parse(req.body);

      const questions = await checkinData.setVersionQuestions(draftVersion.id, parsed);

      res.json({
        version: draftVersion,
        questions,
      });
    } catch (error) {
      console.error("Set check-in questions error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update questions" });
    }
  });

  // POST /api/pro/check-ins/templates/:id/publish - Publish draft version
  app.post("/api/pro/check-ins/templates/:id/publish", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      
      const template = await checkinData.getCheckInTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      if (template.professional_id !== req.professionalId) {
        return res.status(403).json({ error: "Not authorized to publish this template" });
      }

      // Find draft version
      const versions = await checkinData.getTemplateVersions(id);
      const draftVersion = versions.find(v => v.status === 'draft');
      
      if (!draftVersion) {
        return res.status(400).json({ error: "No draft version to publish" });
      }

      const publishedVersion = await checkinData.publishTemplateVersion(draftVersion.id);
      const questions = await checkinData.getVersionQuestions(publishedVersion.id);

      res.json({
        version: publishedVersion,
        questions,
      });
    } catch (error) {
      console.error("Publish check-in template error:", error);
      res.status(500).json({ error: "Failed to publish template" });
    }
  });

  // GET /api/pro/check-ins/assignments - List trainer's check-in assignments
  app.get("/api/pro/check-ins/assignments", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const assignments = await checkinData.getProCheckInAssignments(req.professionalId!);
      res.json(assignments);
    } catch (error) {
      console.error("Get check-in assignments error:", error);
      res.status(500).json({ error: "Failed to fetch check-in assignments" });
    }
  });

  // POST /api/pro/check-ins/assignments - Assign template to client
  app.post("/api/pro/check-ins/assignments", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const schema = z.object({
        template_id: z.string().uuid(),
        client_id: z.string().uuid(),
        anchor_weekday: z.number().int().min(0).max(6),
        start_date: z.string(),
        cadence: z.enum(['weekly', 'biweekly']).optional(),
      });

      const parsed = schema.parse(req.body);

      // Verify template ownership
      const template = await checkinData.getCheckInTemplate(parsed.template_id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      if (template.professional_id !== req.professionalId) {
        return res.status(403).json({ error: "Not authorized to use this template" });
      }
      if (!template.active_version_id) {
        return res.status(400).json({ error: "Template must be published before assigning" });
      }

      // Verify client relationship
      const hasRelationship = await routineData.verifyProClientRelationship(req.professionalId!, parsed.client_id);
      if (!hasRelationship) {
        return res.status(403).json({ error: "Client is not connected to you" });
      }

      const assignment = await checkinData.createCheckInAssignment({
        template_id: parsed.template_id,
        template_version_id: template.active_version_id,
        client_id: parsed.client_id,
        professional_id: req.professionalId!,
        cadence: parsed.cadence || template.cadence,
        anchor_weekday: parsed.anchor_weekday,
        start_date: parsed.start_date,
      });

      // Schedule first submission
      const firstSubmission = await checkinData.scheduleNextSubmission(assignment);

      res.status(201).json({
        assignment,
        first_submission: firstSubmission,
      });
    } catch (error: any) {
      console.error("Create check-in assignment error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error.message?.includes('already has an active check-in')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to create check-in assignment" });
    }
  });

  // DELETE /api/pro/check-ins/assignments/:id - Deactivate assignment
  app.delete("/api/pro/check-ins/assignments/:id", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      await checkinData.deactivateCheckInAssignment(id);
      res.json({ message: "Check-in assignment deactivated" });
    } catch (error) {
      console.error("Deactivate check-in assignment error:", error);
      res.status(500).json({ error: "Failed to deactivate check-in assignment" });
    }
  });

  // GET /api/pro/check-ins/submissions - List submissions for trainer
  app.get("/api/pro/check-ins/submissions", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { client_id, status, limit } = req.query;
      
      const submissions = await checkinData.getProSubmissions(req.professionalId!, {
        clientId: client_id as string,
        status: status as checkinData.CheckInSubmissionStatus,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      res.json(submissions);
    } catch (error) {
      console.error("Get check-in submissions error:", error);
      res.status(500).json({ error: "Failed to fetch check-in submissions" });
    }
  });

  // GET /api/pro/check-ins/submissions/:id - Get submission detail with answers and analysis
  app.get("/api/pro/check-ins/submissions/:id", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      
      const submission = await checkinData.getProSubmission(id, req.professionalId!);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found or not authorized" });
      }

      const [answers, questions, analysis] = await Promise.all([
        checkinData.getSubmissionAnswers(id),
        checkinData.getVersionQuestions(submission.template_version_id),
        checkinData.getSubmissionAnalysis(id),
      ]);

      res.json({
        submission,
        questions,
        answers,
        analysis,
      });
    } catch (error) {
      console.error("Get check-in submission error:", error);
      res.status(500).json({ error: "Failed to fetch check-in submission" });
    }
  });

  // POST /api/pro/check-ins/submissions/:id/analyze - Trigger AI analysis for submission
  app.post("/api/pro/check-ins/submissions/:id/analyze", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      
      const submission = await checkinData.getProSubmission(id, req.professionalId!);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found or not authorized" });
      }
      if (submission.status !== 'submitted') {
        return res.status(400).json({ error: "Can only analyze submitted check-ins" });
      }

      // Check if analysis already exists and is complete
      const existingAnalysis = await checkinData.getSubmissionAnalysis(id);
      if (existingAnalysis && existingAnalysis.status === 'completed') {
        return res.json(existingAnalysis);
      }

      // Get all data needed for analysis
      const [answers, questions, client] = await Promise.all([
        checkinData.getSubmissionAnswers(id),
        checkinData.getVersionQuestions(submission.template_version_id),
        checkinData.getClientProfile(submission.client_id),
      ]);

      if (!submission.metrics_snapshot) {
        return res.status(400).json({ error: "Submission has no metrics data for analysis" });
      }

      const clientName = client?.display_name || client?.email?.split('@')[0] || 'Client';

      // Create or update analysis record
      let analysisRecord = existingAnalysis;
      if (!analysisRecord) {
        analysisRecord = await checkinData.createAnalysisRequest(id);
      }
      
      await checkinData.updateAnalysis(analysisRecord.id, { status: 'processing' });

      // Prepare input for AI
      const analysisInput: import("./ai-service").CheckInAnalysisInput = {
        clientName,
        weekStart: submission.week_start,
        metrics: submission.metrics_snapshot,
        questions: questions.map((q: checkinData.CheckInQuestion) => {
          const answer = answers.find((a: checkinData.CheckInAnswer) => a.question_id === q.id);
          return {
            question: q.question_text,
            answer: answer?.answer_value || null,
          };
        }),
      };

      // Call AI analysis
      const aiResponse = await aiService.analyzeCheckIn(analysisInput);

      // Save results
      const updatedAnalysis = await checkinData.updateAnalysis(analysisRecord.id, {
        status: 'completed',
        summary: aiResponse.summary,
        risk_score: aiResponse.risk_score,
        flags: aiResponse.flags,
        wins: aiResponse.wins,
        suggested_response: aiResponse.suggested_response,
        coaching_notes: aiResponse.coaching_notes,
        ai_model: 'gpt-4o',
        completed_at: new Date().toISOString(),
      });

      res.json(updatedAnalysis);
    } catch (error) {
      console.error("AI analysis error:", error);
      
      // Try to mark as failed if we have an analysis record
      try {
        const submission = await checkinData.getSubmission(req.params.id);
        if (submission) {
          const existingAnalysis = await checkinData.getSubmissionAnalysis(req.params.id);
          if (existingAnalysis) {
            await checkinData.updateAnalysis(existingAnalysis.id, {
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      } catch (e) {
        console.error("Failed to mark analysis as failed:", e);
      }
      
      res.status(500).json({ error: "Failed to analyze check-in" });
    }
  });

  // GET /api/pro/check-ins/submissions/:id/details - Get full raw data for submission week (drill-down)
  app.get("/api/pro/check-ins/submissions/:id/details", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { id } = req.params;
      
      const details = await checkinData.getSubmissionFullDetails(id, req.professionalId!);
      
      if (!details) {
        return res.status(404).json({ error: "Submission not found or not authorized" });
      }

      res.json(details);
    } catch (error) {
      console.error("Get submission details error:", error);
      res.status(500).json({ error: "Failed to fetch submission details" });
    }
  });

  // ==================== CLIENT CHECK-IN ROUTES ====================

  // GET /api/client/check-ins/upcoming - Get client's next due check-in
  app.get("/api/client/check-ins/upcoming", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const clientId = req.supabaseUser!.id;
      
      // Mark overdue submissions
      await checkinData.markOverdueSubmissions();
      
      const submission = await checkinData.getClientUpcomingSubmission(clientId);
      
      if (!submission) {
        return res.json({ upcoming: null });
      }

      // Get template and questions
      const questions = await checkinData.getVersionQuestions(submission.template_version_id);
      const answers = submission.status === 'in_progress' 
        ? await checkinData.getSubmissionAnswers(submission.id)
        : [];

      // Get or refresh metrics
      let metricsCache = await checkinData.getMetricsCache(clientId, submission.week_start);
      
      // Refresh if stale (>24 hours)
      if (!metricsCache || new Date(metricsCache.refreshed_at).getTime() < Date.now() - 24 * 60 * 60 * 1000) {
        const freshMetrics = await checkinData.aggregateClientMetrics(clientId, submission.week_start);
        metricsCache = await checkinData.upsertMetricsCache(clientId, submission.week_start, freshMetrics);
      }

      res.json({
        upcoming: {
          submission,
          questions,
          answers,
          metrics: metricsCache.metrics,
        },
      });
    } catch (error) {
      console.error("Get upcoming check-in error:", error);
      res.status(500).json({ error: "Failed to fetch upcoming check-in" });
    }
  });

  // POST /api/client/check-ins/:id/start - Start a check-in (mark as in_progress)
  app.post("/api/client/check-ins/:id/start", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const clientId = req.supabaseUser!.id;

      const submission = await checkinData.getClientSubmission(id, clientId);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found or not authorized" });
      }
      if (submission.status !== 'scheduled') {
        return res.status(400).json({ error: "Check-in already started or completed" });
      }

      const updated = await checkinData.startSubmission(id);
      res.json(updated);
    } catch (error) {
      console.error("Start check-in error:", error);
      res.status(500).json({ error: "Failed to start check-in" });
    }
  });

  // POST /api/client/check-ins/:id/save-draft - Autosave answers
  app.post("/api/client/check-ins/:id/save-draft", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const clientId = req.supabaseUser!.id;

      const submission = await checkinData.getClientSubmission(id, clientId);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found or not authorized" });
      }
      if (!['scheduled', 'in_progress'].includes(submission.status)) {
        return res.status(400).json({ error: "Cannot save - check-in already submitted" });
      }

      // If still scheduled, mark as in_progress
      if (submission.status === 'scheduled') {
        await checkinData.startSubmission(id);
      }

      const answerSchema = z.array(z.object({
        question_id: z.string().uuid(),
        answer_value: z.string().nullable(),
      }));

      const parsed = answerSchema.parse(req.body);
      const answers = await checkinData.saveAnswers(id, parsed);

      res.json({ answers });
    } catch (error) {
      console.error("Save check-in draft error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save check-in draft" });
    }
  });

  // POST /api/client/check-ins/:id/submit - Submit check-in
  app.post("/api/client/check-ins/:id/submit", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    console.log('[API] POST /api/client/check-ins/:id/submit - id:', req.params.id);
    try {
      const { id } = req.params;
      const clientId = req.supabaseUser!.id;
      console.log('[API] clientId:', clientId, 'body:', JSON.stringify(req.body).slice(0, 200));

      const submission = await checkinData.getClientSubmission(id, clientId);
      console.log('[API] submission status:', submission?.status);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found or not authorized" });
      }
      if (submission.status === 'submitted') {
        return res.status(400).json({ error: "Check-in already submitted" });
      }
      if (submission.status === 'missed') {
        return res.status(400).json({ error: "Check-in deadline has passed" });
      }

      // Save any final answers
      if (req.body.answers) {
        const answerSchema = z.array(z.object({
          question_id: z.string().uuid(),
          answer_value: z.string().nullable(),
        }));
        const parsed = answerSchema.parse(req.body.answers);
        await checkinData.saveAnswers(id, parsed);
      }

      // Aggregate final metrics
      const metrics = await checkinData.aggregateClientMetrics(clientId, submission.week_start);

      // Submit
      const updated = await checkinData.submitCheckIn(id, metrics);

      // Schedule next check-in
      const assignment = await checkinData.getClientCheckInAssignment(clientId);
      if (assignment) {
        await checkinData.scheduleNextSubmission(assignment);
      }

      res.json({
        submission: updated,
        message: "Check-in submitted successfully",
      });
    } catch (error) {
      console.error("Submit check-in error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to submit check-in" });
    }
  });

  // GET /api/client/check-ins/metrics - Get current week metrics for preview
  app.get("/api/client/check-ins/metrics", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const clientId = req.supabaseUser!.id;
      const weekStart = checkinData.getWeekStartForDate(new Date());
      
      const metrics = await checkinData.aggregateClientMetrics(clientId, weekStart);
      res.json(metrics);
    } catch (error) {
      console.error("Get check-in metrics error:", error);
      res.status(500).json({ error: "Failed to fetch check-in metrics" });
    }
  });

  // POST /api/client/check-ins/metrics/refresh - Force refresh metrics cache
  app.post("/api/client/check-ins/metrics/refresh", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const clientId = req.supabaseUser!.id;
      const weekStart = checkinData.getWeekStartForDate(new Date());
      
      const metrics = await checkinData.aggregateClientMetrics(clientId, weekStart);
      const cached = await checkinData.upsertMetricsCache(clientId, weekStart, metrics);
      
      res.json(cached.metrics);
    } catch (error) {
      console.error("Refresh check-in metrics error:", error);
      res.status(500).json({ error: "Failed to refresh check-in metrics" });
    }
  });

  // ============================================================
  // PERMISSION MANAGEMENT ENDPOINTS
  // ============================================================

  // GET /api/permissions/definitions - Get all permission definitions
  app.get("/api/permissions/definitions", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const permissionModule = await import('./supabase-permissions');
      const definitions = await permissionModule.getPermissionDefinitions();
      res.json(definitions);
    } catch (error) {
      console.error("Get permission definitions error:", error);
      res.status(500).json({ error: "Failed to fetch permission definitions" });
    }
  });

  // GET /api/pro/clients/:clientId/permissions - Get permissions for a specific client
  app.get("/api/pro/clients/:clientId/permissions", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { clientId } = req.params;
      const professionalId = req.professionalId!;

      // Get the relationship first
      const { data: relationship, error: relError } = await supabaseAdmin.supabaseAdmin
        .from('professional_client_relationships')
        .select('id, role_type, status')
        .eq('professional_id', professionalId)
        .eq('client_id', clientId)
        .eq('status', 'active')
        .single();

      if (relError || !relationship) {
        return res.status(404).json({ error: "Client relationship not found" });
      }

      const permissionModule = await import('./supabase-permissions');
      const { granted, available } = await permissionModule.getAllPermissionsForRelationship(relationship.id);

      // Get pending permission requests made by this professional
      const { data: pendingRequests, error: pendingError } = await supabaseAdmin.supabaseAdmin
        .from('permission_requests')
        .select('permission_slug, requested_at, message')
        .eq('relationship_id', relationship.id)
        .eq('status', 'pending');

      if (pendingError) {
        console.error("Error fetching pending requests:", pendingError);
      }

      const pendingPermissions = (pendingRequests || []).map(r => r.permission_slug);

      res.json({
        relationship_id: relationship.id,
        role_type: relationship.role_type,
        relationship_status: relationship.status, // 'active' for now, will expand for payments
        granted_permissions: granted,
        pending_permissions: pendingPermissions,
        pending_requests: pendingRequests || [],
        permission_definitions: available,
      });
    } catch (error) {
      console.error("Get client permissions error:", error);
      res.status(500).json({ error: "Failed to fetch client permissions" });
    }
  });

  // GET /api/pro/clients/by-permission/:permission - Get clients with specific permission
  app.get("/api/pro/clients/by-permission/:permission", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { permission } = req.params;
      const professionalId = req.professionalId!;

      const permissionModule = await import('./supabase-permissions');
      const clientIds = await permissionModule.getClientsWithPermission(professionalId, permission as any);

      // Get client details
      if (clientIds.length === 0) {
        return res.json([]);
      }

      const { data: profiles } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('id, display_name, profile_photo_path, preset_avatar_id, profile_completed')
        .in('id', clientIds);

      const { data: authUsers } = await supabaseAdmin.supabaseAdmin.auth.admin.listUsers();
      const emailMap = new Map<string, string>();
      authUsers?.users?.forEach((u: { id: string; email?: string }) => emailMap.set(u.id, u.email || ''));

      // Get preset avatars for lookup
      const presetAvatarIds = profiles?.filter((p: any) => p.preset_avatar_id).map((p: any) => p.preset_avatar_id!) || [];
      const presetAvatarMap = new Map<string, string | null>();
      if (presetAvatarIds.length > 0) {
        const { data: presetAvatars } = await supabaseAdmin.supabaseAdmin
          .from('preset_avatars')
          .select('id, image_path')
          .in('id', presetAvatarIds);
        if (presetAvatars) {
          for (const pa of presetAvatars) {
            if (pa.image_path) {
              const { data: signedData } = await supabaseAdmin.supabaseAdmin.storage
                .from('preset-avatars')
                .createSignedUrl(pa.image_path, 3600);
              presetAvatarMap.set(pa.id, signedData?.signedUrl || null);
            }
          }
        }
      }

      // Resolve avatar URLs for each client
      const clients = await Promise.all(clientIds.map(async clientId => {
        const profile = profiles?.find((p: { id: string }) => p.id === clientId);
        let avatarUrl: string | null = null;

        // Priority 1: Uploaded profile photo
        if (profile?.profile_photo_path) {
          const { data: signedData } = await supabaseAdmin.supabaseAdmin.storage
            .from('profile-photos')
            .createSignedUrl(profile.profile_photo_path, 3600);
          avatarUrl = signedData?.signedUrl || null;
        }
        // Priority 2: Preset avatar
        if (!avatarUrl && profile?.preset_avatar_id) {
          avatarUrl = presetAvatarMap.get(profile.preset_avatar_id) || null;
        }

        return {
          id: clientId,
          email: emailMap.get(clientId) || '',
          display_name: profile?.display_name || null,
          avatar_url: avatarUrl,
          profile_completed: profile?.profile_completed ?? false,
        };
      }));

      res.json(clients);
    } catch (error) {
      console.error("Get clients by permission error:", error);
      res.status(500).json({ error: "Failed to fetch clients with permission" });
    }
  });

  // GET /api/pro/clients/:clientId/progress-photos - Get progress photos for a client (requires view_progress_photos permission)
  app.get("/api/pro/clients/:clientId/progress-photos", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { clientId } = req.params;
      const professionalId = req.professionalId!;
      const { limit, offset, pose } = req.query;

      // Check permission
      const permissionModule = await import('./supabase-permissions');
      const hasViewPermission = await permissionModule.hasPermission(professionalId, clientId, 'view_progress_photos');
      
      if (!hasViewPermission) {
        return res.status(403).json({ error: "You don't have permission to view this client's progress photos" });
      }

      // Fetch photos from database
      let query = supabaseAdmin.supabaseAdmin
        .from('progress_photos')
        .select('*')
        .eq('user_id', clientId)
        .order('captured_at', { ascending: false });

      if (pose && typeof pose === 'string') {
        query = query.eq('pose', pose);
      }

      if (limit) {
        query = query.limit(parseInt(limit as string, 10));
      }

      if (offset) {
        const offsetNum = parseInt(offset as string, 10);
        const limitNum = limit ? parseInt(limit as string, 10) : 10;
        query = query.range(offsetNum, offsetNum + limitNum - 1);
      }

      const { data: photos, error: fetchError } = await query;

      if (fetchError) {
        console.error("Error fetching progress photos:", fetchError);
        return res.status(500).json({ error: "Failed to fetch progress photos" });
      }

      // Generate signed URLs for each photo
      const photosWithUrls = await Promise.all(
        (photos || []).map(async (photo: any) => {
          const { data: signedUrlData } = await supabaseAdmin.supabaseAdmin.storage
            .from('progress-photos')
            .createSignedUrl(photo.photo_path, 3600); // 1 hour expiry
          
          return {
            ...photo,
            signedUrl: signedUrlData?.signedUrl || null,
          };
        })
      );

      res.json(photosWithUrls);
    } catch (error) {
      console.error("Get client progress photos error:", error);
      res.status(500).json({ error: "Failed to fetch client progress photos" });
    }
  });

  // GET /api/client/permissions - Get all permissions for the current client
  app.get("/api/client/permissions", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const clientId = req.supabaseUser!.id;

      // Step 1: Get all active relationships for this client (without nested join)
      const { data: relationships, error: relError } = await supabaseAdmin.supabaseAdmin
        .from('professional_client_relationships')
        .select('id, professional_id, role_type')
        .eq('client_id', clientId)
        .eq('status', 'active');

      if (relError) {
        console.error('Error fetching client relationships:', relError);
        return res.status(500).json({ error: "Failed to fetch relationships" });
      }

      if (!relationships || relationships.length === 0) {
        const permissionModule = await import('./supabase-permissions');
        const definitions = await permissionModule.getPermissionDefinitions();
        return res.json({ relationships: [], permission_definitions: definitions });
      }

      // Step 2: Get storefronts for headline (Phase 3: single source of truth)
      // professional_id stores auth user IDs, so we join via user_id
      const professionalIds = relationships.map(r => r.professional_id);
      
      const { data: storefronts } = await supabaseAdmin.supabaseAdmin
        .from('trainer_storefronts')
        .select('user_id, headline')
        .in('user_id', professionalIds);

      // Step 3: Get profiles for display_name and preset_avatar_id
      // NOTE: profiles has display_name but NOT full_name
      const { data: profiles } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('id, display_name, profile_photo_path, preset_avatar_id')
        .in('id', professionalIds);

      // Create lookup maps
      const storefrontMap = new Map((storefronts || []).map(s => [s.user_id, s]));
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Get preset avatars for lookup
      const presetAvatarIds = (profiles || []).filter((p: any) => p.preset_avatar_id).map((p: any) => p.preset_avatar_id!);
      const presetAvatarMap = new Map<string, string | null>();
      if (presetAvatarIds.length > 0) {
        const { data: presetAvatars } = await supabaseAdmin.supabaseAdmin
          .from('preset_avatars')
          .select('id, image_path')
          .in('id', presetAvatarIds);
        if (presetAvatars) {
          for (const pa of presetAvatars) {
            if (pa.image_path) {
              const { data: signedData } = await supabaseAdmin.supabaseAdmin.storage
                .from('preset-avatars')
                .createSignedUrl(pa.image_path, 3600);
              presetAvatarMap.set(pa.id, signedData?.signedUrl || null);
            }
          }
        }
      }

      // Tier 3: Fetch auth users for any professionals not in profiles or with null display_name
      const authLookupMap = new Map<string, string>();
      for (const profId of professionalIds) {
        const profile = profileMap.get(profId);
        if (!profile?.display_name) {
          try {
            const { data: authUser } = await supabaseAdmin.supabaseAdmin.auth.admin.getUserById(profId);
            if (authUser?.user) {
              const displayName = authUser.user.user_metadata?.display_name || 
                                  authUser.user.user_metadata?.full_name || 
                                  authUser.user.email?.split('@')[0] || 
                                  'Your Trainer';
              authLookupMap.set(profId, displayName);
            }
          } catch (e) {
            console.error(`Failed to fetch auth for ${profId}:`, e);
          }
        }
      }

      const permissionModule = await import('./supabase-permissions');
      const definitions = await permissionModule.getPermissionDefinitions();

      const result = await Promise.all(relationships.map(async (rel: any) => {
        const { granted } = await permissionModule.getAllPermissionsForRelationship(rel.id);
        const storefront = storefrontMap.get(rel.professional_id);
        const profile = profileMap.get(rel.professional_id);
        
        // 3-tier name lookup: profiles.display_name -> auth metadata -> fallback
        const professionalName = profile?.display_name || 
                                 authLookupMap.get(rel.professional_id) || 
                                 'Unknown Professional';

        // Resolve avatar URL with priority: profile photo > preset avatar
        let avatarUrl: string | null = null;
        
        // Priority 1: User's uploaded profile photo (from profiles table)
        if (profile?.profile_photo_path) {
          const { data: signedData } = await supabaseAdmin.supabaseAdmin.storage
            .from('profile-photos')
            .createSignedUrl(profile.profile_photo_path, 3600);
          avatarUrl = signedData?.signedUrl || null;
        }
        // Priority 2: Preset avatar
        if (!avatarUrl && profile?.preset_avatar_id) {
          avatarUrl = presetAvatarMap.get(profile.preset_avatar_id) || null;
        }
        
        return {
          relationship_id: rel.id,
          professional_id: rel.professional_id,
          professional_name: professionalName,
          professional_avatar: avatarUrl,
          professional_headline: storefront?.headline || null,
          role_type: rel.role_type,
          granted_permissions: granted,
        };
      }));

      res.json({
        relationships: result,
        permission_definitions: definitions,
      });
    } catch (error) {
      console.error("Get client permissions error:", error);
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  // PUT /api/client/permissions/:relationshipId - Update permissions for a relationship (client-controlled)
  app.put("/api/client/permissions/:relationshipId", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const clientId = req.supabaseUser!.id;
      const { relationshipId } = req.params;

      // Verify this relationship belongs to the client
      const { data: relationship, error: relError } = await supabaseAdmin.supabaseAdmin
        .from('professional_client_relationships')
        .select('id, professional_id, client_id')
        .eq('id', relationshipId)
        .eq('client_id', clientId)
        .eq('status', 'active')
        .single();

      if (relError || !relationship) {
        return res.status(403).json({ error: "Not authorized to modify this relationship" });
      }

      const permissionSchema = z.object({
        grant: z.array(z.string()).optional(),
        revoke: z.array(z.string()).optional(),
      });

      const parsed = permissionSchema.parse(req.body);
      const permissionModule = await import('./supabase-permissions');

      const transfers: string[] = [];
      const errors: string[] = [];

      // Process grants (grantPermission now handles exclusive transfer atomically)
      if (parsed.grant && parsed.grant.length > 0) {
        for (const permSlug of parsed.grant) {
          const result = await permissionModule.grantPermission(relationshipId, permSlug as any, 'client');
          if (!result.success) {
            errors.push(`${permSlug}: ${result.error}`);
          } else if (result.transferredFrom) {
            transfers.push(`${permSlug} transferred from ${result.transferredFrom}`);
          }
        }
      }

      // Process revocations
      if (parsed.revoke && parsed.revoke.length > 0) {
        for (const permSlug of parsed.revoke) {
          await permissionModule.revokePermission(relationshipId, permSlug as any);
        }
      }

      // Return updated permissions
      const { granted, available } = await permissionModule.getAllPermissionsForRelationship(relationshipId);

      res.json({
        message: "Permissions updated successfully",
        granted_permissions: granted,
        available_permissions: available,
        transfers: transfers.length > 0 ? transfers : undefined,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("Update client permissions error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update permissions" });
    }
  });

  // POST /api/admin/permissions/migrate-relationship - Migrate existing relationship to permissions
  app.post("/api/admin/permissions/migrate-relationship", requireAdmin, async (req, res) => {
    try {
      const migrateSchema = z.object({
        relationship_id: z.string().uuid(),
        role_type: z.enum(['nutritionist', 'trainer', 'coach']),
        skip_exclusive_check: z.boolean().optional(),
      });

      const parsed = migrateSchema.parse(req.body);
      const permissionModule = await import('./supabase-permissions');
      
      const result = await permissionModule.migrateRelationshipToPermissions(
        parsed.relationship_id,
        parsed.role_type,
        { skipExclusiveCheck: parsed.skip_exclusive_check }
      );

      if (result.success) {
        res.json({ 
          message: "Relationship migrated to permission system successfully",
          granted: result.granted,
          skipped: result.skipped,
        });
      } else {
        res.status(500).json({ 
          error: "Migration completed with errors",
          granted: result.granted,
          skipped: result.skipped,
          errors: result.errors,
        });
      }
    } catch (error) {
      console.error("Migrate relationship error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to migrate relationship" });
    }
  });

  // POST /api/admin/permissions/migrate-all - Migrate all existing relationships
  app.post("/api/admin/permissions/migrate-all", requireAdmin, async (req, res) => {
    try {
      const { data: relationships, error: relError } = await supabaseAdmin.supabaseAdmin
        .from('professional_client_relationships')
        .select('id, role_type')
        .eq('status', 'active');

      if (relError) {
        return res.status(500).json({ error: "Failed to fetch relationships" });
      }

      const permissionModule = await import('./supabase-permissions');
      let migratedCount = 0;
      let errorCount = 0;

      for (const rel of relationships || []) {
        try {
          await permissionModule.migrateRelationshipToPermissions(rel.id, rel.role_type as any);
          migratedCount++;
        } catch (err) {
          console.error(`Error migrating relationship ${rel.id}:`, err);
          errorCount++;
        }
      }

      res.json({
        message: "Migration complete",
        total: relationships?.length || 0,
        migrated: migratedCount,
        errors: errorCount,
      });
    } catch (error) {
      console.error("Migrate all relationships error:", error);
      res.status(500).json({ error: "Failed to migrate relationships" });
    }
  });

  // POST /api/admin/permissions/resolve-duplicates - Clean up duplicate exclusive permissions
  app.post("/api/admin/permissions/resolve-duplicates", requireAdmin, async (req, res) => {
    try {
      const permissionModule = await import('./supabase-permissions');
      
      const exclusivePermissions = ['set_nutrition_targets', 'set_weight_targets', 
        'assign_programmes', 'assign_checkins', 'set_fasting_schedule'];
      
      const { data: clients } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('id');

      let totalResolved = 0;
      const details: { clientId: string; permission: string; resolved: number; winnerPreserved: boolean }[] = [];

      for (const client of clients || []) {
        for (const permSlug of exclusivePermissions) {
          const { data: grants } = await supabaseAdmin.supabaseAdmin
            .from('client_permissions')
            .select(`
              id,
              relationship_id,
              granted_at,
              professional_client_relationships!inner (client_id)
            `)
            .eq('permission_slug', permSlug)
            .eq('status', 'granted')
            .eq('professional_client_relationships.client_id', client.id)
            .eq('professional_client_relationships.status', 'active')
            .order('granted_at', { ascending: true });

          if (grants && grants.length > 1) {
            const keepRelationshipId = grants[0].relationship_id;
            const result = await permissionModule.resolveExclusiveDuplicates(
              client.id, 
              permSlug as any, 
              keepRelationshipId
            );
            totalResolved += result.resolved;
            if (result.resolved > 0) {
              details.push({ 
                clientId: client.id, 
                permission: permSlug, 
                resolved: result.resolved,
                winnerPreserved: result.winnerPreserved,
              });
            }
          }
        }
      }

      res.json({
        message: "Duplicate resolution complete",
        total_resolved: totalResolved,
        details,
      });
    } catch (error) {
      console.error("Resolve duplicates error:", error);
      res.status(500).json({ error: "Failed to resolve duplicates" });
    }
  });

  // =============================================================================
  // INVITATION PERMISSION ROUTES (Phase 3)
  // =============================================================================

  // GET /api/invitations/:token - Fetch invitation details with permissions
  app.get("/api/invitations/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }

      const permissionModule = await import('./supabase-permissions');
      const result = await permissionModule.fetchInvitationDetails(token);

      if (!result.success) {
        return res.status(404).json({ error: result.error || "Invitation not found" });
      }

      res.json(result);
    } catch (error) {
      console.error("Fetch invitation details error:", error);
      res.status(500).json({ error: "Failed to fetch invitation details" });
    }
  });

  // POST /api/invitations/:token/accept - Accept invitation with permission selections
  app.post("/api/invitations/:token/accept", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { token } = req.params;
      const userId = req.supabaseUser?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const acceptSchema = z.object({
        approved: z.array(z.string()).default([]),
        rejected: z.array(z.string()).default([]),
      });

      const { approved, rejected } = acceptSchema.parse(req.body);

      const permissionModule = await import('./supabase-permissions');
      const result = await permissionModule.finalizeInvitationPermissions(
        token,
        approved as any[],
        rejected as any[],
        userId
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({
        success: true,
        relationship_id: result.relationship_id,
        approved_count: result.approved_count,
        rejected_count: result.rejected_count,
        transfers: result.transfers,
      });
    } catch (error) {
      console.error("Accept invitation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });

  // POST /api/client/connection-requests - Client requests to work with a professional
  app.post("/api/client/connection-requests", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const requestSchema = z.object({
        professionalId: z.string().uuid(),
        message: z.string().max(1000).optional().default(""),
      });

      const { professionalId, message } = requestSchema.parse(req.body);

      // Check if professional exists
      const { data: professional, error: proError } = await supabaseAdmin.supabaseAdmin
        .from('professional_profiles')
        .select('user_id')
        .eq('user_id', professionalId)
        .single();

      if (proError || !professional) {
        return res.status(404).json({ error: "Professional not found" });
      }

      // Check for existing relationship
      const { data: existingRel } = await supabaseAdmin.supabaseAdmin
        .from('client_professional_relationships')
        .select('id')
        .eq('client_id', userId)
        .eq('professional_id', professionalId)
        .eq('status', 'active')
        .single();

      if (existingRel) {
        return res.status(400).json({ error: "You are already connected with this professional" });
      }

      // Check for existing pending request
      const { data: existingRequest } = await supabaseAdmin.supabaseAdmin
        .from('client_connection_requests')
        .select('id')
        .eq('client_id', userId)
        .eq('professional_id', professionalId)
        .eq('status', 'pending')
        .single();

      if (existingRequest) {
        return res.status(400).json({ error: "You already have a pending request with this professional" });
      }

      // Create the connection request
      const { data: request, error: insertError } = await supabaseAdmin.supabaseAdmin
        .from('client_connection_requests')
        .insert({
          client_id: userId,
          professional_id: professionalId,
          message: message || null,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        console.error("Connection request insert error:", insertError);
        
        // Check for specific error types
        if (insertError.code === '42P01') {
          // Table doesn't exist - migration not run
          return res.status(503).json({ 
            error: "This feature is not available yet. Please try again later." 
          });
        }
        if (insertError.code === '23505') {
          // Unique violation - probably a duplicate pending request
          return res.status(400).json({ 
            error: "You already have a request pending with this professional." 
          });
        }
        
        return res.status(500).json({ 
          error: "Failed to send your request. Please try again." 
        });
      }

      res.json({
        success: true,
        request_id: request?.id,
      });
    } catch (error) {
      console.error("Create connection request error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      res.status(500).json({ error: "Failed to create connection request" });
    }
  });

  // GET /api/client/permission-requests - Get pending permission requests for client
  app.get("/api/client/permission-requests", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const permissionModule = await import('./supabase-permissions');
      const result = await permissionModule.getClientPermissionRequests(userId);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json({
        success: true,
        requests: result.requests || [],
      });
    } catch (error) {
      console.error("Get permission requests error:", error);
      res.status(500).json({ error: "Failed to fetch permission requests" });
    }
  });

  // PATCH /api/client/permission-requests/:requestId - Respond to a permission request
  app.patch("/api/client/permission-requests/:requestId", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const { requestId } = req.params;
      const userId = req.supabaseUser?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const responseSchema = z.object({
        action: z.enum(['approve', 'deny']),
      });

      const { action } = responseSchema.parse(req.body);

      const permissionModule = await import('./supabase-permissions');
      const result = await permissionModule.respondToPermissionRequest(requestId, userId, action);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({
        success: true,
        action: result.action,
      });
    } catch (error) {
      console.error("Respond to permission request error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data. Action must be 'approve' or 'deny'." });
      }
      res.status(500).json({ error: "Failed to respond to permission request" });
    }
  });

  // POST /api/pro/permission-requests - Create permission request(s) (for professionals)
  // Supports both single and bulk requests with optional message
  app.post("/api/pro/permission-requests", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const professionalId = req.professionalId;
      const professionalUserId = req.supabaseUser?.id;
      
      if (!professionalId || !professionalUserId) {
        return res.status(401).json({ error: "Professional authentication required" });
      }

      // Support both single permission_slug and bulk permission_slugs
      const requestSchema = z.object({
        relationship_id: z.string().uuid(),
        permission_slug: z.string().optional(),
        permission_slugs: z.array(z.string()).optional(),
        message: z.string().max(200).optional(),
      }).refine(data => data.permission_slug || (data.permission_slugs && data.permission_slugs.length > 0), {
        message: "Either permission_slug or permission_slugs must be provided"
      });

      const parsed = requestSchema.parse(req.body);
      const { relationship_id, message } = parsed;
      
      // Normalize to array of slugs
      const slugsToRequest = parsed.permission_slugs || (parsed.permission_slug ? [parsed.permission_slug] : []);

      const permissionModule = await import('./supabase-permissions');
      const results: Array<{ slug: string; success: boolean; error?: string; request_id?: string }> = [];
      
      for (const slug of slugsToRequest) {
        const result = await permissionModule.createPermissionRequestForPro(
          relationship_id,
          slug as any,
          professionalUserId,
          message
        );
        results.push({
          slug,
          success: result.success,
          error: result.error,
          request_id: result.request_id,
        });
      }

      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      if (successCount === 0 && failedCount > 0) {
        return res.status(400).json({ 
          error: results[0].error || "Failed to create permission requests",
          results 
        });
      }

      res.json({
        success: true,
        created_count: successCount,
        failed_count: failedCount,
        results,
      });
    } catch (error) {
      console.error("Create permission request error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      res.status(500).json({ error: "Failed to create permission request" });
    }
  });

  // =============================================================================
  // PRESET AVATARS ADMIN ROUTES
  // =============================================================================

  // GET /api/admin/preset-avatars - List all preset avatars (including inactive)
  app.get("/api/admin/preset-avatars", requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.supabaseAdmin
        .from('preset_avatars')
        .select('*')
        .order('gender', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;

      // Generate signed URLs for each avatar
      const avatarsWithUrls = await Promise.all((data || []).map(async (avatar) => {
        const { data: urlData } = await supabaseAdmin.supabaseAdmin.storage
          .from('preset-avatars')
          .createSignedUrl(avatar.image_path, 3600); // 1 hour expiry

        return {
          ...avatar,
          image_url: urlData?.signedUrl || null,
        };
      }));

      res.json(avatarsWithUrls);
    } catch (error) {
      console.error("List preset avatars error:", error);
      res.status(500).json({ error: "Failed to list preset avatars" });
    }
  });

  // POST /api/admin/preset-avatars - Create a new preset avatar
  app.post("/api/admin/preset-avatars", requireAdmin, upload.single('image'), async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(100),
        gender: z.enum(['female', 'male', 'neutral']),
      });

      const { name, gender } = schema.parse(req.body);

      if (!req.file) {
        return res.status(400).json({ error: "Image file is required" });
      }

      // Upload to Supabase Storage
      const fileExt = req.file.originalname.split('.').pop() || 'png';
      const fileName = `${gender}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabaseAdmin.supabaseAdmin.storage
        .from('preset-avatars')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return res.status(500).json({ error: "Failed to upload image" });
      }

      // Create database record
      const { data, error: insertError } = await supabaseAdmin.supabaseAdmin
        .from('preset_avatars')
        .insert({
          name,
          gender,
          image_path: fileName,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        // Clean up uploaded file on error
        await supabaseAdmin.supabaseAdmin.storage
          .from('preset-avatars')
          .remove([fileName]);
        throw insertError;
      }

      // Get signed URL for the response
      const { data: urlData } = await supabaseAdmin.supabaseAdmin.storage
        .from('preset-avatars')
        .createSignedUrl(fileName, 3600);

      res.json({
        ...data,
        image_url: urlData?.signedUrl || null,
      });
    } catch (error) {
      console.error("Create preset avatar error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      res.status(500).json({ error: "Failed to create preset avatar" });
    }
  });

  // PATCH /api/admin/preset-avatars/:id - Update a preset avatar
  app.patch("/api/admin/preset-avatars/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const schema = z.object({
        name: z.string().min(1).max(100).optional(),
        gender: z.enum(['female', 'male', 'neutral']).optional(),
        is_active: z.boolean().optional(),
      });

      const updates = schema.parse(req.body);

      const { data, error } = await supabaseAdmin.supabaseAdmin
        .from('preset_avatars')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Get signed URL
      const { data: urlData } = await supabaseAdmin.supabaseAdmin.storage
        .from('preset-avatars')
        .createSignedUrl(data.image_path, 3600);

      res.json({
        ...data,
        image_url: urlData?.signedUrl || null,
      });
    } catch (error) {
      console.error("Update preset avatar error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      res.status(500).json({ error: "Failed to update preset avatar" });
    }
  });

  // DELETE /api/admin/preset-avatars/:id - Delete a preset avatar
  app.delete("/api/admin/preset-avatars/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Get the avatar to find the image path
      const { data: avatar, error: fetchError } = await supabaseAdmin.supabaseAdmin
        .from('preset_avatars')
        .select('image_path')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Delete from storage
      if (avatar?.image_path) {
        await supabaseAdmin.supabaseAdmin.storage
          .from('preset-avatars')
          .remove([avatar.image_path]);
      }

      // Delete from database
      const { error: deleteError } = await supabaseAdmin.supabaseAdmin
        .from('preset_avatars')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      res.json({ success: true });
    } catch (error) {
      console.error("Delete preset avatar error:", error);
      res.status(500).json({ error: "Failed to delete preset avatar" });
    }
  });

  // GET /api/avatars/presets - Public endpoint for fetching active preset avatars
  app.get("/api/avatars/presets", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { data, error } = await supabaseAdmin.supabaseAdmin
        .from('preset_avatars')
        .select('*')
        .eq('is_active', true)
        .order('gender', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;

      // Generate signed URLs for each avatar
      const avatarsWithUrls = await Promise.all((data || []).map(async (avatar) => {
        const { data: urlData } = await supabaseAdmin.supabaseAdmin.storage
          .from('preset-avatars')
          .createSignedUrl(avatar.image_path, 3600);

        return {
          id: avatar.id,
          name: avatar.name,
          gender: avatar.gender,
          image_url: urlData?.signedUrl || null,
        };
      }));

      res.json(avatarsWithUrls);
    } catch (error) {
      console.error("Get preset avatars error:", error);
      res.status(500).json({ error: "Failed to fetch preset avatars" });
    }
  });

  // GET /api/profile/photo-url - Get signed URL for user's profile photo
  app.get("/api/profile/photo-url", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      
      const { data: profile, error: profileError } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('profile_photo_path')
        .eq('id', userId)
        .single();
      
      if (profileError || !profile?.profile_photo_path) {
        return res.json({ url: null });
      }
      
      const { data: urlData, error: urlError } = await supabaseAdmin.supabaseAdmin.storage
        .from('profile-photos')
        .createSignedUrl(profile.profile_photo_path, 3600);
      
      if (urlError || !urlData) {
        console.error("Failed to create signed URL:", urlError);
        return res.json({ url: null });
      }
      
      res.json({ url: urlData.signedUrl });
    } catch (error) {
      console.error("Get profile photo URL error:", error);
      res.status(500).json({ error: "Failed to get profile photo URL" });
    }
  });

  // GET /api/profile/:userId/photo-url - Get signed URL for any user's profile photo (for messaging, etc.)
  app.get("/api/profile/:userId/photo-url", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const targetUserId = req.params.userId;
      
      const { data: profile, error: profileError } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('profile_photo_path')
        .eq('id', targetUserId)
        .single();
      
      if (profileError || !profile?.profile_photo_path) {
        return res.json({ url: null });
      }
      
      const { data: urlData, error: urlError } = await supabaseAdmin.supabaseAdmin.storage
        .from('profile-photos')
        .createSignedUrl(profile.profile_photo_path, 3600);
      
      if (urlError || !urlData) {
        console.error("Failed to create signed URL:", urlError);
        return res.json({ url: null });
      }
      
      res.json({ url: urlData.signedUrl });
    } catch (error) {
      console.error("Get profile photo URL error:", error);
      res.status(500).json({ error: "Failed to get profile photo URL" });
    }
  });

  // =============================================================================
  // MESSAGING ROUTES - Phase 6A: In-App Communication
  // =============================================================================

  // Get all conversations for the current user
  app.get("/api/messages/conversations", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const conversations = await messagingData.getConversationsForUser(userId);
      res.json({ conversations });
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({ error: "Failed to get conversations" });
    }
  });

  // Get or create a conversation with another user
  app.post("/api/messages/conversations", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const schema = z.object({
        other_user_id: z.string().uuid(),
      });
      const { other_user_id } = schema.parse(req.body);

      // First check if there's an active relationship
      const hasRelationship = await messagingData.hasActiveRelationship(userId, other_user_id);
      if (!hasRelationship) {
        return res.status(403).json({ error: "No active relationship with this user" });
      }

      const conversationId = await messagingData.getOrCreateConversation(userId, other_user_id);
      if (!conversationId) {
        return res.status(500).json({ error: "Failed to create conversation" });
      }

      const conversation = await messagingData.getConversationById(conversationId, userId);
      res.json({ conversation });
    } catch (error) {
      console.error("Create conversation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Get a specific conversation
  app.get("/api/messages/conversations/:id", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const conversationId = req.params.id;

      const conversation = await messagingData.getConversationById(conversationId, userId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      res.json({ conversation });
    } catch (error) {
      console.error("Get conversation error:", error);
      res.status(500).json({ error: "Failed to get conversation" });
    }
  });

  // Get messages for a conversation (paginated)
  app.get("/api/messages/conversations/:id/messages", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const conversationId = req.params.id;
      const before = req.query.before as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;

      // Verify user can access this conversation
      const canAccess = await messagingData.canAccessConversation(userId, conversationId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      const result = await messagingData.getMessagesForConversation(conversationId, { before, limit });
      res.json(result);
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  // Send a text message
  app.post("/api/messages/conversations/:id/messages", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const conversationId = req.params.id;

      const schema = z.object({
        content: z.string().min(1).max(5000),
      });
      const { content } = schema.parse(req.body);

      // Verify user can access this conversation
      const canAccess = await messagingData.canAccessConversation(userId, conversationId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get conversation details for teaser quota check
      const conversation = await messagingData.getConversationById(conversationId, userId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Check and consume teaser quota (premium users bypass this)
      try {
        await assertTeaserQuota(userId, conversation.professional_id, conversation.client_id);
      } catch (quotaError: any) {
        if (quotaError.code === 'TEASER_LIMIT_EXCEEDED') {
          return res.status(403).json({ 
            error: quotaError.message,
            code: 'TEASER_LIMIT_EXCEEDED',
            data: quotaError.data,
          });
        }
        throw quotaError;
      }

      const message = await messagingData.sendMessage(conversationId, userId, content);
      if (!message) {
        return res.status(500).json({ error: "Failed to send message" });
      }

      // Broadcast to recipient via WebSocket if connected
      const recipientId = conversation.professional_id === userId 
        ? conversation.client_id 
        : conversation.professional_id;
      
      const delivered = notifyNewMessage(recipientId, message);
      if (delivered) {
        // Update delivery status in database
        const deliveredAt = new Date().toISOString();
        await messagingData.updateMessageDeliveryStatus(message.id, 'delivered');
        // Notify sender that message was delivered
        notifyMessageDelivered(userId, message.id, conversationId, deliveredAt);
      }

      res.json({ message });
    } catch (error) {
      console.error("Send message error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid message content" });
      }
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Mark messages as read
  app.post("/api/messages/conversations/:id/read", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const conversationId = req.params.id;

      const schema = z.object({
        up_to_message_id: z.string().uuid().optional(),
      });
      const { up_to_message_id } = schema.parse(req.body);

      // Verify user can access this conversation
      const canAccess = await messagingData.canAccessConversation(userId, conversationId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      const count = await messagingData.markMessagesAsRead(userId, conversationId, up_to_message_id);
      
      // Notify the user's own clients about unread count update
      notifyUnreadUpdate(userId, conversationId, 0);
      
      // Also notify the other participant so their UI updates
      const conversation = await messagingData.getConversationById(conversationId, userId);
      if (conversation) {
        const otherUserId = conversation.professional_id === userId 
          ? conversation.client_id 
          : conversation.professional_id;
        // Notify other user - their badge won't change but they might want to know messages were read
        notifyUnreadUpdate(otherUserId, conversationId, 0);
      }
      
      res.json({ success: true, marked_count: count });
    } catch (error) {
      console.error("Mark messages read error:", error);
      res.status(500).json({ error: "Failed to mark messages as read" });
    }
  });

  // Get total unread count
  app.get("/api/messages/unread-count", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const total = await messagingData.getTotalUnreadCount(userId);
      res.json({ total });
    } catch (error) {
      console.error("Get unread count error:", error);
      res.status(500).json({ error: "Failed to get unread count" });
    }
  });

  // Get teaser usage status for a conversation
  app.get("/api/messages/conversations/:id/teaser-status", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const conversationId = req.params.id;

      // Verify user can access this conversation
      const canAccess = await messagingData.canAccessConversation(userId, conversationId);
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get conversation details
      const conversation = await messagingData.getConversationById(conversationId, userId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Get teaser usage status
      const status = await getTeaserUsageStatus(userId, conversation.professional_id, conversation.client_id);
      
      // Determine if current user is client or trainer
      const isClient = userId === conversation.client_id;
      const isTrainer = userId === conversation.professional_id;

      res.json({
        status,
        isClient,
        isTrainer,
        canSend: status.isPremium || (isClient ? !status.isClientBlocked : !status.isTrainerBlocked),
        remaining: isClient ? status.clientRemaining : status.trainerRemaining,
        limit: isClient ? status.clientLimit : status.trainerLimit,
        sent: isClient ? status.clientMessagesSent : status.trainerMessagesSent,
      });
    } catch (error) {
      console.error("Get teaser status error:", error);
      res.status(500).json({ error: "Failed to get teaser status" });
    }
  });

  // Get messaging preferences
  app.get("/api/messages/preferences", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const preferences = await messagingData.getMessagingPreferences(userId);
      
      // Return defaults if no preferences exist
      res.json({
        preferences: preferences || {
          user_id: userId,
          notifications_enabled: true,
          sound_enabled: true,
          quiet_hours_start: null,
          quiet_hours_end: null,
          muted_conversations: [],
          push_token: null,
          push_platform: null,
          updated_at: new Date().toISOString(),
        }
      });
    } catch (error) {
      console.error("Get messaging preferences error:", error);
      res.status(500).json({ error: "Failed to get preferences" });
    }
  });

  // Update messaging preferences
  app.put("/api/messages/preferences", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      
      const schema = z.object({
        notifications_enabled: z.boolean().optional(),
        sound_enabled: z.boolean().optional(),
        quiet_hours_start: z.string().nullable().optional(),
        quiet_hours_end: z.string().nullable().optional(),
        muted_conversations: z.array(z.string().uuid()).optional(),
      });
      const updates = schema.parse(req.body);

      const preferences = await messagingData.updateMessagingPreferences(userId, updates);
      res.json({ preferences });
    } catch (error) {
      console.error("Update messaging preferences error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid preferences data" });
      }
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  // Register push token
  app.post("/api/messages/push-token", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      
      const schema = z.object({
        token: z.string().min(1),
        platform: z.enum(['web', 'android', 'ios']),
      });
      const { token, platform } = schema.parse(req.body);

      const success = await messagingData.registerPushToken(userId, token, platform);
      res.json({ success });
    } catch (error) {
      console.error("Register push token error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid token data" });
      }
      res.status(500).json({ error: "Failed to register push token" });
    }
  });

  // Upload voice memo
  app.post("/api/messages/conversations/:id/voice", requireSupabaseAuth, upload.single('audio'), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const conversationId = req.params.id;

      if (!await messagingData.canAccessConversation(userId, conversationId)) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const schema = z.object({
        duration_seconds: z.coerce.number().min(1).max(120),
      });
      const { duration_seconds } = schema.parse(req.body);

      const mimeType = req.file.mimetype || 'audio/webm';
      if (!['audio/webm', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/ogg'].includes(mimeType)) {
        return res.status(400).json({ error: "Invalid audio format" });
      }

      // Get conversation details for teaser quota check
      const conversation = await messagingData.getConversationById(conversationId, userId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Check and consume teaser quota (premium users bypass this)
      try {
        await assertTeaserQuota(userId, conversation.professional_id, conversation.client_id);
      } catch (quotaError: any) {
        if (quotaError.code === 'TEASER_LIMIT_EXCEEDED') {
          return res.status(403).json({ 
            error: quotaError.message,
            code: 'TEASER_LIMIT_EXCEEDED',
            data: quotaError.data,
          });
        }
        throw quotaError;
      }

      const message = await messagingData.sendMessage(
        conversationId,
        userId,
        '[Voice Message]',
        'voice'
      );

      if (!message) {
        return res.status(500).json({ error: "Failed to create message" });
      }

      const voiceMessage = await messagingData.uploadVoiceMemo(
        message.id,
        req.file.buffer,
        duration_seconds,
        mimeType
      );

      if (!voiceMessage) {
        return res.status(500).json({ error: "Failed to upload voice memo" });
      }

      const fullMessage = {
        ...message,
        voice_message: voiceMessage,
      };

      // Broadcast to recipient via WebSocket if connected
      const recipientId = conversation.professional_id === userId 
        ? conversation.client_id 
        : conversation.professional_id;
      
      const delivered = notifyNewMessage(recipientId, fullMessage as any);
      if (delivered) {
        const deliveredAt = new Date().toISOString();
        await messagingData.updateMessageDeliveryStatus(message.id, 'delivered');
        notifyMessageDelivered(userId, message.id, conversationId, deliveredAt);
      }

      res.status(201).json({ message: fullMessage });
    } catch (error) {
      console.error("Upload voice memo error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid voice memo data" });
      }
      res.status(500).json({ error: "Failed to upload voice memo" });
    }
  });

  // Get signed URL for voice message playback
  app.get("/api/messages/voice/:messageId/url", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const messageId = req.params.messageId;

      const voiceMessage = await messagingData.getVoiceMessageByMessageId(messageId);
      if (!voiceMessage) {
        return res.status(404).json({ error: "Voice message not found" });
      }

      if (messagingData.isVoiceMemoExpired(voiceMessage)) {
        return res.status(410).json({ error: "Voice message has expired" });
      }

      const signedUrl = await messagingData.getSignedVoiceUrl(voiceMessage.storage_path);
      if (!signedUrl) {
        return res.status(500).json({ error: "Failed to generate playback URL" });
      }

      res.json({ 
        url: signedUrl, 
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        duration_seconds: voiceMessage.duration_seconds,
      });
    } catch (error) {
      console.error("Get voice URL error:", error);
      res.status(500).json({ error: "Failed to get voice URL" });
    }
  });

  // Cleanup expired voice memos (cron-ready endpoint)
  app.post("/api/messages/cleanup-voice-memos", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const cronSecret = process.env.CRON_SECRET;
      
      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { deletedCount, storagePaths } = await messagingData.cleanupExpiredVoiceMemos();

      for (const path of storagePaths) {
        await messagingData.deleteVoiceMemoFile(path);
      }

      res.json({ 
        success: true, 
        deleted_count: deletedCount,
        files_removed: storagePaths.length,
      });
    } catch (error) {
      console.error("Cleanup voice memos error:", error);
      res.status(500).json({ error: "Failed to cleanup voice memos" });
    }
  });

  // ============================================================================
  // FDA NUTRITION SEARCH ROUTES
  // ============================================================================

  // GET /api/nutrition/search - Search FDA FoodData Central for foods
  app.get("/api/nutrition/search", requireSupabaseAuth, requireFeature('text_food_search'), async (req: AuthenticatedRequest, res) => {
    try {
      const { q, page, limit } = req.query;
      const userId = req.supabaseUser!.id;
      
      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.status(400).json({ error: "Search query must be at least 2 characters" });
      }

      const { fdaService } = await import("./fda-service");
      
      const result = await fdaService.searchFoods(q.trim(), {
        pageNumber: page ? parseInt(page as string, 10) : 1,
        pageSize: limit ? Math.min(parseInt(limit as string, 10), 50) : 25,
      });

      const filteredFoods = await Promise.all(
        result.foods.map(async (food) => ({
          ...food,
          nutrients: food.nutrients ? await filterNutrientsForUser(food.nutrients, userId) : [],
        }))
      );

      res.json({
        foods: filteredFoods,
        totalHits: result.totalHits,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        fromCache: result.fromCache,
      });
    } catch (error) {
      console.error("Nutrition search error:", error);
      res.status(500).json({ error: "Failed to search foods" });
    }
  });

  // GET /api/nutrition/barcode/:upc - Lookup food by barcode/UPC
  app.get("/api/nutrition/barcode/:upc", requireSupabaseAuth, requireFeature('barcode_scan'), async (req: AuthenticatedRequest, res) => {
    try {
      const { upc } = req.params;
      const userId = req.supabaseUser!.id;
      
      if (!upc || upc.length < 8) {
        return res.status(400).json({ error: "Invalid barcode format" });
      }

      const { fdaService } = await import("./fda-service");
      
      const food = await fdaService.searchByBarcode(upc);

      if (!food) {
        return res.status(404).json({ error: "Food not found for this barcode" });
      }

      const filteredFood = {
        ...food,
        nutrients: food.nutrients ? await filterNutrientsForUser(food.nutrients, userId) : [],
      };

      res.json(filteredFood);
    } catch (error) {
      console.error("Barcode lookup error:", error);
      res.status(500).json({ error: "Failed to lookup barcode" });
    }
  });

  // GET /api/nutrition/foods/:fdcId - Get detailed food info by FDC ID
  app.get("/api/nutrition/foods/:fdcId", requireSupabaseAuth, requireFeature('text_food_search'), async (req: AuthenticatedRequest, res) => {
    try {
      const { fdcId } = req.params;
      const userId = req.supabaseUser!.id;
      const fdcIdNum = parseInt(fdcId, 10);
      
      if (isNaN(fdcIdNum) || fdcIdNum <= 0) {
        return res.status(400).json({ error: "Invalid FDC ID" });
      }

      const { fdaService } = await import("./fda-service");
      
      const food = await fdaService.getFoodDetails(fdcIdNum);

      if (!food) {
        return res.status(404).json({ error: "Food not found" });
      }

      const filteredFood = {
        ...food,
        nutrients: food.nutrients ? await filterNutrientsForUser(food.nutrients, userId) : [],
      };

      res.json(filteredFood);
    } catch (error) {
      console.error("Get food details error:", error);
      res.status(500).json({ error: "Failed to get food details" });
    }
  });

  // POST /api/nutrition/foods/batch - Batch get multiple foods by FDC IDs
  app.post("/api/nutrition/foods/batch", requireSupabaseAuth, requireFeature('text_food_search'), async (req: AuthenticatedRequest, res) => {
    try {
      const { fdcIds } = req.body;
      const userId = req.supabaseUser!.id;
      
      if (!Array.isArray(fdcIds) || fdcIds.length === 0) {
        return res.status(400).json({ error: "fdcIds must be a non-empty array" });
      }

      if (fdcIds.length > 50) {
        return res.status(400).json({ error: "Maximum 50 foods per batch request" });
      }

      const validIds = fdcIds
        .map(id => parseInt(id, 10))
        .filter(id => !isNaN(id) && id > 0);

      if (validIds.length === 0) {
        return res.status(400).json({ error: "No valid FDC IDs provided" });
      }

      const { fdaService } = await import("./fda-service");
      
      const foods = await fdaService.batchGetFoods(validIds);

      const filteredFoods = await Promise.all(
        foods.map(async (food) => ({
          ...food,
          nutrients: food.nutrients ? await filterNutrientsForUser(food.nutrients, userId) : [],
        }))
      );

      res.json({ foods: filteredFoods });
    } catch (error) {
      console.error("Batch get foods error:", error);
      res.status(500).json({ error: "Failed to batch get foods" });
    }
  });

  // ============================================================================
  // MEAL CAPTURES ROUTES
  // ============================================================================

  // POST /api/meal-captures - Create a meal capture (groups food logs from same entry)
  app.post("/api/meal-captures", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      
      const captureSchema = z.object({
        captureType: z.enum(['photo', 'manual', 'barcode', 'text']),
        rawAiResponse: z.any().nullable().optional(),
        imagePath: z.string().nullable().optional(),
      });

      const data = captureSchema.parse(req.body);

      const { data: mealCapture, error } = await supabaseAdmin.supabaseAdmin
        .from('meal_captures')
        .insert({
          user_id: userId,
          capture_type: data.captureType,
          raw_ai_response: data.rawAiResponse || null,
          image_path: data.imagePath || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Create meal capture error:", error);
        return res.status(500).json({ error: "Failed to create meal capture" });
      }

      res.json(mealCapture);
    } catch (error) {
      console.error("Meal capture error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create meal capture" });
    }
  });

  // GET /api/meal-captures - Get user's meal captures
  app.get("/api/meal-captures", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const { limit, offset } = req.query;

      const { data: captures, error } = await supabaseAdmin.supabaseAdmin
        .from('meal_captures')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(
          offset ? parseInt(offset as string, 10) : 0,
          (offset ? parseInt(offset as string, 10) : 0) + (limit ? parseInt(limit as string, 10) : 50) - 1
        );

      if (error) {
        console.error("Get meal captures error:", error);
        return res.status(500).json({ error: "Failed to get meal captures" });
      }

      res.json({ captures });
    } catch (error) {
      console.error("Get meal captures error:", error);
      res.status(500).json({ error: "Failed to get meal captures" });
    }
  });

  // ============================================================================
  // FOOD LOGS ROUTES (FDA-backed)
  // ============================================================================

  // POST /api/food-logs - Create a food log with FDA data
  app.post("/api/food-logs", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      
      const foodLogSchema = z.object({
        foodName: z.string().min(1),
        quantityValue: z.number().positive(),
        quantityUnit: z.string().min(1),
        calories: z.number().int().min(0),
        proteinG: z.number().nullable().optional(),
        carbsG: z.number().nullable().optional(),
        fatG: z.number().nullable().optional(),
        fiberG: z.number().nullable().optional(),
        sugarG: z.number().nullable().optional(),
        caloriesPerUnit: z.number().nullable().optional(),
        proteinPerUnit: z.number().nullable().optional(),
        carbsPerUnit: z.number().nullable().optional(),
        fatPerUnit: z.number().nullable().optional(),
        micronutrientsDump: z.any().nullable().optional(),
        mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
        breaksFast: z.boolean().optional(),
        barcode: z.string().nullable().optional(),
        loggedAt: z.string().datetime().optional(),
        mealCaptureId: z.string().uuid().nullable().optional(),
        foodItemId: z.string().uuid().nullable().optional(),
        nutrientSnapshot: z.any().nullable().optional(),
      });

      const data = foodLogSchema.parse(req.body);

      const { data: foodLog, error } = await supabaseAdmin.supabaseAdmin
        .from('food_logs')
        .insert({
          user_id: userId,
          food_name: data.foodName,
          quantity_value: data.quantityValue,
          quantity_unit: data.quantityUnit,
          calories: data.calories,
          protein_g: data.proteinG ?? null,
          carbs_g: data.carbsG ?? null,
          fat_g: data.fatG ?? null,
          fiber_g: data.fiberG ?? null,
          sugar_g: data.sugarG ?? null,
          calories_per_unit: data.caloriesPerUnit ?? null,
          protein_per_unit: data.proteinPerUnit ?? null,
          carbs_per_unit: data.carbsPerUnit ?? null,
          fat_per_unit: data.fatPerUnit ?? null,
          micronutrients_dump: data.micronutrientsDump ?? null,
          meal_type: data.mealType ?? null,
          breaks_fast: data.breaksFast ?? null,
          barcode: data.barcode ?? null,
          logged_at: data.loggedAt ? new Date(data.loggedAt) : new Date(),
          meal_capture_id: data.mealCaptureId ?? null,
          food_item_id: data.foodItemId ?? null,
          nutrient_snapshot: data.nutrientSnapshot ?? null,
        })
        .select()
        .single();

      if (error) {
        console.error("Create food log error:", error);
        return res.status(500).json({ error: "Failed to create food log" });
      }

      res.json(foodLog);
    } catch (error) {
      console.error("Create food log error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create food log" });
    }
  });

  // GET /api/food-logs - Get user's food logs for a date
  app.get("/api/food-logs", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const { date, limit, offset } = req.query;

      let query = supabaseAdmin.supabaseAdmin
        .from('food_logs')
        .select('*')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false });

      if (date && typeof date === 'string') {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        query = query
          .gte('logged_at', startOfDay.toISOString())
          .lte('logged_at', endOfDay.toISOString());
      }

      query = query.range(
        offset ? parseInt(offset as string, 10) : 0,
        (offset ? parseInt(offset as string, 10) : 0) + (limit ? parseInt(limit as string, 10) : 100) - 1
      );

      const { data: logs, error } = await query;

      if (error) {
        console.error("Get food logs error:", error);
        return res.status(500).json({ error: "Failed to get food logs" });
      }

      res.json({ logs });
    } catch (error) {
      console.error("Get food logs error:", error);
      res.status(500).json({ error: "Failed to get food logs" });
    }
  });

  // DELETE /api/food-logs/:id - Delete a food log
  app.delete("/api/food-logs/:id", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const { id } = req.params;

      const { error } = await supabaseAdmin.supabaseAdmin
        .from('food_logs')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error("Delete food log error:", error);
        return res.status(500).json({ error: "Failed to delete food log" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete food log error:", error);
      res.status(500).json({ error: "Failed to delete food log" });
    }
  });

  // PATCH /api/food-logs/:id - Update a food log
  app.patch("/api/food-logs/:id", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const { id } = req.params;

      const updateSchema = z.object({
        foodName: z.string().min(1).optional(),
        quantityValue: z.number().positive().optional(),
        quantityUnit: z.string().min(1).optional(),
        calories: z.number().int().min(0).optional(),
        proteinG: z.number().nullable().optional(),
        carbsG: z.number().nullable().optional(),
        fatG: z.number().nullable().optional(),
        fiberG: z.number().nullable().optional(),
        sugarG: z.number().nullable().optional(),
        mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
      });

      const data = updateSchema.parse(req.body);

      const updateData: Record<string, any> = {};
      if (data.foodName !== undefined) updateData.food_name = data.foodName;
      if (data.quantityValue !== undefined) updateData.quantity_value = data.quantityValue;
      if (data.quantityUnit !== undefined) updateData.quantity_unit = data.quantityUnit;
      if (data.calories !== undefined) updateData.calories = data.calories;
      if (data.proteinG !== undefined) updateData.protein_g = data.proteinG;
      if (data.carbsG !== undefined) updateData.carbs_g = data.carbsG;
      if (data.fatG !== undefined) updateData.fat_g = data.fatG;
      if (data.fiberG !== undefined) updateData.fiber_g = data.fiberG;
      if (data.sugarG !== undefined) updateData.sugar_g = data.sugarG;
      if (data.mealType !== undefined) updateData.meal_type = data.mealType;

      const { data: foodLog, error } = await supabaseAdmin.supabaseAdmin
        .from('food_logs')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error("Update food log error:", error);
        return res.status(500).json({ error: "Failed to update food log" });
      }

      res.json(foodLog);
    } catch (error) {
      console.error("Update food log error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update food log" });
    }
  });

  // ============================================================================
  // FEATURE ACCESS ROUTES
  // ============================================================================

  // GET /api/features/my-access - Get current user's feature access
  app.get("/api/features/my-access", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const { features, planCode } = await getUserFeatures(userId);
      
      res.json({ 
        features,
        planCode,
        isPremium: planCode === 'premium'
      });
    } catch (error) {
      console.error("Get features error:", error);
      res.status(500).json({ error: "Failed to get feature access" });
    }
  });

  // GET /api/features/check/:code - Check if user has a specific feature
  app.get("/api/features/check/:code", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const { code } = req.params;
      
      const hasAccess = await hasFeature(userId, code as FeatureCode);
      
      res.json({ 
        feature: code,
        hasAccess
      });
    } catch (error) {
      console.error("Check feature error:", error);
      res.status(500).json({ error: "Failed to check feature access" });
    }
  });

  // GET /api/features/system/:code - Check if a system-level feature flag is active
  // Used for platform-wide toggles like custom_slugs, marketplace_discovery, etc.
  app.get("/api/features/system/:code", async (req, res) => {
    try {
      const { code } = req.params;
      
      const { data: feature, error } = await supabaseAdmin.supabaseAdmin
        .from('features')
        .select('is_active')
        .eq('code', code)
        .maybeSingle();
      
      if (error) {
        console.error("Check system feature error:", error);
        return res.status(500).json({ error: "Failed to check feature" });
      }
      
      // If feature doesn't exist, treat as inactive
      const isActive = feature?.is_active ?? false;
      
      res.json({ 
        feature: code,
        isActive
      });
    } catch (error) {
      console.error("Check system feature error:", error);
      res.status(500).json({ error: "Failed to check feature" });
    }
  });

  // ============================================================================
  // NUTRITION TARGETS ROUTES
  // ============================================================================

  // POST /api/pro/clients/:clientId/nutrition-targets - Pro sets targets for client
  app.post("/api/pro/clients/:clientId/nutrition-targets", requireProfessional, async (req: ProfessionalRequest, res) => {
    try {
      const { clientId } = req.params;
      const professionalId = req.professionalId!;

      const targetSchema = z.object({
        protein_g: z.number().int().min(0).max(1000),
        carbs_g: z.number().int().min(0).max(2000),
        fat_g: z.number().int().min(0).max(500),
      });

      const data = targetSchema.parse(req.body);

      // Verify relationship exists
      const { data: relationship, error: relError } = await supabaseAdmin.supabaseAdmin
        .from("professional_client_relationships")
        .select("id")
        .eq("professional_id", professionalId)
        .eq("client_id", clientId)
        .eq("status", "active")
        .maybeSingle();

      if (relError || !relationship) {
        return res.status(403).json({ error: "Not connected to this client" });
      }

      // Check permission
      const { data: permission, error: permError } = await supabaseAdmin.supabaseAdmin
        .from("client_permissions")
        .select("id")
        .eq("relationship_id", relationship.id)
        .eq("permission_slug", "set_nutrition_targets")
        .eq("status", "granted")
        .maybeSingle();

      if (permError || !permission) {
        return res.status(403).json({ error: "You don't have permission to set nutrition targets for this client" });
      }

      // Import the data layer functions
      const nutritionTargets = await import("./supabase-nutrition-targets");
      const { notifyNutritionTargetsUpdate } = await import("./websocket");
      
      const target = await nutritionTargets.createNutritionTarget(
        clientId,
        professionalId,
        data.protein_g,
        data.carbs_g,
        data.fat_g
      );

      // Get professional's name for notification
      const { data: proProfile } = await supabaseAdmin.supabaseAdmin
        .from("profiles")
        .select("display_name")
        .eq("id", professionalId)
        .single();

      const professionalName = proProfile?.display_name || "Your trainer";
      notifyNutritionTargetsUpdate(clientId, professionalName);

      res.status(201).json(target);
    } catch (error) {
      console.error("Create nutrition target error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to create nutrition target" });
    }
  });

  // GET /api/nutrition-targets - Client gets their current/pending targets
  app.get("/api/nutrition-targets", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const nutritionTargets = await import("./supabase-nutrition-targets");
      
      const targets = await nutritionTargets.getClientNutritionTargets(userId);
      res.json(targets);
    } catch (error) {
      console.error("Get nutrition targets error:", error);
      res.status(500).json({ error: "Failed to get nutrition targets" });
    }
  });

  // POST /api/nutrition-targets/accept - Client accepts pending targets
  app.post("/api/nutrition-targets/accept", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const { target_id } = req.body;

      if (!target_id) {
        return res.status(400).json({ error: "target_id is required" });
      }

      const nutritionTargets = await import("./supabase-nutrition-targets");
      const target = await nutritionTargets.acceptNutritionTarget(userId, target_id);
      
      res.json(target);
    } catch (error) {
      console.error("Accept nutrition target error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to accept nutrition target" });
    }
  });

  // POST /api/nutrition-targets/decline - Client declines pending targets
  app.post("/api/nutrition-targets/decline", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const { target_id } = req.body;

      if (!target_id) {
        return res.status(400).json({ error: "target_id is required" });
      }

      const nutritionTargets = await import("./supabase-nutrition-targets");
      const target = await nutritionTargets.declineNutritionTarget(userId, target_id);
      
      res.json(target);
    } catch (error) {
      console.error("Decline nutrition target error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to decline nutrition target" });
    }
  });

  // PATCH /api/nutrition-targets - Client updates their accepted targets
  app.patch("/api/nutrition-targets", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;

      const targetSchema = z.object({
        protein_g: z.number().int().min(0).max(1000),
        carbs_g: z.number().int().min(0).max(2000),
        fat_g: z.number().int().min(0).max(500),
      });

      const data = targetSchema.parse(req.body);

      const nutritionTargets = await import("./supabase-nutrition-targets");
      const target = await nutritionTargets.updateClientNutritionTarget(
        userId,
        data.protein_g,
        data.carbs_g,
        data.fat_g
      );
      
      res.json(target);
    } catch (error) {
      console.error("Update nutrition target error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update nutrition target" });
    }
  });

  // ============================================================================
  // WATER INTAKE ROUTES
  // ============================================================================

  // GET /api/water/:date - Get water intake for a specific date
  app.get("/api/water/:date", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const { date } = req.params;

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }

      const waterData = await import("./supabase-water-data");
      const intake = await waterData.getDailyWaterIntake(userId, date);
      res.json(intake);
    } catch (error) {
      console.error("Get water intake error:", error);
      res.status(500).json({ error: "Failed to get water intake" });
    }
  });

  // POST /api/water - Add water intake
  app.post("/api/water", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;

      const waterSchema = z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
        amount_ml: z.number().int().min(1).max(5000),
        source: z.string().optional().default("quick_add"),
      });

      const data = waterSchema.parse(req.body);

      const waterData = await import("./supabase-water-data");
      const result = await waterData.addWaterIntake(userId, data.date, data.amount_ml, data.source);
      res.json(result);
    } catch (error) {
      console.error("Add water intake error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to add water intake" });
    }
  });

  // GET /api/water/:date/logs - Get individual water log entries for a date
  app.get("/api/water/:date/logs", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const { date } = req.params;

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }

      const waterData = await import("./supabase-water-data");
      const logs = await waterData.getWaterLogs(userId, date);
      res.json(logs);
    } catch (error) {
      console.error("Get water logs error:", error);
      res.status(500).json({ error: "Failed to get water logs" });
    }
  });

  // PATCH /api/water/target - Update user's default water target
  app.patch("/api/water/target", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;

      const targetSchema = z.object({
        target_ml: z.number().int().min(500).max(10000),
      });

      const data = targetSchema.parse(req.body);

      const waterData = await import("./supabase-water-data");
      await waterData.updateWaterTarget(userId, data.target_ml);
      res.json({ success: true, target_ml: data.target_ml });
    } catch (error) {
      console.error("Update water target error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update water target" });
    }
  });

  // =============================================================================
  // STRIPE SUBSCRIPTION ROUTES - Phase 1 Payment System
  // =============================================================================

  // GET /api/stripe/config - Get Stripe publishable key
  app.get("/api/stripe/config", async (_req, res) => {
    try {
      const stripeService = await import("./stripeService");
      const publishableKey = await stripeService.stripeService.getPublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Get Stripe config error:", error);
      res.status(500).json({ error: "Failed to get Stripe configuration" });
    }
  });

  // GET /api/stripe/products - Get available subscription products and prices
  app.get("/api/stripe/products", async (_req, res) => {
    try {
      const { query: dbQuery } = await import("./db-pool");
      
      const result = await dbQuery(`
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring,
          pr.metadata as price_metadata
        FROM stripe.products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = true
        ORDER BY p.name, pr.unit_amount
      `);

      const productsMap = new Map();
      for (const row of result.rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            metadata: row.product_metadata,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            metadata: row.price_metadata,
          });
        }
      }

      res.json({ products: Array.from(productsMap.values()) });
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  // POST /api/stripe/checkout - Create checkout session
  app.post("/api/stripe/checkout", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const userEmail = req.supabaseUser!.email || '';

      const checkoutSchema = z.object({
        priceId: z.string(),
        promoCode: z.string().optional(),
      });

      const { priceId, promoCode } = checkoutSchema.parse(req.body);

      const stripeService = await import("./stripeService");
      const subscriptionData = await import("./supabase-subscription-data");

      const customerId = await stripeService.stripeService.getOrCreateCustomer(
        userId,
        userEmail,
        req.supabaseUser?.user_metadata?.display_name
      );

      let trialDays = 0;
      const canTrial = await subscriptionData.canUserStartTrial(userId);
      if (canTrial) {
        trialDays = 7;
      }

      const host = req.get('host');
      const protocol = req.protocol;
      const baseUrl = `${protocol}://${host}`;

      const session = await stripeService.stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        `${baseUrl}/subscription/cancel`,
        {
          userId,
          trialDays,
          promoCode,
        }
      );

      if (trialDays > 0) {
        await subscriptionData.recordTrialStart(userId);
      }

      res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      console.error("Create checkout session error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // GET /api/stripe/subscription - Get current user's subscription
  app.get("/api/stripe/subscription", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const subscriptionData = await import("./supabase-subscription-data");
      
      const subscription = await subscriptionData.getUserSubscription(userId);
      
      if (!subscription) {
        return res.json({ subscription: null, status: 'free' });
      }

      const stripeService = await import("./stripeService");
      const stripeSubscription: Stripe.Subscription | null = await stripeService.stripeService.getSubscription(
        subscription.stripe_subscription_id
      );

      const firstItem = stripeSubscription?.items?.data?.[0];
      res.json({
        subscription: {
          ...subscription,
          stripeData: stripeSubscription ? {
            currentPeriodEnd: firstItem?.current_period_end ?? null,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          } : null,
        },
        status: subscription.status,
      });
    } catch (error) {
      console.error("Get subscription error:", error);
      res.status(500).json({ error: "Failed to get subscription" });
    }
  });

  // POST /api/stripe/portal - Create customer portal session
  app.post("/api/stripe/portal", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const subscriptionData = await import("./supabase-subscription-data");
      const stripeService = await import("./stripeService");

      const subscription = await subscriptionData.getUserSubscription(userId);
      
      if (!subscription?.stripe_customer_id) {
        return res.status(400).json({ error: "No active subscription found" });
      }

      const host = req.get('host');
      const protocol = req.protocol;
      const returnUrl = `${protocol}://${host}/settings`;

      const session = await stripeService.stripeService.createCustomerPortalSession(
        subscription.stripe_customer_id,
        returnUrl
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Create portal session error:", error);
      res.status(500).json({ error: "Failed to create portal session" });
    }
  });

  // POST /api/stripe/cancel - Cancel subscription
  app.post("/api/stripe/cancel", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const subscriptionData = await import("./supabase-subscription-data");
      const stripeService = await import("./stripeService");

      const cancelSchema = z.object({
        immediately: z.boolean().optional().default(false),
      });

      const { immediately } = cancelSchema.parse(req.body);

      const subscription = await subscriptionData.getUserSubscription(userId);
      
      if (!subscription?.stripe_subscription_id) {
        return res.status(400).json({ error: "No active subscription found" });
      }

      const result = await stripeService.stripeService.cancelSubscription(
        subscription.stripe_subscription_id,
        immediately
      );

      if (immediately) {
        await subscriptionData.updateSubscriptionStatus(
          subscription.stripe_subscription_id,
          'canceled',
          { canceled_at: new Date().toISOString() }
        );
      }

      res.json({ 
        success: true, 
        cancelAtPeriodEnd: result.cancel_at_period_end,
        cancelAt: result.cancel_at,
      });
    } catch (error) {
      console.error("Cancel subscription error:", error);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // POST /api/stripe/reactivate - Reactivate canceled subscription
  app.post("/api/stripe/reactivate", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const subscriptionData = await import("./supabase-subscription-data");
      const stripeService = await import("./stripeService");

      const subscription = await subscriptionData.getUserSubscription(userId);
      
      if (!subscription?.stripe_subscription_id) {
        return res.status(400).json({ error: "No subscription found" });
      }

      const result = await stripeService.stripeService.reactivateSubscription(
        subscription.stripe_subscription_id
      );

      res.json({ success: true, status: result.status });
    } catch (error) {
      console.error("Reactivate subscription error:", error);
      res.status(500).json({ error: "Failed to reactivate subscription" });
    }
  });

  // POST /api/stripe/promo/validate - Validate promo code
  app.post("/api/stripe/promo/validate", async (req, res) => {
    try {
      const promoSchema = z.object({
        code: z.string().min(1),
      });

      const { code } = promoSchema.parse(req.body);

      const stripeService = await import("./stripeService");
      const result = await stripeService.stripeService.validatePromoCode(code);

      res.json(result);
    } catch (error) {
      console.error("Validate promo code error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to validate promo code" });
    }
  });

  // GET /api/stripe/trial-eligibility - Check if user is eligible for trial
  app.get("/api/stripe/trial-eligibility", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const subscriptionData = await import("./supabase-subscription-data");
      
      const eligible = await subscriptionData.canUserStartTrial(userId);
      
      res.json({ eligible, trialDays: eligible ? 7 : 0 });
    } catch (error) {
      console.error("Check trial eligibility error:", error);
      res.status(500).json({ error: "Failed to check trial eligibility" });
    }
  });

  // =============================================================================
  // ADMIN STRIPE ROUTES
  // =============================================================================

  // GET /api/admin/stripe/subscribers - List all subscribers
  app.get("/api/admin/stripe/subscribers", requireAdmin, async (req: any, res) => {
    try {
      const subscriptionData = await import("./supabase-subscription-data");
      
      const statusFilter = req.query.status as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await subscriptionData.listSubscriptions({
        status: statusFilter as any,
        limit,
        offset,
      });

      res.json(result);
    } catch (error) {
      console.error("List subscribers error:", error);
      res.status(500).json({ error: "Failed to list subscribers" });
    }
  });

  // GET /api/admin/stripe/metrics - Get subscription metrics
  app.get("/api/admin/stripe/metrics", requireAdmin, async (_req: any, res) => {
    try {
      const subscriptionData = await import("./supabase-subscription-data");
      const metrics = await subscriptionData.getSubscriptionMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Get metrics error:", error);
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  // GET /api/admin/stripe/promo-codes - List promo codes
  app.get("/api/admin/stripe/promo-codes", requireAdmin, async (req: any, res) => {
    try {
      const subscriptionData = await import("./supabase-subscription-data");
      const includeInactive = req.query.includeInactive === 'true';
      const codes = await subscriptionData.listPromoCodes(includeInactive);
      res.json({ codes });
    } catch (error) {
      console.error("List promo codes error:", error);
      res.status(500).json({ error: "Failed to list promo codes" });
    }
  });

  // POST /api/admin/stripe/promo-codes - Create promo code
  app.post("/api/admin/stripe/promo-codes", requireAdmin, async (req: any, res) => {
    try {
      const promoSchema = z.object({
        code: z.string().min(3).max(20),
        discountType: z.enum(['percent', 'amount']),
        discountValue: z.number().positive(),
        maxRedemptions: z.number().positive().nullable().optional(),
        firstTimeOnly: z.boolean().optional().default(false),
        expiresAt: z.string().nullable().optional(),
      });

      const data = promoSchema.parse(req.body);

      const stripeService = await import("./stripeService");
      const subscriptionData = await import("./supabase-subscription-data");

      const stripeResult = await stripeService.stripeService.createPromoCode(
        data.code,
        data.discountType,
        data.discountValue,
        {
          maxRedemptions: data.maxRedemptions || undefined,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
          firstTimeOnly: data.firstTimeOnly,
        }
      );

      const promo = await subscriptionData.createPromoCode({
        code: data.code.toUpperCase(),
        stripe_coupon_id: stripeResult.couponId,
        discount_type: data.discountType,
        discount_value: data.discountValue,
        max_redemptions: data.maxRedemptions || null,
        first_time_only: data.firstTimeOnly,
        expires_at: data.expiresAt || null,
        is_active: true,
        created_by: req.session.adminId || null,
      });

      res.json({ success: true, promo });
    } catch (error) {
      console.error("Create promo code error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create promo code" });
    }
  });

  // PATCH /api/admin/stripe/promo-codes/:id - Update promo code
  app.patch("/api/admin/stripe/promo-codes/:id", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        isActive: z.boolean().optional(),
        maxRedemptions: z.number().positive().nullable().optional(),
        expiresAt: z.string().nullable().optional(),
      });

      const data = updateSchema.parse(req.body);
      const subscriptionData = await import("./supabase-subscription-data");

      const updates: any = {};
      if (data.isActive !== undefined) updates.is_active = data.isActive;
      if (data.maxRedemptions !== undefined) updates.max_redemptions = data.maxRedemptions;
      if (data.expiresAt !== undefined) updates.expires_at = data.expiresAt;

      const success = await subscriptionData.updatePromoCode(id, updates);

      if (!success) {
        return res.status(404).json({ error: "Promo code not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Update promo code error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update promo code" });
    }
  });

  // GET /api/admin/stripe/prices - List all products with prices
  app.get("/api/admin/stripe/prices", requireAdmin, async (_req: any, res) => {
    try {
      const stripeService = await import("./stripeService");
      
      const products = await stripeService.stripeService.listProducts();
      const result = [];
      
      for (const product of products) {
        // Include inactive prices for admin view
        const prices = await stripeService.stripeService.listProductPrices(product.id, true);
        result.push({
          id: product.id,
          name: product.name,
          description: product.description,
          metadata: product.metadata,
          prices: prices.map(price => ({
            id: price.id,
            unit_amount: price.unit_amount,
            currency: price.currency,
            nickname: price.nickname,
            recurring: price.recurring ? {
              interval: price.recurring.interval,
              interval_count: price.recurring.interval_count,
            } : null,
            metadata: price.metadata,
            active: price.active,
          })),
        });
      }
      
      res.json({ products: result });
    } catch (error) {
      console.error("Get prices error:", error);
      res.status(500).json({ error: "Failed to get prices" });
    }
  });

  // PATCH /api/admin/stripe/prices/:priceId - Update a price (amount change or active toggle)
  app.patch("/api/admin/stripe/prices/:priceId", requireAdmin, async (req: any, res) => {
    try {
      const { priceId } = req.params;
      const stripeServiceModule = await import("./stripeService");
      const { getStripeSync } = await import("./stripeClient");

      // Discriminated schema: either amount update or active toggle
      const amountSchema = z.object({
        amount: z.number().positive().int(),
        nickname: z.string().optional(),
      });
      const activeSchema = z.object({
        active: z.boolean(),
      });

      // Try to parse as active toggle first (simpler operation)
      const activeResult = activeSchema.safeParse(req.body);
      if (activeResult.success) {
        try {
          const updatedPrice = await stripeServiceModule.stripeService.togglePriceActive(
            priceId,
            activeResult.data.active
          );

          const stripeSync = await getStripeSync();
          await stripeSync.syncBackfill();

          return res.json({
            success: true,
            priceId: updatedPrice.id,
            active: updatedPrice.active,
          });
        } catch (toggleError: any) {
          // Handle last-active-price error specifically
          if (toggleError.message?.includes('last active price')) {
            return res.status(400).json({ 
              error: "Last price validation failed",
              message: toggleError.message 
            });
          }
          throw toggleError;
        }
      }

      // Otherwise, try amount update (creates new price, deactivates old)
      const amountResult = amountSchema.safeParse(req.body);
      if (amountResult.success) {
        const newPrice = await stripeServiceModule.stripeService.updatePrice(
          priceId,
          amountResult.data.amount,
          { nickname: amountResult.data.nickname }
        );

        const stripeSync = await getStripeSync();
        await stripeSync.syncBackfill();

        return res.json({
          success: true,
          newPriceId: newPrice.id,
          oldPriceId: priceId,
          amount: newPrice.unit_amount,
        });
      }

      // Neither schema matched
      return res.status(400).json({ 
        error: "Validation error", 
        message: "Request must include either { amount: number } or { active: boolean }" 
      });
    } catch (error) {
      console.error("Update price error:", error);
      res.status(500).json({ error: "Failed to update price" });
    }
  });

  // =============================================================================
  // STRIPE CONNECT ROUTES (Phase 2)
  // =============================================================================

  // Middleware for Stripe Connect routes - requires pro portal context
  const requireProPortalContext = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Enforce portal context - must be in pro mode
    const portalHeader = req.headers['x-portal-context'];
    if (portalHeader !== 'pro') {
      return res.status(403).json({ error: "Pro portal context required" });
    }

    const context = portalContext.extractPortalContext(req);
    if (!context || context.mode !== 'pro') {
      return res.status(403).json({ error: "Invalid portal context" });
    }

    // Verify the portal context belongs to the authenticated user
    const userId = req.supabaseUser?.id;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isOwner = await portalContext.verifyProfileOwnership(userId, context.mode, context.profileId);
    if (!isOwner) {
      return res.status(403).json({ error: "Portal context does not belong to authenticated user" });
    }

    req.portalContext = {
      mode: context.mode,
      profileId: context.profileId,
    };

    next();
  };

  // POST /api/stripe/connect/account - Create Connect Express account for trainer
  app.post("/api/stripe/connect/account", requireSupabaseAuth, requireProPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const user = req.supabaseUser!;
      
      // Verify user is a professional/trainer
      const { data: profile } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('role, display_name')
        .eq('id', userId)
        .single();

      if (!profile || profile.role !== 'professional') {
        return res.status(403).json({ error: "Only trainers can create Connect accounts" });
      }

      // Check if account already exists
      const stripeServiceModule = await import("./stripeService");
      const existing = await stripeServiceModule.stripeService.getConnectAccountByUserId(userId);
      
      if (existing) {
        return res.status(400).json({ 
          error: "Account already exists",
          stripeAccountId: existing.dbRecord.stripe_account_id,
          onboardingComplete: existing.dbRecord.onboarding_complete,
        });
      }

      // Parse optional body params for pre-filling onboarding
      const bodySchema = z.object({
        country: z.string().length(2).optional(),
        businessType: z.enum(['individual', 'company']).optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      });
      
      const bodyData = bodySchema.safeParse(req.body);
      const options = bodyData.success ? bodyData.data : {};

      const account = await stripeServiceModule.stripeService.createConnectAccount(
        userId,
        user.email || '',
        options
      );

      res.json({
        success: true,
        stripeAccountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
      });
    } catch (error) {
      console.error("Create Connect account error:", error);
      res.status(500).json({ error: "Failed to create Connect account" });
    }
  });

  // POST /api/stripe/connect/onboarding-link - Get onboarding link for Connect account
  app.post("/api/stripe/connect/onboarding-link", requireSupabaseAuth, requireProPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      
      // Verify user is a professional
      const { data: profile } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (!profile || profile.role !== 'professional') {
        return res.status(403).json({ error: "Only trainers can access Connect features" });
      }
      
      const stripeServiceModule = await import("./stripeService");
      const accountData = await stripeServiceModule.stripeService.getConnectAccountByUserId(userId);
      
      if (!accountData) {
        return res.status(404).json({ error: "No Connect account found. Create one first." });
      }

      const bodySchema = z.object({
        refreshUrl: z.string().url(),
        returnUrl: z.string().url(),
        type: z.enum(['account_onboarding', 'account_update']).optional(),
      });

      const { refreshUrl, returnUrl, type } = bodySchema.parse(req.body);

      const accountLink = await stripeServiceModule.stripeService.createAccountLink(
        accountData.dbRecord.stripe_account_id,
        refreshUrl,
        returnUrl,
        type || 'account_onboarding'
      );

      res.json({
        success: true,
        url: accountLink.url,
        expiresAt: accountLink.expires_at,
      });
    } catch (error) {
      console.error("Create onboarding link error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create onboarding link" });
    }
  });

  // GET /api/stripe/connect/status - Get Connect account status for current trainer
  app.get("/api/stripe/connect/status", requireSupabaseAuth, requireProPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      
      // Verify user is a professional
      const { data: profile } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (!profile || profile.role !== 'professional') {
        return res.status(403).json({ error: "Only trainers can access Connect features" });
      }
      
      const stripeServiceModule = await import("./stripeService");
      const accountData = await stripeServiceModule.stripeService.getConnectAccountByUserId(userId);
      
      if (!accountData) {
        return res.json({
          hasAccount: false,
          onboardingComplete: false,
          chargesEnabled: false,
          payoutsEnabled: false,
        });
      }

      const { account, dbRecord } = accountData;

      res.json({
        hasAccount: true,
        stripeAccountId: dbRecord.stripe_account_id,
        onboardingComplete: dbRecord.onboarding_complete,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        defaultCurrency: account.default_currency,
        country: dbRecord.country,
        requirementsDisabledReason: account.requirements?.disabled_reason || null,
        requirementsCurrentDeadline: account.requirements?.current_deadline 
          ? new Date(account.requirements.current_deadline * 1000).toISOString()
          : null,
        requirementsPending: account.requirements?.pending_verification || [],
      });
    } catch (error) {
      console.error("Get Connect status error:", error);
      res.status(500).json({ error: "Failed to get Connect status" });
    }
  });

  // POST /api/stripe/connect/dashboard-link - Get Stripe Express Dashboard link
  app.post("/api/stripe/connect/dashboard-link", requireSupabaseAuth, requireProPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      
      // Verify user is a professional
      const { data: profile } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (!profile || profile.role !== 'professional') {
        return res.status(403).json({ error: "Only trainers can access Connect features" });
      }
      
      const stripeServiceModule = await import("./stripeService");
      const accountData = await stripeServiceModule.stripeService.getConnectAccountByUserId(userId);
      
      if (!accountData) {
        return res.status(404).json({ error: "No Connect account found" });
      }

      if (!accountData.dbRecord.onboarding_complete) {
        return res.status(400).json({ error: "Complete onboarding before accessing dashboard" });
      }

      const loginLink = await stripeServiceModule.stripeService.createLoginLink(
        accountData.dbRecord.stripe_account_id
      );

      res.json({
        success: true,
        url: loginLink.url,
      });
    } catch (error) {
      console.error("Create dashboard link error:", error);
      res.status(500).json({ error: "Failed to create dashboard link" });
    }
  });

  // =============================================================================
  // ADMIN CONNECT ROUTES
  // =============================================================================

  // GET /api/admin/stripe/connect/accounts - List all connected accounts
  app.get("/api/admin/stripe/connect/accounts", requireAdmin, async (req: any, res) => {
    try {
      const stripeServiceModule = await import("./stripeService");
      
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;

      let onlyComplete: boolean | undefined;
      if (status === 'active') onlyComplete = true;

      const result = await stripeServiceModule.stripeService.listConnectedAccounts({
        limit,
        onlyComplete,
      });

      // Flatten the profile data for the frontend
      const flattenedAccounts = result.accounts.map((account: any) => ({
        ...account,
        display_name: account.profiles?.display_name || null,
        email: account.profiles?.email || null,
      }));

      // Filter by status if specified
      let filteredAccounts = flattenedAccounts;
      if (status === 'pending') {
        filteredAccounts = flattenedAccounts.filter((a: any) => !a.onboarding_complete && !a.requirements_disabled_reason);
      } else if (status === 'restricted') {
        filteredAccounts = flattenedAccounts.filter((a: any) => a.requirements_disabled_reason);
      }

      res.json({
        accounts: filteredAccounts.slice(offset, offset + limit),
        total: status ? filteredAccounts.length : result.total,
      });
    } catch (error) {
      console.error("List connected accounts error:", error);
      res.status(500).json({ error: "Failed to list connected accounts" });
    }
  });

  // GET /api/admin/stripe/connect/metrics - Get Connect dashboard metrics
  app.get("/api/admin/stripe/connect/metrics", requireAdmin, async (_req: any, res) => {
    try {
      const stripeServiceModule = await import("./stripeService");
      const metrics = await stripeServiceModule.stripeService.getConnectDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Get Connect metrics error:", error);
      res.status(500).json({ error: "Failed to get Connect metrics" });
    }
  });

  // GET /api/admin/stripe/connect/account/:userId - Get Connect account details for specific user
  app.get("/api/admin/stripe/connect/account/:userId", requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      const stripeServiceModule = await import("./stripeService");
      const accountData = await stripeServiceModule.stripeService.getConnectAccountByUserId(userId);
      
      if (!accountData) {
        return res.status(404).json({ error: "No Connect account found for this user" });
      }

      const { account, dbRecord } = accountData;

      res.json({
        dbRecord,
        stripeAccount: {
          id: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
          defaultCurrency: account.default_currency,
          requirements: account.requirements,
          settings: account.settings,
        },
      });
    } catch (error) {
      console.error("Get Connect account details error:", error);
      res.status(500).json({ error: "Failed to get Connect account details" });
    }
  });

  // ============================================
  // PHASE 3: MARKETPLACE PRODUCTS ROUTES
  // ============================================

  // GET /api/marketplace/products - Get approved products for marketplace (with trainer info)
  app.get("/api/marketplace/products", async (_req, res) => {
    try {
      const productServiceModule = await import("./productService");
      const products = await productServiceModule.productService.getApprovedProducts();
      res.json(products);
    } catch (error) {
      console.error("Get marketplace products error:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  // GET /api/products - Get approved products for marketplace
  app.get("/api/products", async (_req, res) => {
    try {
      const productServiceModule = await import("./productService");
      const products = await productServiceModule.productService.getApprovedProducts();
      res.json(products);
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  // GET /api/products/:id - Get single product with pricing
  app.get("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const productServiceModule = await import("./productService");
      const product = await productServiceModule.productService.getProductWithPricing(id);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      if (product.status !== 'approved') {
        return res.status(403).json({ error: "Product not available" });
      }

      res.json(product);
    } catch (error) {
      console.error("Get product error:", error);
      res.status(500).json({ error: "Failed to get product" });
    }
  });

  // GET /api/trainer/products - Get trainer's own products
  app.get("/api/trainer/products", requireSupabaseAuth, requireProPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { supabaseAdmin } = await import("./supabase-admin");
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (!profile || profile.role !== 'professional') {
        return res.status(403).json({ error: "Only professionals can access products" });
      }

      const includeArchived = req.query.includeArchived === 'true';
      const productServiceModule = await import("./productService");
      const products = await productServiceModule.productService.getTrainerProducts(userId, includeArchived);
      res.json(products);
    } catch (error) {
      console.error("Get trainer products error:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  // POST /api/trainer/products - Create a new product
  app.post("/api/trainer/products", requireSupabaseAuth, requireProPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { supabaseAdmin } = await import("./supabase-admin");
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (!profile || profile.role !== 'professional') {
        return res.status(403).json({ error: "Only professionals can create products" });
      }

      const { insertTrainerProductSchema, insertProductPricingSchema } = await import("@shared/schema");
      
      const productData = insertTrainerProductSchema.parse({
        ...req.body,
        trainerId: userId,
      });

      const pricingData = {
        amountCents: req.body.amountCents || 0,
        currency: req.body.currency || 'usd',
        billingInterval: req.body.billingInterval || null,
        intervalCount: req.body.intervalCount || null,
        isPrimary: true,
      };

      const productServiceModule = await import("./productService");
      const result = await productServiceModule.productService.createProductWithStripe(productData, pricingData);

      if (!result) {
        return res.status(500).json({ error: "Failed to create product" });
      }

      res.status(201).json(result);
    } catch (error: any) {
      console.error("Create product error:", error);
      res.status(400).json({ error: error.message || "Failed to create product" });
    }
  });

  // PATCH /api/trainer/products/:id - Update a product
  app.patch("/api/trainer/products/:id", requireSupabaseAuth, requireProPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { supabaseAdmin } = await import("./supabase-admin");
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (!profile || profile.role !== 'professional') {
        return res.status(403).json({ error: "Only professionals can update products" });
      }

      const { id } = req.params;
      const { updateTrainerProductSchema } = await import("@shared/schema");
      const updates = updateTrainerProductSchema.parse(req.body);

      const productServiceModule = await import("./productService");
      const product = await productServiceModule.productService.updateProduct(id, userId, updates);

      if (!product) {
        return res.status(404).json({ error: "Product not found or cannot be updated" });
      }

      res.json(product);
    } catch (error: any) {
      console.error("Update product error:", error);
      res.status(400).json({ error: error.message || "Failed to update product" });
    }
  });

  // POST /api/trainer/products/:id/submit - Submit product for review
  app.post("/api/trainer/products/:id/submit", requireSupabaseAuth, requireProPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { supabaseAdmin } = await import("./supabase-admin");
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (!profile || profile.role !== 'professional') {
        return res.status(403).json({ error: "Only professionals can submit products" });
      }

      const { id } = req.params;
      const productServiceModule = await import("./productService");
      await productServiceModule.productService.submitForReview(id, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Submit product error:", error);
      res.status(400).json({ error: error.message || "Failed to submit product" });
    }
  });

  // POST /api/trainer/products/:id/archive - Archive a product
  app.post("/api/trainer/products/:id/archive", requireSupabaseAuth, requireProPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { supabaseAdmin } = await import("./supabase-admin");
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (!profile || profile.role !== 'professional') {
        return res.status(403).json({ error: "Only professionals can archive products" });
      }

      const { id } = req.params;
      const productServiceModule = await import("./productService");
      const success = await productServiceModule.productService.archiveProduct(id, userId);

      if (!success) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Archive product error:", error);
      res.status(400).json({ error: error.message || "Failed to archive product" });
    }
  });

  // POST /api/trainer/products/:id/pricing - Add pricing to a product
  app.post("/api/trainer/products/:id/pricing", requireSupabaseAuth, requireProPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { supabaseAdmin } = await import("./supabase-admin");
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (!profile || profile.role !== 'professional') {
        return res.status(403).json({ error: "Only professionals can add pricing" });
      }

      const { id } = req.params;
      const productServiceModule = await import("./productService");
      const stripeServiceModule = await import("./stripeService");

      const product = await productServiceModule.productService.getProduct(id);
      if (!product || product.trainerId !== userId) {
        return res.status(404).json({ error: "Product not found" });
      }

      if (!product.stripeProductId) {
        return res.status(400).json({ error: "Product not synced with Stripe" });
      }

      const { amountCents, currency, billingInterval, intervalCount, isPrimary } = req.body;

      const recurring = billingInterval ? {
        interval: billingInterval as 'day' | 'week' | 'month' | 'year',
        interval_count: intervalCount || 1,
      } : undefined;

      const stripePrice = await stripeServiceModule.stripeService.createStripePrice(
        product.stripeProductId,
        amountCents,
        currency || 'usd',
        recurring
      );

      const pricing = await productServiceModule.productService.addPricing({
        productId: id,
        amountCents,
        currency: currency || 'usd',
        billingInterval: billingInterval || null,
        intervalCount: intervalCount || null,
        isPrimary: isPrimary || false,
      });

      if (pricing) {
        const { supabaseAdmin } = await import("./supabase-admin");
        await supabaseAdmin
          .from('product_pricing')
          .update({ stripe_price_id: stripePrice.id })
          .eq('id', pricing.id);
        
        pricing.stripePriceId = stripePrice.id;
      }

      res.status(201).json(pricing);
    } catch (error: any) {
      console.error("Add pricing error:", error);
      res.status(400).json({ error: error.message || "Failed to add pricing" });
    }
  });

  // GET /api/trainer/sales - Get trainer's sales
  app.get("/api/trainer/sales", requireSupabaseAuth, requireProPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { supabaseAdmin } = await import("./supabase-admin");
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (!profile || profile.role !== 'professional') {
        return res.status(403).json({ error: "Only professionals can view sales" });
      }

      const productServiceModule = await import("./productService");
      const sales = await productServiceModule.productService.getTrainerSales(userId);
      res.json(sales);
    } catch (error) {
      console.error("Get trainer sales error:", error);
      res.status(500).json({ error: "Failed to get sales" });
    }
  });

  // GET /api/client/purchases - Get client's purchased products
  app.get("/api/client/purchases", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const productServiceModule = await import("./productService");
      const purchases = await productServiceModule.productService.getClientPurchases(userId);
      res.json(purchases);
    } catch (error) {
      console.error("Get client purchases error:", error);
      res.status(500).json({ error: "Failed to get purchases" });
    }
  });

  // GET /api/client/products/:id/access - Check if client has access to a product
  app.get("/api/client/products/:id/access", requireSupabaseAuth, requireClientPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const productServiceModule = await import("./productService");
      const hasAccess = await productServiceModule.productService.checkProductAccess(userId, id);
      res.json({ hasAccess });
    } catch (error) {
      console.error("Check product access error:", error);
      res.status(500).json({ error: "Failed to check access" });
    }
  });

  // POST /api/products/:id/checkout - Create checkout session for product purchase
  app.post("/api/products/:id/checkout", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const { pricingId, successUrl, cancelUrl } = req.body;

      const productServiceModule = await import("./productService");
      const stripeServiceModule = await import("./stripeService");
      const { supabaseAdmin } = await import("./supabase-admin");

      const { data: subscription } = await supabaseAdmin
        .from('user_subscriptions')
        .select('status')
        .eq('user_id', userId)
        .single();

      if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
        return res.status(403).json({ error: "Premium subscription required to purchase products" });
      }

      const product = await productServiceModule.productService.getProductWithPricing(id);
      if (!product || product.status !== 'approved') {
        return res.status(404).json({ error: "Product not available" });
      }

      const pricing = product.pricing.find(p => p.id === pricingId && p.isActive);
      if (!pricing || !pricing.stripePriceId) {
        return res.status(400).json({ error: "Invalid pricing option" });
      }

      const { data: connectAccount } = await supabaseAdmin
        .from('connected_accounts')
        .select('stripe_account_id, charges_enabled')
        .eq('user_id', product.trainerId)
        .single();

      if (!connectAccount?.stripe_account_id || !connectAccount.charges_enabled) {
        return res.status(400).json({ error: "Trainer cannot receive payments" });
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, display_name')
        .eq('id', userId)
        .single();

      if (!profile?.email) {
        return res.status(400).json({ error: "User profile not found" });
      }

      const customerId = await stripeServiceModule.stripeService.getOrCreateCustomer(
        userId,
        profile.email,
        profile.display_name
      );

      const isSubscription = !!pricing.billingInterval;

      const session = await stripeServiceModule.stripeService.createProductCheckoutSession(
        customerId,
        pricing.stripePriceId,
        connectAccount.stripe_account_id,
        successUrl,
        cancelUrl,
        {
          clientId: userId,
          trainerId: product.trainerId,
          productId: id,
          pricingId: pricing.id,
          isSubscription,
        }
      );

      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error("Create product checkout error:", error);
      res.status(500).json({ error: error.message || "Failed to create checkout session" });
    }
  });

  // ADMIN PRODUCT ROUTES

  // GET /api/admin/products - Get all products with filtering
  app.get("/api/admin/products", requireAdmin, async (req: any, res) => {
    try {
      const { status } = req.query;
      const productServiceModule = await import("./productService");
      const { supabaseAdmin } = await import("./supabase-admin");

      let query = supabaseAdmin
        .from('trainer_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data: products, error } = await query;

      if (error) {
        throw error;
      }

      res.json(products || []);
    } catch (error) {
      console.error("Get admin products error:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  // GET /api/admin/products/pending - Get products pending review
  app.get("/api/admin/products/pending", requireAdmin, async (_req: any, res) => {
    try {
      const productServiceModule = await import("./productService");
      const products = await productServiceModule.productService.getPendingProducts();
      res.json(products);
    } catch (error) {
      console.error("Get pending products error:", error);
      res.status(500).json({ error: "Failed to get pending products" });
    }
  });

  // POST /api/admin/products/:id/approve - Approve a product
  app.post("/api/admin/products/:id/approve", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.id || req.session?.adminUserId;

      const productServiceModule = await import("./productService");
      const success = await productServiceModule.productService.approveProduct(id, adminId);

      if (!success) {
        return res.status(400).json({ error: "Could not approve product" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Approve product error:", error);
      res.status(500).json({ error: "Failed to approve product" });
    }
  });

  // POST /api/admin/products/:id/reject - Reject a product
  app.post("/api/admin/products/:id/reject", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: "Rejection reason required" });
      }

      const productServiceModule = await import("./productService");
      const success = await productServiceModule.productService.rejectProduct(id, reason);

      if (!success) {
        return res.status(400).json({ error: "Could not reject product" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Reject product error:", error);
      res.status(500).json({ error: "Failed to reject product" });
    }
  });

  // GET /api/admin/products/metrics - Get product marketplace metrics
  app.get("/api/admin/products/metrics", requireAdmin, async (_req: any, res) => {
    try {
      const productServiceModule = await import("./productService");
      const metrics = await productServiceModule.productService.getProductMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Get product metrics error:", error);
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  // POST /api/admin/purchases/:id/refund - Refund a purchase
  app.post("/api/admin/purchases/:id/refund", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const productServiceModule = await import("./productService");
      const success = await productServiceModule.productService.refundPurchase(id, reason);

      if (!success) {
        return res.status(400).json({ error: "Could not refund purchase" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Refund purchase error:", error);
      res.status(500).json({ error: "Failed to refund purchase" });
    }
  });

  // ============================================
  // Phase 4: Trainer Storefront Routes
  // ============================================

  // GET /api/storefronts - Get all published storefronts
  app.get("/api/storefronts", async (_req, res) => {
    try {
      const storefrontService = await import("./storefrontService");
      const storefronts = await storefrontService.getPublishedStorefronts();
      res.json(storefronts);
    } catch (error) {
      console.error("Get storefronts error:", error);
      res.status(500).json({ error: "Failed to get storefronts" });
    }
  });

  // GET /api/storefront/:slug - Get public storefront by slug
  app.get("/api/storefront/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const storefrontService = await import("./storefrontService");
      const storefront = await storefrontService.getStorefrontBySlug(slug);

      if (!storefront) {
        return res.status(404).json({ error: "Storefront not found" });
      }

      // Only return if published (public access)
      if (!storefront.isPublished) {
        return res.status(404).json({ error: "Storefront not found" });
      }

      res.json(storefront);
    } catch (error) {
      console.error("Get storefront error:", error);
      res.status(500).json({ error: "Failed to get storefront" });
    }
  });

  // GET /api/storefront/:slug/products - Get products for a public storefront
  app.get("/api/storefront/:slug/products", async (req, res) => {
    try {
      const { slug } = req.params;
      const storefrontService = await import("./storefrontService");
      const storefront = await storefrontService.getStorefrontBySlug(slug);

      if (!storefront || !storefront.isPublished) {
        return res.status(404).json({ error: "Storefront not found" });
      }

      const products = await storefrontService.getStorefrontProducts(storefront.trainerId);
      res.json(products);
    } catch (error) {
      console.error("Get storefront products error:", error);
      res.status(500).json({ error: "Failed to get storefront products" });
    }
  });

  // GET /api/trainer/storefront - Get trainer's own storefront (authenticated)
  app.get("/api/trainer/storefront", requireSupabaseAuth, requireProPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const trainerId = req.supabaseUser?.id;
      if (!trainerId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify user is a professional
      const { data: profile } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('role, display_name')
        .eq('id', trainerId)
        .single();

      if (!profile || profile.role !== 'professional') {
        return res.status(403).json({ error: "Only professionals can access storefronts" });
      }

      const storefrontService = await import("./storefrontService");
      
      // Ensure storefront exists (create if not)
      const storefront = await storefrontService.ensureStorefrontExists(trainerId, profile.display_name);
      res.json(storefront);
    } catch (error) {
      console.error("Get trainer storefront error:", error);
      res.status(500).json({ error: "Failed to get storefront" });
    }
  });

  // PATCH /api/trainer/storefront - Update trainer's storefront
  app.patch("/api/trainer/storefront", requireSupabaseAuth, requireProPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const trainerId = req.supabaseUser?.id;
      if (!trainerId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify user is a professional
      const { data: profile } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', trainerId)
        .single();

      if (!profile || profile.role !== 'professional') {
        return res.status(403).json({ error: "Only professionals can update storefronts" });
      }

      const storefrontService = await import("./storefrontService");
      const { updateTrainerStorefrontSchema } = await import("@shared/schema");

      const parseResult = updateTrainerStorefrontSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
      }

      // If changing slug, check availability
      if (parseResult.data.slug) {
        const isAvailable = await storefrontService.checkSlugAvailability(
          parseResult.data.slug, 
          trainerId
        );
        if (!isAvailable) {
          return res.status(400).json({ error: "This URL is already taken" });
        }
      }

      const storefront = await storefrontService.updateStorefront(trainerId, parseResult.data);
      res.json(storefront);
    } catch (error: any) {
      console.error("Update storefront error:", error);
      if (error.message?.includes('reserved')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update storefront" });
    }
  });

  // GET /api/trainer/storefront/preview - Get trainer's storefront with products for preview (authenticated, owner only)
  app.get("/api/trainer/storefront/preview", requireSupabaseAuth, requireProPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const trainerId = req.supabaseUser?.id;
      if (!trainerId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify user is a professional
      const { data: profile } = await supabaseAdmin.supabaseAdmin
        .from('profiles')
        .select('role, display_name')
        .eq('id', trainerId)
        .single();

      if (!profile || profile.role !== 'professional') {
        return res.status(403).json({ error: "Only professionals can preview storefronts" });
      }

      // Verify user has a professional profile
      const { data: proProfile } = await supabaseAdmin.supabaseAdmin
        .from('professional_profiles')
        .select('id, verification_status')
        .eq('user_id', trainerId)
        .single();

      if (!proProfile) {
        return res.status(403).json({ error: "Professional profile not found" });
      }

      const storefrontService = await import("./storefrontService");
      
      // Get storefront (create if not exists)
      const storefront = await storefrontService.ensureStorefrontExists(trainerId, profile.display_name);
      
      // Validate ownership - storefront.trainerId must match authenticated user
      if (storefront.trainerId !== trainerId) {
        return res.status(403).json({ error: "You can only preview your own storefront" });
      }

      // Get products for preview (even if storefront is unpublished)
      const products = await storefrontService.getStorefrontProducts(trainerId);

      res.json({
        ...storefront,
        products,
      });
    } catch (error) {
      console.error("Get trainer storefront preview error:", error);
      res.status(500).json({ error: "Failed to get storefront preview" });
    }
  });

  // GET /api/trainer/storefront/check-slug/:slug - Check if slug is available
  app.get("/api/trainer/storefront/check-slug/:slug", requireSupabaseAuth, requireProPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const trainerId = req.supabaseUser?.id;
      const { slug } = req.params;

      if (!trainerId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const storefrontService = await import("./storefrontService");
      const isAvailable = await storefrontService.checkSlugAvailability(slug, trainerId);
      res.json({ available: isAvailable });
    } catch (error) {
      console.error("Check slug availability error:", error);
      res.status(500).json({ error: "Failed to check slug availability" });
    }
  });

  // GET /api/trainer/storefront/products - Get trainer's products for their storefront
  app.get("/api/trainer/storefront/products", requireSupabaseAuth, requireProPortalContext, async (req: AuthenticatedRequest, res) => {
    try {
      const trainerId = req.supabaseUser?.id;
      if (!trainerId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const storefrontService = await import("./storefrontService");
      const products = await storefrontService.getStorefrontProducts(trainerId);
      res.json(products);
    } catch (error) {
      console.error("Get trainer storefront products error:", error);
      res.status(500).json({ error: "Failed to get storefront products" });
    }
  });

  // ============================================
  // Phase 5: Marketplace Analytics Routes
  // ============================================

  // GET /api/admin/marketplace/metrics - Get marketplace GMV metrics
  app.get("/api/admin/marketplace/metrics", requireAdmin, async (_req: any, res) => {
    try {
      const analyticsService = await import("./marketplaceAnalyticsService");
      const metrics = await analyticsService.getMarketplaceGmvMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Get marketplace metrics error:", error);
      res.status(500).json({ error: "Failed to get marketplace metrics" });
    }
  });

  // GET /api/admin/marketplace/gmv-daily - Get daily GMV data for charts
  app.get("/api/admin/marketplace/gmv-daily", requireAdmin, async (req: any, res) => {
    try {
      const days = parseInt(req.query.days) || 30;
      const analyticsService = await import("./marketplaceAnalyticsService");
      const data = await analyticsService.getGmvDaily(days);
      res.json(data);
    } catch (error) {
      console.error("Get daily GMV error:", error);
      res.status(500).json({ error: "Failed to get daily GMV data" });
    }
  });

  // GET /api/admin/marketplace/trainer-earnings - Get trainer earnings summary
  app.get("/api/admin/marketplace/trainer-earnings", requireAdmin, async (_req: any, res) => {
    try {
      const analyticsService = await import("./marketplaceAnalyticsService");
      const earnings = await analyticsService.getTrainerEarnings();
      res.json(earnings);
    } catch (error) {
      console.error("Get trainer earnings error:", error);
      res.status(500).json({ error: "Failed to get trainer earnings" });
    }
  });

  // GET /api/admin/marketplace/product-sales - Get product sales metrics with filtering
  app.get("/api/admin/marketplace/product-sales", requireAdmin, async (req: any, res) => {
    try {
      const { status, trainerId, search } = req.query;
      const analyticsService = await import("./marketplaceAnalyticsService");
      const metrics = await analyticsService.getProductSalesMetrics({
        status,
        trainerId,
        search,
      });
      res.json(metrics);
    } catch (error) {
      console.error("Get product sales metrics error:", error);
      res.status(500).json({ error: "Failed to get product sales metrics" });
    }
  });

  // GET /api/admin/marketplace/purchases - Get recent purchases with filtering
  app.get("/api/admin/marketplace/purchases", requireAdmin, async (req: any, res) => {
    try {
      const { limit, status, trainerId, clientId } = req.query;
      const analyticsService = await import("./marketplaceAnalyticsService");
      const purchases = await analyticsService.getRecentPurchases({
        limit: limit ? parseInt(limit) : undefined,
        status,
        trainerId,
        clientId,
      });
      res.json(purchases);
    } catch (error) {
      console.error("Get recent purchases error:", error);
      res.status(500).json({ error: "Failed to get purchases" });
    }
  });

  // GET /api/admin/marketplace/checkout-abandonment - Get checkout abandonment metrics
  app.get("/api/admin/marketplace/checkout-abandonment", requireAdmin, async (_req: any, res) => {
    try {
      const analyticsService = await import("./marketplaceAnalyticsService");
      const metrics = await analyticsService.getCheckoutAbandonmentMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Get checkout abandonment metrics error:", error);
      res.status(500).json({ error: "Failed to get checkout abandonment metrics" });
    }
  });

  // GET /api/admin/marketplace/webhook-events - Get webhook events summary
  app.get("/api/admin/marketplace/webhook-events", requireAdmin, async (_req: any, res) => {
    try {
      const analyticsService = await import("./marketplaceAnalyticsService");
      const events = await analyticsService.getWebhookEventsSummary();
      res.json(events);
    } catch (error) {
      console.error("Get webhook events summary error:", error);
      res.status(500).json({ error: "Failed to get webhook events summary" });
    }
  });

  // GET /api/admin/marketplace/webhook-events/pending - Get pending webhook events
  app.get("/api/admin/marketplace/webhook-events/pending", requireAdmin, async (_req: any, res) => {
    try {
      const analyticsService = await import("./marketplaceAnalyticsService");
      const events = await analyticsService.getPendingWebhookEvents();
      res.json(events);
    } catch (error) {
      console.error("Get pending webhook events error:", error);
      res.status(500).json({ error: "Failed to get pending webhook events" });
    }
  });

  // ============================================
  // Phase 2: Storefront Routes
  // ============================================

  // GET /api/pro/storefront - Get authenticated pro's storefront with all child data
  app.get("/api/pro/storefront", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const storefront = await storefrontData.getStorefrontByTrainerId(userId);
      
      if (!storefront) {
        return res.status(404).json({ error: "Storefront not found" });
      }
      
      res.json(storefront);
    } catch (error) {
      console.error("Get pro storefront error:", error);
      res.status(500).json({ error: "Failed to get storefront" });
    }
  });

  // PUT /api/pro/storefront - Update authenticated pro's storefront
  app.put("/api/pro/storefront", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const rawUpdates = req.body;
      
      // Whitelist mutable columns only - prevent privilege escalation
      const MUTABLE_FIELDS = [
        'slug', 'headline', 'bio', 'cover_image_url', 'specialties', 'credentials',
        'experience_years', 'is_published', 'business_name', 'intro_video_url',
        'video_thumbnail_url', 'accent_color', 'social_links', 'accepting_new_clients',
        'waitlist_enabled', 'booking_url', 'profession_types', 'timezone', 'languages', 
        'storefront_variation', 'location_city', 'location_state', 'location_country'
      ];
      
      const updates: Record<string, any> = {};
      for (const field of MUTABLE_FIELDS) {
        if (rawUpdates[field] !== undefined) {
          updates[field] = rawUpdates[field];
        }
      }
      
      if (updates.accent_color && !storefrontData.validateAccentColor(updates.accent_color)) {
        return res.status(400).json({ 
          error: "Invalid accent color. Must be one of: " + storefrontData.ACCENT_COLOR_SAFELIST.join(", ")
        });
      }
      
      // Fetch current storefront once for validation and comparison
      let current = await storefrontData.getStorefrontByTrainerId(userId);
      
      // If storefront doesn't exist, create it (upsert behavior for Phase 3 data consolidation)
      if (!current) {
        // Generate a slug from user profile display name or userId
        const { data: profile } = await supabaseAdmin.supabaseAdmin
          .from('profiles')
          .select('display_name')
          .eq('id', userId)
          .single();
        
        // Sanitize and generate slug: lowercase, alphanumeric with hyphens, trim edges, max 50 chars
        let baseName = (profile?.display_name || 'pro')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, ''); // Strip leading/trailing hyphens
        
        // Ensure baseName has content after sanitization
        if (!baseName) baseName = 'pro';
        
        // Combine with userId prefix and clamp to 50 chars
        const uniqueSlug = `${baseName}-${userId.slice(0, 8)}`.slice(0, 50);
        
        const newStorefront = await storefrontData.createStorefront(userId, uniqueSlug);
        if (!newStorefront) {
          return res.status(500).json({ error: "Failed to create storefront" });
        }
        
        // Re-fetch to get full StorefrontWithDetails type
        current = await storefrontData.getStorefrontByTrainerId(userId);
        if (!current) {
          return res.status(500).json({ error: "Failed to retrieve created storefront" });
        }
      }
      
      // Validate slug if being updated and actually changing
      if (updates.slug !== undefined && updates.slug !== current.slug) {
        const slug = updates.slug;
        
        // Check if user is allowed to edit slug:
        // Either custom_slugs feature is enabled globally OR user has purchased premium slug
        const { data: customSlugsFeature } = await supabaseAdmin.supabaseAdmin
          .from('features')
          .select('is_active')
          .eq('code', 'custom_slugs')
          .maybeSingle();
        
        const customSlugsEnabled = customSlugsFeature?.is_active ?? false;
        const hasPremiumSlug = current.has_premium_slug ?? false;
        
        if (!customSlugsEnabled && !hasPremiumSlug) {
          return res.status(403).json({ 
            error: "Custom slug editing is not available. Purchase a premium slug to unlock this feature." 
          });
        }
        
        if (!slug || slug.length < 3 || slug.length > 50) {
          return res.status(400).json({ error: "Slug must be between 3 and 50 characters" });
        }
        
        if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
          return res.status(400).json({ error: "Slug must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric" });
        }
        
        const available = await storefrontData.checkSlugAvailability(slug, userId);
        if (!available) {
          return res.status(409).json({ error: "Slug is already taken" });
        }
      }
      
      // Handle publish/unpublish timestamp logic
      // Determine the resulting publish state after this update
      const resultingPublishState = updates.is_published ?? current.is_published;
      
      if (updates.is_published === true && !current.is_published) {
        // Transitioning draft → published: set published_at
        updates.published_at = new Date().toISOString();
      } else if (resultingPublishState === false && current.published_at) {
        // Resulting state is draft AND has stale published_at: clear it
        // This handles both explicit unpublish AND healing of inconsistent data
        updates.published_at = null;
      }
      // If resulting state is published and published_at exists: leave untouched
      
      const result = await storefrontData.updateStorefront(userId, updates);
      
      if (!result) {
        return res.status(500).json({ error: "Update failed" });
      }
      
      // Refetch to return fully hydrated StorefrontWithDetails
      const fullStorefront = await storefrontData.getStorefrontByTrainerId(userId);
      res.json(fullStorefront);
    } catch (error: any) {
      console.error("Update pro storefront error:", error);
      
      // Handle Postgres unique constraint violation
      if (error?.code === '23505') {
        return res.status(409).json({ error: "Slug is already taken" });
      }
      
      res.status(500).json({ error: "Failed to update storefront" });
    }
  });

  // GET /api/pro/storefront/slug-availability - Check if slug is available
  app.get("/api/pro/storefront/slug-availability", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const slug = req.query.slug as string;
      
      if (!slug || slug.length < 3 || slug.length > 50) {
        return res.status(400).json({ error: "Slug must be between 3 and 50 characters" });
      }
      
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
        return res.status(400).json({ error: "Slug must be lowercase alphanumeric with hyphens" });
      }
      
      const available = await storefrontData.checkSlugAvailability(slug, userId);
      res.json({ available, slug });
    } catch (error) {
      console.error("Check slug availability error:", error);
      res.status(500).json({ error: "Failed to check slug availability" });
    }
  });

  // POST /api/pro/storefront/services - Add a service
  app.post("/api/pro/storefront/services", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const storefront = await storefrontData.getStorefrontByTrainerId(userId);
      
      if (!storefront) {
        return res.status(404).json({ error: "Storefront not found" });
      }
      
      const service = await storefrontData.addService(storefront.id, req.body);
      
      if (!service) {
        return res.status(500).json({ error: "Failed to add service" });
      }
      
      res.json(service);
    } catch (error) {
      console.error("Add service error:", error);
      res.status(500).json({ error: "Failed to add service" });
    }
  });

  // PUT /api/pro/storefront/services/:id - Update a service
  app.put("/api/pro/storefront/services/:id", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const serviceId = req.params.id;
      
      const service = await storefrontData.updateService(serviceId, userId, req.body);
      
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }
      
      res.json(service);
    } catch (error) {
      console.error("Update service error:", error);
      res.status(500).json({ error: "Failed to update service" });
    }
  });

  // DELETE /api/pro/storefront/services/:id - Delete a service
  app.delete("/api/pro/storefront/services/:id", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const serviceId = req.params.id;
      
      const deleted = await storefrontData.deleteService(serviceId, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Service not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete service error:", error);
      res.status(500).json({ error: "Failed to delete service" });
    }
  });

  // POST /api/pro/storefront/testimonials - Add a testimonial
  app.post("/api/pro/storefront/testimonials", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const storefront = await storefrontData.getStorefrontByTrainerId(userId);
      
      if (!storefront) {
        return res.status(404).json({ error: "Storefront not found" });
      }
      
      const testimonial = await storefrontData.addTestimonial(storefront.id, req.body);
      
      if (!testimonial) {
        return res.status(500).json({ error: "Failed to add testimonial" });
      }
      
      res.json(testimonial);
    } catch (error) {
      console.error("Add testimonial error:", error);
      res.status(500).json({ error: "Failed to add testimonial" });
    }
  });

  // PUT /api/pro/storefront/testimonials/:id - Update a testimonial
  app.put("/api/pro/storefront/testimonials/:id", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const testimonialId = req.params.id;
      
      const testimonial = await storefrontData.updateTestimonial(testimonialId, userId, req.body);
      
      if (!testimonial) {
        return res.status(404).json({ error: "Testimonial not found" });
      }
      
      res.json(testimonial);
    } catch (error) {
      console.error("Update testimonial error:", error);
      res.status(500).json({ error: "Failed to update testimonial" });
    }
  });

  // DELETE /api/pro/storefront/testimonials/:id - Delete a testimonial
  app.delete("/api/pro/storefront/testimonials/:id", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const testimonialId = req.params.id;
      
      const deleted = await storefrontData.deleteTestimonial(testimonialId, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Testimonial not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete testimonial error:", error);
      res.status(500).json({ error: "Failed to delete testimonial" });
    }
  });

  // POST /api/pro/storefront/transformations - Add a transformation
  app.post("/api/pro/storefront/transformations", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const storefront = await storefrontData.getStorefrontByTrainerId(userId);
      
      if (!storefront) {
        return res.status(404).json({ error: "Storefront not found" });
      }
      
      const transformation = await storefrontData.addTransformation(storefront.id, req.body);
      
      if (!transformation) {
        return res.status(500).json({ error: "Failed to add transformation" });
      }
      
      res.json(transformation);
    } catch (error) {
      console.error("Add transformation error:", error);
      res.status(500).json({ error: "Failed to add transformation" });
    }
  });

  // PUT /api/pro/storefront/transformations/:id - Update a transformation
  app.put("/api/pro/storefront/transformations/:id", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const transformationId = req.params.id;
      
      const transformation = await storefrontData.updateTransformation(transformationId, userId, req.body);
      
      if (!transformation) {
        return res.status(404).json({ error: "Transformation not found" });
      }
      
      res.json(transformation);
    } catch (error) {
      console.error("Update transformation error:", error);
      res.status(500).json({ error: "Failed to update transformation" });
    }
  });

  // DELETE /api/pro/storefront/transformations/:id - Delete a transformation
  app.delete("/api/pro/storefront/transformations/:id", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const transformationId = req.params.id;
      
      const deleted = await storefrontData.deleteTransformation(transformationId, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Transformation not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete transformation error:", error);
      res.status(500).json({ error: "Failed to delete transformation" });
    }
  });

  // GET /api/storefronts/:slug - Public storefront fetch (published only, or owner preview)
  app.get("/api/storefronts/:slug", async (req: AuthenticatedRequest, res) => {
    try {
      const slug = req.params.slug;
      
      // Try to get authenticated user for owner preview
      let requesterId: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const user = await validateSupabaseToken(token);
        if (user) {
          requesterId = user.id;
        }
      }
      
      const storefront = await storefrontData.getStorefrontBySlug(slug, requesterId);
      
      if (!storefront) {
        return res.status(404).json({ error: "Storefront not found" });
      }
      
      res.json(storefront);
    } catch (error) {
      console.error("Get public storefront error:", error);
      res.status(500).json({ error: "Failed to get storefront" });
    }
  });

  // GET /api/marketplace/discover - Published storefronts with filters and pagination
  app.get("/api/marketplace/discover", async (req, res) => {
    try {
      const filters: storefrontData.MarketplaceFilters = {
        language: req.query.language as string | undefined,
        professionType: req.query.professionType as string | undefined,
        acceptingClients: req.query.acceptingClients === 'true' ? true : 
                          req.query.acceptingClients === 'false' ? false : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      };
      
      const result = await storefrontData.getMarketplaceStorefronts(filters);
      res.json(result);
    } catch (error) {
      console.error("Get marketplace storefronts error:", error);
      res.status(500).json({ error: "Failed to get marketplace storefronts" });
    }
  });

  // GET /api/marketplace/mine - Client's connected trainers (requires auth)
  app.get("/api/marketplace/mine", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const storefronts = await storefrontData.getClientConnectedTrainers(userId);
      res.json(storefronts);
    } catch (error) {
      console.error("Get my trainers error:", error);
      res.status(500).json({ error: "Failed to get connected trainers" });
    }
  });

  // GET /api/marketplace/pro/:proId - Professional detail with products (requires auth)
  // Returns profile, products with pricing, testimonials, transformations, and connection status
  app.get("/api/marketplace/pro/:proId", requireSupabaseAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { proId } = req.params;
      const requesterId = req.supabaseUser!.id;
      
      const professional = await storefrontData.getProfessionalDetail(proId, requesterId);
      
      if (!professional) {
        return res.status(404).json({ error: "Professional not found or not accessible" });
      }
      
      res.json(professional);
    } catch (error) {
      console.error("Get professional detail error:", error);
      res.status(500).json({ error: "Failed to get professional details" });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize WebSocket server for real-time messaging
  initWebSocket(httpServer);
  
  return httpServer;
}
