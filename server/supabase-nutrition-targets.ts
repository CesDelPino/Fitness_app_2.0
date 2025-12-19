import { supabaseAdmin } from "./supabase-admin";
import type { 
  NutritionTarget, 
  InsertNutritionTarget, 
  UpdateNutritionTarget,
  NutritionTargetStatus 
} from "@shared/supabase-types";

export interface NutritionTargetWithProfessional extends NutritionTarget {
  professional_name?: string | null;
}

export async function getClientNutritionTargets(clientId: string): Promise<{
  current: NutritionTargetWithProfessional | null;
  pending: NutritionTargetWithProfessional | null;
}> {
  const { data, error } = await supabaseAdmin
    .from("nutrition_targets")
    .select("*")
    .eq("client_id", clientId)
    .in("status", ["accepted", "pending"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch nutrition targets: ${error.message}`);

  const targets = (data || []) as NutritionTarget[];
  
  const current = targets.find(t => t.status === "accepted") || null;
  const pending = targets.find(t => t.status === "pending") || null;

  const professionalIds = Array.from(new Set([current?.professional_id, pending?.professional_id].filter((id): id is string => !!id)));
  
  let professionalNames: Record<string, string> = {};
  if (professionalIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", professionalIds);
    
    if (profiles) {
      professionalNames = Object.fromEntries(
        profiles.map(p => [p.id, p.display_name || null])
      );
    }
  }

  return {
    current: current ? {
      ...current,
      professional_name: current.professional_id ? professionalNames[current.professional_id] || null : null
    } : null,
    pending: pending ? {
      ...pending,
      professional_name: pending.professional_id ? professionalNames[pending.professional_id] || null : null
    } : null
  };
}

export async function createNutritionTarget(
  clientId: string,
  professionalId: string,
  proteinG: number,
  carbsG: number,
  fatG: number
): Promise<NutritionTarget> {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("nutrition_targets")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingError) throw new Error(`Failed to check existing targets: ${existingError.message}`);

  if (existing) {
    const { error: deleteError } = await supabaseAdmin
      .from("nutrition_targets")
      .delete()
      .eq("id", existing.id);

    if (deleteError) throw new Error(`Failed to replace pending target: ${deleteError.message}`);
  }

  const { data, error } = await supabaseAdmin
    .from("nutrition_targets")
    .insert({
      client_id: clientId,
      professional_id: professionalId,
      protein_g: proteinG,
      carbs_g: carbsG,
      fat_g: fatG,
      status: "pending",
      source: "professional"
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create nutrition target: ${error.message}`);

  await logNutritionTargetAction(data.id, "created", professionalId);

  return data;
}

export async function acceptNutritionTarget(
  clientId: string,
  targetId: string
): Promise<NutritionTarget> {
  const { data: target, error: fetchError } = await supabaseAdmin
    .from("nutrition_targets")
    .select("*")
    .eq("id", targetId)
    .eq("client_id", clientId)
    .eq("status", "pending")
    .single();

  if (fetchError || !target) {
    throw new Error("Pending target not found or already processed");
  }

  const { error: archiveError } = await supabaseAdmin
    .from("nutrition_targets")
    .update({ status: "declined" as NutritionTargetStatus })
    .eq("client_id", clientId)
    .eq("status", "accepted");

  if (archiveError) {
    console.error("Failed to archive previous accepted target:", archiveError);
  }

  const { data, error } = await supabaseAdmin
    .from("nutrition_targets")
    .update({
      status: "accepted" as NutritionTargetStatus,
      accepted_at: new Date().toISOString()
    })
    .eq("id", targetId)
    .select()
    .single();

  if (error) throw new Error(`Failed to accept target: ${error.message}`);

  const calories = Math.round(data.protein_g * 4 + data.carbs_g * 4 + data.fat_g * 9);
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      protein_target_g: data.protein_g,
      carbs_target_g: data.carbs_g,
      fat_target_g: data.fat_g,
      daily_calorie_target: calories,
    })
    .eq("id", clientId);

  if (profileError) {
    console.error("Failed to sync targets to profile:", profileError);
  }

  await logNutritionTargetAction(data.id, "accepted", clientId);

  return data;
}

export async function declineNutritionTarget(
  clientId: string,
  targetId: string
): Promise<NutritionTarget> {
  const { data, error } = await supabaseAdmin
    .from("nutrition_targets")
    .update({ status: "declined" as NutritionTargetStatus })
    .eq("id", targetId)
    .eq("client_id", clientId)
    .eq("status", "pending")
    .select()
    .single();

  if (error) throw new Error(`Failed to decline target: ${error.message}`);

  await logNutritionTargetAction(data.id, "declined", clientId);

  return data;
}

export async function updateClientNutritionTarget(
  clientId: string,
  proteinG: number,
  carbsG: number,
  fatG: number
): Promise<NutritionTarget> {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("nutrition_targets")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "accepted")
    .maybeSingle();

  if (existingError) throw new Error(`Failed to fetch current target: ${existingError.message}`);

  let result: NutritionTarget;

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("nutrition_targets")
      .update({
        protein_g: proteinG,
        carbs_g: carbsG,
        fat_g: fatG,
        source: "client"
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update target: ${error.message}`);

    await logNutritionTargetAction(data.id, "updated", clientId);
    result = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("nutrition_targets")
      .insert({
        client_id: clientId,
        protein_g: proteinG,
        carbs_g: carbsG,
        fat_g: fatG,
        status: "accepted",
        source: "client",
        accepted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create self-set target: ${error.message}`);

    await logNutritionTargetAction(data.id, "created", clientId);
    result = data;
  }

  const calories = Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      protein_target_g: proteinG,
      carbs_target_g: carbsG,
      fat_target_g: fatG,
      daily_calorie_target: calories,
    })
    .eq("id", clientId);

  if (profileError) {
    console.error("Failed to sync targets to profile:", profileError);
  }

  return result;
}

async function logNutritionTargetAction(
  targetId: string,
  action: string,
  actorId: string
): Promise<void> {
  try {
    await supabaseAdmin.rpc("log_nutrition_target_action", {
      p_target_id: targetId,
      p_action: action,
      p_actor_id: actorId
    });
  } catch (error) {
    console.error("Failed to log nutrition target action:", error);
  }
}

export async function checkSetNutritionTargetsPermission(
  professionalId: string,
  clientId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("client_permissions")
    .select("id")
    .eq("relationship_id", (
      supabaseAdmin
        .from("professional_client_relationships")
        .select("id")
        .eq("professional_id", professionalId)
        .eq("client_id", clientId)
        .eq("status", "active")
        .limit(1)
    ))
    .eq("permission_slug", "set_nutrition_targets")
    .eq("status", "granted")
    .maybeSingle();

  if (error) {
    const { data: altData, error: altError } = await supabaseAdmin
      .from("professional_client_relationships")
      .select(`
        id,
        client_permissions!inner(id)
      `)
      .eq("professional_id", professionalId)
      .eq("client_id", clientId)
      .eq("status", "active")
      .eq("client_permissions.permission_slug", "set_nutrition_targets")
      .eq("client_permissions.status", "granted")
      .maybeSingle();

    return !!altData;
  }

  return !!data;
}
