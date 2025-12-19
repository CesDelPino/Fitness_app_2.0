# Professional-Client Connection Manual Testing Schedule

## Overview
This document outlines a comprehensive manual testing plan for the professional-client connection system. The goal is to systematically test the entire connection lifecycle to identify where validation issues occur.

---

## Phase 0: Setup Test Accounts

| Account | Email | Role | Purpose |
|---------|-------|------|---------|
| Pro A | testpro1@test.com | Professional | Primary test trainer |
| Pro B | testpro2@test.com | Professional | Second trainer for multi-connection tests |
| Client 1 | testclient1@test.com | Client | Primary test client |
| Client 2 | testclient2@test.com | Client | Second client for multi-client tests |

**Setup Steps:**
1. Register each account through normal registration flow
2. For professionals: Complete pro verification/setup process
3. For professionals: Complete storefront setup (required for visibility)

---

## Phase 1: Single Connection (Happy Path)

### Test 1.1: Pro Invites Client
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as **Pro A** | Dashboard loads |
| 2 | Go to Client Management | Client list page loads |
| 3 | Send invitation to **Client 1** email | Success message shown |
| 4 | Check pending invitations list | Invitation appears as pending |

**Result:** ☐ Pass ☐ Fail  
**Notes:**

---

### Test 1.2: Client Accepts Invitation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log out of Pro A | Redirected to login |
| 2 | Log in as **Client 1** | Dashboard loads |
| 3 | Check for pending invitation | Notification/banner visible |
| 4 | Accept the invitation | Success confirmation |
| 5 | Navigate to Train page | Pro A's info loads correctly |
| 6 | Check "My Pro" section | Pro A's details displayed |

**Result:** ☐ Pass ☐ Fail  
**Notes:**

---

### Test 1.3: Pro Sees Connected Client
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log out of Client 1 | Redirected to login |
| 2 | Log in as **Pro A** | Dashboard loads |
| 3 | Go to Client Management | Client list page loads |
| 4 | Check connected clients | Client 1 appears in active list |

**Result:** ☐ Pass ☐ Fail  
**Notes:**

---

### Test 1.4: Permission Verification
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | As **Pro A**, view Client 1's permissions | Permission list displays |
| 2 | Verify default permissions granted | Basic view permissions active |

**Result:** ☐ Pass ☐ Fail  
**Notes:**

---

## Phase 2: Multi-Connection Scenarios

### Test 2.1: Client Connects to Second Pro
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as **Pro B** | Dashboard loads |
| 2 | Send invitation to **Client 1** | Success message |
| 3 | Log in as **Client 1** | See pending invitation from Pro B |
| 4 | Accept invitation from Pro B | Success confirmation |
| 5 | Navigate to Train page | BOTH Pro A and Pro B visible |
| 6 | Can switch between pros | Switching works correctly |

**Result:** ☐ Pass ☐ Fail  
**Notes:**

---

### Test 2.2: Pro with Multiple Clients
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as **Pro A** | Dashboard loads |
| 2 | Send invitation to **Client 2** | Success message |
| 3 | Log in as **Client 2** | See pending invitation |
| 4 | Accept invitation | Success confirmation |
| 5 | Log in as **Pro A** | Dashboard loads |
| 6 | Check Client Management | Both Client 1 and Client 2 listed |

**Result:** ☐ Pass ☐ Fail  
**Notes:**

---

### Test 2.3: Exclusivity Check
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | If system has exclusive categories | Document behavior |
| 2 | Attempt second pro connection in same category | Should be blocked with clear error |

**Result:** ☐ Pass ☐ Fail ☐ N/A  
**Notes:**

---

## Phase 3: Breaking Connections

### Test 3.1: Pro Ends Connection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as **Pro A** | Dashboard loads |
| 2 | Go to Client Management | Client list displays |
| 3 | End/disconnect from **Client 2** | Confirmation dialog |
| 4 | Confirm disconnection | Success message |
| 5 | Verify Client 2 removed from list | No longer in active clients |
| 6 | Log in as **Client 2** | Dashboard loads |
| 7 | Check Train page | Pro A no longer appears |

**Result:** ☐ Pass ☐ Fail  
**Notes:**

---

### Test 3.2: Client Ends Connection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as **Client 1** | Dashboard loads |
| 2 | Find option to end relationship with **Pro B** | Option available |
| 3 | End the connection | Confirmation dialog |
| 4 | Confirm disconnection | Success message |
| 5 | Verify Pro B removed | No longer in Train page |
| 6 | Log in as **Pro B** | Dashboard loads |
| 7 | Check Client Management | Client 1 no longer in active list |

**Result:** ☐ Pass ☐ Fail  
**Notes:**

---

### Test 3.3: Re-Invite After Termination
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as **Pro A** | Dashboard loads |
| 2 | Send new invitation to **Client 2** | Success (not blocked by previous relationship) |
| 3 | Log in as **Client 2** | See pending invitation |
| 4 | Accept invitation | Success confirmation |
| 5 | Verify connection re-established | Both sides show active connection |

**Result:** ☐ Pass ☐ Fail  
**Notes:**

---

## Phase 4: Account Switching Edge Cases

### Test 4.1: Rapid Account Switch
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as **Pro A** | Dashboard loads |
| 2 | Log out | Redirected to login |
| 3 | Immediately log in as **Client 1** | Dashboard loads |
| 4 | Navigate to Train page | Correct professional info (not stale Pro A data) |

**Result:** ☐ Pass ☐ Fail  
**Notes:**

---

### Test 4.2: Multiple Browser Tabs
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Tab 1: Log in as **Pro A** | Dashboard loads |
| 2 | Open Tab 2 (incognito): Log in as **Client 1** | Dashboard loads |
| 3 | In Tab 1, perform actions as Pro A | Actions succeed |
| 4 | In Tab 2, navigate Train page | Correct client data, no crossover |

**Result:** ☐ Pass ☐ Fail  
**Notes:**

---

### Test 4.3: Portal Context Switch (Dual-Role Account)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in with account having BOTH pro and client roles | Role selector appears |
| 2 | Select Pro Portal | Pro dashboard loads |
| 3 | Switch to Client Portal | Client dashboard loads correctly |
| 4 | Verify data is correct for each portal | No data bleeding between contexts |

**Result:** ☐ Pass ☐ Fail ☐ N/A (no dual-role test account)  
**Notes:**

---

## Phase 5: Invitation Edge Cases

### Test 5.1: Resend Invitation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as **Pro A** | Dashboard loads |
| 2 | Send invitation to test email | Success message |
| 3 | Resend invitation before acceptance | Works without error |

**Result:** ☐ Pass ☐ Fail  
**Notes:**

---

### Test 5.2: Invalid/Expired Token
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Get an invitation link | Copy the URL |
| 2 | Modify the token in URL | Change random characters |
| 3 | Try to accept with invalid token | Clear error message shown |

**Result:** ☐ Pass ☐ Fail  
**Notes:**

---

### Test 5.3: Cancel Pending Invitation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as **Pro A** | Dashboard loads |
| 2 | Send invitation to new email | Success message |
| 3 | Cancel/revoke the invitation | Success confirmation |
| 4 | Attempt to accept cancelled invitation | Error: invitation no longer valid |

**Result:** ☐ Pass ☐ Fail  
**Notes:**

---

## Logging Checklist

For each failed test, document:

- [ ] Exact error message (copy text)
- [ ] Network tab errors (403/404/500 status codes)
- [ ] Console errors (any JavaScript errors)
- [ ] Screenshot of unexpected behavior
- [ ] Steps to reproduce

---

## Summary

| Phase | Tests Passed | Tests Failed | Notes |
|-------|--------------|--------------|-------|
| Phase 1: Single Connection | /4 | | |
| Phase 2: Multi-Connection | /3 | | |
| Phase 3: Breaking Connections | /3 | | |
| Phase 4: Account Switching | /3 | | |
| Phase 5: Invitation Edge Cases | /3 | | |
| **TOTAL** | **/16** | | |

---

## Known Issues Found

| Issue # | Description | Steps to Reproduce | Severity |
|---------|-------------|-------------------|----------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

---

## Test Environment

- **Date Tested:** 
- **Browser:** 
- **Tester:** 
- **App Version/Commit:** 
