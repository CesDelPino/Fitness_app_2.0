import { supabaseAdmin } from "./supabase-admin";
import type { DailyWaterIntake, WaterLog } from "@shared/supabase-types";

export interface WaterIntakeResult {
  total_ml: number;
  target_ml: number;
}

export async function getDailyWaterIntake(
  userId: string,
  date: string
): Promise<WaterIntakeResult> {
  const { data, error } = await supabaseAdmin
    .from("daily_water_intake")
    .select("total_ml, target_ml")
    .eq("user_id", userId)
    .eq("date", date)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching daily water intake:", error);
    throw error;
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("water_target_ml")
    .eq("id", userId)
    .single();

  const defaultTarget = profile?.water_target_ml || 2000;

  if (!data) {
    return {
      total_ml: 0,
      target_ml: defaultTarget,
    };
  }

  return {
    total_ml: data.total_ml,
    target_ml: data.target_ml ?? defaultTarget,
  };
}

export async function addWaterIntake(
  userId: string,
  date: string,
  amountMl: number,
  source: string = "quick_add"
): Promise<WaterIntakeResult> {
  // Use atomic RPC function to prevent race conditions
  // The increment_daily_water function atomically:
  // 1. Upserts daily_water_intake (creates or increments)
  // 2. Logs the individual entry to water_logs
  // 3. Returns the new total and target
  const { data, error } = await supabaseAdmin.rpc("increment_daily_water", {
    p_user_id: userId,
    p_date: date,
    p_amount_ml: amountMl,
    p_source: source,
  });

  if (error) {
    console.error("Error adding water intake via RPC:", error);
    throw error;
  }

  // RPC returns an array with one row
  if (!data || data.length === 0) {
    throw new Error("No result from increment_daily_water RPC");
  }

  return {
    total_ml: data[0].total_ml,
    target_ml: data[0].target_ml,
  };
}

export async function getWaterLogs(
  userId: string,
  date: string
): Promise<WaterLog[]> {
  const { data, error } = await supabaseAdmin
    .from("water_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching water logs:", error);
    throw error;
  }

  return data || [];
}

export async function updateWaterTarget(
  userId: string,
  targetMl: number
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ water_target_ml: targetMl })
    .eq("id", userId);

  if (error) {
    console.error("Error updating water target:", error);
    throw error;
  }
}

export interface WaterHistoryDay {
  date: string;
  total_ml: number;
  target_ml: number;
}

export async function getWaterHistory(
  userId: string,
  startDate: string,
  endDate: string
): Promise<WaterHistoryDay[]> {
  // Get user's default target from profile
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("water_target_ml")
    .eq("id", userId)
    .single();

  const defaultTarget = profile?.water_target_ml || 2000;

  // Fetch water intake records for the date range
  const { data, error } = await supabaseAdmin
    .from("daily_water_intake")
    .select("date, total_ml, target_ml")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching water history:", error);
    throw error;
  }

  // Create a map of existing data
  const dataMap = new Map<string, { total_ml: number; target_ml: number | null }>();
  (data || []).forEach((row) => {
    dataMap.set(row.date, { total_ml: row.total_ml, target_ml: row.target_ml });
  });

  // Generate all dates in range and fill with data or defaults
  const result: WaterHistoryDay[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(end); d >= start; d.setDate(d.getDate() - 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const existing = dataMap.get(dateStr);
    
    result.push({
      date: dateStr,
      total_ml: existing?.total_ml ?? 0,
      target_ml: existing?.target_ml ?? defaultTarget,
    });
  }

  return result;
}
