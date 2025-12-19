-- LOBA SaaS Migration: Routine Assignment Seed Data
-- Phase 1: Initial data for equipment, goals, and exercise library
-- See: docs/ROUTINE_ASSIGNMENT_ARCHITECTURE.md

-- ============================================
-- EQUIPMENT OPTIONS SEED DATA
-- ============================================

INSERT INTO equipment_options (name, category, display_order) VALUES
-- Free Weights
('Dumbbells', 'free_weights', 1),
('Barbells', 'free_weights', 2),
('Kettlebells', 'free_weights', 3),
('Weight Plates', 'free_weights', 4),
('EZ Curl Bar', 'free_weights', 5),
('Trap Bar', 'free_weights', 6),

-- Machines
('Cable Stack', 'machines', 10),
('Smith Machine', 'machines', 11),
('Leg Press', 'machines', 12),
('Lat Pulldown Machine', 'machines', 13),
('Chest Press Machine', 'machines', 14),
('Leg Curl Machine', 'machines', 15),
('Leg Extension Machine', 'machines', 16),
('Seated Row Machine', 'machines', 17),
('Shoulder Press Machine', 'machines', 18),
('Pec Deck / Fly Machine', 'machines', 19),
('Hack Squat Machine', 'machines', 20),
('Calf Raise Machine', 'machines', 21),

-- Racks & Benches
('Squat Rack / Power Cage', 'racks_benches', 30),
('Flat Bench', 'racks_benches', 31),
('Adjustable Bench', 'racks_benches', 32),
('Incline Bench', 'racks_benches', 33),
('Pull-up Bar', 'racks_benches', 34),
('Dip Station', 'racks_benches', 35),
('Preacher Curl Bench', 'racks_benches', 36),
('Roman Chair / Back Extension', 'racks_benches', 37),

-- Cardio
('Treadmill', 'cardio', 50),
('Stationary Bike', 'cardio', 51),
('Rowing Machine', 'cardio', 52),
('Stair Climber', 'cardio', 53),
('Elliptical', 'cardio', 54),
('Assault Bike / Air Bike', 'cardio', 55),
('Ski Erg', 'cardio', 56),

-- Other
('Resistance Bands', 'other', 70),
('TRX / Suspension Trainer', 'other', 71),
('Medicine Ball', 'other', 72),
('Stability Ball', 'other', 73),
('Foam Roller', 'other', 74),
('Yoga Mat', 'other', 75),
('Battle Ropes', 'other', 76),
('Plyo Box', 'other', 77),
('Ab Wheel', 'other', 78),
('Landmine Attachment', 'other', 79);

-- ============================================
-- GOAL TYPES SEED DATA
-- ============================================

INSERT INTO goal_types (name, description, default_rep_range, default_rest_seconds, display_order) VALUES
('Hypertrophy', 'Build muscle size and volume through moderate rep ranges and controlled tempo', '8-12', 90, 1),
('Strength', 'Maximize force output and 1RM through heavy loads and low reps', '3-6', 180, 2),
('Endurance', 'Improve muscular stamina through high reps and minimal rest', '15-20', 45, 3),
('Power', 'Develop explosive strength and speed through dynamic movements', '3-5', 150, 4),
('Fat Loss', 'Maximize caloric burn through higher volume and circuit-style training', '12-15', 30, 5),
('General Fitness', 'Balanced approach for overall health and functional fitness', '10-15', 60, 6);

-- ============================================
-- EXERCISE LIBRARY SEED DATA
-- Organized by category with muscle groups and equipment tags
-- ============================================

INSERT INTO exercise_library (name, category, muscle_groups, equipment_tags, difficulty_level, instructions, is_system) VALUES

-- CHEST EXERCISES
('Barbell Bench Press', 'compound', ARRAY['chest', 'triceps', 'front_delts'], ARRAY['Barbells', 'Flat Bench'], 'intermediate', 'Lie on bench, grip bar slightly wider than shoulders, lower to chest, press up explosively', true),
('Incline Barbell Press', 'compound', ARRAY['upper_chest', 'triceps', 'front_delts'], ARRAY['Barbells', 'Incline Bench'], 'intermediate', 'Set bench to 30-45 degrees, press bar from upper chest', true),
('Dumbbell Bench Press', 'compound', ARRAY['chest', 'triceps', 'front_delts'], ARRAY['Dumbbells', 'Flat Bench'], 'beginner', 'Lie on bench, press dumbbells from chest level, bring together at top', true),
('Incline Dumbbell Press', 'compound', ARRAY['upper_chest', 'triceps', 'front_delts'], ARRAY['Dumbbells', 'Adjustable Bench'], 'beginner', 'Set bench to 30-45 degrees, press dumbbells from upper chest', true),
('Dumbbell Flyes', 'isolation', ARRAY['chest'], ARRAY['Dumbbells', 'Flat Bench'], 'beginner', 'Lie on bench, arms extended, lower dumbbells in arc motion keeping slight elbow bend', true),
('Cable Crossover', 'isolation', ARRAY['chest'], ARRAY['Cable Stack'], 'intermediate', 'Stand between cables, bring handles together in front of chest in hugging motion', true),
('Push-ups', 'compound', ARRAY['chest', 'triceps', 'front_delts'], ARRAY[]::text[], 'beginner', 'Hands shoulder-width, lower chest to floor, push back up', true),
('Chest Dips', 'compound', ARRAY['lower_chest', 'triceps'], ARRAY['Dip Station'], 'intermediate', 'Lean forward on dip bars, lower body until stretch in chest, push up', true),
('Machine Chest Press', 'compound', ARRAY['chest', 'triceps'], ARRAY['Chest Press Machine'], 'beginner', 'Sit with back against pad, press handles forward, control the return', true),
('Pec Deck Fly', 'isolation', ARRAY['chest'], ARRAY['Pec Deck / Fly Machine'], 'beginner', 'Sit with arms on pads, bring arms together in front of chest', true),

-- BACK EXERCISES
('Barbell Row', 'compound', ARRAY['lats', 'rhomboids', 'biceps', 'lower_back'], ARRAY['Barbells'], 'intermediate', 'Hinge forward, pull bar to lower chest, squeeze shoulder blades', true),
('Dumbbell Row', 'compound', ARRAY['lats', 'rhomboids', 'biceps'], ARRAY['Dumbbells', 'Flat Bench'], 'beginner', 'One hand on bench, pull dumbbell to hip, keep elbow close to body', true),
('Pull-ups', 'compound', ARRAY['lats', 'biceps', 'rear_delts'], ARRAY['Pull-up Bar'], 'intermediate', 'Hang from bar, pull chin above bar, lower with control', true),
('Chin-ups', 'compound', ARRAY['lats', 'biceps'], ARRAY['Pull-up Bar'], 'intermediate', 'Underhand grip, pull chin above bar, emphasizes biceps more than pull-ups', true),
('Lat Pulldown', 'compound', ARRAY['lats', 'biceps'], ARRAY['Lat Pulldown Machine'], 'beginner', 'Sit with thighs secured, pull bar to upper chest, squeeze lats at bottom', true),
('Seated Cable Row', 'compound', ARRAY['lats', 'rhomboids', 'biceps'], ARRAY['Cable Stack', 'Seated Row Machine'], 'beginner', 'Sit upright, pull handle to torso, squeeze shoulder blades together', true),
('T-Bar Row', 'compound', ARRAY['lats', 'rhomboids', 'biceps', 'lower_back'], ARRAY['Barbells', 'Landmine Attachment'], 'intermediate', 'Straddle bar, pull to chest while maintaining hip hinge', true),
('Face Pulls', 'isolation', ARRAY['rear_delts', 'rhomboids', 'rotator_cuff'], ARRAY['Cable Stack'], 'beginner', 'Pull rope to face, externally rotate shoulders at end position', true),
('Deadlift', 'compound', ARRAY['lower_back', 'glutes', 'hamstrings', 'traps'], ARRAY['Barbells'], 'advanced', 'Hinge at hips, grip bar outside legs, drive through heels to stand', true),
('Romanian Deadlift', 'compound', ARRAY['hamstrings', 'glutes', 'lower_back'], ARRAY['Barbells', 'Dumbbells'], 'intermediate', 'Slight knee bend, hinge at hips lowering weight along legs, feel hamstring stretch', true),

-- SHOULDER EXERCISES
('Overhead Press', 'compound', ARRAY['front_delts', 'side_delts', 'triceps'], ARRAY['Barbells'], 'intermediate', 'Press bar from shoulders overhead, lock out at top', true),
('Dumbbell Shoulder Press', 'compound', ARRAY['front_delts', 'side_delts', 'triceps'], ARRAY['Dumbbells', 'Adjustable Bench'], 'beginner', 'Press dumbbells from shoulders overhead, palms facing forward', true),
('Arnold Press', 'compound', ARRAY['front_delts', 'side_delts', 'triceps'], ARRAY['Dumbbells'], 'intermediate', 'Start with palms facing you, rotate as you press overhead', true),
('Lateral Raises', 'isolation', ARRAY['side_delts'], ARRAY['Dumbbells'], 'beginner', 'Raise dumbbells to sides until parallel with floor, slight bend in elbows', true),
('Front Raises', 'isolation', ARRAY['front_delts'], ARRAY['Dumbbells'], 'beginner', 'Raise dumbbells in front until parallel with floor, alternate or together', true),
('Reverse Pec Deck', 'isolation', ARRAY['rear_delts', 'rhomboids'], ARRAY['Pec Deck / Fly Machine'], 'beginner', 'Face machine, pull handles back squeezing rear delts', true),
('Upright Row', 'compound', ARRAY['side_delts', 'traps'], ARRAY['Barbells', 'Dumbbells'], 'intermediate', 'Pull weight up along body to chin level, elbows high', true),
('Shrugs', 'isolation', ARRAY['traps'], ARRAY['Dumbbells', 'Barbells'], 'beginner', 'Hold weight at sides, elevate shoulders toward ears, hold and lower', true),

-- ARM EXERCISES
('Barbell Curl', 'isolation', ARRAY['biceps'], ARRAY['Barbells', 'EZ Curl Bar'], 'beginner', 'Stand with bar at thighs, curl to shoulders keeping elbows stationary', true),
('Dumbbell Curl', 'isolation', ARRAY['biceps'], ARRAY['Dumbbells'], 'beginner', 'Curl dumbbells alternating or together, supinate wrist at top', true),
('Hammer Curl', 'isolation', ARRAY['biceps', 'brachialis', 'forearms'], ARRAY['Dumbbells'], 'beginner', 'Neutral grip curl, targets brachialis and forearms more', true),
('Preacher Curl', 'isolation', ARRAY['biceps'], ARRAY['Dumbbells', 'EZ Curl Bar', 'Preacher Curl Bench'], 'beginner', 'Rest arms on preacher pad, curl weight keeping upper arms stationary', true),
('Cable Curl', 'isolation', ARRAY['biceps'], ARRAY['Cable Stack'], 'beginner', 'Stand facing cable, curl handle to shoulders with constant tension', true),
('Tricep Pushdown', 'isolation', ARRAY['triceps'], ARRAY['Cable Stack'], 'beginner', 'Push rope or bar down keeping elbows at sides, squeeze triceps at bottom', true),
('Overhead Tricep Extension', 'isolation', ARRAY['triceps'], ARRAY['Dumbbells', 'Cable Stack'], 'beginner', 'Hold weight overhead, lower behind head keeping elbows pointing up', true),
('Skull Crushers', 'isolation', ARRAY['triceps'], ARRAY['Barbells', 'EZ Curl Bar', 'Flat Bench'], 'intermediate', 'Lie on bench, lower bar to forehead, extend back up', true),
('Close Grip Bench Press', 'compound', ARRAY['triceps', 'chest'], ARRAY['Barbells', 'Flat Bench'], 'intermediate', 'Narrow grip bench press emphasizing triceps', true),
('Dips (Tricep Focus)', 'compound', ARRAY['triceps', 'chest'], ARRAY['Dip Station'], 'intermediate', 'Keep body upright on dip bars to emphasize triceps', true),

-- LEG EXERCISES
('Barbell Squat', 'compound', ARRAY['quads', 'glutes', 'hamstrings', 'core'], ARRAY['Barbells', 'Squat Rack / Power Cage'], 'intermediate', 'Bar on upper back, squat to parallel or below, drive through heels', true),
('Front Squat', 'compound', ARRAY['quads', 'glutes', 'core'], ARRAY['Barbells', 'Squat Rack / Power Cage'], 'advanced', 'Bar in front rack position, squat maintaining upright torso', true),
('Goblet Squat', 'compound', ARRAY['quads', 'glutes'], ARRAY['Dumbbells', 'Kettlebells'], 'beginner', 'Hold weight at chest, squat keeping torso upright', true),
('Leg Press', 'compound', ARRAY['quads', 'glutes', 'hamstrings'], ARRAY['Leg Press'], 'beginner', 'Press platform away, dont lock knees at top', true),
('Hack Squat', 'compound', ARRAY['quads', 'glutes'], ARRAY['Hack Squat Machine'], 'intermediate', 'Shoulders under pads, squat on angled platform', true),
('Walking Lunges', 'compound', ARRAY['quads', 'glutes', 'hamstrings'], ARRAY['Dumbbells'], 'beginner', 'Step forward into lunge, alternate legs walking forward', true),
('Bulgarian Split Squat', 'compound', ARRAY['quads', 'glutes'], ARRAY['Dumbbells', 'Flat Bench'], 'intermediate', 'Rear foot elevated on bench, squat on front leg', true),
('Leg Extension', 'isolation', ARRAY['quads'], ARRAY['Leg Extension Machine'], 'beginner', 'Extend legs against pad, squeeze quads at top', true),
('Leg Curl', 'isolation', ARRAY['hamstrings'], ARRAY['Leg Curl Machine'], 'beginner', 'Curl heels toward glutes, squeeze hamstrings', true),
('Stiff Leg Deadlift', 'compound', ARRAY['hamstrings', 'glutes', 'lower_back'], ARRAY['Barbells', 'Dumbbells'], 'intermediate', 'Minimal knee bend, hinge at hips for maximum hamstring stretch', true),
('Hip Thrust', 'compound', ARRAY['glutes', 'hamstrings'], ARRAY['Barbells', 'Flat Bench'], 'intermediate', 'Upper back on bench, drive hips up squeezing glutes at top', true),
('Calf Raises (Standing)', 'isolation', ARRAY['calves'], ARRAY['Calf Raise Machine', 'Dumbbells'], 'beginner', 'Rise onto toes, lower heels below platform for stretch', true),
('Calf Raises (Seated)', 'isolation', ARRAY['calves'], ARRAY['Calf Raise Machine'], 'beginner', 'Seated calf raise targets soleus more than standing version', true),

-- CORE EXERCISES
('Plank', 'isolation', ARRAY['core', 'abs'], ARRAY[]::text[], 'beginner', 'Hold push-up position on forearms, keep body straight, brace core', true),
('Side Plank', 'isolation', ARRAY['obliques', 'core'], ARRAY[]::text[], 'beginner', 'Balance on one forearm and side of foot, keep body straight', true),
('Crunches', 'isolation', ARRAY['abs'], ARRAY['Yoga Mat'], 'beginner', 'Lie on back, curl shoulders toward pelvis, dont pull on neck', true),
('Hanging Leg Raise', 'isolation', ARRAY['abs', 'hip_flexors'], ARRAY['Pull-up Bar'], 'intermediate', 'Hang from bar, raise legs to parallel or higher', true),
('Cable Woodchop', 'compound', ARRAY['obliques', 'core'], ARRAY['Cable Stack'], 'intermediate', 'Rotate torso pulling cable diagonally across body', true),
('Ab Wheel Rollout', 'compound', ARRAY['abs', 'core'], ARRAY['Ab Wheel'], 'advanced', 'Roll wheel forward extending body, contract abs to return', true),
('Dead Bug', 'isolation', ARRAY['core', 'abs'], ARRAY['Yoga Mat'], 'beginner', 'Lie on back, alternate extending opposite arm and leg while bracing core', true),
('Russian Twist', 'isolation', ARRAY['obliques'], ARRAY['Medicine Ball'], 'intermediate', 'Seated with feet elevated, rotate torso side to side with weight', true),
('Back Extension', 'isolation', ARRAY['lower_back', 'glutes'], ARRAY['Roman Chair / Back Extension'], 'beginner', 'Hinge at hips over pad, extend back to parallel with legs', true),

-- COMPOUND/FUNCTIONAL
('Clean and Press', 'compound', ARRAY['full_body', 'shoulders', 'traps', 'legs'], ARRAY['Barbells'], 'advanced', 'Clean bar to shoulders, press overhead in one fluid movement', true),
('Kettlebell Swing', 'compound', ARRAY['glutes', 'hamstrings', 'core', 'shoulders'], ARRAY['Kettlebells'], 'intermediate', 'Hinge at hips, swing kettlebell to chest height using hip drive', true),
('Burpees', 'compound', ARRAY['full_body'], ARRAY[]::text[], 'intermediate', 'Squat, jump feet back, push-up, jump feet forward, jump up', true),
('Box Jumps', 'compound', ARRAY['quads', 'glutes', 'calves'], ARRAY['Plyo Box'], 'intermediate', 'Jump onto box, step down, reset and repeat', true),
('Battle Rope Waves', 'compound', ARRAY['shoulders', 'core', 'arms'], ARRAY['Battle Ropes'], 'intermediate', 'Create alternating waves with heavy ropes for conditioning', true),
('Farmers Walk', 'compound', ARRAY['grip', 'traps', 'core', 'legs'], ARRAY['Dumbbells', 'Kettlebells'], 'beginner', 'Hold heavy weights at sides, walk with good posture', true),
('Turkish Get-up', 'compound', ARRAY['full_body', 'core', 'shoulders'], ARRAY['Kettlebells', 'Dumbbells'], 'advanced', 'From lying to standing while holding weight overhead', true);
