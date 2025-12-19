-- LOBA SaaS Seed Data for Testing
-- Run this after 001 and 002 to create test data
-- NOTE: This creates test users in Supabase Auth first, then this data

-- ============================================
-- IMPORTANT: Create test users in Supabase Auth Dashboard first!
-- Go to Authentication > Users > Add User
-- 
-- Create these test users:
-- 1. pro@test.com (password: test1234) - The professional
-- 2. client1@test.com (password: test1234) - Client 1
-- 3. client2@test.com (password: test1234) - Client 2
--
-- After creating, note the UUIDs and update them below
-- ============================================

-- Placeholder UUIDs - REPLACE WITH ACTUAL UUIDs FROM SUPABASE AUTH
-- Professional UUID: Replace 'PROFESSIONAL_UUID_HERE'
-- Client 1 UUID: Replace 'CLIENT1_UUID_HERE'
-- Client 2 UUID: Replace 'CLIENT2_UUID_HERE'

-- Example (uncomment and update with real UUIDs):
/*

-- Update professional profile
UPDATE profiles 
SET 
  role = 'professional',
  display_name = 'Dr. Sarah Coach',
  timezone = 'America/New_York',
  updated_at = NOW()
WHERE id = 'PROFESSIONAL_UUID_HERE';

-- Create professional profile
INSERT INTO professional_profiles (user_id, bio, headline, specialties, verification_status)
VALUES (
  'PROFESSIONAL_UUID_HERE',
  'Certified nutritionist with 10 years of experience helping clients achieve their health goals.',
  'Holistic Health Coach',
  ARRAY['weight_loss', 'sports_nutrition', 'meal_planning'],
  'verified'
);

-- Update client 1 profile
UPDATE profiles 
SET 
  display_name = 'John Doe',
  timezone = 'America/New_York',
  current_weight_kg = 85.0,
  height_cm = 178,
  birthdate = '1990-05-15',
  gender = 'male',
  activity_multiplier = 1.55,
  updated_at = NOW()
WHERE id = 'CLIENT1_UUID_HERE';

-- Update client 2 profile
UPDATE profiles 
SET 
  display_name = 'Jane Smith',
  timezone = 'America/Los_Angeles',
  current_weight_kg = 65.0,
  height_cm = 165,
  birthdate = '1988-08-22',
  gender = 'female',
  activity_multiplier = 1.375,
  updated_at = NOW()
WHERE id = 'CLIENT2_UUID_HERE';

-- Create active relationships
INSERT INTO professional_client_relationships (professional_id, client_id, role_type, status, accepted_at)
VALUES 
  ('PROFESSIONAL_UUID_HERE', 'CLIENT1_UUID_HERE', 'coach', 'active', NOW()),
  ('PROFESSIONAL_UUID_HERE', 'CLIENT2_UUID_HERE', 'nutritionist', 'active', NOW());

-- Add some sample food logs for Client 1
INSERT INTO food_logs (user_id, logged_by_user_id, food_name, serving_description, servings, calories, protein, carbs, fat, meal_type, logged_at)
VALUES
  ('CLIENT1_UUID_HERE', 'CLIENT1_UUID_HERE', 'Scrambled Eggs', '2 large eggs', 1, 180, 12, 2, 14, 'breakfast', NOW() - INTERVAL '1 day'),
  ('CLIENT1_UUID_HERE', 'CLIENT1_UUID_HERE', 'Whole Wheat Toast', '1 slice', 2, 140, 6, 26, 2, 'breakfast', NOW() - INTERVAL '1 day'),
  ('CLIENT1_UUID_HERE', 'CLIENT1_UUID_HERE', 'Grilled Chicken Salad', '1 bowl', 1, 350, 35, 15, 18, 'lunch', NOW() - INTERVAL '1 day'),
  ('CLIENT1_UUID_HERE', 'CLIENT1_UUID_HERE', 'Salmon with Vegetables', '6 oz salmon', 1, 450, 40, 20, 22, 'dinner', NOW() - INTERVAL '1 day');

-- Add some sample workouts for Client 1
INSERT INTO workout_sessions (user_id, logged_by_user_id, name, duration_minutes, logged_at)
VALUES
  ('CLIENT1_UUID_HERE', 'CLIENT1_UUID_HERE', 'Upper Body Strength', 45, NOW() - INTERVAL '2 days'),
  ('CLIENT1_UUID_HERE', 'CLIENT1_UUID_HERE', 'Morning Run', 30, NOW() - INTERVAL '1 day');

-- Add weigh-ins for Client 1
INSERT INTO weigh_ins (user_id, weight_kg, logged_at)
VALUES
  ('CLIENT1_UUID_HERE', 86.5, NOW() - INTERVAL '7 days'),
  ('CLIENT1_UUID_HERE', 86.0, NOW() - INTERVAL '5 days'),
  ('CLIENT1_UUID_HERE', 85.5, NOW() - INTERVAL '3 days'),
  ('CLIENT1_UUID_HERE', 85.0, NOW() - INTERVAL '1 day');

*/

-- ============================================
-- VERIFICATION QUERIES
-- Run these to verify the setup works
-- ============================================

-- Check profiles
-- SELECT id, role, display_name FROM profiles;

-- Check professional profiles
-- SELECT pp.*, p.display_name 
-- FROM professional_profiles pp 
-- JOIN profiles p ON pp.user_id = p.id;

-- Check relationships
-- SELECT 
--   pcr.*,
--   pro.display_name as professional_name,
--   cli.display_name as client_name
-- FROM professional_client_relationships pcr
-- JOIN profiles pro ON pcr.professional_id = pro.id
-- JOIN profiles cli ON pcr.client_id = cli.id;

-- Test RLS: Check if professional can see client food logs
-- (Run as professional user in Supabase)
-- SELECT * FROM food_logs;
