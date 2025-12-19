export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'client' | 'professional' | 'admin';
export type ProfessionalRoleType = 'nutritionist' | 'trainer' | 'coach';
export type RelationshipStatus = 'pending' | 'active' | 'ended';
export type InvitationStatus = 'pending' | 'accepted' | 'expired';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type FastStatus = 'active' | 'ended';
export type FastMode = 'duration' | 'target_time';
export type WorkoutType = 'strength_traditional' | 'strength_circuit' | 'cardio' | 'other';
export type FoodSource = 'barcode' | 'ai_text' | 'ai_image' | 'manual' | 'imported';
export type FoodVerificationStatus = 'verified' | 'user_contributed' | 'pending';
export type ProgressPhotoPose = 'front' | 'side' | 'back';
export type NutritionTargetStatus = 'pending' | 'accepted' | 'declined';
export type NutritionTargetSource = 'professional' | 'client';

// Permission system types
export type PermissionCategory = 'nutrition' | 'workouts' | 'weight' | 'photos' | 'checkins' | 'fasting' | 'profile';
export type PermissionType = 'read' | 'write';
export type PermissionStatus = 'pending' | 'granted' | 'revoked';
export type PermissionGrantedBy = 'client' | 'admin' | 'system';
export type PermissionRequestStatus = 'pending' | 'approved' | 'denied';
export type InvitationPermissionRequestedBy = 'professional' | 'admin' | 'system';

// Invitation permission types for Phase 3
export interface InvitationPermission {
  id: string;
  invitation_id: string;
  permission_slug: PermissionSlug;
  requested_at: string;
  requested_by: InvitationPermissionRequestedBy;
}

export interface PermissionRequest {
  id: string;
  relationship_id: string;
  permission_slug: PermissionSlug;
  requested_at: string;
  status: PermissionRequestStatus;
  responded_at: string | null;
  client_id: string;
  notes: string | null;
}

// Invitation details response from fetch_invitation_details RPC
export interface InvitationDetailsResponse {
  success: boolean;
  error?: string;
  invitation?: {
    id: string;
    client_email: string;
    role_type: ProfessionalRoleType;
    created_at: string;
  };
  professional?: {
    id: string;
    user_id: string;
    name: string;
  };
  permissions?: Array<{
    slug: PermissionSlug;
    display_name: string;
    description: string | null;
    category: PermissionCategory;
    permission_type: PermissionType;
    is_exclusive: boolean;
    requested_at: string;
  }>;
}

// Permission request with full details for client dashboard
export interface PermissionRequestWithDetails {
  id: string;
  relationship_id: string;
  permission_slug: PermissionSlug;
  permission_name: string;
  permission_description: string | null;
  category: PermissionCategory;
  is_exclusive: boolean;
  requested_at: string;
  status: PermissionRequestStatus;
  professional_name: string;
}

// All available permission slugs
export type PermissionSlug = 
  | 'view_nutrition' 
  | 'view_workouts' 
  | 'view_weight' 
  | 'view_progress_photos' 
  | 'view_fasting' 
  | 'view_checkins' 
  | 'view_profile'
  | 'set_nutrition_targets'
  | 'set_weight_targets'
  | 'assign_programmes'
  | 'assign_checkins'
  | 'set_fasting_schedule';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: UserRole
          display_name: string | null
          timezone: string
          current_weight_kg: number | null
          height_cm: number | null
          birthdate: string | null
          gender: string | null
          activity_multiplier: number | null
          daily_calorie_target: number | null
          manual_calorie_target: number | null
          protein_target_g: number | null
          carbs_target_g: number | null
          fat_target_g: number | null
          preferred_unit_system: string
          macro_input_type: string
          show_bmi_tape: boolean
          water_target_ml: number | null
          preset_avatar_id: string | null
          profile_photo_path: string | null
          unit_body_weight: string | null
          unit_body_measurements: string | null
          unit_exercise_weight: string | null
          unit_cardio_distance: string | null
          unit_food_weight: string | null
          unit_food_volume: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: UserRole
          display_name?: string | null
          timezone?: string
          current_weight_kg?: number | null
          height_cm?: number | null
          birthdate?: string | null
          gender?: string | null
          activity_multiplier?: number | null
          daily_calorie_target?: number | null
          manual_calorie_target?: number | null
          protein_target_g?: number | null
          carbs_target_g?: number | null
          fat_target_g?: number | null
          preferred_unit_system?: string
          macro_input_type?: string
          show_bmi_tape?: boolean
          water_target_ml?: number | null
          preset_avatar_id?: string | null
          profile_photo_path?: string | null
          unit_body_weight?: string | null
          unit_body_measurements?: string | null
          unit_exercise_weight?: string | null
          unit_cardio_distance?: string | null
          unit_food_weight?: string | null
          unit_food_volume?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: UserRole
          display_name?: string | null
          timezone?: string
          current_weight_kg?: number | null
          height_cm?: number | null
          birthdate?: string | null
          gender?: string | null
          activity_multiplier?: number | null
          daily_calorie_target?: number | null
          manual_calorie_target?: number | null
          protein_target_g?: number | null
          carbs_target_g?: number | null
          fat_target_g?: number | null
          preferred_unit_system?: string
          macro_input_type?: string
          show_bmi_tape?: boolean
          water_target_ml?: number | null
          preset_avatar_id?: string | null
          profile_photo_path?: string | null
          unit_body_weight?: string | null
          unit_body_measurements?: string | null
          unit_exercise_weight?: string | null
          unit_cardio_distance?: string | null
          unit_food_weight?: string | null
          unit_food_volume?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      professional_profiles: {
        Row: {
          id: string
          user_id: string
          bio: string | null
          headline: string | null
          specialties: string[] | null
          credentials: Json | null
          location_city: string | null
          location_state: string | null
          location_country: string | null
          pricing_summary: string | null
          profile_photo_path: string | null
          experience_years: number | null
          accepting_new_clients: boolean
          verification_status: VerificationStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bio?: string | null
          headline?: string | null
          specialties?: string[] | null
          credentials?: Json | null
          location_city?: string | null
          location_state?: string | null
          location_country?: string | null
          pricing_summary?: string | null
          profile_photo_path?: string | null
          experience_years?: number | null
          accepting_new_clients?: boolean
          verification_status?: VerificationStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bio?: string | null
          headline?: string | null
          specialties?: string[] | null
          credentials?: Json | null
          location_city?: string | null
          location_state?: string | null
          location_country?: string | null
          pricing_summary?: string | null
          profile_photo_path?: string | null
          experience_years?: number | null
          accepting_new_clients?: boolean
          verification_status?: VerificationStatus
          created_at?: string
          updated_at?: string
        }
      }
      professional_certifications: {
        Row: {
          id: string
          user_id: string
          name: string
          issuing_organization: string
          date_earned: string
          expiration_date: string | null
          certificate_image_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          issuing_organization: string
          date_earned: string
          expiration_date?: string | null
          certificate_image_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          issuing_organization?: string
          date_earned?: string
          expiration_date?: string | null
          certificate_image_path?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      professional_client_relationships: {
        Row: {
          id: string
          professional_id: string
          client_id: string
          role_type: ProfessionalRoleType
          status: RelationshipStatus
          invitation_id: string | null
          invited_at: string | null
          accepted_at: string | null
          ended_at: string | null
        }
        Insert: {
          id?: string
          professional_id: string
          client_id: string
          role_type: ProfessionalRoleType
          status?: RelationshipStatus
          invitation_id?: string | null
          invited_at?: string | null
          accepted_at?: string | null
          ended_at?: string | null
        }
        Update: {
          id?: string
          professional_id?: string
          client_id?: string
          role_type?: ProfessionalRoleType
          status?: RelationshipStatus
          invitation_id?: string | null
          invited_at?: string | null
          accepted_at?: string | null
          ended_at?: string | null
        }
      }
      permission_definitions: {
        Row: {
          id: string
          slug: PermissionSlug
          display_name: string
          description: string | null
          category: PermissionCategory
          permission_type: PermissionType
          is_exclusive: boolean
          is_enabled: boolean
          requires_verification: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          slug: PermissionSlug
          display_name: string
          description?: string | null
          category: PermissionCategory
          permission_type: PermissionType
          is_exclusive?: boolean
          is_enabled?: boolean
          requires_verification?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          slug?: PermissionSlug
          display_name?: string
          description?: string | null
          category?: PermissionCategory
          permission_type?: PermissionType
          is_exclusive?: boolean
          is_enabled?: boolean
          requires_verification?: boolean
          sort_order?: number
          created_at?: string
        }
      }
      client_permissions: {
        Row: {
          id: string
          relationship_id: string
          permission_slug: PermissionSlug
          status: PermissionStatus
          granted_at: string
          granted_by: PermissionGrantedBy
          revoked_at: string | null
          admin_notes: string | null
          client_id: string
        }
        Insert: {
          id?: string
          relationship_id: string
          permission_slug: PermissionSlug
          status?: PermissionStatus
          granted_at?: string
          granted_by?: PermissionGrantedBy
          revoked_at?: string | null
          admin_notes?: string | null
          client_id?: string
        }
        Update: {
          id?: string
          relationship_id?: string
          permission_slug?: PermissionSlug
          status?: PermissionStatus
          granted_at?: string
          granted_by?: PermissionGrantedBy
          revoked_at?: string | null
          admin_notes?: string | null
          client_id?: string
        }
      }
      invitations: {
        Row: {
          id: string
          professional_id: string
          email: string
          role_type: ProfessionalRoleType
          token_hash: string
          status: InvitationStatus
          created_at: string
          expires_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          professional_id: string
          email: string
          role_type: ProfessionalRoleType
          token_hash: string
          status?: InvitationStatus
          created_at?: string
          expires_at: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          professional_id?: string
          email?: string
          role_type?: ProfessionalRoleType
          token_hash?: string
          status?: InvitationStatus
          created_at?: string
          expires_at?: string
          accepted_at?: string | null
        }
      }
      food_logs: {
        Row: {
          id: string
          user_id: string
          logged_by_user_id: string
          food_name: string
          serving_description: string | null
          servings: number
          quantity_value: number | null
          quantity_unit: string | null
          calories: number | null
          protein: number | null
          carbs: number | null
          fat: number | null
          fiber: number | null
          sugar: number | null
          calories_per_unit: number | null
          protein_per_unit: number | null
          carbs_per_unit: number | null
          fat_per_unit: number | null
          micronutrients_dump: Json | null
          meal_type: MealType
          breaks_fast: boolean | null
          barcode: string | null
          logged_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          logged_by_user_id: string
          food_name: string
          serving_description?: string | null
          servings?: number
          quantity_value?: number | null
          quantity_unit?: string | null
          calories?: number | null
          protein?: number | null
          carbs?: number | null
          fat?: number | null
          fiber?: number | null
          sugar?: number | null
          calories_per_unit?: number | null
          protein_per_unit?: number | null
          carbs_per_unit?: number | null
          fat_per_unit?: number | null
          micronutrients_dump?: Json | null
          meal_type: MealType
          breaks_fast?: boolean | null
          barcode?: string | null
          logged_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          logged_by_user_id?: string
          food_name?: string
          serving_description?: string | null
          servings?: number
          quantity_value?: number | null
          quantity_unit?: string | null
          calories?: number | null
          protein?: number | null
          carbs?: number | null
          fat?: number | null
          fiber?: number | null
          sugar?: number | null
          calories_per_unit?: number | null
          protein_per_unit?: number | null
          carbs_per_unit?: number | null
          fat_per_unit?: number | null
          micronutrients_dump?: Json | null
          meal_type?: MealType
          breaks_fast?: boolean | null
          barcode?: string | null
          logged_at?: string
          created_at?: string
        }
      }
      workout_sessions: {
        Row: {
          id: string
          user_id: string
          logged_by_user_id: string
          routine_id: string | null
          routine_name: string | null
          name: string
          workout_type: WorkoutType
          exercises: Json | null
          duration_minutes: number | null
          notes: string | null
          activity_name: string | null
          intensity: number | null
          calories_burned: number | null
          logged_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          logged_by_user_id: string
          routine_id?: string | null
          routine_name?: string | null
          name: string
          workout_type: WorkoutType
          exercises?: Json | null
          duration_minutes?: number | null
          notes?: string | null
          activity_name?: string | null
          intensity?: number | null
          calories_burned?: number | null
          logged_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          logged_by_user_id?: string
          routine_id?: string | null
          routine_name?: string | null
          name?: string
          workout_type?: WorkoutType
          exercises?: Json | null
          duration_minutes?: number | null
          notes?: string | null
          activity_name?: string | null
          intensity?: number | null
          calories_burned?: number | null
          logged_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      weigh_ins: {
        Row: {
          id: string
          user_id: string
          weight_kg: number
          notes: string | null
          logged_at: string
          waist_cm: number | null
          hips_cm: number | null
          bust_chest_cm: number | null
          thigh_cm: number | null
          arm_cm: number | null
          calf_cm: number | null
          neck_cm: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          weight_kg: number
          notes?: string | null
          logged_at: string
          waist_cm?: number | null
          hips_cm?: number | null
          bust_chest_cm?: number | null
          thigh_cm?: number | null
          arm_cm?: number | null
          calf_cm?: number | null
          neck_cm?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          weight_kg?: number
          notes?: string | null
          logged_at?: string
          waist_cm?: number | null
          hips_cm?: number | null
          bust_chest_cm?: number | null
          thigh_cm?: number | null
          arm_cm?: number | null
          calf_cm?: number | null
          neck_cm?: number | null
          created_at?: string
        }
      }
      progress_photos: {
        Row: {
          id: string
          user_id: string
          photo_path: string
          pose: ProgressPhotoPose
          is_flexed: boolean
          captured_at: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          photo_path: string
          pose: ProgressPhotoPose
          is_flexed?: boolean
          captured_at?: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          photo_path?: string
          pose?: ProgressPhotoPose
          is_flexed?: boolean
          captured_at?: string
          notes?: string | null
          created_at?: string
        }
      }
      fasts: {
        Row: {
          id: string
          user_id: string
          start_time: string
          end_time: string
          actual_end_time: string | null
          status: FastStatus
          breaking_food_log_id: string | null
          planned_duration_minutes: number | null
          fast_mode: FastMode | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          start_time: string
          end_time: string
          actual_end_time?: string | null
          status?: FastStatus
          breaking_food_log_id?: string | null
          planned_duration_minutes?: number | null
          fast_mode?: FastMode | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          start_time?: string
          end_time?: string
          actual_end_time?: string | null
          status?: FastStatus
          breaking_food_log_id?: string | null
          planned_duration_minutes?: number | null
          fast_mode?: FastMode | null
          created_at?: string
        }
      }
      daily_summaries: {
        Row: {
          id: string
          user_id: string
          date: string
          finalized: boolean
          finalized_at: string
          total_calories: number
          total_protein_g: number
          total_carbs_g: number
          total_fat_g: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          finalized?: boolean
          finalized_at?: string
          total_calories: number
          total_protein_g: number
          total_carbs_g: number
          total_fat_g: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          finalized?: boolean
          finalized_at?: string
          total_calories?: number
          total_protein_g?: number
          total_carbs_g?: number
          total_fat_g?: number
          created_at?: string
        }
      }
      workout_routines: {
        Row: {
          id: string
          user_id: string
          name: string
          type: WorkoutType
          archived: boolean
          created_at: string
          last_used_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: WorkoutType
          archived?: boolean
          created_at?: string
          last_used_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: WorkoutType
          archived?: boolean
          created_at?: string
          last_used_at?: string | null
          updated_at?: string
        }
      }
      routine_exercises: {
        Row: {
          id: string
          routine_id: string
          exercise_name: string
          order_index: number
          target_sets: number | null
          target_reps: number | null
          created_at: string
        }
        Insert: {
          id?: string
          routine_id: string
          exercise_name: string
          order_index: number
          target_sets?: number | null
          target_reps?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          routine_id?: string
          exercise_name?: string
          order_index?: number
          target_sets?: number | null
          target_reps?: number | null
          created_at?: string
        }
      }
      workout_sets: {
        Row: {
          id: string
          session_id: string
          exercise_name: string
          set_number: number
          reps: number
          weight: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          exercise_name: string
          set_number: number
          reps: number
          weight?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          exercise_name?: string
          set_number?: number
          reps?: number
          weight?: number | null
          notes?: string | null
          created_at?: string
        }
      }
      cardio_activities: {
        Row: {
          id: string
          name: string
          base_met: number
          category: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          base_met: number
          category: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          base_met?: number
          category?: string
          created_at?: string
        }
      }
      user_custom_activities: {
        Row: {
          id: string
          user_id: string
          activity_name: string
          estimated_met: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          activity_name: string
          estimated_met: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          activity_name?: string
          estimated_met?: number
          created_at?: string
        }
      }
      foods: {
        Row: {
          id: string
          canonical_name: string
          brand: string | null
          source: FoodSource
          verification_status: FoodVerificationStatus
          calories_per_100g: number | null
          protein_per_100g: number | null
          carbs_per_100g: number | null
          fat_per_100g: number | null
          fiber_per_100g: number | null
          sugar_per_100g: number | null
          default_serving_size: string | null
          default_serving_grams: number | null
          calories_per_serving: number | null
          protein_per_serving: number | null
          carbs_per_serving: number | null
          fat_per_serving: number | null
          times_used: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          canonical_name: string
          brand?: string | null
          source: FoodSource
          verification_status?: FoodVerificationStatus
          calories_per_100g?: number | null
          protein_per_100g?: number | null
          carbs_per_100g?: number | null
          fat_per_100g?: number | null
          fiber_per_100g?: number | null
          sugar_per_100g?: number | null
          default_serving_size?: string | null
          default_serving_grams?: number | null
          calories_per_serving?: number | null
          protein_per_serving?: number | null
          carbs_per_serving?: number | null
          fat_per_serving?: number | null
          times_used?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          canonical_name?: string
          brand?: string | null
          source?: FoodSource
          verification_status?: FoodVerificationStatus
          calories_per_100g?: number | null
          protein_per_100g?: number | null
          carbs_per_100g?: number | null
          fat_per_100g?: number | null
          fiber_per_100g?: number | null
          sugar_per_100g?: number | null
          default_serving_size?: string | null
          default_serving_grams?: number | null
          calories_per_serving?: number | null
          protein_per_serving?: number | null
          carbs_per_serving?: number | null
          fat_per_serving?: number | null
          times_used?: number
          created_at?: string
          updated_at?: string
        }
      }
      food_barcodes: {
        Row: {
          id: string
          food_id: string
          barcode: string
          created_at: string
        }
        Insert: {
          id?: string
          food_id: string
          barcode: string
          created_at?: string
        }
        Update: {
          id?: string
          food_id?: string
          barcode?: string
          created_at?: string
        }
      }
      food_aliases: {
        Row: {
          id: string
          food_id: string
          alias_text: string
          normalized_text: string
          created_at: string
        }
        Insert: {
          id?: string
          food_id: string
          alias_text: string
          normalized_text: string
          created_at?: string
        }
        Update: {
          id?: string
          food_id?: string
          alias_text?: string
          normalized_text?: string
          created_at?: string
        }
      }
      nutrition_targets: {
        Row: {
          id: string
          client_id: string
          professional_id: string | null
          protein_g: number
          carbs_g: number
          fat_g: number
          calories: number
          status: NutritionTargetStatus
          source: NutritionTargetSource
          created_at: string
          updated_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          client_id: string
          professional_id?: string | null
          protein_g: number
          carbs_g: number
          fat_g: number
          status?: NutritionTargetStatus
          source?: NutritionTargetSource
          created_at?: string
          updated_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          professional_id?: string | null
          protein_g?: number
          carbs_g?: number
          fat_g?: number
          status?: NutritionTargetStatus
          source?: NutritionTargetSource
          created_at?: string
          updated_at?: string
          accepted_at?: string | null
        }
      }
      daily_water_intake: {
        Row: {
          id: string
          user_id: string
          date: string
          total_ml: number
          target_ml: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          total_ml?: number
          target_ml?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          total_ml?: number
          target_ml?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      water_logs: {
        Row: {
          id: string
          user_id: string
          date: string
          amount_ml: number
          source: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          amount_ml: number
          source?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          amount_ml?: number
          source?: string
          created_at?: string
        }
      }
      trainer_storefronts: {
        Row: {
          id: string
          trainer_id: string
          slug: string
          headline: string | null
          bio: string | null
          cover_image_url: string | null
          specialties: string[]
          credentials: string[]
          experience_years: number | null
          is_published: boolean
          published_at: string | null
          created_at: string
          updated_at: string
          business_name: string | null
          intro_video_url: string | null
          video_thumbnail_url: string | null
          accent_color: string | null
          social_links: Json
          waitlist_enabled: boolean
          accepting_new_clients: boolean
          booking_url: string | null
          profession_types: string[]
          timezone: string | null
          languages: string[]
          has_premium_slug: boolean
          slug_purchased_at: string | null
          storefront_variation: 'classic' | 'bold' | 'services-first' | 'story-driven'
          location_city: string | null
          location_state: string | null
          location_country: string | null
        }
        Insert: {
          id?: string
          trainer_id: string
          slug: string
          headline?: string | null
          bio?: string | null
          cover_image_url?: string | null
          specialties?: string[]
          credentials?: string[]
          experience_years?: number | null
          is_published?: boolean
          published_at?: string | null
          created_at?: string
          updated_at?: string
          business_name?: string | null
          intro_video_url?: string | null
          video_thumbnail_url?: string | null
          accent_color?: string | null
          social_links?: Json
          waitlist_enabled?: boolean
          accepting_new_clients?: boolean
          booking_url?: string | null
          profession_types?: string[]
          timezone?: string | null
          languages?: string[]
          has_premium_slug?: boolean
          slug_purchased_at?: string | null
          storefront_variation?: 'classic' | 'bold' | 'services-first' | 'story-driven'
          location_city?: string | null
          location_state?: string | null
          location_country?: string | null
        }
        Update: {
          id?: string
          trainer_id?: string
          slug?: string
          headline?: string | null
          bio?: string | null
          cover_image_url?: string | null
          specialties?: string[]
          credentials?: string[]
          experience_years?: number | null
          is_published?: boolean
          published_at?: string | null
          created_at?: string
          updated_at?: string
          business_name?: string | null
          intro_video_url?: string | null
          video_thumbnail_url?: string | null
          accent_color?: string | null
          social_links?: Json
          waitlist_enabled?: boolean
          accepting_new_clients?: boolean
          booking_url?: string | null
          profession_types?: string[]
          timezone?: string | null
          languages?: string[]
          has_premium_slug?: boolean
          slug_purchased_at?: string | null
          storefront_variation?: 'classic' | 'bold' | 'services-first' | 'story-driven'
          location_city?: string | null
          location_state?: string | null
          location_country?: string | null
        }
      }
      storefront_services: {
        Row: {
          id: string
          storefront_id: string
          title: string
          description: string | null
          price_display: string | null
          duration: string | null
          image_url: string | null
          is_featured: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          storefront_id: string
          title: string
          description?: string | null
          price_display?: string | null
          duration?: string | null
          image_url?: string | null
          is_featured?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          storefront_id?: string
          title?: string
          description?: string | null
          price_display?: string | null
          duration?: string | null
          image_url?: string | null
          is_featured?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      storefront_testimonials: {
        Row: {
          id: string
          storefront_id: string
          client_name: string
          client_photo_url: string | null
          quote: string
          rating: number | null
          result_achieved: string | null
          is_featured: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          storefront_id: string
          client_name: string
          client_photo_url?: string | null
          quote: string
          rating?: number | null
          result_achieved?: string | null
          is_featured?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          storefront_id?: string
          client_name?: string
          client_photo_url?: string | null
          quote?: string
          rating?: number | null
          result_achieved?: string | null
          is_featured?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      storefront_transformations: {
        Row: {
          id: string
          storefront_id: string
          title: string | null
          description: string | null
          before_image_url: string
          after_image_url: string
          duration_weeks: number | null
          is_featured: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          storefront_id: string
          title?: string | null
          description?: string | null
          before_image_url: string
          after_image_url: string
          duration_weeks?: number | null
          is_featured?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          storefront_id?: string
          title?: string | null
          description?: string | null
          before_image_url?: string
          after_image_url?: string
          duration_weeks?: number | null
          is_featured?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_active_relationship: {
        Args: {
          p_professional_id: string
          p_client_id: string
          p_allowed_roles: string[]
        }
        Returns: boolean
      }
      create_invitation: {
        Args: {
          p_email: string
          p_role_type: ProfessionalRoleType
          p_token: string
        }
        Returns: {
          success: boolean
          invitation_id?: string
          error?: string
        }
      }
      accept_invitation: {
        Args: {
          p_token: string
        }
        Returns: {
          success: boolean
          relationship_id?: string
          error?: string
        }
      }
      promote_to_professional: {
        Args: {
          p_headline: string
          p_bio?: string | null
          p_specialties?: string[] | null
          p_city?: string | null
          p_state?: string | null
        }
        Returns: {
          success: boolean
          professional_profile_id?: string
          error?: string
        }
      }
      can_view_user_data: {
        Args: {
          target_user_id: string
          required_role_type?: ProfessionalRoleType | null
        }
        Returns: boolean
      }
      get_accessible_clients: {
        Args: {
          required_role_type?: ProfessionalRoleType | null
        }
        Returns: string[]
      }
    }
    Enums: {
      user_role: UserRole
      professional_role_type: ProfessionalRoleType
      relationship_status: RelationshipStatus
      invitation_status: InvitationStatus
      verification_status: VerificationStatus
      meal_type: MealType
      fast_status: FastStatus
      fast_mode: FastMode
      workout_type: WorkoutType
      food_source: FoodSource
      food_verification_status: FoodVerificationStatus
      progress_photo_pose: ProgressPhotoPose
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type InsertProfile = Database['public']['Tables']['profiles']['Insert'];

export type ProfessionalProfile = Database['public']['Tables']['professional_profiles']['Row'];
export type InsertProfessionalProfile = Database['public']['Tables']['professional_profiles']['Insert'];

export type ProfessionalCertification = Database['public']['Tables']['professional_certifications']['Row'];
export type InsertProfessionalCertification = Database['public']['Tables']['professional_certifications']['Insert'];

export type Relationship = Database['public']['Tables']['professional_client_relationships']['Row'];
export type InsertRelationship = Database['public']['Tables']['professional_client_relationships']['Insert'];

export type Invitation = Database['public']['Tables']['invitations']['Row'];
export type InsertInvitation = Database['public']['Tables']['invitations']['Insert'];

export type FoodLog = Database['public']['Tables']['food_logs']['Row'];
export type InsertFoodLog = Database['public']['Tables']['food_logs']['Insert'];

export type WorkoutSession = Database['public']['Tables']['workout_sessions']['Row'];
export type InsertWorkoutSession = Database['public']['Tables']['workout_sessions']['Insert'];

export type WeighIn = Database['public']['Tables']['weigh_ins']['Row'];
export type InsertWeighIn = Database['public']['Tables']['weigh_ins']['Insert'];

export type ProgressPhoto = Database['public']['Tables']['progress_photos']['Row'];
export type InsertProgressPhoto = Database['public']['Tables']['progress_photos']['Insert'];

export type Fast = Database['public']['Tables']['fasts']['Row'];
export type InsertFast = Database['public']['Tables']['fasts']['Insert'];

export type DailySummary = Database['public']['Tables']['daily_summaries']['Row'];
export type InsertDailySummary = Database['public']['Tables']['daily_summaries']['Insert'];

export type WorkoutRoutine = Database['public']['Tables']['workout_routines']['Row'];
export type InsertWorkoutRoutine = Database['public']['Tables']['workout_routines']['Insert'];

export type RoutineExercise = Database['public']['Tables']['routine_exercises']['Row'];
export type InsertRoutineExercise = Database['public']['Tables']['routine_exercises']['Insert'];

export type WorkoutSet = Database['public']['Tables']['workout_sets']['Row'];
export type InsertWorkoutSet = Database['public']['Tables']['workout_sets']['Insert'];

export type CardioActivity = Database['public']['Tables']['cardio_activities']['Row'];
export type InsertCardioActivity = Database['public']['Tables']['cardio_activities']['Insert'];

export type UserCustomActivity = Database['public']['Tables']['user_custom_activities']['Row'];
export type InsertUserCustomActivity = Database['public']['Tables']['user_custom_activities']['Insert'];

export type Food = Database['public']['Tables']['foods']['Row'];
export type InsertFood = Database['public']['Tables']['foods']['Insert'];

export type FoodBarcode = Database['public']['Tables']['food_barcodes']['Row'];
export type InsertFoodBarcode = Database['public']['Tables']['food_barcodes']['Insert'];

export type FoodAlias = Database['public']['Tables']['food_aliases']['Row'];
export type InsertFoodAlias = Database['public']['Tables']['food_aliases']['Insert'];

export type PermissionDefinition = Database['public']['Tables']['permission_definitions']['Row'];
export type InsertPermissionDefinition = Database['public']['Tables']['permission_definitions']['Insert'];

export type ClientPermission = Database['public']['Tables']['client_permissions']['Row'];
export type InsertClientPermission = Database['public']['Tables']['client_permissions']['Insert'];

export type NutritionTarget = Database['public']['Tables']['nutrition_targets']['Row'];
export type InsertNutritionTarget = Database['public']['Tables']['nutrition_targets']['Insert'];
export type UpdateNutritionTarget = Database['public']['Tables']['nutrition_targets']['Update'];

export type DailyWaterIntake = Database['public']['Tables']['daily_water_intake']['Row'];
export type InsertDailyWaterIntake = Database['public']['Tables']['daily_water_intake']['Insert'];
export type UpdateDailyWaterIntake = Database['public']['Tables']['daily_water_intake']['Update'];

export type WaterLog = Database['public']['Tables']['water_logs']['Row'];
export type InsertWaterLog = Database['public']['Tables']['water_logs']['Insert'];

export type TrainerStorefront = Database['public']['Tables']['trainer_storefronts']['Row'];
export type InsertTrainerStorefront = Database['public']['Tables']['trainer_storefronts']['Insert'];
export type UpdateTrainerStorefront = Database['public']['Tables']['trainer_storefronts']['Update'];

export type StorefrontService = Database['public']['Tables']['storefront_services']['Row'];
export type InsertStorefrontService = Database['public']['Tables']['storefront_services']['Insert'];
export type UpdateStorefrontService = Database['public']['Tables']['storefront_services']['Update'];

export type StorefrontTestimonial = Database['public']['Tables']['storefront_testimonials']['Row'];
export type InsertStorefrontTestimonial = Database['public']['Tables']['storefront_testimonials']['Insert'];
export type UpdateStorefrontTestimonial = Database['public']['Tables']['storefront_testimonials']['Update'];

export type StorefrontTransformation = Database['public']['Tables']['storefront_transformations']['Row'];
export type InsertStorefrontTransformation = Database['public']['Tables']['storefront_transformations']['Insert'];
export type UpdateStorefrontTransformation = Database['public']['Tables']['storefront_transformations']['Update'];

export type StorefrontVariation = 'classic' | 'bold' | 'services-first' | 'story-driven';
