# Small Updates Log

This document tracks smaller feature enhancements and bug fixes.

---

## Local-First Food Search with API Fallback

**Date:** December 9, 2024  
**Status:** Complete

### Overview
Add instant typeahead search that queries local Supabase `food_items` table, with fallback to FDC API via existing search button.

### Current State
- Food search uses FDC API calls triggered by a search button
- 200+ food items cached in Supabase `food_items` table
- GIN index exists on `to_tsvector('english', description)` for fast text search

### Proposed Solution

**User Flow:**
1. User starts typing in food search field
2. After 300ms debounce (min 2-3 chars), dropdown appears with local matches
3. User can select from dropdown → item logged (no API call)
4. If not found, user clicks "Search FDC" button → current API workflow
5. New FDC results saved to local DB for future instant searches

**Technical Approach:**
- Use Supabase `textSearch` with `websearch_to_tsquery` (utilizes existing GIN index)
- Fallback to `ILIKE` for edge cases
- Debounce: 300ms, minimum 2-3 character threshold
- UI: shadcn Combobox/Command list in ScrollArea
- Selection maps to existing `FoodSearchResult` shape to reuse logging flow

### Tasks

- [x] Create backend endpoint for local food search (`/api/foods/local-search`)
- [x] Add Supabase text search query helper (reused existing `searchCachedFoods`)
- [x] Update FoodSearch UI with instant dropdown
- [x] Wire dropdown selection to existing food logging flow
- [x] Ensure FDC results persist to local DB after selection (already handled by `cacheFood`)
- [x] Add loading/empty states and `data-testid` attributes
- [x] Add click-outside-to-close and Escape key handling
- [x] Reset state after local selection so FDC button works again
- [x] Test end-to-end flow

### Acceptance Criteria
1. Typing 3+ characters triggers instant local search
2. Results appear in scrollable dropdown within 300ms
3. Selecting a local result logs food without API call
4. "Search FDC" button still works as before
5. FDC selections are saved to `food_items` for future local searches
6. Empty state shown when no local matches found

### Architecture Review
Reviewed by Architect on Dec 9, 2024:
- GIN index on `description` column confirmed for fast text search
- 300ms debounce recommended
- Reuse existing `FoodSearchResult` type for seamless integration
- No security concerns identified

---

## Food Portion Options Storage

**Date:** December 9, 2024  
**Status:** Complete

### Overview
Store multiple portion options per food item (cup, tbsp, grams, serving, etc.) so the portion selector works correctly with locally-cached foods.

### Problem Statement
When foods are fetched from the FDA API, they include rich portion data (multiple serving sizes). However, when we cache foods to `food_items`, we only store one default serving size. This breaks the portion selector for local search results.

### Schema Design

**New Table: `food_item_portions`**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, default gen_random_uuid() | Unique identifier |
| `food_item_id` | UUID | FK → food_items(id) ON DELETE CASCADE | Parent food item |
| `source_portion_id` | TEXT | nullable | FDA portion ID (preserves provenance) |
| `description` | TEXT | NOT NULL | Portion description (e.g., "1 cup, chopped") |
| `amount` | NUMERIC(10,4) | nullable | Serving multiplier (nullable - some FDA rows omit) |
| `gram_weight` | NUMERIC(10,4) | nullable | Gram weight (nullable - FDA data sometimes missing) |
| `unit` | TEXT | nullable | Unit abbreviation (g, mL, serving) |
| `sequence` | SMALLINT | nullable | Display order from FDA |
| `modifier` | TEXT | nullable | Additional context (e.g., "package (7 oz)") |
| `is_default` | BOOLEAN | default false | Mark default portion (max one per food) |
| `data_source` | data_source_type | default 'fda_foundation' | Origin of data |
| `created_at` | TIMESTAMPTZ | default now() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | default now() | Last update timestamp |

**Indexes:**
- `btree` on `food_item_id` for fast joins
- Partial unique index on `(food_item_id) WHERE is_default = true` to enforce single default
- Unique constraint on `(food_item_id, LOWER(description), COALESCE(gram_weight, -1), COALESCE(amount, -1), COALESCE(unit, ''))` to dedupe identical portions

**Null Handling Strategy:**
- Allow nulls for FDA data gaps (gram_weight, amount, unit)
- Application logic provides fallbacks:
  - Prefer `gram_weight` for calculations
  - If absent, derive from `serving_size_grams` on parent food_items
  - Fallback to household text for display

### Data Normalization
1. Collapse duplicate portions by normalized tuple (description/modifier/gram_weight/amount/unit)
2. Prefer entries with gram_weight values over those without
3. Use sequence as tie-breaker for ordering
4. Auto-mark default: FDA `portionDefault=true`, else match to `serving_size_description`, else first portion

### Tasks

- [x] Create migration for `food_item_portions` table with constraints and indexes
- [x] Add shared TypeScript types in `shared/schema.ts`
- [x] Extend `cacheFood` in `fda-cache.ts` to upsert portions transactionally
- [x] Update `searchCachedFoods` to return nested portions array
- [x] Update `/api/foods/local-search` endpoint to include portions
- [x] Update `LocalFoodResult` type in FoodSearchModal to include portions
- [x] Ensure FoodMatchSelector consumes portions from local results
- [x] Implement backfill strategy for existing cached foods
- [x] Add Admin panel button to trigger backfill (FoodVerificationTab)
- [x] Test portion selector with local search results

### Backfill Strategy

**Approach: Staged Batch + On-Demand Fallback**

1. **Batch Job (Primary):**
   - Queue existing `food_items` ordered by `fetch_timestamp` desc (most recent first)
   - Process in shards of ~200 items per run
   - Re-fetch FDA details with `includePortions=true`
   - Insert portions transactionally

2. **On-Demand Fallback:**
   - If user selects a portionless cached food
   - Fetch portions from FDA in real-time
   - Persist immediately to avoid repeat fetches
   - Graceful degradation: show single default portion if API fails

### Acceptance Criteria
1. Portion selector works identically for local results and FDA API results
2. Multiple portion options displayed (cup, tbsp, 100g, serving, etc.)
3. Default portion auto-selected
4. Existing cached foods have portions after backfill
5. No data loss on portion updates (transactional upsert)

### Architecture Review
Reviewed by Architect on Dec 9, 2024:
- Schema designed for resilience with nullable columns for FDA data gaps
- Unique constraints prevent duplicate portions
- Partial index enforces single default per food
- Transactional upsert prevents orphaned data
- On-demand fallback ensures graceful degradation

---

## Admin Food Library Browser

**Date:** December 9, 2024  
**Status:** Complete

### Overview
Added an admin feature to browse, search, and view all cached foods in the database with their full details including portions and nutrients.

### Features
- **Searchable list** - Search by name, brand, or barcode with 300ms debounce
- **Filters** - Data source type (FDA Foundation, FDA Branded, etc.)
- **Paginated table** - 25 items per page with columns: food, source, portion count, usage count
- **Detail modal** - Shows full metadata, all portions (with amount/grams), and nutrient breakdown grouped by category

### API Endpoints
- `GET /api/admin/foods` - Paginated list with search/filter support
- `GET /api/admin/foods/:id` - Full food details with portions and nutrients

### UI Location
Added to the Foods tab in Admin panel as `FoodLibraryTab`, displayed above the existing `FoodVerificationTab`.

### Implementation Files
- `server/routes.ts` - Backend endpoints with pagination and search
- `client/src/pages/AdminPage.tsx` - FoodLibraryTab component with types

---
