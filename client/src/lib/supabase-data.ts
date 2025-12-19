import { supabaseUntyped as supabase, supabaseTyped } from './supabase';
import type { 
  CardioActivity, 
  Food, 
  FoodBarcode,
  WeighIn,
  InsertWeighIn,
  FoodLog,
  InsertFoodLog,
} from '@shared/schema';

export type { CardioActivity, Food, FoodBarcode, WeighIn, FoodLog };

export interface UserProfile {
  id: string;
  displayName: string | null;
  heightCm: number | null;
  currentWeightKg: number | null;
  birthdate: string | null;
  gender: string | null;
  activityMultiplier: number | null;
  dailyCalorieTarget: number | null;
  preferredUnitSystem: string;
  macroInputType: string;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  manualCalorieTarget: number | null;
  showBmiTape: boolean;
  timezone: string;
  presetAvatarId: string | null;
  profilePhotoPath: string | null;
  unitBodyWeight: string | null;
  unitBodyMeasurements: string | null;
  unitExerciseWeight: string | null;
  unitCardioDistance: string | null;
  unitFoodWeight: string | null;
  unitFoodVolume: string | null;
}

export interface PresetAvatar {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  imagePath: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export async function getPresetAvatars(): Promise<PresetAvatar[]> {
  const { data, error } = await supabase
    .from('preset_avatars')
    .select('*')
    .eq('is_active', true)
    .order('gender', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching preset avatars:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    gender: row.gender as 'female' | 'male' | 'neutral',
    imagePath: row.image_path,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
}

export async function getPresetAvatarById(id: string): Promise<PresetAvatar | null> {
  const { data, error } = await supabase
    .from('preset_avatars')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching preset avatar:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    gender: data.gender as 'female' | 'male' | 'neutral',
    imagePath: data.image_path,
    isActive: data.is_active,
    createdAt: data.created_at,
  };
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return {
    id: data.id,
    displayName: data.display_name ?? null,
    heightCm: data.height_cm != null ? Number(data.height_cm) : null,
    currentWeightKg: data.current_weight_kg != null ? Number(data.current_weight_kg) : null,
    birthdate: data.birthdate ?? null,
    gender: data.gender ?? null,
    activityMultiplier: data.activity_multiplier != null ? Number(data.activity_multiplier) : 1.2,
    dailyCalorieTarget: data.daily_calorie_target != null ? Number(data.daily_calorie_target) : 2100,
    preferredUnitSystem: data.preferred_unit_system ?? 'metric',
    macroInputType: data.macro_input_type ?? 'percentage',
    proteinTargetG: data.protein_target_g != null ? Number(data.protein_target_g) : null,
    carbsTargetG: data.carbs_target_g != null ? Number(data.carbs_target_g) : null,
    fatTargetG: data.fat_target_g != null ? Number(data.fat_target_g) : null,
    manualCalorieTarget: data.manual_calorie_target != null ? Number(data.manual_calorie_target) : null,
    showBmiTape: data.show_bmi_tape ?? true,
    timezone: data.timezone ?? 'UTC',
    presetAvatarId: data.preset_avatar_id ?? null,
    profilePhotoPath: data.profile_photo_path ?? null,
    unitBodyWeight: data.unit_body_weight ?? null,
    unitBodyMeasurements: data.unit_body_measurements ?? null,
    unitExerciseWeight: data.unit_exercise_weight ?? null,
    unitCardioDistance: data.unit_cardio_distance ?? null,
    unitFoodWeight: data.unit_food_weight ?? null,
    unitFoodVolume: data.unit_food_volume ?? null,
  };
}

export async function updateUserProfile(updates: Partial<UserProfile>): Promise<UserProfile | null> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const payload: Record<string, any> = {};
  if (updates.displayName !== undefined) payload.display_name = updates.displayName;
  if (updates.heightCm !== undefined) payload.height_cm = updates.heightCm;
  if (updates.currentWeightKg !== undefined) payload.current_weight_kg = updates.currentWeightKg;
  if (updates.birthdate !== undefined) payload.birthdate = updates.birthdate;
  if (updates.gender !== undefined) payload.gender = updates.gender;
  if (updates.activityMultiplier !== undefined) payload.activity_multiplier = updates.activityMultiplier;
  if (updates.dailyCalorieTarget !== undefined) payload.daily_calorie_target = updates.dailyCalorieTarget;
  if (updates.preferredUnitSystem !== undefined) payload.preferred_unit_system = updates.preferredUnitSystem;
  if (updates.macroInputType !== undefined) payload.macro_input_type = updates.macroInputType;
  if (updates.proteinTargetG !== undefined) payload.protein_target_g = updates.proteinTargetG;
  if (updates.carbsTargetG !== undefined) payload.carbs_target_g = updates.carbsTargetG;
  if (updates.fatTargetG !== undefined) payload.fat_target_g = updates.fatTargetG;
  if (updates.manualCalorieTarget !== undefined) payload.manual_calorie_target = updates.manualCalorieTarget;
  if (updates.showBmiTape !== undefined) payload.show_bmi_tape = updates.showBmiTape;
  if (updates.timezone !== undefined) payload.timezone = updates.timezone;
  
  if (updates.presetAvatarId !== undefined) {
    payload.preset_avatar_id = updates.presetAvatarId;
  }
  if (updates.profilePhotoPath !== undefined) {
    payload.profile_photo_path = updates.profilePhotoPath;
    if (updates.profilePhotoPath !== null) {
      payload.preset_avatar_id = null;
    }
  }
  if (updates.unitBodyWeight !== undefined) payload.unit_body_weight = updates.unitBodyWeight;
  if (updates.unitBodyMeasurements !== undefined) payload.unit_body_measurements = updates.unitBodyMeasurements;
  if (updates.unitExerciseWeight !== undefined) payload.unit_exercise_weight = updates.unitExerciseWeight;
  if (updates.unitCardioDistance !== undefined) payload.unit_cardio_distance = updates.unitCardioDistance;
  if (updates.unitFoodWeight !== undefined) payload.unit_food_weight = updates.unitFoodWeight;
  if (updates.unitFoodVolume !== undefined) payload.unit_food_volume = updates.unitFoodVolume;

  console.log('[Profile] Updating profile with payload:', payload);

  const { error, data, count } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', user.id)
    .select();

  console.log('[Profile] Update result:', { error, data, count });

  if (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }

  return getUserProfile();
}

// ============================================
// FASTS
// ============================================

export interface Fast {
  id: string;
  startTime: string;
  endTime: string;
  actualEndTime: string | null;
  status: 'active' | 'ended';
  breakingFoodLogId: string | null;
  plannedDurationMinutes: number | null;
  fastMode: 'duration' | 'target_time' | null;
  createdAt: string;
}

export interface FastingAnalytics {
  totalFasts: number;
  avgPlannedDurationHours: number;
  avgActualDurationHours: number;
  completionRate: number;
  totalFastingHours: number;
  longestFastHours: number;
}

function mapFastRow(row: any): Fast {
  return {
    id: row.id,
    startTime: row.start_time,
    endTime: row.end_time,
    actualEndTime: row.actual_end_time,
    status: row.status,
    breakingFoodLogId: row.breaking_food_log_id,
    plannedDurationMinutes: row.planned_duration_minutes,
    fastMode: row.fast_mode,
    createdAt: row.created_at,
  };
}

export async function getActiveFast(): Promise<Fast | null> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('fasts')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching active fast:', error);
    return null;
  }

  return mapFastRow(data);
}

export async function startFast(data: {
  endTime: string;
  plannedDurationMinutes?: number;
  fastMode?: 'duration' | 'target_time';
}): Promise<Fast> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data: result, error } = await supabase
    .from('fasts')
    .insert({
      user_id: user.id,
      start_time: new Date().toISOString(),
      end_time: data.endTime,
      planned_duration_minutes: data.plannedDurationMinutes,
      fast_mode: data.fastMode || 'duration',
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('Error starting fast:', error);
    throw error;
  }

  return mapFastRow(result);
}

export async function endFast(fastId: string, actualEndTime?: string): Promise<Fast> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('fasts')
    .update({
      status: 'ended',
      actual_end_time: actualEndTime || new Date().toISOString(),
    })
    .eq('id', fastId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error ending fast:', error);
    throw error;
  }

  return mapFastRow(data);
}

export async function getFasts(limit: number = 30): Promise<Fast[]> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('fasts')
    .select('*')
    .eq('user_id', user.id)
    .order('start_time', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching fasts:', error);
    return [];
  }

  return (data || []).map(mapFastRow);
}

export async function getFastingAnalytics(): Promise<FastingAnalytics> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    return {
      totalFasts: 0,
      avgPlannedDurationHours: 0,
      avgActualDurationHours: 0,
      completionRate: 0,
      totalFastingHours: 0,
      longestFastHours: 0,
    };
  }

  const { data: fasts, error } = await supabase
    .from('fasts')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'ended');

  if (error || !fasts || fasts.length === 0) {
    return {
      totalFasts: 0,
      avgPlannedDurationHours: 0,
      avgActualDurationHours: 0,
      completionRate: 0,
      totalFastingHours: 0,
      longestFastHours: 0,
    };
  }

  const totalFasts = fasts.length;
  
  let totalPlannedMs = 0;
  let totalActualMs = 0;
  let completedCount = 0;
  let longestFastMs = 0;

  for (const fast of fasts) {
    const startTime = new Date(fast.start_time).getTime();
    const plannedEnd = new Date(fast.end_time).getTime();
    const actualEnd = fast.actual_end_time 
      ? new Date(fast.actual_end_time).getTime() 
      : plannedEnd;
    
    const actualDuration = actualEnd - startTime;
    totalPlannedMs += plannedEnd - startTime;
    totalActualMs += actualDuration;
    
    if (actualDuration > longestFastMs) {
      longestFastMs = actualDuration;
    }
    
    if (actualEnd >= plannedEnd) {
      completedCount++;
    }
  }

  const avgPlannedDurationHours = totalPlannedMs / totalFasts / (1000 * 60 * 60);
  const avgActualDurationHours = totalActualMs / totalFasts / (1000 * 60 * 60);
  const completionRate = (completedCount / totalFasts) * 100;
  const totalFastingHours = totalActualMs / (1000 * 60 * 60);
  const longestFastHours = longestFastMs / (1000 * 60 * 60);

  return {
    totalFasts,
    avgPlannedDurationHours: Math.round(avgPlannedDurationHours * 10) / 10,
    avgActualDurationHours: Math.round(avgActualDurationHours * 10) / 10,
    completionRate: Math.round(completionRate),
    totalFastingHours: Math.round(totalFastingHours * 10) / 10,
    longestFastHours: Math.round(longestFastHours * 10) / 10,
  };
}

// ============================================
// WORKOUTS
// ============================================

export type WorkoutType = 'strength_traditional' | 'strength_circuit' | 'cardio' | 'other';

export interface WorkoutSession {
  id: string;
  userId: string;
  routineId: string | null;
  routineName: string | null;
  workoutType: WorkoutType;
  loggedAt: string;
  durationMinutes: number | null;
  notes: string | null;
  activityName: string | null;
  intensity: number | null;
  caloriesBurned: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface WorkoutSet {
  id: string;
  sessionId: string;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weight: number | null;
  notes: string | null;
  createdAt: string;
}

export interface WorkoutRoutine {
  id: string;
  userId: string;
  name: string;
  type: WorkoutType;
  archived: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  updatedAt: string;
}

export interface RoutineExercise {
  id: string;
  routineId: string;
  exerciseName: string;
  orderIndex: number;
  targetSets: number | null;
  targetReps: number | null;
  createdAt: string;
}

export interface WorkoutSessionWithSets extends WorkoutSession {
  sets: WorkoutSet[];
}

function mapWorkoutSessionRow(row: any): WorkoutSession {
  return {
    id: row.id,
    userId: row.user_id,
    routineId: row.routine_id,
    routineName: row.routine_name,
    workoutType: row.workout_type,
    loggedAt: row.logged_at,
    durationMinutes: row.duration_minutes != null ? Number(row.duration_minutes) : null,
    notes: row.notes,
    activityName: row.activity_name,
    intensity: row.intensity != null ? Number(row.intensity) : null,
    caloriesBurned: row.calories_burned != null ? Number(row.calories_burned) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWorkoutSetRow(row: any): WorkoutSet {
  return {
    id: row.id,
    sessionId: row.session_id,
    exerciseName: row.exercise_name,
    setNumber: row.set_number,
    reps: Number(row.reps),
    weight: row.weight != null ? Number(row.weight) : null,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function mapWorkoutRoutineRow(row: any): WorkoutRoutine {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    archived: row.archived,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    updatedAt: row.updated_at,
  };
}

function mapRoutineExerciseRow(row: any): RoutineExercise {
  return {
    id: row.id,
    routineId: row.routine_id,
    exerciseName: row.exercise_name,
    orderIndex: row.order_index,
    targetSets: row.target_sets,
    targetReps: row.target_reps,
    createdAt: row.created_at,
  };
}

export async function getWorkoutSessions(
  startDate?: Date, 
  endDate?: Date,
  limit: number = 50
): Promise<WorkoutSession[]> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    return [];
  }

  let query = supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false })
    .limit(limit);

  if (startDate) {
    query = query.gte('logged_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('logged_at', endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching workout sessions:', error);
    return [];
  }

  return (data || []).map(mapWorkoutSessionRow);
}

export async function getWorkoutSessionsWithSets(
  startDate?: Date,
  endDate?: Date,
  limit: number = 50
): Promise<WorkoutSessionWithSets[]> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    return [];
  }

  let query = supabase
    .from('workout_sessions')
    .select('*, workout_sets(*)')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false })
    .limit(limit);

  if (startDate) {
    query = query.gte('logged_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('logged_at', endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching workout sessions with sets:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    ...mapWorkoutSessionRow(row),
    sets: (row.workout_sets || [])
      .map(mapWorkoutSetRow)
      .sort((a: WorkoutSet, b: WorkoutSet) => {
        const nameCompare = a.exerciseName.localeCompare(b.exerciseName);
        if (nameCompare !== 0) return nameCompare;
        return a.setNumber - b.setNumber;
      }),
  }));
}

export async function getWorkoutSessionsForDate(date: Date): Promise<WorkoutSession[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return getWorkoutSessions(startOfDay, endOfDay, 100);
}

export async function getWorkoutSessionDetails(sessionId: string): Promise<WorkoutSessionWithSets | null> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: session, error: sessionError } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (sessionError || !session) {
    console.error('Error fetching workout session:', sessionError);
    return null;
  }

  const { data: sets, error: setsError } = await supabase
    .from('workout_sets')
    .select('*')
    .eq('session_id', sessionId)
    .order('exercise_name')
    .order('set_number');

  if (setsError) {
    console.error('Error fetching workout sets:', setsError);
    return { ...mapWorkoutSessionRow(session), sets: [] };
  }

  return {
    ...mapWorkoutSessionRow(session),
    sets: (sets || []).map(mapWorkoutSetRow),
  };
}

export interface CreateWorkoutSessionInput {
  routineId?: string;
  routineName?: string;
  workoutType: WorkoutType;
  durationMinutes?: number;
  notes?: string;
  activityName?: string;
  intensity?: number;
  caloriesBurned?: number;
  loggedAt?: string; // ISO date string for backdating (e.g., "2024-01-15")
}

export async function createWorkoutSession(input: CreateWorkoutSessionInput): Promise<WorkoutSession> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  // Handle date - if loggedAt is provided as date string (YYYY-MM-DD), convert to ISO datetime
  let loggedAtDateTime = new Date().toISOString();
  if (input.loggedAt) {
    const dateOnly = input.loggedAt.split('T')[0]; // Handle both "2024-01-15" and "2024-01-15T..."
    loggedAtDateTime = new Date(`${dateOnly}T12:00:00Z`).toISOString(); // Default to noon UTC
  }

  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: user.id,
      logged_by_user_id: user.id,
      routine_id: input.routineId || null,
      name: input.routineName || 'Workout',
      routine_name: input.routineName || null,
      workout_type: input.workoutType,
      logged_at: loggedAtDateTime,
      duration_minutes: input.durationMinutes || null,
      notes: input.notes || null,
      activity_name: input.activityName || null,
      intensity: input.intensity || null,
      calories_burned: input.caloriesBurned || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating workout session:', error);
    throw error;
  }

  return mapWorkoutSessionRow(data);
}

export async function deleteWorkoutSession(sessionId: string): Promise<void> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('workout_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting workout session:', error);
    throw error;
  }
}

export interface CreateWorkoutSetInput {
  sessionId: string;
  exerciseName: string;
  exerciseId?: string;
  setNumber: number;
  reps: number;
  weight?: number;
  notes?: string;
}

export async function createWorkoutSet(input: CreateWorkoutSetInput): Promise<WorkoutSet> {
  const { data, error } = await supabase
    .from('workout_sets')
    .insert({
      session_id: input.sessionId,
      exercise_name: input.exerciseName,
      exercise_id: input.exerciseId || null,
      set_number: input.setNumber,
      reps: input.reps,
      weight: input.weight || null,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating workout set:', error);
    throw error;
  }

  return mapWorkoutSetRow(data);
}

export async function createWorkoutSets(inputs: CreateWorkoutSetInput[]): Promise<WorkoutSet[]> {
  if (inputs.length === 0) return [];

  // Insert without exercise_id for now - name-based matching works reliably
  // TODO: Add exercise_id support after Supabase migration is applied
  const insertData = inputs.map(input => ({
    session_id: input.sessionId,
    exercise_name: input.exerciseName,
    set_number: input.setNumber,
    reps: input.reps,
    weight: input.weight || null,
    notes: input.notes || null,
  }));

  const { data, error } = await supabase
    .from('workout_sets')
    .insert(insertData)
    .select();

  if (error) {
    console.error('Error creating workout sets:', error);
    throw error;
  }

  return (data || []).map(mapWorkoutSetRow);
}

export interface ExerciseHistorySession {
  sessionId: string;
  date: string;
  sets: Array<{ setNumber: number; reps: number; weight: number | null }>;
  maxWeight: number | null;
}

export async function getExerciseHistory(
  exerciseName: string,
  exerciseId?: string,
  limit: number = 3
): Promise<ExerciseHistorySession[]> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    return [];
  }

  // Query sets with their session info using name-based matching
  // Note: exercise_id support can be added after Supabase migration
  const { data, error } = await supabase
    .from('workout_sets')
    .select(`
      id,
      session_id,
      exercise_name,
      set_number,
      reps,
      weight,
      workout_sessions!inner (
        id,
        user_id,
        logged_at
      )
    `)
    .eq('workout_sessions.user_id', user.id)
    .ilike('exercise_name', exerciseName)
    .order('workout_sessions(logged_at)', { ascending: false });

  if (error) {
    console.error('Error fetching exercise history:', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Group sets by session
  const sessionMap = new Map<string, {
    sessionId: string;
    date: string;
    sets: Array<{ setNumber: number; reps: number; weight: number | null }>;
  }>();

  for (const row of data) {
    const sessionInfo = row.workout_sessions as any;
    const sessionId = row.session_id;
    
    if (!sessionMap.has(sessionId)) {
      sessionMap.set(sessionId, {
        sessionId,
        date: sessionInfo.logged_at,
        sets: [],
      });
    }
    
    sessionMap.get(sessionId)!.sets.push({
      setNumber: row.set_number,
      reps: row.reps,
      weight: row.weight,
    });
  }

  // Convert to array, sort by date descending, limit results
  const sessions = Array.from(sessionMap.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)
    .map(session => ({
      ...session,
      sets: session.sets.sort((a, b) => a.setNumber - b.setNumber),
      maxWeight: Math.max(...session.sets.map(s => s.weight || 0)) || null,
    }));

  return sessions;
}

export async function getWorkoutRoutines(includeArchived: boolean = false): Promise<WorkoutRoutine[]> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    return [];
  }

  let query = supabase
    .from('workout_routines')
    .select('*')
    .eq('user_id', user.id)
    .order('last_used_at', { ascending: false, nullsFirst: false });

  if (!includeArchived) {
    query = query.eq('archived', false);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching workout routines:', error);
    return [];
  }

  return (data || []).map(mapWorkoutRoutineRow);
}

export async function getRoutineWithExercises(routineId: string): Promise<{
  routine: WorkoutRoutine;
  exercises: RoutineExercise[];
} | null> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: routine, error: routineError } = await supabase
    .from('workout_routines')
    .select('*')
    .eq('id', routineId)
    .eq('user_id', user.id)
    .single();

  if (routineError || !routine) {
    console.error('Error fetching routine:', routineError);
    return null;
  }

  const { data: exercises, error: exercisesError } = await supabase
    .from('routine_exercises')
    .select('*')
    .eq('routine_id', routineId)
    .order('order_index');

  if (exercisesError) {
    console.error('Error fetching routine exercises:', exercisesError);
    return { routine: mapWorkoutRoutineRow(routine), exercises: [] };
  }

  return {
    routine: mapWorkoutRoutineRow(routine),
    exercises: (exercises || []).map(mapRoutineExerciseRow),
  };
}

export interface CreateWorkoutRoutineInput {
  name: string;
  type: WorkoutType;
}

export async function createWorkoutRoutine(input: CreateWorkoutRoutineInput): Promise<WorkoutRoutine> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('workout_routines')
    .insert({
      user_id: user.id,
      name: input.name,
      type: input.type,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating workout routine:', error);
    throw error;
  }

  return mapWorkoutRoutineRow(data);
}

export async function archiveWorkoutRoutine(routineId: string): Promise<void> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('workout_routines')
    .update({ archived: true })
    .eq('id', routineId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error archiving workout routine:', error);
    throw error;
  }
}

export async function updateRoutineLastUsed(routineId: string): Promise<void> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    return;
  }

  await supabase
    .from('workout_routines')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', routineId)
    .eq('user_id', user.id);
}

export interface CreateRoutineExerciseInput {
  routineId: string;
  exerciseName: string;
  orderIndex: number;
  targetSets?: number;
  targetReps?: number;
}

export async function createRoutineExercise(input: CreateRoutineExerciseInput): Promise<RoutineExercise> {
  const { data, error } = await supabase
    .from('routine_exercises')
    .insert({
      routine_id: input.routineId,
      exercise_name: input.exerciseName,
      order_index: input.orderIndex,
      target_sets: input.targetSets || null,
      target_reps: input.targetReps || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating routine exercise:', error);
    throw error;
  }

  return mapRoutineExerciseRow(data);
}

export async function deleteRoutineExercise(exerciseId: string): Promise<void> {
  const { error } = await supabase
    .from('routine_exercises')
    .delete()
    .eq('id', exerciseId);

  if (error) {
    console.error('Error deleting routine exercise:', error);
    throw error;
  }
}

export interface UpdateWorkoutRoutineInput {
  name?: string;
  type?: WorkoutType;
}

export async function updateWorkoutRoutine(
  routineId: string,
  input: UpdateWorkoutRoutineInput
): Promise<WorkoutRoutine> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const updates: Record<string, any> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.type !== undefined) updates.type = input.type;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('workout_routines')
    .update(updates)
    .eq('id', routineId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating workout routine:', error);
    throw error;
  }

  return mapWorkoutRoutineRow(data);
}

export interface ReplaceRoutineExercisesInput {
  exerciseName: string;
  orderIndex: number;
  targetSets?: number;
  targetReps?: number;
}

export async function replaceRoutineExercises(
  routineId: string,
  exercises: ReplaceRoutineExercisesInput[]
): Promise<RoutineExercise[]> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  // First verify the routine belongs to this user
  const { data: routine, error: routineError } = await supabase
    .from('workout_routines')
    .select('id')
    .eq('id', routineId)
    .eq('user_id', user.id)
    .single();

  if (routineError || !routine) {
    throw new Error('Routine not found or access denied');
  }

  // Delete existing exercises
  const { error: deleteError } = await supabase
    .from('routine_exercises')
    .delete()
    .eq('routine_id', routineId);

  if (deleteError) {
    console.error('Error deleting routine exercises:', deleteError);
    throw deleteError;
  }

  // Insert new exercises
  if (exercises.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('routine_exercises')
    .insert(
      exercises.map((ex) => ({
        routine_id: routineId,
        exercise_name: ex.exerciseName,
        order_index: ex.orderIndex,
        target_sets: ex.targetSets || null,
        target_reps: ex.targetReps || null,
      }))
    )
    .select();

  if (error) {
    console.error('Error creating routine exercises:', error);
    throw error;
  }

  return (data || []).map(mapRoutineExerciseRow);
}

// ============================================
// USER CUSTOM ACTIVITIES
// ============================================

export interface UserCustomActivity {
  id: string;
  userId: string;
  activityName: string;
  estimatedMet: number;
  createdAt: string;
}

function mapUserCustomActivityRow(row: any): UserCustomActivity {
  return {
    id: row.id,
    userId: row.user_id,
    activityName: row.activity_name,
    estimatedMet: Number(row.estimated_met),
    createdAt: row.created_at,
  };
}

export async function getUserCustomActivities(): Promise<UserCustomActivity[]> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('user_custom_activities')
    .select('*')
    .eq('user_id', user.id)
    .order('activity_name');

  if (error) {
    console.error('Error fetching user custom activities:', error);
    return [];
  }

  return (data || []).map(mapUserCustomActivityRow);
}

export async function createUserCustomActivity(input: {
  activityName: string;
  estimatedMet: number;
}): Promise<UserCustomActivity> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('user_custom_activities')
    .insert({
      user_id: user.id,
      activity_name: input.activityName,
      estimated_met: input.estimatedMet,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user custom activity:', error);
    throw error;
  }

  return mapUserCustomActivityRow(data);
}

// ============================================
// DAILY SUMMARIES
// ============================================

export interface DailySummary {
  id: string;
  userId: string;
  date: string;
  finalized: boolean;
  finalizedAt: string;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  createdAt: string;
}

function mapDailySummaryRow(row: any): DailySummary {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    finalized: row.finalized,
    finalizedAt: row.finalized_at,
    totalCalories: Number(row.total_calories),
    totalProteinG: Number(row.total_protein_g),
    totalCarbsG: Number(row.total_carbs_g),
    totalFatG: Number(row.total_fat_g),
    createdAt: row.created_at,
  };
}

export async function getDailySummary(date: string): Promise<DailySummary | null> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', date)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching daily summary:', error);
    throw error;
  }

  return mapDailySummaryRow(data);
}

export interface CreateDailySummaryInput {
  date: string;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
}

export async function createDailySummary(input: CreateDailySummaryInput): Promise<DailySummary> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('daily_summaries')
    .insert({
      user_id: user.id,
      date: input.date,
      finalized: true,
      total_calories: input.totalCalories,
      total_protein_g: input.totalProteinG,
      total_carbs_g: input.totalCarbsG,
      total_fat_g: input.totalFatG,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Day already finalized');
    }
    console.error('Error creating daily summary:', error);
    throw error;
  }

  return mapDailySummaryRow(data);
}

export async function getDailySummaries(startDate?: string, endDate?: string): Promise<DailySummary[]> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    return [];
  }

  let query = supabase
    .from('daily_summaries')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false });

  if (startDate) {
    query = query.gte('date', startDate);
  }
  if (endDate) {
    query = query.lte('date', endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching daily summaries:', error);
    throw error;
  }

  return (data || []).map(mapDailySummaryRow);
}

export interface FoodWithBarcodes extends Food {
  barcodes?: FoodBarcode[];
}

export async function getCardioActivities(): Promise<{
  activities: CardioActivity[];
  grouped: Record<string, CardioActivity[]>;
}> {
  const { data, error } = await supabase
    .from('cardio_activities')
    .select('*')
    .order('category')
    .order('name');

  if (error) {
    console.error('Error fetching cardio activities:', error);
    throw error;
  }

  const activities: CardioActivity[] = (data || []).map(row => ({
    id: row.id,
    name: row.name,
    baseMET: Number(row.base_met),
    category: row.category,
  }));

  const grouped = activities.reduce((acc, activity) => {
    if (!acc[activity.category]) {
      acc[activity.category] = [];
    }
    acc[activity.category].push(activity);
    return acc;
  }, {} as Record<string, CardioActivity[]>);

  return { activities, grouped };
}

export async function searchFoods(query: string, limit: number = 20): Promise<FoodWithBarcodes[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = `%${query.trim().toLowerCase()}%`;
  
  const { data, error } = await supabase
    .from('foods')
    .select(`
      *,
      food_barcodes(id, food_id, barcode, created_at)
    `)
    .or(`canonical_name.ilike.${searchTerm},brand.ilike.${searchTerm}`)
    .order('times_used', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error searching foods:', error);
    return [];
  }

  return (data || []).map(row => mapFoodRow(row));
}

export async function getPopularFoods(limit: number = 20): Promise<FoodWithBarcodes[]> {
  const { data, error } = await supabase
    .from('foods')
    .select(`
      *,
      food_barcodes(id, food_id, barcode, created_at)
    `)
    .order('times_used', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching popular foods:', error);
    return [];
  }

  return (data || []).map(row => mapFoodRow(row));
}

export async function getRecentFoods(limit: number = 10): Promise<FoodWithBarcodes[]> {
  const { data, error } = await supabase
    .from('foods')
    .select(`
      *,
      food_barcodes(id, food_id, barcode, created_at)
    `)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent foods:', error);
    throw error;
  }

  return (data || []).map(row => mapFoodRow(row));
}

export async function getFoodByBarcode(barcode: string): Promise<FoodWithBarcodes | null> {
  const { data, error } = await supabase
    .from('food_barcodes')
    .select(`
      *,
      foods(*)
    `)
    .eq('barcode', barcode)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching food by barcode:', error);
    throw error;
  }

  if (!data || !data.foods) {
    return null;
  }

  const food = mapFoodRowSimple(data.foods as any);
  return {
    ...food,
    barcodes: [mapFoodBarcodeRow(data)],
  };
}

export async function createFood(foodData: {
  canonicalName: string;
  brand?: string | null;
  source: 'barcode' | 'ai_text' | 'ai_image' | 'manual' | 'imported';
  caloriesPer100g?: number | null;
  proteinPer100g?: number | null;
  carbsPer100g?: number | null;
  fatPer100g?: number | null;
  fiberPer100g?: number | null;
  sugarPer100g?: number | null;
  defaultServingSize?: string | null;
  defaultServingGrams?: number | null;
  caloriesPerServing?: number | null;
  proteinPerServing?: number | null;
  carbsPerServing?: number | null;
  fatPerServing?: number | null;
}): Promise<Food> {
  const { data, error } = await supabase
    .from('foods')
    .insert({
      canonical_name: foodData.canonicalName,
      brand: foodData.brand,
      source: foodData.source,
      verification_status: 'pending',
      calories_per_100g: foodData.caloriesPer100g,
      protein_per_100g: foodData.proteinPer100g,
      carbs_per_100g: foodData.carbsPer100g,
      fat_per_100g: foodData.fatPer100g,
      fiber_per_100g: foodData.fiberPer100g,
      sugar_per_100g: foodData.sugarPer100g,
      default_serving_size: foodData.defaultServingSize,
      default_serving_grams: foodData.defaultServingGrams,
      calories_per_serving: foodData.caloriesPerServing,
      protein_per_serving: foodData.proteinPerServing,
      carbs_per_serving: foodData.carbsPerServing,
      fat_per_serving: foodData.fatPerServing,
      times_used: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating food:', error);
    throw error;
  }

  return mapFoodRowSimple(data);
}

export async function addFoodBarcode(foodId: string, barcode: string): Promise<FoodBarcode> {
  const { data, error } = await supabase
    .from('food_barcodes')
    .insert({
      food_id: foodId,
      barcode: barcode,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding food barcode:', error);
    throw error;
  }

  return mapFoodBarcodeRow(data);
}

export async function addFoodAlias(foodId: string, aliasText: string): Promise<void> {
  const normalizedText = aliasText.toLowerCase().trim();
  
  const { error } = await supabase
    .from('food_aliases')
    .insert({
      food_id: foodId,
      alias_text: aliasText,
      normalized_text: normalizedText,
    });

  if (error) {
    console.error('Error adding food alias:', error);
    throw error;
  }
}

export async function incrementFoodUsage(foodId: string): Promise<void> {
  const { data: food } = await supabase
    .from('foods')
    .select('times_used')
    .eq('id', foodId)
    .single();
    
  if (food) {
    const { error } = await supabase
      .from('foods')
      .update({ times_used: (food.times_used || 0) + 1 })
      .eq('id', foodId);
      
    if (error) {
      console.error('Error incrementing food usage:', error);
    }
  }
}

function mapFoodBarcodeRow(b: any): FoodBarcode {
  return {
    id: b.id,
    foodId: b.food_id,
    barcode: b.barcode,
    createdAt: new Date(b.created_at),
  };
}

function mapFoodRow(row: any): FoodWithBarcodes {
  const food = mapFoodRowSimple(row);
  return {
    ...food,
    barcodes: (row.food_barcodes || []).map(mapFoodBarcodeRow),
  };
}

function mapFoodRowSimple(row: any): Food {
  return {
    id: row.id,
    canonicalName: row.canonical_name,
    brand: row.brand,
    source: row.source,
    verificationStatus: row.verification_status,
    caloriesPer100g: row.calories_per_100g != null ? Number(row.calories_per_100g) : null,
    proteinPer100g: row.protein_per_100g != null ? Number(row.protein_per_100g) : null,
    carbsPer100g: row.carbs_per_100g != null ? Number(row.carbs_per_100g) : null,
    fatPer100g: row.fat_per_100g != null ? Number(row.fat_per_100g) : null,
    fiberPer100g: row.fiber_per_100g != null ? Number(row.fiber_per_100g) : null,
    sugarPer100g: row.sugar_per_100g != null ? Number(row.sugar_per_100g) : null,
    defaultServingSize: row.default_serving_size,
    defaultServingGrams: row.default_serving_grams != null ? Number(row.default_serving_grams) : null,
    caloriesPerServing: row.calories_per_serving != null ? Number(row.calories_per_serving) : null,
    proteinPerServing: row.protein_per_serving != null ? Number(row.protein_per_serving) : null,
    carbsPerServing: row.carbs_per_serving != null ? Number(row.carbs_per_serving) : null,
    fatPerServing: row.fat_per_serving != null ? Number(row.fat_per_serving) : null,
    timesUsed: row.times_used ?? 0,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getWeighIns(limit: number = 30): Promise<WeighIn[]> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('weigh_ins')
    .select('*')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching weigh-ins:', error);
    throw error;
  }

  return (data || []).map(mapWeighInRow);
}

export async function createWeighIn(weighInData: Omit<InsertWeighIn, 'userId'>): Promise<WeighIn> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const loggedAt = weighInData.date 
    ? new Date(weighInData.date + 'T12:00:00Z').toISOString()
    : new Date().toISOString();

  const { data, error } = await supabase
    .from('weigh_ins')
    .insert({
      user_id: user.id,
      logged_at: loggedAt,
      weight_kg: weighInData.weightKg,
      notes: weighInData.notes ?? null,
      waist_cm: weighInData.waistCm ?? null,
      hips_cm: weighInData.hipsCm ?? null,
      bust_chest_cm: weighInData.bustChestCm ?? null,
      thigh_cm: weighInData.thighCm ?? null,
      arm_cm: weighInData.armCm ?? null,
      calf_cm: weighInData.calfCm ?? null,
      neck_cm: weighInData.neckCm ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating weigh-in:', error);
    throw error;
  }

  // Also update the profile's current weight so BMI gauge and other features work
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ current_weight_kg: weighInData.weightKg })
    .eq('id', user.id);

  if (profileError) {
    console.error('Error updating profile weight:', profileError);
    // Don't throw - the weigh-in was created successfully
  }

  return mapWeighInRow(data);
}

export async function deleteWeighIn(id: string): Promise<void> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('weigh_ins')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting weigh-in:', error);
    throw error;
  }

  // Update profile to the most recent remaining weigh-in
  const { data: latestWeighIn } = await supabase
    .from('weigh_ins')
    .select('weight_kg')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false })
    .limit(1)
    .single();

  if (latestWeighIn) {
    await supabase
      .from('profiles')
      .update({ current_weight_kg: latestWeighIn.weight_kg })
      .eq('id', user.id);
  }
}

function mapWeighInRow(row: any): WeighIn {
  const loggedAt = new Date(row.logged_at);
  const dateStr = loggedAt.toISOString().split('T')[0];
  
  return {
    id: row.id,
    userId: row.user_id,
    date: dateStr,
    weightKg: Number(row.weight_kg),
    notes: row.notes ?? null,
    waistCm: row.waist_cm != null ? Number(row.waist_cm) : null,
    hipsCm: row.hips_cm != null ? Number(row.hips_cm) : null,
    bustChestCm: row.bust_chest_cm != null ? Number(row.bust_chest_cm) : null,
    thighCm: row.thigh_cm != null ? Number(row.thigh_cm) : null,
    armCm: row.arm_cm != null ? Number(row.arm_cm) : null,
    calfCm: row.calf_cm != null ? Number(row.calf_cm) : null,
    neckCm: row.neck_cm != null ? Number(row.neck_cm) : null,
    createdAt: new Date(row.created_at),
  };
}

export async function getFoodLogs(startDate?: Date, endDate?: Date): Promise<FoodLog[]> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  let query = supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false });

  if (startDate) {
    query = query.gte('logged_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('logged_at', endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching food logs:', error);
    throw error;
  }

  return (data || []).map(mapFoodLogRow);
}

type ValidMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

function normalizeMealType(mealType: string | undefined | null): ValidMealType {
  if (!mealType) return 'snack';
  const lower = mealType.toLowerCase().trim();
  if (lower === 'breakfast' || lower === 'lunch' || lower === 'dinner' || lower === 'snack') {
    return lower as ValidMealType;
  }
  if (lower === 'snacks') return 'snack';
  return 'snack';
}

export async function createFoodLog(foodLogData: Omit<InsertFoodLog, 'userId' | 'mealType'> & { mealType?: string; loggedAt?: string }): Promise<FoodLog> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const loggedAt = foodLogData.loggedAt 
    ? new Date(foodLogData.loggedAt).toISOString()
    : new Date().toISOString();

  const validMealType = normalizeMealType(foodLogData.mealType);

  const { data, error } = await supabase
    .from('food_logs')
    .insert({
      user_id: user.id,
      logged_by_user_id: user.id,
      logged_at: loggedAt,
      food_name: foodLogData.foodName,
      quantity_value: foodLogData.quantityValue,
      quantity_unit: foodLogData.quantityUnit,
      calories: foodLogData.calories,
      protein: foodLogData.proteinG ?? null,
      carbs: foodLogData.carbsG ?? null,
      fat: foodLogData.fatG ?? null,
      fiber: foodLogData.fiberG ?? null,
      sugar: foodLogData.sugarG ?? null,
      calories_per_unit: foodLogData.caloriesPerUnit ?? null,
      protein_per_unit: foodLogData.proteinPerUnit ?? null,
      carbs_per_unit: foodLogData.carbsPerUnit ?? null,
      fat_per_unit: foodLogData.fatPerUnit ?? null,
      micronutrients_dump: foodLogData.micronutrientsDump ?? null,
      meal_type: validMealType,
      breaks_fast: foodLogData.breaksFast ?? null,
      barcode: foodLogData.barcode ?? null,
      servings: foodLogData.quantityValue,
      serving_description: foodLogData.quantityUnit,
      meal_capture_id: foodLogData.mealCaptureId ?? null,
      food_item_id: foodLogData.foodItemId ?? null,
      nutrient_snapshot: foodLogData.nutrientSnapshot ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating food log:', error);
    throw error;
  }

  return mapFoodLogRow(data);
}

export async function updateFoodLog(id: string, updates: {
  quantityValue?: number;
  calories?: number;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  fiberG?: number | null;
  sugarG?: number | null;
}): Promise<FoodLog> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const updatePayload: Record<string, any> = {};
  if (updates.quantityValue !== undefined) {
    updatePayload.quantity_value = updates.quantityValue;
    updatePayload.servings = updates.quantityValue;
  }
  if (updates.calories !== undefined) updatePayload.calories = updates.calories;
  if (updates.proteinG !== undefined) updatePayload.protein = updates.proteinG;
  if (updates.carbsG !== undefined) updatePayload.carbs = updates.carbsG;
  if (updates.fatG !== undefined) updatePayload.fat = updates.fatG;
  if (updates.fiberG !== undefined) updatePayload.fiber = updates.fiberG;
  if (updates.sugarG !== undefined) updatePayload.sugar = updates.sugarG;

  const { data, error } = await supabase
    .from('food_logs')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating food log:', error);
    throw error;
  }

  return mapFoodLogRow(data);
}

export async function deleteFoodLog(id: string): Promise<void> {
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('food_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting food log:', error);
    throw error;
  }
}

function mapFoodLogRow(row: any): FoodLog {
  return {
    id: row.id,
    userId: row.user_id,
    timestamp: new Date(row.logged_at),
    foodName: row.food_name,
    quantityValue: Number(row.quantity_value ?? row.servings ?? 1),
    quantityUnit: row.quantity_unit ?? row.serving_description ?? 'serving',
    calories: Number(row.calories ?? 0),
    proteinG: row.protein != null ? Number(row.protein) : null,
    carbsG: row.carbs != null ? Number(row.carbs) : null,
    fatG: row.fat != null ? Number(row.fat) : null,
    fiberG: row.fiber != null ? Number(row.fiber) : null,
    sugarG: row.sugar != null ? Number(row.sugar) : null,
    caloriesPerUnit: row.calories_per_unit != null ? Number(row.calories_per_unit) : null,
    proteinPerUnit: row.protein_per_unit != null ? Number(row.protein_per_unit) : null,
    carbsPerUnit: row.carbs_per_unit != null ? Number(row.carbs_per_unit) : null,
    fatPerUnit: row.fat_per_unit != null ? Number(row.fat_per_unit) : null,
    micronutrientsDump: row.micronutrients_dump ?? null,
    mealType: row.meal_type ?? null,
    breaksFast: row.breaks_fast ?? null,
    barcode: row.barcode ?? null,
    mealCaptureId: row.meal_capture_id ?? null,
    foodItemId: row.food_item_id ?? null,
    nutrientSnapshot: row.nutrient_snapshot ?? null,
  };
}
