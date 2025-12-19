# Password Reset Setup Guide

This document explains how to configure the password reset feature for LOBA Tracker.

## Overview

LOBA Tracker uses Supabase's built-in password reset functionality. When a user clicks "Forgot Password?" on the login page, Supabase sends them an email with a secure link. Clicking that link brings them to the app's reset password page where they can set a new password.

## Required Configuration

### Supabase Redirect URLs

For the password reset to work, you must add your app's reset password URL to Supabase's allowed redirect list.

#### Steps:

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. In the **Redirect URLs** section, add your reset password URL(s)

---

## URL Configuration by Deployment Type

### Option A: Replit Default Domain Only

If you're using only the Replit-provided domain (e.g., `your-app.replit.app`):

**Add this URL:**
```
https://your-app-name.replit.app/reset-password
```

Replace `your-app-name` with your actual Replit app subdomain.

---

### Option B: Custom Domain Only

If you've attached a custom domain (e.g., `app.yourdomain.com`) and want users to only use that:

**Add this URL:**
```
https://app.yourdomain.com/reset-password
```

Replace `app.yourdomain.com` with your actual custom domain.

---

### Option C: Both Replit Domain and Custom Domain

If you want password reset to work from either domain (recommended for flexibility):

**Add both URLs:**
```
https://your-app-name.replit.app/reset-password
https://app.yourdomain.com/reset-password
```

This ensures the reset flow works regardless of which domain users access the app from.

---

## Important Notes

### Email Template (Optional)

Supabase sends a default password reset email. If you want to customize it:

1. Go to **Authentication** → **Email Templates**
2. Select **Reset Password**
3. Customize the email content and branding
4. The `{{ .ConfirmationURL }}` variable contains the reset link

### Rate Limiting

Supabase applies rate limits to prevent abuse:
- Reset emails are limited per email address
- If a user tries too many times, they'll need to wait before trying again

### Security Considerations

- Reset links expire after a set time (typically 1 hour)
- Each link can only be used once
- The link contains secure tokens that verify the user's identity

---

## Testing the Flow

1. Go to the login page
2. Click "Forgot Password?"
3. Enter an email address for an existing account
4. Check the inbox for the reset email
5. Click the link in the email
6. You should arrive at `/reset-password` in the app
7. Enter and confirm a new password
8. You should see a success message and be redirected to login

---

## Troubleshooting

### "Link expired" error
- The reset link may have timed out (usually 1 hour)
- Request a new reset email

### Page doesn't load after clicking email link
- Check that the redirect URL is correctly added in Supabase
- Make sure the URL matches exactly (including https://)

### No email received
- Check spam/junk folder
- Verify the email address has an account in the system
- Wait a few minutes and try again (rate limiting may apply)

### "Invalid token" error
- The link may have already been used
- Request a new reset email
