# Set Nutrition Targets Feature

## Overview
Allow professionals with `set_nutrition_targets` permission to send nutritional goals to their clients. Clients must accept the targets before they take effect, after which only the client can edit them.

## Flow
1. **Pro sends targets** → Creates pending record
2. **Client accepts/declines** → If accepted, targets become active
3. **Client can edit** after acceptance (pro cannot)
4. **Pro sends new targets** → Creates new pending (supersedes when accepted)

## Data Model

### `nutrition_targets` table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| client_id | uuid | FK to auth.users |
| professional_id | uuid | FK to auth.users (who set it) |
| protein_g | integer | Protein target in grams |
| carbs_g | integer | Carbs target in grams |
| fat_g | integer | Fat target in grams |
| calories | integer | Calculated: (P×4) + (C×4) + (F×9) |
| status | text | 'pending' / 'accepted' / 'declined' |
| source | text | 'professional' / 'client' |
| created_at | timestamp | When created |
| updated_at | timestamp | Last update |
| accepted_at | timestamp | When client accepted (nullable) |

## API Endpoints
- `POST /api/pro/client/:clientId/nutrition-targets` - Pro sets targets (creates pending)
- `GET /api/nutrition-targets` - Client gets their current/pending targets
- `POST /api/nutrition-targets/accept` - Client accepts pending targets
- `POST /api/nutrition-targets/decline` - Client declines pending targets
- `PATCH /api/nutrition-targets` - Client updates their accepted targets

## Task List

### Task 1: Database Schema
- [ ] Create `nutrition_targets` table in Supabase
- [ ] Add RLS policies for client and professional access
- [ ] Add index on client_id for fast lookups

### Task 2: API Endpoints
- [ ] Pro endpoint to set targets (with permission check)
- [ ] Client endpoints: get, accept, decline, update
- [ ] Calories calculated server-side from macros

### Task 3: Pro Modal UI
- [ ] Create SetNutritionTargetsModal component
- [ ] Form fields: protein (g), carbs (g), fat (g)
- [ ] Show calculated calories preview
- [ ] Validation and error handling

### Task 4: Wire Quick Action Button
- [ ] Pass onSetNutritionTargets to ClientQuickActions
- [ ] Connect to modal in ProDashboard
- [ ] Also wire in ProClientView

### Task 5: Client Pending UI
- [ ] Banner/card on Dashboard for pending targets
- [ ] Show values with accept/decline buttons
- [ ] Show who sent them

### Task 6: Client Dashboard Update
- [ ] Display accepted targets with provenance
- [ ] Show "Set by [Pro Name]" vs "Self-set"
- [ ] Show last updated timestamp

### Task 7: Notifications
- [ ] Create notification when pro sends targets
- [ ] Show in notification center
- [ ] Real-time update via WebSocket if available

## Edge Cases
- **Client declines**: Keep prior accepted/self-set targets
- **Client edits after accept**: Status stays accepted, source changes to 'client'
- **Pro sends new while pending exists**: Replace pending record
- **Pro sends new after accepted**: Create new pending, client must accept

## Permissions
- Uses existing `set_nutrition_targets` permission (exclusive type)
- Only the professional holding this permission can set targets
- Client always has full control after acceptance
