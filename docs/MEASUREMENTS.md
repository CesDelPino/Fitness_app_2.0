# LOBA Tracker - Measurement Units System

## Overview

LOBA Tracker serves both US (imperial) and European (metric) markets. This document outlines the unit handling strategy across all measurement domains, ensuring users can work in their preferred units while maintaining consistent internal storage.

## Core Principle

**Storage: Always Metric | Display: User Preference**

All measurements are stored internally in metric units. Conversion happens at the display/input layer only.

---

## Measurement Domains

### 1. Body Weight
| Aspect | Details |
|--------|---------|
| **Storage** | Kilograms (kg) |
| **Options** | kg / lbs |
| **Setting Location** | User Profile Settings |
| **Status** | ✅ Already implemented via `useWeightUnits` hook |

### 2. Body Measurements (waist, hips, chest, etc.)
| Aspect | Details |
|--------|---------|
| **Storage** | Centimeters (cm) |
| **Options** | cm / inches |
| **Setting Location** | User Profile Settings |
| **Status** | ✅ Implemented (Phase 1) - independent from body weight |

### 3. Exercise/Lifting Weights
| Aspect | Details |
|--------|---------|
| **Storage** | Kilograms (kg) |
| **Options** | kg / lbs |
| **Setting Location** | User Profile Settings (default) + Session Toggle |
| **Status** | ✅ Implemented (Phase 3) - WorkoutSection, ExerciseHistory, ActiveWorkoutSession |

### 4. Cardio Distance
| Aspect | Details |
|--------|---------|
| **Storage** | Kilometers (km) - stored as `distance_km` |
| **Options** | km / miles |
| **Setting Location** | User Profile Settings |
| **Status** | ⚠️ Partial - Check-in displays only (ProCheckInSubmissionView) |
| **Limitation** | workout_sessions table has no distance field; Analytics has no distance data |
| **Conversion** | km × 0.621371 = miles |
| **Rounding** | Standard 1 decimal (e.g., "3.1 miles") |

### 5. Food Weight
| Aspect | Details |
|--------|---------|
| **Storage** | Grams (g) |
| **Options** | g / oz |
| **Setting Location** | User Profile Settings |
| **Status** | ✅ Implemented (Phase 2) - FoodMatchSelector, FoodSearchModal, ReviewModal, ManualEntryModal |
| **Rounding** | Snap-to-clean-values (e.g., 3.99 oz → 4 oz for values within 1% of whole/half numbers) |

### 6. Food Volume (excluding water)
| Aspect | Details |
|--------|---------|
| **Storage** | Milliliters (ml) |
| **Options** | ml / fl oz |
| **Setting Location** | User Profile Settings |
| **Status** | ⏸️ No current UI displays food volume (only weight-based portions) |
| **Note** | Separate from water intake which already has unit support. Will implement when volume-based food logging is added. |

---

## Food Logging - Unit Handling (US Market Priority)

### The Problem
FDA data provides all weights in grams, but US users expect ounces for many foods:
- "4 oz chicken breast" not "113g chicken breast"
- "8 fl oz milk" not "237ml milk"

### Current Behavior
- Portions display descriptive names: "1 cup", "1 medium", "1 slice" (works universally)
- Gram weights shown when portion selected (e.g., "1 cup (240g)")
- No option to display in ounces

### Proposed Solution

#### 1. Portion Display
When showing portion options with weights:
- **Metric user**: "1 cup (240g)"
- **Imperial user**: "1 cup (8.5 oz)"

#### 2. Custom Amount Entry
When user enters a custom quantity:
- **Metric user**: Input field labeled "grams", stores directly
- **Imperial user**: Input field labeled "oz", converts to grams for storage

#### 3. Nutrient Panel Display
Show serving size in user's preferred unit:
- **Metric**: "Per 100g" or "Per serving (150g)"
- **Imperial**: "Per 3.5oz" or "Per serving (5.3oz)"

#### 4. Quick Log / Manual Entry
- Weight input respects user's food weight preference
- Volume input respects user's food volume preference

### Where Units Appear in Food Logging

| Location | Current | Proposed (Imperial) |
|----------|---------|---------------------|
| Portion selector dropdown | "1 cup (240g)" | "1 cup (8.5 oz)" |
| Custom amount input | "Enter grams" | "Enter oz" |
| Food card in meal log | "240g" | "8.5 oz" |
| Nutrient panel header | "Per 100g" | "Per 3.5 oz" |
| Daily totals | N/A (calories only) | N/A |
| AI analysis results | "Estimated: 150g" | "Estimated: 5.3 oz" |
| Barcode scan results | "Serving: 28g" | "Serving: 1 oz" |

### Common US Food Portion Expectations

| Food Type | US Expectation | Metric Equivalent |
|-----------|----------------|-------------------|
| Meat/Protein | 4 oz, 6 oz, 8 oz | 113g, 170g, 227g |
| Beverages | 8 fl oz, 12 fl oz, 16 fl oz | 237ml, 355ml, 473ml |
| Cheese | 1 oz | 28g |
| Nuts | 1 oz | 28g |
| Liquids (cooking) | cups, tbsp, tsp | ml |

### Rounding Strategy for Food Units

**Problem:** Converting grams ↔ ounces introduces floating point imprecision.
- User enters "4 oz" → stored as 113.398g → displayed as 3.9999 oz

**Solution: Snap to Clean Values**

When displaying converted values, snap to whole or half numbers if within 1%:
- 3.99 oz → **4 oz**
- 2.01 oz → **2 oz**  
- 4.48 oz → **4.5 oz**
- 4.52 oz → **4.5 oz**
- 4.23 oz → **4.2 oz** (no snap, use 1 decimal)

**Implementation:**
```javascript
function snapToCleanValue(value: number): number {
  // Check if within 1% of a whole number
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) / rounded < 0.01) {
    return rounded;
  }
  
  // Check if within 1% of a half number
  const halfRounded = Math.round(value * 2) / 2;
  if (Math.abs(value - halfRounded) / halfRounded < 0.01) {
    return halfRounded;
  }
  
  // Otherwise, round to 1 decimal
  return Math.round(value * 10) / 10;
}
```

**Examples:**
| Stored (g) | Raw Conversion (oz) | After Snap |
|------------|---------------------|------------|
| 113.4g | 3.9999 oz | 4 oz |
| 28.35g | 1.0000 oz | 1 oz |
| 170.1g | 6.0002 oz | 6 oz |
| 142.0g | 5.0088 oz | 5 oz |
| 100.0g | 3.5274 oz | 3.5 oz |

### Implementation Notes

1. **FDA portions are descriptive first** - "1 medium apple" works in any unit system
2. **Gram weights are secondary** - Convert these to oz for imperial users
3. **Don't over-convert** - If FDA says "1 slice", keep it as "1 slice", just convert the gram weight
4. **Nutrient math stays in grams** - All calculations use gram-based values internally
5. **Display uses snap rounding** - Clean values for better UX, no schema changes needed

### Files to Update for Food Units
- `client/src/components/FoodSearchModal.tsx` - Portion display
- `client/src/components/FoodMatchSelector.tsx` - Portion weights
- `client/src/components/MealSection.tsx` - Logged food display
- `client/src/components/NutrientPanel.tsx` - "Per 100g" headers
- `client/src/components/QuickLogModal.tsx` - Custom entry
- `client/src/hooks/use-nutrition.ts` - AI analysis display

---

### 7. Water Intake
| Aspect | Details |
|--------|---------|
| **Storage** | Milliliters (ml) - stored as `amount_ml` |
| **Options** | ml / fl oz |
| **Setting Location** | User Profile Settings |
| **Status** | ✅ Already implemented |
| **Implementation** | Uses `VolumeUnit` type, `formatVolumeShort()`, `getWaterPresets()` in `shared/units.ts` |
| **Components** | `AddMealDropdown.tsx`, `client/src/lib/water.ts` |

---

## Exercise Weight - Session Toggle Design

### The Problem
Users may train at different locations with different equipment:
- Home gym with kg plates
- Commercial gym with lbs plates  
- Mixed equipment within the same gym (common in Europe)

### Solution: Default + Session Override

1. **Default Preference** (in Settings)
   - User sets their usual preference: kg or lbs
   - Applies when starting any new workout

2. **Session Toggle** (in Active Workout)
   - Toggle visible during active workout session
   - Changes display/input unit immediately
   - All previously entered weights recalculate for display
   - New entries convert to kg for storage
   - Toggle state is session-only (not persisted)

3. **Mid-Session Toggle Behavior**
   - User enters "225 lbs" → stored as 102.058 kg
   - User toggles to kg → display shows "102.1 kg"
   - User enters next set as "105 kg" → stored as 105 kg
   - Each set saves immediately after input
   - No data loss, seamless experience

4. **Session Toggle Persistence**
   - **Toggle state is NOT persisted to database**
   - Stored in React component state only (ephemeral)
   - Resets to user's default preference on next workout
   - No schema changes needed for session override
   - No API changes - weight always sent/stored in kg

### Why Not Per-Exercise Override?
Per-exercise unit settings add significant UI complexity. The session toggle handles the real-world scenario adequately:
- User toggles to lbs → logs machine exercises
- User toggles to kg → logs barbell exercises
- Quick and intuitive

---

## Settings UI Structure

### Proposed Settings Page Section: "Units & Measurements"

```
Units & Measurements
├── Body Weight: [kg ▼] / [lbs]
├── Body Measurements: [cm ▼] / [inches]
├── Exercise Weights: [kg ▼] / [lbs]  ← Default for workouts
├── Cardio Distance: [km ▼] / [miles]
├── Food Weight: [g ▼] / [oz]
├── Food/Water Volume: [ml ▼] / [fl oz]
└── [Reset All to Metric] [Reset All to Imperial]
```

Each setting is independent, allowing users to mix (e.g., body weight in lbs, exercise in kg).

---

## Conversion Reference

### Weight Conversions
| From | To | Formula |
|------|-----|---------|
| kg | lbs | kg × 2.20462 |
| lbs | kg | lbs ÷ 2.20462 |
| g | oz | g × 0.035274 |
| oz | g | oz × 28.3495 |

### Length Conversions
| From | To | Formula |
|------|-----|---------|
| cm | inches | cm × 0.393701 |
| inches | cm | inches × 2.54 |
| km | miles | km × 0.621371 |
| miles | km | miles × 1.60934 |

### Volume Conversions
| From | To | Formula |
|------|-----|---------|
| ml | fl oz | ml × 0.033814 |
| fl oz | ml | fl oz × 29.5735 |

---

## Implementation Priority

### Phase 1: Foundation + Body Measurements ✅ COMPLETE
**Deliverables:**
1. ✅ Created migration `063_unit_preferences.sql` with all 6 unit preference columns
2. ✅ Updated `shared/supabase-types.ts` with new profile fields
3. ✅ Created `useUnitPreferences` hook with conversion helpers for all domains
4. ✅ Added "Units & Measurements" section to Settings page UI
5. ✅ Updated `WeighInForm.tsx` with cm conversion on submit
6. ✅ Updated `WeighInHistory.tsx` with cm→display unit conversion
7. ⏭️ Height display kept on main unit system toggle (UX decision - height is one-time setting)

**Success criteria:** ✅ MET
- User can independently set body weight (kg/lbs) and body measurements (cm/in)
- Settings page shows all unit toggles (6 domains)
- WeighInForm/History respects separate measurement unit with proper conversions

**Completed:** December 9, 2024

### Phase 2: Food & Nutrition (US Market Priority) ✅ COMPLETE
**Deliverables:**
1. ✅ Add g/oz display option for food portions
2. ✅ Update FoodSearchModal, FoodMatchSelector portion displays
3. ⏭️ MealSection - skipped (shows food name/macros, not weights)
4. ⏭️ NutrientPanel headers - skipped (doesn't have "Per 100g" header currently)
5. ⏭️ QuickLogModal - skipped (is for cardio workouts, not food)
6. ✅ Update ReviewModal and ManualEntryModal for AI analysis/manual entry
7. ✅ Implement snap-to-clean-values rounding for food units

**Success criteria:** ✅ MET
- US users see ounces throughout food logging flow
- Gram weights convert cleanly (4 oz not 3.99 oz)

**Completed:** December 9, 2024

### Phase 3: Exercise Weights ✅ COMPLETE
**Deliverables:**
1. ✅ Update WorkoutSection.tsx to use `unit_exercise_weight` preference
2. ✅ Add session unit toggle to ActiveWorkoutSession UI (ephemeral state, kg/lbs toggle in header)
3. ✅ Update all exercise-related display components (ExerciseHistory, ProClientView, ProCheckInSubmissionView)
4. ✅ Ensure sets save in kg regardless of display unit (lbsToKg conversion in saveMutation)

**Success criteria:** ✅ MET
- Exercise weights respect user preference
- Mid-session toggle works without data loss
- Toggle is ephemeral (React state only, resets on new workout)

**Completed:** December 9, 2024

### Phase 4: Cardio Distance ✅ COMPLETE
**Status:** Complete

**Scope Analysis:**
- Audited codebase for `distance_km`, `distanceKm`, "km" literals
- `workout_sessions` table has NO `distance_km` column - WorkoutSection has no distance to display
- `Analytics.tsx` has NO distance/km/miles references - no update needed
- Only one location required update: `ProCheckInSubmissionView.tsx`

**Deliverables:**
1. ✅ Codebase audit - identified only ProCheckInSubmissionView.tsx needed update
2. ✅ Updated `ProCheckInSubmissionView.tsx` to use `cardioDistance.format(cardio.distance_km)`
3. ⏭️ WorkoutSection.tsx - N/A (workout_sessions has no distance field)
4. ⏭️ Analytics.tsx - N/A (no distance aggregations present)

**Current Limitation:**
- Distance data only exists in weekly check-in cardio summaries (pro-checkins)
- When cardio distance capture expands to workout_sessions, the audit should be revisited

**Success criteria:** ✅ MET
- Cardio distances in check-in views respect user's km/mi preference
- Rounding handled by `formatDistance()` helper (1 decimal)

**Completed:** December 9, 2024

**Note:** Water intake already complete - no work needed.

---

## Technical Implementation Notes

### Database Schema Addition

**Migration: Add unit preference columns to profiles table**

```sql
-- Migration: 063_unit_preferences.sql
-- Add per-domain unit preference columns

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unit_body_weight TEXT DEFAULT 'kg' 
  CHECK (unit_body_weight IN ('kg', 'lbs'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unit_body_measurements TEXT DEFAULT 'cm'
  CHECK (unit_body_measurements IN ('cm', 'in'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unit_exercise_weight TEXT DEFAULT 'kg'
  CHECK (unit_exercise_weight IN ('kg', 'lbs'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unit_cardio_distance TEXT DEFAULT 'km'
  CHECK (unit_cardio_distance IN ('km', 'mi'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unit_food_weight TEXT DEFAULT 'g'
  CHECK (unit_food_weight IN ('g', 'oz'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unit_food_volume TEXT DEFAULT 'ml'
  CHECK (unit_food_volume IN ('ml', 'floz'));

-- Note: Water intake already uses VolumeUnit from shared/units.ts
-- which reads from preferred_unit_system, no new column needed
```

**Backwards Compatibility:**
- All columns have sensible defaults (metric)
- Existing users get metric by default
- No backfill required - users update preferences as needed

**Existing column reference:**
- `preferred_unit_system` ('metric' | 'imperial') - global fallback, already exists
- New columns override the global setting per domain

### Files to Update
- `shared/units.ts` - Add all conversion functions
- `client/src/hooks/useUnitPreferences.ts` - New generalized hook
- `client/src/hooks/useWeightUnits.ts` - Refactor to use new system
- `client/src/pages/SettingsPage.tsx` - Add unit preference UI
- `client/src/components/WorkoutSection.tsx` - Fix hardcoded "kg"
- `client/src/components/ActiveWorkoutSession.tsx` - Add session toggle
- `client/src/components/FoodSearchModal.tsx` - Add food unit support
- `client/src/components/MealSection.tsx` - Display in preferred units

---

## Notes

- **Food Rounding**: Uses "snap to clean values" strategy for better UX (see Food Logging section)
- **Exercise Rounding**: Standard rounding is acceptable. Users will notice if they enter in wrong unit.
- **Historical Data**: Displays in current preference, converted from stored metric value.
- **No per-set unit storage**: We don't track which unit was used for entry. Storage is always metric.
- **Session toggle is ephemeral**: Not saved to database, resets to default on next workout.

---

## Status

| Domain | Settings UI | Display | Input | Session Toggle | Notes |
|--------|-------------|---------|-------|----------------|-------|
| Body Weight | ✅ | ✅ | ✅ | N/A | |
| Body Measurements | ✅ | ✅ | ✅ | N/A | |
| Exercise Weights | ✅ | ✅ | ✅ | ✅ | |
| Cardio Distance | ✅ | ⚠️ | N/A | N/A | Check-in only; workout_sessions has no distance field |
| Food Weight | ✅ | ✅ | ✅ | N/A | |
| Food Volume | ✅ | ❌ | ❌ | N/A | No current UI displays food volume |
| Water Intake | ✅ | ✅ | ✅ | N/A | |

**Legend:** ✅ Complete | ⚠️ Partial | ❌ Not Implemented | N/A Not Applicable

### Phase Summary
| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Foundation + Body Measurements | ✅ Complete (Dec 9, 2024) |
| Phase 2 | Food & Nutrition (g/oz) | ✅ Complete (Dec 9, 2024) |
| Phase 3 | Exercise Weights (kg/lbs) | ✅ Complete (Dec 9, 2024) |
| Phase 4 | Cardio Distance (km/mi) | ✅ Complete (Dec 9, 2024) |

### Phase 3 Critical Implementation Notes
**ActiveWorkoutSession.tsx Architecture (IMPORTANT FOR FUTURE REFERENCE):**
- Weights are ALWAYS stored internally in kg in React state
- `inputToKg()` converts user input to kg before storing in state
- `kgToDisplay()` converts stored kg values for display based on activeUnit
- Mid-session unit toggle only affects display, never corrupts stored data
- Save mutation uses stored kg values directly (no conversion needed)
- Session toggle is ephemeral (React state only, not persisted to profile)

---

## Testing

Test accounts are available for verifying unit handling across different user roles.

See: `docs/TEST_ACCOUNTS_LOGIN.md`

---

*Last Updated: December 9, 2024*
*Phase 1 Completed: December 9, 2024*
*Phase 2 Completed: December 9, 2024*
*Phase 3 Completed: December 9, 2024*
*Phase 4 Completed: December 9, 2024*
