export type AdminUser = { id: string; username: string };

export type SupabaseUser = {
  id: string;
  email: string;
  displayName?: string;
  role?: string;
  createdAt: string;
  lastSignIn?: string;
};

export type EnhancedUser = {
  id: string;
  email: string;
  displayName?: string;
  role: string;
  createdAt: string;
  lastSignIn?: string;
  isPremium: boolean;
  hasAdminOverride: boolean;
  subscriptionStatus: string | null;
  adminOverrideDetails: {
    grantedBy?: string;
    grantedAt?: string;
    expiresAt?: string;
    reason?: string;
  } | null;
};

export type UsersResponse = {
  users: EnhancedUser[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type UserDependencies = {
  userId: string;
  displayName: string;
  role: string;
  dependencies: {
    messages: number;
    conversations: number;
    purchases: number;
    products: number;
  };
  warnings: string[];
};

export type EquipmentOption = {
  id: string;
  name: string;
  category: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

export type GoalType = {
  id: string;
  name: string;
  description: string | null;
  default_rep_range: string | null;
  default_rest_seconds: number | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

export type Exercise = {
  id: string;
  name: string;
  category: string;
  muscle_groups: string[];
  equipment_tags: string[];
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  instructions: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  demonstration_notes: string | null;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RoutineBlueprint = {
  id: string;
  name: string;
  description: string | null;
  owner_type: 'platform' | 'professional' | 'client';
  owner_id: string | null;
  created_for_client_id: string | null;
  source_blueprint_id: string | null;
  creation_method: 'manual' | 'template' | 'ai_assisted';
  goal_type_id: string | null;
  equipment_profile: string[] | null;
  duration_weeks: number | null;
  sessions_per_week: number | null;
  is_template: boolean;
  is_archived: boolean;
  ai_prompt: string | null;
  ai_response: any;
  created_at: string;
  updated_at: string;
};

export type RoutineVersion = {
  id: string;
  blueprint_id: string;
  version_number: number;
  status: 'draft' | 'pending_review' | 'active' | 'archived';
  notes: string | null;
  published_at: string | null;
  created_at: string;
};

export type LoadDirective = 'absolute' | 'assisted' | 'bodyweight' | 'open';
export type WeightUnitType = 'kg' | 'lbs';

export type RoutineVersionExercise = {
  id: string;
  routine_version_id: string;
  exercise_id: string | null;
  custom_exercise_name: string | null;
  day_number: number;
  order_in_day: number;
  sets: number;
  reps_min: number | null;
  reps_max: number | null;
  rest_seconds: number | null;
  notes: string | null;
  superset_group: string | null;
  target_weight_kg: number | null;
  entered_weight_value: number | null;
  entered_weight_unit: WeightUnitType | null;
  load_directive: LoadDirective;
  special_instructions: string | null;
  created_at: string;
};

export type RoutineAssignment = {
  id: string;
  routine_version_id: string;
  client_id: string;
  assigned_by_pro_id: string | null;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionMetrics = {
  totalActive: number;
  totalTrialing: number;
  totalCanceled: number;
  totalPastDue: number;
  newThisMonth: number;
  canceledThisMonth: number;
};

export type Subscriber = {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete';
  current_period_start: string | null;
  current_period_end: string | null;
  trial_start: string | null;
  trial_end: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
  grace_period_end: string | null;
  created_at: string;
  updated_at: string;
  profiles: {
    email: string;
    display_name: string | null;
  };
};

export type PromoCode = {
  id: string;
  code: string;
  stripe_coupon_id: string | null;
  discount_type: 'percent' | 'amount';
  discount_value: number;
  max_redemptions: number | null;
  redemption_count: number;
  first_time_only: boolean;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
};

export type StripePrice = {
  id: string;
  unit_amount: number | null;
  currency: string;
  nickname: string | null;
  recurring: {
    interval: 'day' | 'week' | 'month' | 'year';
    interval_count: number;
  } | null;
  metadata: Record<string, string>;
  active: boolean;
};

export type StripeProduct = {
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, string>;
  prices: StripePrice[];
};

export type ConnectedAccount = {
  id: number;
  user_id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_complete: boolean;
  requirements_disabled_reason: string | null;
  default_currency: string;
  created_at: string;
  updated_at: string;
  display_name?: string;
  email?: string;
};

export type AdminSection = 'business' | 'users' | 'catalog' | 'system';
