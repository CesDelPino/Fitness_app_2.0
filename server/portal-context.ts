import { supabaseAdmin } from './supabase-admin';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export type PortalMode = 'pro' | 'client';
export type ProfileStatus = 'active' | 'pending_approval' | 'suspended' | null;

export interface PortalContextCookie {
  mode: PortalMode;
  profileId: string;
  expires: number;
}

export interface AvailableRolesResponse {
  availableRoles: PortalMode[];
  proProfileId: string | null;
  proProfileStatus: ProfileStatus;
  clientProfileId: string | null;
  clientProfileStatus: ProfileStatus;
}

interface AuthenticatedRequest extends Request {
  supabaseUser?: { id: string; email?: string };
  portalContext?: {
    mode: PortalMode;
    profileId: string;
  };
}

const COOKIE_NAME = 'loba_portal_ctx';
const COOKIE_MAX_AGE_MS = 60 * 60 * 1000;
const COOKIE_REFRESH_THRESHOLD_MS = 10 * 60 * 1000;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }
  return secret;
}

export function signCookie(data: PortalContextCookie): string {
  const payload = `${data.mode}.${data.profileId}.${data.expires}`;
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('hex');
  return `${payload}.${signature}`;
}

export function parseCookie(cookieValue: string): PortalContextCookie | null {
  try {
    const parts = cookieValue.split('.');
    if (parts.length !== 4) {
      return null;
    }

    const [mode, profileId, expiresStr, signature] = parts;
    const expires = parseInt(expiresStr, 10);

    if (!['pro', 'client'].includes(mode) || isNaN(expires)) {
      return null;
    }

    const payload = `${mode}.${profileId}.${expiresStr}`;
    const expectedSignature = crypto
      .createHmac('sha256', getSessionSecret())
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('[portal-context] Invalid cookie signature');
      return null;
    }

    if (Date.now() > expires) {
      console.warn('[portal-context] Cookie expired');
      return null;
    }

    return {
      mode: mode as PortalMode,
      profileId,
      expires,
    };
  } catch (error) {
    console.error('[portal-context] Error parsing cookie:', error);
    return null;
  }
}

export function isNearExpiry(expires: number): boolean {
  return expires - Date.now() < COOKIE_REFRESH_THRESHOLD_MS;
}

export function setCookieOnResponse(res: Response, mode: PortalMode, profileId: string): number {
  const expires = Date.now() + COOKIE_MAX_AGE_MS;
  const cookieValue = signCookie({ mode, profileId, expires });
  
  res.cookie(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
  
  return expires;
}

export function clearCookieOnResponse(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

export async function getAvailableRoles(userId: string): Promise<AvailableRolesResponse> {
  const availableRoles: PortalMode[] = [];
  let proProfileId: string | null = null;
  let proProfileStatus: ProfileStatus = null;
  let clientProfileId: string | null = null;
  let clientProfileStatus: ProfileStatus = null;

  const { data: proProfile, error: proError } = await supabaseAdmin
    .from('professional_profiles')
    .select('id, verification_status')
    .eq('user_id', userId)
    .single();

  if (proProfile && !proError) {
    proProfileId = proProfile.id;
    
    if (proProfile.verification_status === 'approved') {
      proProfileStatus = 'active';
      availableRoles.push('pro');
    } else if (proProfile.verification_status === 'pending') {
      proProfileStatus = 'pending_approval';
    } else if (proProfile.verification_status === 'rejected') {
      proProfileStatus = 'suspended';
    }
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();
  
  if (profile) {
    clientProfileId = userId;
    clientProfileStatus = 'active';
    availableRoles.push('client');
  }

  return {
    availableRoles,
    proProfileId,
    proProfileStatus,
    clientProfileId,
    clientProfileStatus,
  };
}

export async function verifyProfileOwnership(
  userId: string,
  mode: PortalMode,
  profileId: string
): Promise<boolean> {
  if (mode === 'pro') {
    const { data, error } = await supabaseAdmin
      .from('professional_profiles')
      .select('id')
      .eq('id', profileId)
      .eq('user_id', userId)
      .single();

    return !!data && !error;
  } else {
    return profileId === userId;
  }
}

export async function logPortalSwitch(
  userId: string,
  fromPortal: PortalMode | null,
  toPortal: PortalMode,
  ipAddress: string | null
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('portal_audit_logs').insert({
      user_id: userId,
      from_portal: fromPortal,
      to_portal: toPortal,
      ip_address: ipAddress,
      created_at: new Date().toISOString(),
    });
    
    if (error) {
      if (error.code === '42P01') {
        console.log('[portal-context] portal_audit_logs table not yet created, skipping audit log');
      } else {
        console.error('[portal-context] Failed to log portal switch:', error);
      }
    }
  } catch (error) {
    console.error('[portal-context] Failed to log portal switch:', error);
  }
}

export function extractPortalContext(req: Request): PortalContextCookie | null {
  const cookieValue = req.cookies?.[COOKIE_NAME];
  if (!cookieValue) {
    return null;
  }
  return parseCookie(cookieValue);
}

export function requireProContext(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers['x-portal-context'];
  if (header !== 'pro') {
    res.status(403).json({ error: 'Pro portal context required' });
    return;
  }

  const context = extractPortalContext(req);
  if (!context || context.mode !== 'pro') {
    res.status(403).json({ error: 'Invalid portal context' });
    return;
  }

  req.portalContext = {
    mode: context.mode,
    profileId: context.profileId,
  };

  next();
}

export function requireClientContext(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers['x-portal-context'];
  if (header !== 'client') {
    res.status(403).json({ error: 'Client portal context required' });
    return;
  }

  const context = extractPortalContext(req);
  if (!context || context.mode !== 'client') {
    res.status(403).json({ error: 'Invalid portal context' });
    return;
  }

  req.portalContext = {
    mode: context.mode,
    profileId: context.profileId,
  };

  next();
}

export async function validateAndRefreshContext(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.supabaseUser?.id;
  if (!userId) {
    return next();
  }

  const context = extractPortalContext(req);
  if (!context) {
    return next();
  }

  const isOwner = await verifyProfileOwnership(userId, context.mode, context.profileId);
  if (!isOwner) {
    clearCookieOnResponse(res);
    res.status(403).json({ error: 'Portal context does not belong to authenticated user' });
    return;
  }

  if (isNearExpiry(context.expires)) {
    setCookieOnResponse(res, context.mode, context.profileId);
  }

  req.portalContext = {
    mode: context.mode,
    profileId: context.profileId,
  };

  next();
}
