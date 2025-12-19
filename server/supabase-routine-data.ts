import { supabaseAdmin } from './supabase-admin';

/**
 * Helper to get the profile photo path, with fallback to preset avatar URL.
 * If profile_photo_path is set, use it. Otherwise, look up the preset avatar's signed URL.
 */
async function resolveProfilePhotoPath(
  profilePhotoPath: string | null | undefined,
  presetAvatarId: string | null | undefined
): Promise<string | null> {
  if (profilePhotoPath) {
    return profilePhotoPath;
  }
  
  if (!presetAvatarId) {
    return null;
  }
  
  const { data: presetAvatar } = await supabaseAdmin
    .from('preset_avatars')
    .select('image_path')
    .eq('id', presetAvatarId)
    .maybeSingle();
    
  if (presetAvatar?.image_path) {
    const { data: signedData } = await supabaseAdmin.storage
      .from('preset-avatars')
      .createSignedUrl(presetAvatar.image_path, 3600);
    return signedData?.signedUrl || null;
  }
  
  return null;
}

export interface EquipmentOption {
  id: string;
  name: string;
  category: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface GoalType {
  id: string;
  name: string;
  description: string | null;
  default_rep_range: string | null;
  default_rest_seconds: number | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Exercise {
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
}

export interface RoutineBlueprint {
  id: string;
  name: string;
  description: string | null;
  owner_type: 'platform' | 'professional' | 'client_proxy';
  owner_id: string | null;
  created_for_client_id: string | null;
  creation_method: 'manual' | 'template' | 'ai_assisted';
  source_blueprint_id: string | null;
  goal_type_id: string | null;
  equipment_profile: string[] | null;
  duration_weeks: number | null;
  sessions_per_week: number | null;
  ai_prompt: string | null;
  ai_response: any | null;
  is_template: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoutineVersion {
  id: string;
  blueprint_id: string;
  routine_id: string;
  version_number: number;
  status: 'draft' | 'pending_review' | 'active' | 'archived';
  notes: string | null;
  created_at: string;
  published_at: string | null;
  parent_version_id: string | null;
}

export type LoadDirective = 'absolute' | 'assisted' | 'bodyweight' | 'open';
export type WeightUnit = 'kg' | 'lbs';

export interface RoutineVersionExercise {
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
  entered_weight_unit: WeightUnit | null;
  load_directive: LoadDirective;
  special_instructions: string | null;
  created_at: string;
}

export interface RoutineAIRequest {
  id: string;
  requester_id: string;
  requester_role: 'professional' | 'client' | 'admin';
  for_client_id: string | null;
  prompt_text: string;
  equipment_selected: string[];
  goal_type_id: string | null;
  additional_params: any | null;
  ai_response: any | null;
  resulting_blueprint_id: string | null;
  status: 'pending' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export type AssignmentEventType = 'created' | 'status_changed' | 'dates_updated' | 'notes_updated' | 'reassigned' | 'accepted' | 'rejected';
export type AssignmentStatus = 'active' | 'paused' | 'completed' | 'cancelled' | 'pending_acceptance' | 'rejected';
export type ClientTier = 'normal' | 'pro_connected';

export interface RoutineAssignmentEvent {
  id: string;
  assignment_id: string;
  event_type: AssignmentEventType;
  performed_by: string | null;
  old_status: AssignmentStatus | null;
  new_status: AssignmentStatus | null;
  old_start_date: string | null;
  new_start_date: string | null;
  old_end_date: string | null;
  new_end_date: string | null;
  old_notes: string | null;
  new_notes: string | null;
  event_notes: string | null;
  created_at: string;
}

// =============================================================================
// EQUIPMENT OPTIONS
// =============================================================================

export async function getEquipmentOptions(): Promise<EquipmentOption[]> {
  const { data, error } = await supabaseAdmin
    .from('equipment_options')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching equipment options:', error);
    throw error;
  }

  return data || [];
}

export async function createEquipmentOption(option: Partial<Omit<EquipmentOption, 'id' | 'created_at'>>): Promise<EquipmentOption> {
  const normalizedOption = {
    name: option.name || 'Unnamed Equipment',
    category: option.category || 'Other',
    display_order: typeof option.display_order === 'number' ? option.display_order : 0,
    is_active: option.is_active !== false,
  };

  const { data, error } = await supabaseAdmin
    .from('equipment_options')
    .insert(normalizedOption)
    .select()
    .single();

  if (error) {
    console.error('Error creating equipment option:', error);
    throw error;
  }

  return data;
}

export async function updateEquipmentOption(id: string, updates: Partial<EquipmentOption>): Promise<EquipmentOption> {
  const sanitizedUpdates: Record<string, any> = {};
  
  if (updates.name !== undefined && typeof updates.name === 'string' && updates.name.trim().length > 0) {
    sanitizedUpdates.name = updates.name.trim();
  }
  if (updates.category !== undefined && typeof updates.category === 'string' && updates.category.trim().length > 0) {
    sanitizedUpdates.category = updates.category.trim();
  }
  if (updates.display_order !== undefined && typeof updates.display_order === 'number') {
    sanitizedUpdates.display_order = updates.display_order;
  }
  if (updates.is_active !== undefined && typeof updates.is_active === 'boolean') {
    sanitizedUpdates.is_active = updates.is_active;
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    const existing = await supabaseAdmin.from('equipment_options').select('*').eq('id', id).single();
    if (existing.error) throw existing.error;
    return existing.data;
  }

  const { data, error } = await supabaseAdmin
    .from('equipment_options')
    .update(sanitizedUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating equipment option:', error);
    throw error;
  }

  return data;
}

export async function deleteEquipmentOption(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('equipment_options')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting equipment option:', error);
    throw error;
  }
}

// =============================================================================
// GOAL TYPES
// =============================================================================

export async function getGoalTypes(): Promise<GoalType[]> {
  const { data, error } = await supabaseAdmin
    .from('goal_types')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching goal types:', error);
    throw error;
  }

  return data || [];
}

export async function createGoalType(goal: Partial<Omit<GoalType, 'id' | 'created_at'>>): Promise<GoalType> {
  const normalizedGoal = {
    name: goal.name || 'Unnamed Goal',
    description: goal.description || null,
    default_rep_range: goal.default_rep_range || null,
    default_rest_seconds: typeof goal.default_rest_seconds === 'number' ? goal.default_rest_seconds : null,
    display_order: typeof goal.display_order === 'number' ? goal.display_order : 0,
    is_active: goal.is_active !== false,
  };

  const { data, error } = await supabaseAdmin
    .from('goal_types')
    .insert(normalizedGoal)
    .select()
    .single();

  if (error) {
    console.error('Error creating goal type:', error);
    throw error;
  }

  return data;
}

export async function updateGoalType(id: string, updates: Partial<GoalType>): Promise<GoalType> {
  const sanitizedUpdates: Record<string, any> = {};
  
  if (updates.name !== undefined && typeof updates.name === 'string' && updates.name.trim().length > 0) {
    sanitizedUpdates.name = updates.name.trim();
  }
  if (updates.description !== undefined && typeof updates.description === 'string') {
    const trimmed = updates.description.trim();
    sanitizedUpdates.description = trimmed.length > 0 ? trimmed : null;
  }
  if (updates.default_rep_range !== undefined && typeof updates.default_rep_range === 'string') {
    const trimmed = updates.default_rep_range.trim();
    sanitizedUpdates.default_rep_range = trimmed.length > 0 ? trimmed : null;
  }
  if (updates.default_rest_seconds !== undefined) {
    sanitizedUpdates.default_rest_seconds = typeof updates.default_rest_seconds === 'number' ? updates.default_rest_seconds : null;
  }
  if (updates.display_order !== undefined && typeof updates.display_order === 'number') {
    sanitizedUpdates.display_order = updates.display_order;
  }
  if (updates.is_active !== undefined && typeof updates.is_active === 'boolean') {
    sanitizedUpdates.is_active = updates.is_active;
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    const existing = await supabaseAdmin.from('goal_types').select('*').eq('id', id).single();
    if (existing.error) throw existing.error;
    return existing.data;
  }

  const { data, error } = await supabaseAdmin
    .from('goal_types')
    .update(sanitizedUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating goal type:', error);
    throw error;
  }

  return data;
}

export async function deleteGoalType(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('goal_types')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting goal type:', error);
    throw error;
  }
}

// =============================================================================
// EXERCISE LIBRARY
// =============================================================================

export async function getExercises(filters?: {
  category?: string;
  muscleGroup?: string;
  equipment?: string;
  isSystem?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ exercises: Exercise[]; total: number }> {
  let query = supabaseAdmin
    .from('exercise_library')
    .select('*', { count: 'exact' });

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.muscleGroup) {
    query = query.contains('muscle_groups', [filters.muscleGroup]);
  }

  if (filters?.equipment) {
    query = query.contains('equipment_tags', [filters.equipment]);
  }

  if (filters?.isSystem !== undefined) {
    query = query.eq('is_system', filters.isSystem);
  }

  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  query = query.order('name', { ascending: true });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching exercises:', error);
    throw error;
  }

  return { exercises: data || [], total: count || 0 };
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
  const { data, error } = await supabaseAdmin
    .from('exercise_library')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching exercise:', error);
    throw error;
  }

  return data;
}

export async function createExercise(exercise: Partial<Omit<Exercise, 'id' | 'created_at' | 'updated_at'>>): Promise<Exercise> {
  const normalizedExercise = {
    name: exercise.name || 'Unnamed Exercise',
    category: exercise.category || 'Other',
    muscle_groups: Array.isArray(exercise.muscle_groups) ? exercise.muscle_groups : [],
    equipment_tags: Array.isArray(exercise.equipment_tags) ? exercise.equipment_tags : [],
    difficulty_level: exercise.difficulty_level || 'intermediate',
    instructions: exercise.instructions || null,
    video_url: exercise.video_url || null,
    thumbnail_url: exercise.thumbnail_url || null,
    demonstration_notes: exercise.demonstration_notes || null,
    is_system: exercise.is_system !== false,
    created_by: exercise.created_by || null,
  };

  const { data, error } = await supabaseAdmin
    .from('exercise_library')
    .insert(normalizedExercise)
    .select()
    .single();

  if (error) {
    console.error('Error creating exercise:', error);
    throw error;
  }

  return data;
}

export async function updateExercise(id: string, updates: Partial<Exercise>): Promise<Exercise> {
  const sanitizedUpdates: Record<string, any> = {};
  
  if (updates.name !== undefined && typeof updates.name === 'string' && updates.name.trim().length > 0) {
    sanitizedUpdates.name = updates.name.trim();
  }
  if (updates.category !== undefined && typeof updates.category === 'string' && updates.category.trim().length > 0) {
    sanitizedUpdates.category = updates.category.trim();
  }
  if (updates.muscle_groups !== undefined) {
    sanitizedUpdates.muscle_groups = Array.isArray(updates.muscle_groups) ? updates.muscle_groups : [];
  }
  if (updates.equipment_tags !== undefined) {
    sanitizedUpdates.equipment_tags = Array.isArray(updates.equipment_tags) ? updates.equipment_tags : [];
  }
  if (updates.difficulty_level !== undefined && ['beginner', 'intermediate', 'advanced'].includes(updates.difficulty_level)) {
    sanitizedUpdates.difficulty_level = updates.difficulty_level;
  }
  if (updates.instructions !== undefined && typeof updates.instructions === 'string') {
    const trimmed = updates.instructions.trim();
    sanitizedUpdates.instructions = trimmed.length > 0 ? trimmed : null;
  }
  if (updates.video_url !== undefined && typeof updates.video_url === 'string') {
    const trimmed = updates.video_url.trim();
    sanitizedUpdates.video_url = trimmed.length > 0 ? trimmed : null;
  }
  if (updates.thumbnail_url !== undefined && typeof updates.thumbnail_url === 'string') {
    const trimmed = updates.thumbnail_url.trim();
    sanitizedUpdates.thumbnail_url = trimmed.length > 0 ? trimmed : null;
  }
  if (updates.demonstration_notes !== undefined && typeof updates.demonstration_notes === 'string') {
    const trimmed = updates.demonstration_notes.trim();
    sanitizedUpdates.demonstration_notes = trimmed.length > 0 ? trimmed : null;
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    const existing = await supabaseAdmin.from('exercise_library').select('*').eq('id', id).single();
    if (existing.error) throw existing.error;
    return existing.data;
  }

  const { data, error } = await supabaseAdmin
    .from('exercise_library')
    .update(sanitizedUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating exercise:', error);
    throw error;
  }

  return data;
}

export async function deleteExercise(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('exercise_library')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting exercise:', error);
    throw error;
  }
}

// =============================================================================
// ROUTINE BLUEPRINTS
// =============================================================================

export async function getRoutineBlueprints(filters?: {
  ownerType?: 'platform' | 'professional' | 'client_proxy';
  ownerId?: string;
  isTemplate?: boolean;
  isArchived?: boolean;
  goalTypeId?: string;
}): Promise<RoutineBlueprint[]> {
  let query = supabaseAdmin
    .from('routine_blueprints')
    .select('*');

  if (filters?.ownerType) {
    query = query.eq('owner_type', filters.ownerType);
  }

  if (filters?.ownerId) {
    query = query.eq('owner_id', filters.ownerId);
  }

  if (filters?.isTemplate !== undefined) {
    query = query.eq('is_template', filters.isTemplate);
  }

  if (filters?.isArchived !== undefined) {
    query = query.eq('is_archived', filters.isArchived);
  }

  if (filters?.goalTypeId) {
    query = query.eq('goal_type_id', filters.goalTypeId);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching routine blueprints:', error);
    throw error;
  }

  return data || [];
}

export async function getRoutineBlueprintById(id: string): Promise<RoutineBlueprint | null> {
  const { data, error } = await supabaseAdmin
    .from('routine_blueprints')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching routine blueprint:', error);
    throw error;
  }

  return data;
}

export async function createRoutineBlueprint(blueprint: Partial<Omit<RoutineBlueprint, 'id' | 'created_at' | 'updated_at'>>): Promise<RoutineBlueprint> {
  const normalizedBlueprint = {
    name: blueprint.name?.trim() || '',
    description: blueprint.description?.trim() || null,
    owner_type: blueprint.owner_type || 'platform',
    owner_id: blueprint.owner_id || null,
    created_for_client_id: blueprint.created_for_client_id || null,
    creation_method: blueprint.creation_method || 'manual',
    source_blueprint_id: blueprint.source_blueprint_id || null,
    goal_type_id: blueprint.goal_type_id || null,
    equipment_profile: Array.isArray(blueprint.equipment_profile) ? blueprint.equipment_profile : null,
    duration_weeks: typeof blueprint.duration_weeks === 'number' ? blueprint.duration_weeks : null,
    sessions_per_week: typeof blueprint.sessions_per_week === 'number' ? blueprint.sessions_per_week : null,
    ai_prompt: blueprint.ai_prompt?.trim() || null,
    ai_response: blueprint.ai_response || null,
    is_template: blueprint.is_template !== false,
    is_archived: blueprint.is_archived === true,
  };

  if (!normalizedBlueprint.name) {
    throw new Error('Blueprint name is required');
  }

  const { data, error } = await supabaseAdmin
    .from('routine_blueprints')
    .insert(normalizedBlueprint)
    .select()
    .single();

  if (error) {
    console.error('Error creating routine blueprint:', error);
    throw error;
  }

  return data;
}

export async function updateRoutineBlueprint(id: string, updates: Partial<RoutineBlueprint>): Promise<RoutineBlueprint> {
  const sanitizedUpdates: Record<string, any> = {};

  if (updates.name !== undefined && typeof updates.name === 'string' && updates.name.trim().length > 0) {
    sanitizedUpdates.name = updates.name.trim();
  }
  if (updates.description !== undefined && typeof updates.description === 'string') {
    const trimmed = updates.description.trim();
    sanitizedUpdates.description = trimmed.length > 0 ? trimmed : null;
  }
  if (updates.goal_type_id !== undefined) {
    sanitizedUpdates.goal_type_id = updates.goal_type_id || null;
  }
  if (updates.equipment_profile !== undefined) {
    sanitizedUpdates.equipment_profile = Array.isArray(updates.equipment_profile) ? updates.equipment_profile : null;
  }
  if (updates.duration_weeks !== undefined) {
    sanitizedUpdates.duration_weeks = typeof updates.duration_weeks === 'number' ? updates.duration_weeks : null;
  }
  if (updates.sessions_per_week !== undefined) {
    sanitizedUpdates.sessions_per_week = typeof updates.sessions_per_week === 'number' ? updates.sessions_per_week : null;
  }
  if (updates.is_archived !== undefined && typeof updates.is_archived === 'boolean') {
    sanitizedUpdates.is_archived = updates.is_archived;
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    const existing = await supabaseAdmin.from('routine_blueprints').select('*').eq('id', id).single();
    if (existing.error) throw existing.error;
    return existing.data;
  }

  sanitizedUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('routine_blueprints')
    .update(sanitizedUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating routine blueprint:', error);
    throw error;
  }

  return data;
}

export async function deleteRoutineBlueprint(id: string): Promise<RoutineBlueprint> {
  return updateRoutineBlueprint(id, { is_archived: true });
}

export async function cloneRoutineBlueprint(sourceId: string, newOwnerType?: 'platform' | 'professional' | 'client_proxy', newOwnerId?: string): Promise<{ blueprint: RoutineBlueprint; version: RoutineVersion }> {
  const source = await getRoutineBlueprintById(sourceId);
  if (!source) {
    throw new Error('Source blueprint not found');
  }

  const sourceVersions = await getRoutineVersions(sourceId);
  const activeVersion = sourceVersions.find(v => v.status === 'active') || sourceVersions[0];
  
  const newBlueprint = await createRoutineBlueprint({
    name: `${source.name} (Copy)`,
    description: source.description,
    owner_type: newOwnerType || source.owner_type,
    owner_id: newOwnerId || source.owner_id,
    creation_method: 'template',
    source_blueprint_id: sourceId,
    goal_type_id: source.goal_type_id,
    equipment_profile: source.equipment_profile,
    duration_weeks: source.duration_weeks,
    sessions_per_week: source.sessions_per_week,
    is_template: source.is_template,
  });

  const newVersion = await createRoutineVersion({
    blueprint_id: newBlueprint.id,
    version_number: 1,
    status: 'draft',
    notes: `Cloned from ${source.name}`,
  });

  if (activeVersion) {
    const sourceExercises = await getRoutineVersionExercises(activeVersion.id);
    if (sourceExercises.length > 0) {
      const exercisesToClone = sourceExercises.map(ex => ({
        routine_version_id: newVersion.id,
        exercise_id: ex.exercise_id,
        custom_exercise_name: ex.custom_exercise_name,
        day_number: ex.day_number,
        order_in_day: ex.order_in_day,
        sets: ex.sets,
        reps_min: ex.reps_min,
        reps_max: ex.reps_max,
        rest_seconds: ex.rest_seconds,
        notes: ex.notes,
        superset_group: ex.superset_group,
        target_weight_kg: ex.target_weight_kg,
        entered_weight_value: ex.entered_weight_value,
        entered_weight_unit: ex.entered_weight_unit,
        load_directive: ex.load_directive,
        special_instructions: ex.special_instructions,
      }));
      await bulkCreateRoutineVersionExercises(exercisesToClone);
    }
  }

  return { blueprint: newBlueprint, version: newVersion };
}

// =============================================================================
// ROUTINE VERSIONS
// =============================================================================

export async function getRoutineVersions(blueprintId: string): Promise<RoutineVersion[]> {
  const { data, error } = await supabaseAdmin
    .from('routine_versions')
    .select('*')
    .eq('blueprint_id', blueprintId)
    .order('version_number', { ascending: false });

  if (error) {
    console.error('Error fetching routine versions:', error);
    throw error;
  }

  return data || [];
}

export async function getRoutineVersionById(id: string): Promise<RoutineVersion | null> {
  const { data, error } = await supabaseAdmin
    .from('routine_versions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching routine version:', error);
    throw error;
  }

  return data;
}

export async function createRoutineVersion(version: {
  blueprint_id: string;
  version_number?: number;
  status?: 'draft' | 'pending_review' | 'active' | 'archived';
  notes?: string | null;
  published_at?: string | null;
}): Promise<RoutineVersion> {
  let versionNumber = version.version_number;
  
  if (!versionNumber) {
    const existing = await getRoutineVersions(version.blueprint_id);
    versionNumber = existing.length > 0 ? Math.max(...existing.map(v => v.version_number)) + 1 : 1;
  }

  const normalizedVersion = {
    blueprint_id: version.blueprint_id,
    version_number: versionNumber,
    status: version.status || 'draft',
    notes: version.notes?.trim() || null,
    published_at: version.published_at || null,
  };

  const { data, error } = await supabaseAdmin
    .from('routine_versions')
    .insert(normalizedVersion)
    .select()
    .single();

  if (error) {
    console.error('Error creating routine version:', error);
    throw error;
  }

  return data;
}

export async function updateRoutineVersion(id: string, updates: Partial<RoutineVersion>): Promise<RoutineVersion> {
  const sanitizedUpdates: Record<string, any> = {};

  if (updates.notes !== undefined && typeof updates.notes === 'string') {
    const trimmed = updates.notes.trim();
    sanitizedUpdates.notes = trimmed.length > 0 ? trimmed : null;
  }
  if (updates.status !== undefined && ['draft', 'pending_review', 'active', 'archived'].includes(updates.status)) {
    sanitizedUpdates.status = updates.status;
    if (updates.status === 'active') {
      sanitizedUpdates.published_at = new Date().toISOString();
    }
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    const existing = await supabaseAdmin.from('routine_versions').select('*').eq('id', id).single();
    if (existing.error) throw existing.error;
    return existing.data;
  }

  const { data, error } = await supabaseAdmin
    .from('routine_versions')
    .update(sanitizedUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating routine version:', error);
    throw error;
  }

  return data;
}

export async function deleteRoutineVersion(id: string): Promise<void> {
  const version = await getRoutineVersionById(id);
  if (!version) {
    throw new Error('Version not found');
  }
  
  if (version.status === 'active') {
    throw new Error('Cannot delete active version');
  }

  await supabaseAdmin
    .from('routine_version_exercises')
    .delete()
    .eq('routine_version_id', id);

  const { error } = await supabaseAdmin
    .from('routine_versions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting routine version:', error);
    throw error;
  }
}

export async function activateRoutineVersion(id: string): Promise<RoutineVersion> {
  const version = await getRoutineVersionById(id);
  if (!version) {
    throw new Error('Version not found');
  }

  await supabaseAdmin
    .from('routine_versions')
    .update({ status: 'archived' })
    .eq('blueprint_id', version.blueprint_id)
    .eq('status', 'active');

  return updateRoutineVersion(id, { status: 'active' });
}

// =============================================================================
// ROUTINE VERSION EXERCISES
// =============================================================================

export async function getRoutineVersionExercises(versionId: string): Promise<(RoutineVersionExercise & { exercise?: Exercise })[]> {
  const { data: exercises, error } = await supabaseAdmin
    .from('routine_version_exercises')
    .select(`
      *,
      exercise:exercise_library(*)
    `)
    .eq('routine_version_id', versionId)
    .order('day_number', { ascending: true })
    .order('order_in_day', { ascending: true });

  if (error) {
    console.error('Error fetching routine version exercises:', error);
    throw error;
  }

  return exercises || [];
}

export async function createRoutineVersionExercise(exercise: Omit<RoutineVersionExercise, 'id' | 'created_at'>): Promise<RoutineVersionExercise> {
  const { data, error } = await supabaseAdmin
    .from('routine_version_exercises')
    .insert(exercise)
    .select()
    .single();

  if (error) {
    console.error('Error creating routine version exercise:', error);
    throw error;
  }

  return data;
}

export async function updateRoutineVersionExercise(id: string, updates: Partial<RoutineVersionExercise>): Promise<RoutineVersionExercise> {
  const { data, error } = await supabaseAdmin
    .from('routine_version_exercises')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating routine version exercise:', error);
    throw error;
  }

  return data;
}

export async function deleteRoutineVersionExercise(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('routine_version_exercises')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting routine version exercise:', error);
    throw error;
  }
}

export async function bulkCreateRoutineVersionExercises(exercises: Omit<RoutineVersionExercise, 'id' | 'created_at'>[]): Promise<RoutineVersionExercise[]> {
  const { data, error } = await supabaseAdmin
    .from('routine_version_exercises')
    .insert(exercises)
    .select();

  if (error) {
    console.error('Error bulk creating routine version exercises:', error);
    throw error;
  }

  return data || [];
}

export async function setVersionExercises(versionId: string, exercises: Omit<RoutineVersionExercise, 'id' | 'created_at' | 'routine_version_id'>[]): Promise<RoutineVersionExercise[]> {
  await supabaseAdmin
    .from('routine_version_exercises')
    .delete()
    .eq('routine_version_id', versionId);

  if (exercises.length === 0) {
    return [];
  }

  const exercisesWithVersion = exercises.map(ex => ({
    ...ex,
    routine_version_id: versionId,
  }));

  return bulkCreateRoutineVersionExercises(exercisesWithVersion);
}

// =============================================================================
// ROUTINE AI REQUESTS
// =============================================================================

export async function createAIRoutineRequest(request: {
  requester_id: string;
  requester_role: 'professional' | 'client' | 'admin';
  for_client_id?: string | null;
  prompt_text: string;
  equipment_selected: string[];
  goal_type_id?: string | null;
  additional_params?: any;
}): Promise<RoutineAIRequest> {
  const normalizedRequest = {
    requester_id: request.requester_id,
    requester_role: request.requester_role,
    for_client_id: request.for_client_id || null,
    prompt_text: request.prompt_text.trim(),
    equipment_selected: request.equipment_selected,
    goal_type_id: request.goal_type_id || null,
    additional_params: request.additional_params || null,
    ai_response: null,
    resulting_blueprint_id: null,
    status: 'pending' as const,
    error_message: null,
  };

  const { data, error } = await supabaseAdmin
    .from('routine_ai_requests')
    .insert(normalizedRequest)
    .select()
    .single();

  if (error) {
    console.error('Error creating AI routine request:', error);
    throw error;
  }

  return data;
}

export async function updateAIRoutineRequest(id: string, updates: {
  ai_response?: any;
  resulting_blueprint_id?: string;
  status?: 'pending' | 'completed' | 'failed';
  error_message?: string | null;
}): Promise<RoutineAIRequest> {
  const sanitizedUpdates: Record<string, any> = {};

  if (updates.ai_response !== undefined) {
    sanitizedUpdates.ai_response = updates.ai_response;
  }
  if (updates.resulting_blueprint_id !== undefined) {
    sanitizedUpdates.resulting_blueprint_id = updates.resulting_blueprint_id;
  }
  if (updates.status !== undefined) {
    sanitizedUpdates.status = updates.status;
    if (updates.status === 'completed' || updates.status === 'failed') {
      sanitizedUpdates.completed_at = new Date().toISOString();
    }
  }
  if (updates.error_message !== undefined) {
    sanitizedUpdates.error_message = updates.error_message;
  }

  const { data, error } = await supabaseAdmin
    .from('routine_ai_requests')
    .update(sanitizedUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating AI routine request:', error);
    throw error;
  }

  return data;
}

export async function getAIRoutineRequest(id: string): Promise<RoutineAIRequest | null> {
  const { data, error } = await supabaseAdmin
    .from('routine_ai_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching AI routine request:', error);
    throw error;
  }

  return data;
}

// =============================================================================
// HELPER: Get full routine with exercises
// =============================================================================

export async function getFullRoutine(blueprintId: string, versionId?: string): Promise<{
  blueprint: RoutineBlueprint;
  version: RoutineVersion;
  exercises: (RoutineVersionExercise & { exercise?: Exercise })[];
  goalType?: GoalType;
} | null> {
  const blueprint = await getRoutineBlueprintById(blueprintId);
  if (!blueprint) return null;

  let version: RoutineVersion | null = null;

  if (versionId) {
    version = await getRoutineVersionById(versionId);
  } else {
    const versions = await getRoutineVersions(blueprintId);
    version = versions.find(v => v.status === 'active') || versions[0] || null;
  }

  if (!version) return null;

  const exercises = await getRoutineVersionExercises(version.id);

  let goalType: GoalType | undefined;
  if (blueprint.goal_type_id) {
    const goals = await getGoalTypes();
    goalType = goals.find(g => g.id === blueprint.goal_type_id);
  }

  return { blueprint, version, exercises, goalType };
}

// =============================================================================
// ROUTINE ASSIGNMENTS
// =============================================================================

export interface RoutineAssignment {
  id: string;
  routine_id: string;
  routine_version_id: string;  // The currently active version
  client_id: string;
  assigned_by_pro_id: string | null;
  status: AssignmentStatus;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  rejected_at: string | null;
  has_pending_update: boolean;
  pending_version_id: string | null;  // New version awaiting client approval
  pending_created_at: string | null;
  pending_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionExercise {
  exercise_id: string | null;
  exercise_name: string;
  sets: number;
  reps_min: number | null;
  reps_max: number | null;
  rest_seconds: number | null;
  notes: string | null;
  order_in_day: number;
  load_directive: LoadDirective;
  target_weight_kg: number | null;
  entered_weight_value: number | null;
  entered_weight_unit: WeightUnit | null;
}

export interface RoutineAssignmentSession {
  id: string;
  routine_assignment_id: string;
  routine_version_id: string;
  day_number: number;
  session_focus: string | null;
  materialized_at: string;
  is_current: boolean;
  exercises: SessionExercise[] | null;
}

export interface ProgrammeSession {
  session_id: string;
  day_number: number;
  focus: string | null;
  exercises: (RoutineVersionExercise & { exercise_name?: string })[];
}

export interface AssignmentWithSessions {
  assignment: RoutineAssignment;
  programme: {
    id: string;
    name: string;
    description: string | null;
    goal: string | null;
    duration_weeks: number | null;
    sessions_per_week: number | null;
  };
  sessions: ProgrammeSession[];
}

export async function getRoutineAssignments(filters?: {
  clientId?: string;
  assignedByProId?: string;
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
}): Promise<RoutineAssignment[]> {
  let query = supabaseAdmin
    .from('routine_assignments')
    .select('*');

  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId);
  }

  if (filters?.assignedByProId) {
    query = query.eq('assigned_by_pro_id', filters.assignedByProId);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching routine assignments:', error);
    throw error;
  }

  return data || [];
}

export async function getRoutineAssignmentById(id: string): Promise<RoutineAssignment | null> {
  const { data, error } = await supabaseAdmin
    .from('routine_assignments')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching routine assignment:', error);
    throw error;
  }

  return data;
}

export async function createRoutineAssignment(assignment: {
  routine_version_id: string;
  client_id: string;
  assigned_by_pro_id?: string | null;
  status?: AssignmentStatus;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
}): Promise<RoutineAssignment> {
  const normalizedAssignment = {
    routine_version_id: assignment.routine_version_id,
    client_id: assignment.client_id,
    assigned_by_pro_id: assignment.assigned_by_pro_id || null,
    status: assignment.status || 'pending_acceptance',
    start_date: assignment.start_date || null,
    end_date: assignment.end_date || null,
    notes: assignment.notes?.trim() || null,
  };

  const { data, error } = await supabaseAdmin
    .from('routine_assignments')
    .insert(normalizedAssignment)
    .select()
    .single();

  if (error) {
    console.error('Error creating routine assignment:', error);
    throw error;
  }

  return data;
}

const VALID_ASSIGNMENT_STATUSES: AssignmentStatus[] = ['active', 'paused', 'completed', 'cancelled', 'pending_acceptance', 'rejected'];

export async function updateRoutineAssignment(id: string, updates: Partial<RoutineAssignment>): Promise<RoutineAssignment> {
  const sanitizedUpdates: Record<string, any> = {};

  if (updates.status !== undefined && VALID_ASSIGNMENT_STATUSES.includes(updates.status)) {
    sanitizedUpdates.status = updates.status;
    if (updates.status === 'rejected') {
      sanitizedUpdates.rejected_at = new Date().toISOString();
    }
  }
  if (updates.start_date !== undefined) {
    sanitizedUpdates.start_date = updates.start_date || null;
  }
  if (updates.end_date !== undefined) {
    sanitizedUpdates.end_date = updates.end_date || null;
  }
  if (updates.notes !== undefined && typeof updates.notes === 'string') {
    const trimmed = updates.notes.trim();
    sanitizedUpdates.notes = trimmed.length > 0 ? trimmed : null;
  }
  if (updates.has_pending_update !== undefined) {
    sanitizedUpdates.has_pending_update = updates.has_pending_update;
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    const existing = await supabaseAdmin.from('routine_assignments').select('*').eq('id', id).single();
    if (existing.error) throw existing.error;
    return existing.data;
  }

  sanitizedUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('routine_assignments')
    .update(sanitizedUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating routine assignment:', error);
    throw error;
  }

  return data;
}

export async function deleteRoutineAssignment(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('routine_assignments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting routine assignment:', error);
    throw error;
  }
}

// =============================================================================
// ROUTINE ASSIGNMENT EVENTS (History)
// =============================================================================

/**
 * Gets the event history for a specific assignment.
 */
export async function getAssignmentEvents(assignmentId: string): Promise<RoutineAssignmentEvent[]> {
  const { data, error } = await supabaseAdmin
    .from('routine_assignment_events')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching assignment events:', error);
    throw error;
  }

  return data || [];
}

/**
 * Gets all events for a client's assignments (for timeline view).
 * Returns events with assignment and routine details.
 */
export async function getClientAssignmentHistory(clientId: string, limit?: number): Promise<(RoutineAssignmentEvent & {
  assignment?: RoutineAssignment & {
    routine_version?: RoutineVersion & {
      blueprint?: RoutineBlueprint;
    };
  };
})[]> {
  let query = supabaseAdmin
    .from('routine_assignment_events')
    .select(`
      *,
      assignment:routine_assignments!inner(
        *,
        routine_version:routine_versions!routine_assignments_routine_version_id_fkey(
          *,
          blueprint:routine_blueprints(*)
        )
      )
    `)
    .eq('assignment.client_id', clientId)
    .order('created_at', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching client assignment history:', error);
    throw error;
  }

  return data || [];
}

// =============================================================================
// SESSION DERIVATION HELPERS
// =============================================================================

/**
 * Derives sessions from a routine version's exercises.
 * Each unique day_number becomes a session with its exercises.
 * Session ID format: ${versionId}-d${dayNumber}
 */
export function deriveSessionsFromExercises(
  versionId: string,
  exercises: RoutineVersionExercise[],
  exerciseLibrary?: Exercise[]
): ProgrammeSession[] {
  const dayMap = new Map<number, RoutineVersionExercise[]>();

  for (const ex of exercises) {
    const day = ex.day_number;
    if (!dayMap.has(day)) {
      dayMap.set(day, []);
    }
    dayMap.get(day)!.push(ex);
  }

  const sessions: ProgrammeSession[] = [];

  const sortedDays = Array.from(dayMap.keys()).sort((a, b) => a - b);

  for (const dayNumber of sortedDays) {
    const dayExercises = dayMap.get(dayNumber)!
      .sort((a, b) => a.order_in_day - b.order_in_day)
      .map(ex => {
        let exerciseName = ex.custom_exercise_name || 'Unknown Exercise';
        if (ex.exercise_id && exerciseLibrary) {
          const libExercise = exerciseLibrary.find(e => e.id === ex.exercise_id);
          if (libExercise) {
            exerciseName = libExercise.name;
          }
        }
        return { ...ex, exercise_name: exerciseName };
      });

    const focus = inferSessionFocus(dayExercises, exerciseLibrary);

    sessions.push({
      session_id: `${versionId}-d${dayNumber}`,
      day_number: dayNumber,
      focus,
      exercises: dayExercises,
    });
  }

  return sessions;
}

/**
 * Infers session focus from exercises (e.g., "Push", "Pull", "Legs", "Full Body")
 */
function inferSessionFocus(
  exercises: (RoutineVersionExercise & { exercise_name?: string })[],
  exerciseLibrary?: Exercise[]
): string | null {
  if (!exerciseLibrary || exercises.length === 0) {
    return `Day ${exercises[0]?.day_number || 1}`;
  }

  const muscleGroups = new Set<string>();

  for (const ex of exercises) {
    if (ex.exercise_id) {
      const libEx = exerciseLibrary.find(e => e.id === ex.exercise_id);
      if (libEx?.muscle_groups) {
        libEx.muscle_groups.forEach(mg => muscleGroups.add(mg.toLowerCase()));
      }
    }
  }

  const hasPush = muscleGroups.has('chest') || muscleGroups.has('shoulders') || muscleGroups.has('triceps');
  const hasPull = muscleGroups.has('back') || muscleGroups.has('biceps') || muscleGroups.has('lats');
  const hasLegs = muscleGroups.has('quadriceps') || muscleGroups.has('hamstrings') || muscleGroups.has('glutes') || muscleGroups.has('calves');

  if (hasPush && !hasPull && !hasLegs) return 'Push (Chest, Shoulders, Triceps)';
  if (hasPull && !hasPush && !hasLegs) return 'Pull (Back, Biceps)';
  if (hasLegs && !hasPush && !hasPull) return 'Legs';
  if (hasPush && hasPull && hasLegs) return 'Full Body';
  if (hasPush && hasPull) return 'Upper Body';
  if (hasLegs && (hasPush || hasPull)) return 'Lower + Upper Mix';

  return `Day ${exercises[0]?.day_number || 1}`;
}

/**
 * Gets a full assignment with programme details and derived sessions.
 */
export async function getAssignmentWithSessions(assignmentId: string): Promise<AssignmentWithSessions | null> {
  const assignment = await getRoutineAssignmentById(assignmentId);
  if (!assignment) return null;

  const version = await getRoutineVersionById(assignment.routine_version_id);
  if (!version) return null;

  const blueprint = await getRoutineBlueprintById(version.blueprint_id);
  if (!blueprint) return null;

  const exercises = await getRoutineVersionExercises(version.id);

  const { exercises: exerciseLibrary } = await getExercises({ limit: 500 });

  let goalName: string | null = null;
  if (blueprint.goal_type_id) {
    const goals = await getGoalTypes();
    const goal = goals.find(g => g.id === blueprint.goal_type_id);
    goalName = goal?.name || null;
  }

  const sessions = deriveSessionsFromExercises(version.id, exercises, exerciseLibrary);

  return {
    assignment,
    programme: {
      id: blueprint.id,
      name: blueprint.name,
      description: blueprint.description,
      goal: goalName,
      duration_weeks: blueprint.duration_weeks,
      sessions_per_week: blueprint.sessions_per_week,
    },
    sessions,
  };
}

/**
 * Gets all assignments for a client with their sessions.
 */
export async function getClientAssignmentsWithSessions(clientId: string): Promise<AssignmentWithSessions[]> {
  const assignments = await getRoutineAssignments({ clientId, status: 'active' });
  
  const results: AssignmentWithSessions[] = [];
  
  for (const assignment of assignments) {
    const withSessions = await getAssignmentWithSessions(assignment.id);
    if (withSessions) {
      results.push(withSessions);
    }
  }
  
  return results;
}

// =============================================================================
// PROFESSIONAL PORTAL HELPERS
// =============================================================================

export interface ProfessionalProfileVerification {
  id: string;
  user_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
}

export interface ProClientRelationship {
  id: string;
  professional_id: string;
  client_id: string;
  role_type: 'nutritionist' | 'trainer' | 'coach';
  status: 'active' | 'ended';
  accepted_at: string | null;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
}

/**
 * Gets a professional's verification status by their user ID.
 * Used for middleware checks - only fetches verification-related columns.
 */
export async function getProfessionalProfile(userId: string): Promise<ProfessionalProfileVerification | null> {
  const { data, error } = await supabaseAdmin
    .from('professional_profiles')
    .select('id, user_id, verification_status')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching professional profile:', error);
    throw error;
  }

  return data;
}

/**
 * Verifies a pro-client relationship exists and is active.
 */
export async function verifyProClientRelationship(
  professionalId: string, 
  clientId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id')
    .eq('professional_id', professionalId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return false;
    console.error('Error verifying pro-client relationship:', error);
    throw error;
  }

  return !!data;
}

/**
 * Gets all clients connected to a professional.
 */
export async function getProClients(professionalId: string): Promise<Array<{
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  relationship_since: string;
  role_type: string;
  profile_completed: boolean;
}>> {
  const { data: relationships, error: relError } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('client_id, role_type, accepted_at')
    .eq('professional_id', professionalId)
    .eq('status', 'active');

  if (relError) {
    console.error('Error fetching pro clients:', relError);
    throw relError;
  }

  if (!relationships || relationships.length === 0) {
    return [];
  }

  const clientIds = relationships.map(r => r.client_id);
  
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name, profile_photo_path, preset_avatar_id, profile_completed')
    .in('id', clientIds);

  if (profilesError) {
    console.error('Error fetching client profiles:', profilesError);
    throw profilesError;
  }

  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  authUsers?.users?.forEach(u => emailMap.set(u.id, u.email || ''));

  // Get preset avatars for lookup
  const presetAvatarIds = profiles?.filter(p => p.preset_avatar_id).map(p => p.preset_avatar_id!) || [];
  const presetAvatarMap = new Map<string, string | null>();
  if (presetAvatarIds.length > 0) {
    const { data: presetAvatars } = await supabaseAdmin
      .from('preset_avatars')
      .select('id, image_path')
      .in('id', presetAvatarIds);
    if (presetAvatars) {
      for (const pa of presetAvatars) {
        if (pa.image_path) {
          const { data: signedData } = await supabaseAdmin.storage
            .from('preset-avatars')
            .createSignedUrl(pa.image_path, 3600);
          presetAvatarMap.set(pa.id, signedData?.signedUrl || null);
        }
      }
    }
  }

  // Resolve avatar URLs for each client
  const results: Array<{
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    relationship_since: string;
    role_type: string;
    profile_completed: boolean;
  }> = [];

  for (const rel of relationships) {
    const profile = profiles?.find(p => p.id === rel.client_id);
    let avatarUrl: string | null = null;

    // Priority 1: Uploaded profile photo
    if (profile?.profile_photo_path) {
      const { data: signedData } = await supabaseAdmin.storage
        .from('profile-photos')
        .createSignedUrl(profile.profile_photo_path, 3600);
      avatarUrl = signedData?.signedUrl || null;
    }
    // Priority 2: Preset avatar
    if (!avatarUrl && profile?.preset_avatar_id) {
      avatarUrl = presetAvatarMap.get(profile.preset_avatar_id) || null;
    }

    results.push({
      id: rel.client_id,
      email: emailMap.get(rel.client_id) || '',
      display_name: profile?.display_name || null,
      avatar_url: avatarUrl,
      relationship_since: rel.accepted_at || '',
      role_type: rel.role_type,
      profile_completed: profile?.profile_completed ?? false,
    });
  }

  return results;
}

/**
 * Gets routines for a professional (their own + system templates).
 */
export async function getProfessionalRoutines(professionalId: string, options?: {
  includeTemplates?: boolean;
  includeArchived?: boolean;
}): Promise<RoutineBlueprint[]> {
  const includeTemplates = options?.includeTemplates ?? true;
  const includeArchived = options?.includeArchived ?? false;

  let query = supabaseAdmin
    .from('routine_blueprints')
    .select('*');

  if (includeTemplates) {
    query = query.or(`owner_id.eq.${professionalId},and(owner_type.eq.platform,is_template.eq.true)`);
  } else {
    query = query.eq('owner_id', professionalId);
  }

  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching professional routines:', error);
    throw error;
  }

  return data || [];
}

/**
 * Gets routines pending review (draft or pending_review status) for a professional.
 * Returns blueprints with their latest version info including exercises.
 */
export async function getProReviewQueue(professionalId: string): Promise<(RoutineBlueprint & {
  latest_version?: RoutineVersion & { exercises?: RoutineVersionExercise[] };
  goal?: GoalType;
})[]> {
  const { data: blueprints, error } = await supabaseAdmin
    .from('routine_blueprints')
    .select(`
      *,
      goal:goal_types(*)
    `)
    .eq('owner_id', professionalId)
    .eq('owner_type', 'professional')
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching pro review queue:', error);
    throw error;
  }

  if (!blueprints || blueprints.length === 0) {
    return [];
  }

  const { data: versions, error: versionsError } = await supabaseAdmin
    .from('routine_versions')
    .select('*')
    .in('blueprint_id', blueprints.map(b => b.id))
    .in('status', ['draft', 'pending_review'])
    .order('version_number', { ascending: false });

  if (versionsError) {
    console.error('Error fetching versions for review queue:', versionsError);
    throw versionsError;
  }

  // Build map of latest version per blueprint
  const versionMap = new Map<string, RoutineVersion>();
  versions?.forEach(v => {
    if (!versionMap.has(v.blueprint_id)) {
      versionMap.set(v.blueprint_id, v);
    }
  });

  // Fetch exercises for all versions in the queue
  const versionIds = Array.from(versionMap.values()).map(v => v.id);
  let exerciseMap = new Map<string, RoutineVersionExercise[]>();
  
  if (versionIds.length > 0) {
    const { data: exercises, error: exercisesError } = await supabaseAdmin
      .from('routine_version_exercises')
      .select('*')
      .in('routine_version_id', versionIds)
      .order('day_number', { ascending: true })
      .order('order_in_day', { ascending: true });

    if (exercisesError) {
      console.error('Error fetching exercises for review queue:', exercisesError);
      // Don't throw - just continue without exercises
    } else if (exercises) {
      exercises.forEach(ex => {
        if (!exerciseMap.has(ex.routine_version_id)) {
          exerciseMap.set(ex.routine_version_id, []);
        }
        exerciseMap.get(ex.routine_version_id)!.push(ex);
      });
    }
  }

  return blueprints
    .filter(b => versionMap.has(b.id))
    .map(b => {
      const version = versionMap.get(b.id)!;
      return {
        ...b,
        latest_version: {
          ...version,
          exercises: exerciseMap.get(version.id) || [],
        },
        goal: b.goal,
      };
    });
}

/**
 * Approves a routine version (changes status from draft/pending_review to active).
 */
export async function approveRoutineVersion(versionId: string, notes?: string): Promise<RoutineVersion> {
  const version = await getRoutineVersionById(versionId);
  if (!version) {
    throw new Error('Version not found');
  }

  if (version.status === 'active') {
    return version;
  }

  if (version.status === 'archived') {
    throw new Error('Cannot approve an archived version');
  }

  const { data, error } = await supabaseAdmin
    .from('routine_versions')
    .update({
      status: 'active',
      notes: notes || version.notes,
      published_at: new Date().toISOString(),
    })
    .eq('id', versionId)
    .select()
    .single();

  if (error) {
    console.error('Error approving routine version:', error);
    throw error;
  }

  return data;
}

/**
 * Creates a routine for a professional.
 */
export async function createRoutineForPro(
  professionalId: string,
  routine: {
    name: string;
    description?: string;
    goal_type_id?: string;
    equipment_profile?: string[];
    duration_weeks?: number;
    sessions_per_week?: number;
    creation_method: 'manual' | 'template' | 'ai_assisted';
    source_blueprint_id?: string;
    ai_prompt?: string;
    ai_response?: any;
  }
): Promise<{ blueprint: RoutineBlueprint; version: RoutineVersion }> {
  const blueprint = await createRoutineBlueprint({
    ...routine,
    owner_type: 'professional',
    owner_id: professionalId,
    is_template: false,
  });

  const version = await createRoutineVersion({
    blueprint_id: blueprint.id,
    status: 'draft',
  });

  return { blueprint, version };
}

/**
 * Clones a routine for a professional (from template or another routine).
 */
export async function cloneRoutineForPro(
  professionalId: string,
  sourceRoutineId: string,
  overrides?: {
    name?: string;
    description?: string;
  }
): Promise<{ blueprint: RoutineBlueprint; version: RoutineVersion }> {
  const source = await getRoutineBlueprintById(sourceRoutineId);
  if (!source) {
    throw new Error('Source routine not found');
  }

  const sourceVersions = await getRoutineVersions(source.id);
  // Prefer active version, fallback to draft (AI-generated routines start as draft)
  const activeVersion = sourceVersions.find(v => v.status === 'active')
    || sourceVersions.find(v => v.status === 'draft');
  
  const newBlueprint = await createRoutineBlueprint({
    name: overrides?.name || `${source.name} (Copy)`,
    description: overrides?.description || source.description || undefined,
    owner_type: 'professional',
    owner_id: professionalId,
    creation_method: 'template',
    source_blueprint_id: sourceRoutineId,
    goal_type_id: source.goal_type_id || undefined,
    equipment_profile: source.equipment_profile || undefined,
    duration_weeks: source.duration_weeks || undefined,
    sessions_per_week: source.sessions_per_week || undefined,
    is_template: false,
  });

  // Auto-activate cloned routines since templates are already vetted content
  const newVersion = await createRoutineVersion({
    blueprint_id: newBlueprint.id,
    status: 'active',
    published_at: new Date().toISOString(),
    notes: `Cloned from ${source.name}`,
  });

  if (activeVersion) {
    const sourceExercises = await getRoutineVersionExercises(activeVersion.id);
    if (sourceExercises.length > 0) {
      await setVersionExercises(newVersion.id, sourceExercises.map((ex: RoutineVersionExercise) => ({
        exercise_id: ex.exercise_id,
        custom_exercise_name: ex.custom_exercise_name,
        day_number: ex.day_number,
        order_in_day: ex.order_in_day,
        sets: ex.sets,
        reps_min: ex.reps_min,
        reps_max: ex.reps_max,
        rest_seconds: ex.rest_seconds,
        notes: ex.notes,
        superset_group: ex.superset_group,
        target_weight_kg: ex.target_weight_kg,
        entered_weight_value: ex.entered_weight_value,
        entered_weight_unit: ex.entered_weight_unit,
        load_directive: ex.load_directive,
        special_instructions: ex.special_instructions,
      })));
    }
  }

  return { blueprint: newBlueprint, version: newVersion };
}

/**
 * Assigns a routine to a client (pro must have relationship with client).
 */
export async function assignRoutineToClient(
  professionalId: string,
  routineId: string,
  clientId: string,
  options?: {
    start_date?: string;
    end_date?: string;
    notes?: string;
  }
): Promise<RoutineAssignment> {
  const hasRelationship = await verifyProClientRelationship(professionalId, clientId);
  if (!hasRelationship) {
    throw new Error('Professional does not have an active relationship with this client');
  }

  const versions = await getRoutineVersions(routineId);
  const activeVersion = versions.find(v => v.status === 'active');
  if (!activeVersion) {
    throw new Error('Routine must be activated before it can be assigned. Please review and activate the routine first.');
  }

  return createRoutineAssignment({
    routine_version_id: activeVersion.id,
    client_id: clientId,
    assigned_by_pro_id: professionalId,
    status: 'pending_acceptance',
    start_date: options?.start_date || null,
    end_date: options?.end_date || null,
    notes: options?.notes || null,
  });
}

export interface RoutineAssignmentWithDetails extends RoutineAssignment {
  routine_version?: RoutineVersion & {
    blueprint?: RoutineBlueprint;
  };
}

/**
 * Gets all assignments made by a professional with routine details.
 */
export async function getProAssignments(professionalId: string, filters?: {
  clientId?: string;
  status?: AssignmentStatus;
}): Promise<RoutineAssignmentWithDetails[]> {
  let query = supabaseAdmin
    .from('routine_assignments')
    .select(`
      *,
      routine_version:routine_versions!routine_assignments_routine_version_id_fkey(
        *,
        blueprint:routine_blueprints(*)
      )
    `)
    .eq('assigned_by_pro_id', professionalId);

  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching pro assignments:', error);
    throw error;
  }

  return data || [];
}

/**
 * Gets recent expired update events for a professional (last 7 days).
 * Used to notify pros when their pushed updates expire without client action.
 */
export interface ExpiredUpdateNotification {
  assignment_id: string;
  client_id: string;
  client_name: string | null;
  programme_name: string | null;
  expired_at: string;
}

export async function getProExpiredUpdates(professionalId: string): Promise<ExpiredUpdateNotification[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabaseAdmin
    .from('routine_assignment_update_events')
    .select(`
      assignment_id,
      created_at,
      assignment:routine_assignments(
        client_id,
        routine_version:routine_versions!routine_assignments_routine_version_id_fkey(
          blueprint:routine_blueprints(name)
        )
      )
    `)
    .eq('performed_by', professionalId)
    .eq('event_type', 'update_expired')
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching expired updates for pro:', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Filter out empty/null/undefined client_ids before calling .in()
  const clientIds = Array.from(new Set(
    data
      .map(d => (d.assignment as any)?.client_id)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
  ));
  let clientNames: Record<string, string> = {};
  
  if (clientIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name')
      .in('id', clientIds);
    
    if (profilesError) {
      console.error('Error fetching client profiles for expired updates:', profilesError);
    }
    
    for (const p of profiles || []) {
      clientNames[p.id] = p.display_name || 'Unknown';
    }
  }

  return data.map(event => {
    const assignment = event.assignment as any;
    const version = Array.isArray(assignment?.routine_version) 
      ? assignment.routine_version[0] 
      : assignment?.routine_version;
    const blueprint = Array.isArray(version?.blueprint) 
      ? version.blueprint[0] 
      : version?.blueprint;

    return {
      assignment_id: event.assignment_id,
      client_id: assignment?.client_id || '',
      client_name: clientNames[assignment?.client_id] || null,
      programme_name: blueprint?.name || null,
      expired_at: event.created_at,
    };
  });
}

// =============================================================================
// CLIENT TIER RESOLVER (Phase 5A)
// =============================================================================

/**
 * Determines if a client is pro_connected or normal based on active relationships.
 */
export async function getClientTier(clientUserId: string): Promise<ClientTier> {
  const { data, error } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id')
    .eq('client_id', clientUserId)
    .eq('status', 'active')
    .limit(1);

  if (error) {
    console.error('Error checking client tier:', error);
    return 'normal';
  }

  return data && data.length > 0 ? 'pro_connected' : 'normal';
}

/**
 * Gets the connected professional for a client (if any).
 * Uses trainer_storefronts for headline/specialties (Phase 3 migration).
 * Fallback chain: trainer_storefronts + profiles -> profiles only -> Supabase Auth
 */
export async function getClientProfessional(clientUserId: string): Promise<{
  professional: {
    id: string;
    display_name: string;
    headline: string | null;
    specialties: string[];
    contact_email: string | null;
    profile_photo_path: string | null;
    preset_avatar_id: string | null;
  };
  relationship_since: string;
} | null> {
  // First, find the active relationship (use maybeSingle to handle 0 rows gracefully)
  const { data: relationships, error: relError } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('professional_id, accepted_at')
    .eq('client_id', clientUserId)
    .eq('status', 'active')
    .limit(1);

  if (relError) {
    console.error('Error fetching client professional relationship:', relError);
    return null;
  }

  if (!relationships || relationships.length === 0) {
    return null;
  }

  const relationship = relationships[0];
  const professionalId = relationship.professional_id;

  // Fetch profile data (display_name, photo) from profiles table
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name, profile_photo_path, preset_avatar_id')
    .eq('id', professionalId)
    .maybeSingle();

  // Fetch headline/specialties from trainer_storefronts (Phase 3: single source of truth)
  const { data: storefront } = await supabaseAdmin
    .from('trainer_storefronts')
    .select('headline, specialties, contact_email')
    .eq('user_id', professionalId)
    .maybeSingle();

  // Tier 1: Have both profile and storefront data
  if (profile && storefront) {
    const resolvedPhotoPath = await resolveProfilePhotoPath(
      profile.profile_photo_path,
      profile.preset_avatar_id
    );
    return {
      professional: {
        id: profile.id,
        display_name: profile.display_name || 'Unknown',
        headline: storefront.headline,
        specialties: storefront.specialties || [],
        contact_email: storefront.contact_email,
        profile_photo_path: resolvedPhotoPath,
        preset_avatar_id: profile.preset_avatar_id || null,
      },
      relationship_since: relationship.accepted_at,
    };
  }

  // Tier 2: Have profile but no storefront - use profile data only
  if (profile) {
    const resolvedPhotoPath = await resolveProfilePhotoPath(
      profile.profile_photo_path,
      profile.preset_avatar_id
    );
    return {
      professional: {
        id: profile.id,
        display_name: profile.display_name || 'Unknown',
        headline: storefront?.headline || null,
        specialties: storefront?.specialties || [],
        contact_email: storefront?.contact_email || null,
        profile_photo_path: resolvedPhotoPath,
        preset_avatar_id: profile.preset_avatar_id || null,
      },
      relationship_since: relationship.accepted_at,
    };
  }

  // Tier 3: Final fallback to Supabase Auth (get email/metadata from auth system)
  try {
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(professionalId);
    
    if (authError || !authUser?.user) {
      console.error('Failed to fetch professional from auth:', authError);
      return null;
    }

    const user = authUser.user;
    const displayName = user.user_metadata?.display_name || 
                        user.user_metadata?.full_name || 
                        user.email?.split('@')[0] || 
                        'Your Trainer';

    return {
      professional: {
        id: professionalId,
        display_name: displayName,
        headline: storefront?.headline || null,
        specialties: storefront?.specialties || [],
        contact_email: storefront?.contact_email || user.email || null,
        profile_photo_path: null,
        preset_avatar_id: null,
      },
      relationship_since: relationship.accepted_at,
    };
  } catch (error) {
    console.error('Error fetching professional from auth:', error);
    return null;
  }
}

// =============================================================================
// CLIENT ASSIGNMENT OPERATIONS (Phase 5A)
// =============================================================================

export interface PendingUpdateInfo {
  version_id: string;
  version_name: string;
  offered_at: string;
  notes: string | null;
}

export interface ClientAssignmentWithDetails {
  id: string;
  programme: {
    id: string;
    name: string;
    description: string | null;
    goal: string | null;
    sessions_per_week: number | null;
    duration_weeks: number | null;
  };
  assigned_by: {
    id: string;
    name: string;
    headline: string | null;
  } | null;
  status: AssignmentStatus;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  has_pending_update: boolean;
  pending_update: PendingUpdateInfo | null;
  assigned_at: string;
}

/**
 * Gets all pending and active assignments for a client.
 * Also performs on-read cleanup of old rejected assignments.
 */
export async function getClientAssignments(clientUserId: string): Promise<{
  pending: ClientAssignmentWithDetails[];
  active: ClientAssignmentWithDetails[];
}> {
  await cleanupOldRejectedAssignments(clientUserId);
  await expireStalePendingUpdates();

  const { data, error } = await supabaseAdmin
    .from('routine_assignments')
    .select(`
      id,
      status,
      start_date,
      end_date,
      notes,
      has_pending_update,
      pending_version_id,
      pending_created_at,
      pending_notes,
      created_at,
      assigned_by_pro_id,
      routine_version:routine_versions!routine_assignments_routine_version_id_fkey(
        id,
        blueprint:routine_blueprints(
          id,
          name,
          description,
          duration_weeks,
          sessions_per_week,
          goal_type:goal_types(name)
        )
      ),
      pending_version:routine_versions!pending_version_id(
        id,
        version_number
      )
    `)
    .eq('client_id', clientUserId)
    .in('status', ['pending_acceptance', 'active'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching client assignments:', error);
    throw error;
  }

  const pending: ClientAssignmentWithDetails[] = [];
  const active: ClientAssignmentWithDetails[] = [];

  const proIds = Array.from(new Set((data || []).map(row => row.assigned_by_pro_id).filter(Boolean)));
  let proProfiles: Record<string, { display_name: string; headline: string | null }> = {};

  if (proIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name')
      .in('id', proIds);
    
    // Phase 3: Get headline from trainer_storefronts (single source of truth)
    const { data: storefronts } = await supabaseAdmin
      .from('trainer_storefronts')
      .select('user_id, headline')
      .in('user_id', proIds);

    for (const p of profiles || []) {
      proProfiles[p.id] = { 
        display_name: p.display_name || 'Unknown',
        headline: storefronts?.find(s => s.user_id === p.id)?.headline || null
      };
    }
  }

  for (const row of data || []) {
    const version = Array.isArray(row.routine_version) ? row.routine_version[0] : row.routine_version;
    const blueprint = Array.isArray(version?.blueprint) ? version.blueprint[0] : version?.blueprint;
    const goalType = Array.isArray(blueprint?.goal_type) ? blueprint.goal_type[0] : blueprint?.goal_type;
    const proInfo = row.assigned_by_pro_id ? proProfiles[row.assigned_by_pro_id] : null;

    const pendingVersion = Array.isArray((row as any).pending_version) 
      ? (row as any).pending_version[0] 
      : (row as any).pending_version;
    
    let pendingUpdate: PendingUpdateInfo | null = null;
    if ((row as any).pending_version_id && pendingVersion) {
      pendingUpdate = {
        version_id: (row as any).pending_version_id,
        version_name: `Version ${pendingVersion.version_number}`,
        offered_at: (row as any).pending_created_at,
        notes: (row as any).pending_notes || null,
      };
    }

    const assignment: ClientAssignmentWithDetails = {
      id: row.id,
      programme: {
        id: (blueprint as any)?.id || '',
        name: (blueprint as any)?.name || 'Unknown Programme',
        description: (blueprint as any)?.description || null,
        goal: (goalType as any)?.name || null,
        sessions_per_week: (blueprint as any)?.sessions_per_week || null,
        duration_weeks: (blueprint as any)?.duration_weeks || null,
      },
      assigned_by: row.assigned_by_pro_id ? {
        id: row.assigned_by_pro_id,
        name: proInfo?.display_name || 'Unknown',
        headline: proInfo?.headline || null,
      } : null,
      status: row.status,
      start_date: row.start_date,
      end_date: row.end_date,
      notes: row.notes,
      has_pending_update: row.has_pending_update || false,
      pending_update: pendingUpdate,
      assigned_at: row.created_at,
    };

    if (row.status === 'pending_acceptance') {
      pending.push(assignment);
    } else {
      active.push(assignment);
    }
  }

  return { pending, active };
}

/**
 * Cleans up rejected assignments older than 7 days for a client.
 */
async function cleanupOldRejectedAssignments(clientUserId: string): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabaseAdmin
    .from('routine_assignments')
    .delete()
    .eq('client_id', clientUserId)
    .eq('status', 'rejected')
    .lt('rejected_at', sevenDaysAgo.toISOString())
    .select('id');

  if (error) {
    console.error('Error cleaning up rejected assignments:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Expires stale pending updates older than the configured number of days.
 * Default: 14 days. Configurable via PENDING_UPDATE_EXPIRY_DAYS env var.
 */
const PENDING_UPDATE_EXPIRY_DAYS = parseInt(process.env.PENDING_UPDATE_EXPIRY_DAYS || '14', 10);

export async function expireStalePendingUpdates(): Promise<{ expired: number; expiredAssignments: Array<{ id: string; assigned_by_pro_id: string | null }> }> {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() - PENDING_UPDATE_EXPIRY_DAYS);

  const { data: staleAssignments, error: fetchError } = await supabaseAdmin
    .from('routine_assignments')
    .select('id, pending_version_id, routine_version_id, assigned_by_pro_id, pending_created_at')
    .not('pending_version_id', 'is', null)
    .lt('pending_created_at', expiryDate.toISOString());

  if (fetchError) {
    console.error('Error fetching stale pending updates:', fetchError);
    return { expired: 0, expiredAssignments: [] };
  }

  if (!staleAssignments || staleAssignments.length === 0) {
    return { expired: 0, expiredAssignments: [] };
  }

  const expiredAssignments: Array<{ id: string; assigned_by_pro_id: string | null }> = [];

  for (const assignment of staleAssignments) {
    // Use transactional RPC for atomic expiration (update + event insert together)
    // This prevents partial state where update succeeds but event fails
    // Also uses optimistic concurrency checking both pending_version_id and routine_version_id
    const { data: expired, error: rpcError } = await supabaseAdmin.rpc('expire_pending_update', {
      p_assignment_id: assignment.id,
      p_expected_pending_version_id: assignment.pending_version_id,
      p_expected_routine_version_id: assignment.routine_version_id,
      p_performed_by: assignment.assigned_by_pro_id,
      p_expiry_days: PENDING_UPDATE_EXPIRY_DAYS,
    });

    if (rpcError) {
      console.error(`Error expiring pending update for assignment ${assignment.id}:`, rpcError);
      continue;
    }

    // RPC returns false if versions changed (race condition avoided)
    if (!expired) {
      continue;
    }

    expiredAssignments.push({
      id: assignment.id,
      assigned_by_pro_id: assignment.assigned_by_pro_id,
    });
  }

  if (expiredAssignments.length > 0) {
    console.log(`Expired ${expiredAssignments.length} stale pending update(s)`);
  }

  return { expired: expiredAssignments.length, expiredAssignments };
}

// =============================================================================
// SESSION MATERIALIZATION (Phase 5A)
// =============================================================================

/**
 * Materializes sessions from a routine version into the assignment_sessions table.
 * Now includes full exercise data for each session.
 */
export async function materializeSessionsForAssignment(
  assignmentId: string,
  versionId: string
): Promise<RoutineAssignmentSession[]> {
  const exercises = await getRoutineVersionExercises(versionId);
  const { exercises: exerciseLibrary } = await getExercises({ limit: 500 });
  const sessions = deriveSessionsFromExercises(versionId, exercises, exerciseLibrary);

  const sessionRecords = sessions.map(session => {
    const sessionExercises: SessionExercise[] = session.exercises.map(ex => ({
      exercise_id: ex.exercise_id,
      exercise_name: ex.exercise_name || ex.custom_exercise_name || 'Unknown Exercise',
      sets: ex.sets,
      reps_min: ex.reps_min,
      reps_max: ex.reps_max,
      rest_seconds: ex.rest_seconds,
      notes: ex.notes,
      order_in_day: ex.order_in_day,
      load_directive: ex.load_directive,
      target_weight_kg: ex.target_weight_kg,
      entered_weight_value: ex.entered_weight_value,
      entered_weight_unit: ex.entered_weight_unit,
    }));

    return {
      routine_assignment_id: assignmentId,
      routine_version_id: versionId,
      day_number: session.day_number,
      session_focus: session.focus,
      is_current: true,
      exercises: sessionExercises,
    };
  });

  const { data, error } = await supabaseAdmin
    .from('routine_assignment_sessions')
    .insert(sessionRecords)
    .select();

  if (error) {
    console.error('Error materializing sessions:', error);
    throw error;
  }

  return data || [];
}

/**
 * Gets current sessions for an assignment.
 */
export async function getAssignmentSessions(assignmentId: string): Promise<RoutineAssignmentSession[]> {
  const { data, error } = await supabaseAdmin
    .from('routine_assignment_sessions')
    .select('*')
    .eq('routine_assignment_id', assignmentId)
    .eq('is_current', true)
    .order('day_number', { ascending: true });

  if (error) {
    console.error('Error fetching assignment sessions:', error);
    throw error;
  }

  return data || [];
}

/**
 * Accepts an assignment: changes status to active and materializes sessions.
 */
export async function acceptAssignment(
  assignmentId: string,
  clientUserId: string
): Promise<{
  assignment: RoutineAssignment;
  sessions: ProgrammeSession[];
}> {
  const assignment = await getRoutineAssignmentById(assignmentId);
  if (!assignment) {
    throw new Error('Assignment not found');
  }

  if (assignment.client_id !== clientUserId) {
    throw new Error('Not authorized to accept this assignment');
  }

  if (assignment.status !== 'pending_acceptance') {
    throw new Error('Assignment is not pending acceptance');
  }

  const updatedAssignment = await updateRoutineAssignment(assignmentId, {
    status: 'active',
  });

  await materializeSessionsForAssignment(assignmentId, assignment.routine_version_id);

  const exercises = await getRoutineVersionExercises(assignment.routine_version_id);
  const { exercises: exerciseLibrary } = await getExercises({ limit: 500 });
  const sessions = deriveSessionsFromExercises(
    assignment.routine_version_id,
    exercises,
    exerciseLibrary
  );

  return {
    assignment: updatedAssignment,
    sessions,
  };
}

/**
 * Rejects an assignment: changes status to rejected.
 */
export async function rejectAssignment(
  assignmentId: string,
  clientUserId: string,
  reason?: string
): Promise<RoutineAssignment> {
  const assignment = await getRoutineAssignmentById(assignmentId);
  if (!assignment) {
    throw new Error('Assignment not found');
  }

  if (assignment.client_id !== clientUserId) {
    throw new Error('Not authorized to reject this assignment');
  }

  if (assignment.status !== 'pending_acceptance') {
    throw new Error('Assignment is not pending acceptance');
  }

  const updates: Partial<RoutineAssignment> = {
    status: 'rejected',
  };

  if (reason) {
    updates.notes = reason;
  }

  return updateRoutineAssignment(assignmentId, updates);
}

/**
 * Gets assignment with full session details for the client workout logger.
 * This version validates client ownership before returning data.
 */
export async function getClientAssignmentWithSessions(
  assignmentId: string,
  clientUserId: string
): Promise<AssignmentWithSessions | null> {
  const assignment = await getRoutineAssignmentById(assignmentId);
  if (!assignment || assignment.client_id !== clientUserId) {
    return null;
  }

  if (assignment.status !== 'active') {
    return null;
  }

  return getAssignmentWithSessions(assignmentId);
}

// ============================================
// PHASE 5C: PROGRAMME UPDATE FLOW
// ============================================

/**
 * Pushes a programme update to a client's assignment.
 * The new version becomes pending until client accepts/declines.
 * If there's already a pending update, it gets superseded.
 */
export async function pushProgrammeUpdate(
  assignmentId: string,
  newVersionId: string,
  proUserId: string,
  notes?: string
): Promise<RoutineAssignment> {
  const assignment = await getRoutineAssignmentById(assignmentId);
  if (!assignment) {
    throw new Error('Assignment not found');
  }

  if (assignment.assigned_by_pro_id !== proUserId) {
    throw new Error('Not authorized to update this assignment');
  }

  if (assignment.status !== 'active') {
    throw new Error('Can only push updates to active assignments');
  }

  const version = await getRoutineVersionById(newVersionId);
  if (!version) {
    throw new Error('Version not found');
  }

  if (version.routine_id !== assignment.routine_id) {
    throw new Error('Version does not belong to the assigned routine');
  }

  const { data, error } = await supabaseAdmin
    .from('routine_assignments')
    .update({
      pending_version_id: newVersionId,
      pending_created_at: new Date().toISOString(),
      pending_notes: notes || null,
      has_pending_update: true,
    })
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) {
    console.error('Error pushing programme update:', error);
    throw error;
  }

  return data;
}

/**
 * Client accepts a pending update.
 * Marks old sessions as is_current=false, creates new sessions, updates routine_version_id.
 */
export async function acceptProgrammeUpdate(
  assignmentId: string,
  clientUserId: string
): Promise<{
  assignment: RoutineAssignment;
  sessions: ProgrammeSession[];
}> {
  const assignment = await getRoutineAssignmentById(assignmentId);
  if (!assignment) {
    throw new Error('Assignment not found');
  }

  if (assignment.client_id !== clientUserId) {
    throw new Error('Not authorized to accept this update');
  }

  if (!assignment.pending_version_id) {
    throw new Error('No pending update to accept');
  }

  const newVersionId = assignment.pending_version_id;
  const oldVersionId = assignment.routine_version_id;

  await supabaseAdmin
    .from('routine_assignment_sessions')
    .update({ is_current: false })
    .eq('routine_assignment_id', assignmentId)
    .eq('is_current', true);

  await materializeSessionsForAssignment(assignmentId, newVersionId);

  const { data: updatedAssignment, error } = await supabaseAdmin
    .from('routine_assignments')
    .update({
      routine_version_id: newVersionId,
      pending_version_id: null,
      pending_created_at: null,
      pending_notes: null,
      has_pending_update: false,
    })
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) {
    console.error('Error accepting programme update:', error);
    throw error;
  }

  await supabaseAdmin
    .from('routine_assignment_update_events')
    .insert({
      assignment_id: assignmentId,
      from_version_id: oldVersionId,
      to_version_id: newVersionId,
      event_type: 'update_accepted',
      performed_by: clientUserId,
    });

  const exercises = await getRoutineVersionExercises(newVersionId);
  const { exercises: exerciseLibrary } = await getExercises({ limit: 500 });
  const sessions = deriveSessionsFromExercises(
    newVersionId,
    exercises,
    exerciseLibrary
  );

  return {
    assignment: updatedAssignment,
    sessions,
  };
}

/**
 * Client declines a pending update.
 * Clears pending update fields, keeps current version and sessions.
 */
export async function declineProgrammeUpdate(
  assignmentId: string,
  clientUserId: string
): Promise<RoutineAssignment> {
  const assignment = await getRoutineAssignmentById(assignmentId);
  if (!assignment) {
    throw new Error('Assignment not found');
  }

  if (assignment.client_id !== clientUserId) {
    throw new Error('Not authorized to decline this update');
  }

  if (!assignment.pending_version_id) {
    throw new Error('No pending update to decline');
  }

  const pendingVersionId = assignment.pending_version_id;

  const { data, error } = await supabaseAdmin
    .from('routine_assignments')
    .update({
      pending_version_id: null,
      pending_created_at: null,
      pending_notes: null,
      has_pending_update: false,
    })
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) {
    console.error('Error declining programme update:', error);
    throw error;
  }

  await supabaseAdmin
    .from('routine_assignment_update_events')
    .insert({
      assignment_id: assignmentId,
      from_version_id: assignment.routine_version_id,
      to_version_id: pendingVersionId,
      event_type: 'update_declined',
      performed_by: clientUserId,
    });

  return data;
}

/**
 * Gets pending update details for an assignment.
 */
export async function getPendingUpdateDetails(assignmentId: string): Promise<{
  pending_version_id: string;
  pending_created_at: string;
  pending_notes: string | null;
  version_name: string;
  exercises: RoutineVersionExercise[];
} | null> {
  const assignment = await getRoutineAssignmentById(assignmentId);
  if (!assignment || !assignment.pending_version_id) {
    return null;
  }

  const version = await getRoutineVersionById(assignment.pending_version_id);
  if (!version) {
    return null;
  }

  const exercises = await getRoutineVersionExercises(assignment.pending_version_id);

  return {
    pending_version_id: assignment.pending_version_id,
    pending_created_at: assignment.pending_created_at!,
    pending_notes: assignment.pending_notes || null,
    version_name: `Version ${version.version_number}`,
    exercises,
  };
}
