# Progress Photos Feature Implementation

## Overview
Progress photos are standalone entities that clients upload to track their fitness transformation visually. Photos are categorized by pose (front/side/back) with an optional flexed variant. Professionals with the `view_progress_photos` permission can view their clients' photos.

## Implementation Phases

### Phase 1: Core Feature (Current)
Minimal vertical slice to ship first.

#### Tasks
- [x] **1.1 Database Schema** - Create `progress_photos` table in Supabase
  - Columns: id, user_id, photo_path, pose (front/side/back), is_flexed, captured_at, notes, created_at
  - Indexes: (user_id, captured_at DESC), (user_id, pose)
  - RLS policies for owner CRUD
  - ✅ Migration 029_progress_photos.sql applied

- [x] **1.2 Storage Bucket** - Create "progress-photos" bucket with RLS
  - Owner can upload/view/delete own photos
  - Professionals can read if `view_progress_photos` permission granted
  - Use signed URLs (not public)
  - ✅ Migration 030_progress_photos_storage.sql applied

- [x] **1.3 Shared Types** - Add types to shared/schema.ts or shared/supabase-types.ts
  - ProgressPhoto type
  - Insert schema with zod validation
  - Pose enum type
  - ✅ Added to shared/supabase-types.ts

- [x] **1.4 Storage Utilities** - Create client/src/lib/progress-photos-storage.ts
  - uploadProgressPhoto() - with client-side compression
  - deleteProgressPhoto() - cleans up storage object
  - getProgressPhotoSignedUrl() - returns signed URL
  - getProgressPhotos() - paginated list for user
  - ✅ Implemented with MIME validation and compression

- [x] **1.5 Server API** - Add routes for progress photos
  - GET /api/progress-photos - list user's photos
  - POST /api/progress-photos - upload photo
  - DELETE /api/progress-photos/:id - delete photo
  - GET /api/pro/clients/:clientId/progress-photos - pro view (permission-gated)
  - ✅ All routes implemented with permission checking

- [x] **1.6 Client Upload UI** - Add to WeighIn page
  - Collapsible "Progress Photos" section
  - Pose selector (Front/Side/Back)
  - Flexed toggle
  - Camera capture or file upload
  - Preview before upload
  - 5MB max file size enforcement
  - ✅ ProgressPhotos component integrated into WeighIn page

- [x] **1.7 Photo Tips Guide** - Original wording
  - Choose a consistent location with good lighting
  - Take photos at the same time each day (morning works best)
  - Wear similar fitted clothing for accurate comparison
  - Capture front, side, and back angles
  - Stand naturally with relaxed posture
  - ✅ Tips shown in collapsible section

- [x] **1.8 Client Gallery** - Photo gallery on WeighIn page
  - Grid view (latest 6, load more)
  - Filter by pose
  - Delete with confirmation
  - Mobile-responsive design
  - ✅ Gallery with pose filter and delete functionality

- [x] **1.9 Pro View Integration** - ProClientView photos section
  - Permission gate (`view_progress_photos`)
  - Read-only gallery
  - Filter by pose and date
  - Signed URL handling
  - ✅ ProClientView shows photos grid with permission checking

- [x] **1.10 Testing** - End-to-end verification
  - Client upload flow
  - Pro view with permission
  - Pro view without permission (should be hidden)
  - Delete functionality
  - ✅ E2E tests passed

### Phase 2: Enhancements (Future)
- [ ] Side-by-side comparison tool
- [ ] Weigh-in linking (`linked_photo_id` on weigh_ins table)
- [ ] Date range filtering
- [ ] Bulk photo operations

## Technical Details

### Database Schema
```sql
CREATE TABLE progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_path TEXT NOT NULL,
  pose TEXT NOT NULL CHECK (pose IN ('front', 'side', 'back')),
  is_flexed BOOLEAN DEFAULT FALSE,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_progress_photos_user_date ON progress_photos(user_id, captured_at DESC);
CREATE INDEX idx_progress_photos_user_pose ON progress_photos(user_id, pose);
```

### RLS Policies
- Owner: Full CRUD on own photos
- Professional: SELECT only if `view_progress_photos` permission granted for relationship

### Storage Structure
```
progress-photos/
  {user_id}/
    {timestamp}_{pose}_{flexed}.jpg
```

### File Constraints
- Max size: 5MB
- Allowed MIME types: image/jpeg, image/png, image/webp
- Client-side compression before upload

## Security Considerations
- Signed URLs only (no public access)
- Permission check via RLS + relationship validation
- MIME type validation (client + server)
- File size limits enforced both sides
- Delete cascades to storage cleanup

## UX Copy

### Photo Tips (shown in upload UI)
> **Tips for great progress photos:**
> - Choose a consistent location with good lighting
> - Take photos at the same time each day (morning works best)
> - Wear similar fitted clothing for accurate comparison
> - Capture front, side, and back angles
> - Stand naturally with relaxed posture

### Privacy Note (shown when granting permission)
> Your progress photos will become visible to [Professional Name]

## Progress Log
- 2024-12-03: Plan approved, implementation started
- 2024-12-03: Phase 1 complete - All 10 tasks implemented and tested
  - Database migrations (029, 030) applied to Supabase
  - Storage bucket created with RLS policies
  - Client upload UI with pose selector and tips
  - Pro view integration with permission gating
  - E2E tests passing
- 2024-12-03: Full-size lightbox added for professional view
  - Click any thumbnail to open full-size view
  - Shows pose, flexed indicator, and formatted date
  - Accessible with sr-only DialogTitle for screen readers
  - Watermarking feature added to backlog (P2)
