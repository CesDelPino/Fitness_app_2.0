import { supabaseAdmin } from "./supabase-admin";

const CARDIO_ACTIVITIES = [
  { name: "Elliptical", base_met: 5, category: "Cardio Machines" },
  { name: "Jump Rope", base_met: 11, category: "Cardio Machines" },
  { name: "Rowing Machine", base_met: 7, category: "Cardio Machines" },
  { name: "Ski Machine", base_met: 7, category: "Cardio Machines" },
  { name: "Stair Climber", base_met: 9, category: "Cardio Machines" },
  
  { name: "Cycling", base_met: 6.8, category: "Cycling" },
  { name: "Mountain Biking", base_met: 8.5, category: "Cycling" },
  { name: "Spinning Class", base_met: 8.5, category: "Cycling" },
  { name: "Stationary Bike", base_met: 7, category: "Cycling" },
  
  { name: "Aerobics", base_met: 6, category: "Dance/Aerobics" },
  { name: "Dance (general)", base_met: 5.5, category: "Dance/Aerobics" },
  { name: "HIIT", base_met: 12, category: "Dance/Aerobics" },
  { name: "Step Aerobics", base_met: 8.5, category: "Dance/Aerobics" },
  { name: "Zumba", base_met: 6.5, category: "Dance/Aerobics" },
  
  { name: "Cross-Country Skiing", base_met: 9, category: "Outdoor Activities" },
  { name: "Hiking", base_met: 6, category: "Outdoor Activities" },
  { name: "Ice Skating", base_met: 7, category: "Outdoor Activities" },
  { name: "Kayaking", base_met: 5, category: "Outdoor Activities" },
  { name: "Rock Climbing", base_met: 8, category: "Outdoor Activities" },
  { name: "Rollerblading", base_met: 7.5, category: "Outdoor Activities" },
  { name: "Skiing (downhill)", base_met: 6, category: "Outdoor Activities" },
  { name: "Surfing", base_met: 6, category: "Outdoor Activities" },
  
  { name: "Badminton", base_met: 5.5, category: "Sports" },
  { name: "Basketball", base_met: 6.5, category: "Sports" },
  { name: "Boxing (sparring)", base_met: 9, category: "Sports" },
  { name: "Golf (walking)", base_met: 4.5, category: "Sports" },
  { name: "Martial Arts", base_met: 10, category: "Sports" },
  { name: "Pickleball", base_met: 6, category: "Sports" },
  { name: "Racquetball", base_met: 7, category: "Sports" },
  { name: "Soccer", base_met: 7, category: "Sports" },
  { name: "Tennis", base_met: 7.3, category: "Sports" },
  { name: "Volleyball", base_met: 4, category: "Sports" },
  
  { name: "Swimming (leisure)", base_met: 5, category: "Swimming" },
  { name: "Swimming Laps", base_met: 7, category: "Swimming" },
  { name: "Treading Water", base_met: 4, category: "Swimming" },
  { name: "Water Aerobics", base_met: 5.5, category: "Swimming" },
  
  { name: "Jogging", base_met: 7, category: "Walking/Running" },
  { name: "Running", base_met: 9.8, category: "Walking/Running" },
  { name: "Sprinting", base_met: 14.5, category: "Walking/Running" },
  { name: "Trail Running", base_met: 10, category: "Walking/Running" },
  { name: "Treadmill", base_met: 8, category: "Walking/Running" },
  { name: "Walking", base_met: 3.5, category: "Walking/Running" },
];

const CANONICAL_ACTIVITY_NAMES = CARDIO_ACTIVITIES.map(a => a.name);

export async function seedCardioActivitiesToSupabase(): Promise<void> {
  try {
    const { data: existingActivities, error: fetchError } = await supabaseAdmin
      .from('cardio_activities')
      .select('name');

    if (fetchError) {
      console.error("Failed to fetch cardio activities from Supabase:", fetchError);
      return;
    }

    const existingNames = new Set((existingActivities || []).map(a => a.name));
    const hasAllCanonical = CANONICAL_ACTIVITY_NAMES.every(name => existingNames.has(name));

    if (hasAllCanonical) {
      console.log(`Cardio activities already synced (${existingActivities?.length || 0} activities)`);
      return;
    }

    console.log("Synchronizing cardio activities to Supabase...");

    const missingActivities = CARDIO_ACTIVITIES.filter(a => !existingNames.has(a.name));
    
    if (missingActivities.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('cardio_activities')
        .insert(missingActivities);

      if (insertError) {
        console.error("Failed to insert cardio activities:", insertError);
        return;
      }
      
      console.log(`Added ${missingActivities.length} canonical activities to Supabase`);
    }

    const { count } = await supabaseAdmin
      .from('cardio_activities')
      .select('*', { count: 'exact', head: true });

    console.log(`Cardio activities synchronized (${count || 0} activities in Supabase)`);
  } catch (error) {
    console.error("Error seeding cardio activities to Supabase:", error);
  }
}
