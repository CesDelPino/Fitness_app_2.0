# To-Do List

## Pending Tasks

- [ ] Add `https://platform.com/reset-password` to Supabase redirect URLs (see `docs/PASSWORD_RESET_SETUP.md` for details)

### Preset Avatars Setup
1. [ ] Create Supabase Storage bucket for preset avatars:
   - Go to Supabase Dashboard > Storage
   - Click "New bucket"
   - Name: `preset-avatars`
   - Set to **Private** (not public)
   - Click "Create bucket"
2. [ ] Upload initial avatars via Admin Panel:
   - Go to `/admin` and log in
   - Navigate to the "Avatars" tab
   - Upload 20 avatar files (10 male, 10 female)
   - Set appropriate gender categorization for each
   - Ensure all avatars are set to "Active"
