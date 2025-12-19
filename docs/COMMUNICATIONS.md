# In-App Communication System

## Overview

Enable direct communication between professionals and clients within LOBA Tracker, supporting text messaging, voice memos, and notifications. This eliminates dependency on external messaging apps and keeps all trainer-client interactions within the platform.

**Status:** Phase 6A-6E Complete (Core messaging system ready)  
**Estimated Effort:** 6-7 weeks (single developer)  
**Dependencies:** Active professional-client relationships (Phase 4 complete)

---

## Why This Matters

### Current Pain Points
- Trainers use WhatsApp/Telegram/SMS to communicate with clients (fragmented)
- Communication history is lost when switching platforms
- No integration between check-in feedback and messaging
- Clients can't easily ask quick questions about workouts
- No audit trail for professional accountability

### Business Value
- **Stickiness:** Keep users in-app, reducing churn
- **Professional experience:** Unified workspace for trainers
- **Prerequisite for Marketplace:** "Contact Professional" CTA needs messaging
- **Premium feature potential:** Voice memos, read receipts, priority support

---

## Scope Decisions

### MVP Features (Confirmed)

| Feature | Status | Notes |
|---------|--------|-------|
| Text messaging | ✅ MVP | Fundamental |
| Real-time delivery | ✅ MVP | Expected UX |
| Unread badges | ✅ MVP | Essential feedback |
| Message history | ✅ MVP | Pagination required |
| Voice memos | ✅ MVP | Adds 5-7 days |
| Push notifications | ✅ MVP | Complex (5-7 days) |
| Typing indicators | ❌ V2 | Nice polish |
| Read receipts | ❌ V2 | Privacy concerns |
| File attachments | ❌ V2 | Scope TBD - what files needed? |
| Message reactions | ❌ V2 | Polish |
| Message editing | ❌ V2 | Audit concerns |
| Group messaging | ❌ V2 | Different architecture |

### Confirmed MVP Scope
1. **Text messaging** with real-time WebSocket delivery
2. **Voice memos** (2-minute limit, 14-day expiry, then auto-delete)
3. **In-app notifications** (badges, notification center)
4. **Push notifications** (FCM for Android/Chrome, limited iOS support)
5. **No read receipts** (privacy-first approach)
6. **No typing indicators** (deferred to V2)

---

## Technical Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│  Chat UI     │  Voice UI    │ Notification │ WebSocket Manager │
│  Component   │  Component   │   Center     │   (Context)       │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬──────────┘
       │              │              │                │
       ▼              ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express Backend                               │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│  REST API    │  WebSocket   │  Cleanup     │  Storage          │
│  /api/chat/* │  Server      │  Jobs        │  Service          │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬──────────┘
       │              │              │                │
       ▼              ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase                                    │
├──────────────┬──────────────┬──────────────────────────────────┤
│  PostgreSQL  │  Realtime    │  Storage (voice-memos bucket)    │
│  (tables)    │  (optional)  │                                   │
└──────────────┴──────────────┴──────────────────────────────────┘
```

### Database Schema

```sql
-- 1. Conversations (one per professional-client pair)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES profiles(id),
  client_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT, -- First 100 chars for list view
  UNIQUE(professional_id, client_id)
);

-- 2. Text messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- 'text', 'voice', 'system'
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

-- 3. Voice memos (stored in Supabase Storage)
CREATE TABLE voice_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  file_size_bytes INTEGER,
  waveform_data JSONB, -- Pre-computed for display
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days'),
  deleted_at TIMESTAMPTZ -- Soft delete for cleanup tracking
);

-- 4. Unread message counts (materialized for performance)
CREATE TABLE unread_counts (
  user_id UUID NOT NULL REFERENCES profiles(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  unread_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);

-- 5. Notification preferences
CREATE TABLE messaging_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id),
  notifications_enabled BOOLEAN DEFAULT true,
  sound_enabled BOOLEAN DEFAULT true,
  quiet_hours_start TIME, -- e.g., 22:00
  quiet_hours_end TIME,   -- e.g., 07:00
  muted_conversations UUID[], -- Array of conversation IDs
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_messages_conversation_sent ON messages(conversation_id, sent_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_conversations_professional ON conversations(professional_id, last_message_at DESC);
CREATE INDEX idx_conversations_client ON conversations(client_id, last_message_at DESC);
CREATE INDEX idx_voice_messages_expires ON voice_messages(expires_at) WHERE deleted_at IS NULL;
```

### Row-Level Security (RLS)

```sql
-- conversations: Only participants can see
CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = professional_id OR auth.uid() = client_id);

-- messages: Only conversation participants can see
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE professional_id = auth.uid() OR client_id = auth.uid()
    )
  );

-- messages: Only participants can send
CREATE POLICY "Users can send messages to their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT id FROM conversations
      WHERE professional_id = auth.uid() OR client_id = auth.uid()
    )
  );
```

### WebSocket Protocol

```typescript
// Client → Server
interface ClientMessage {
  type: 'auth' | 'send_message' | 'typing_start' | 'typing_stop' | 'mark_read';
  payload: {
    token?: string;           // For auth
    conversationId?: string;
    content?: string;         // For send_message
    messageId?: string;       // For mark_read
  };
}

// Server → Client
interface ServerMessage {
  type: 'auth_success' | 'auth_error' | 'new_message' | 'message_delivered' | 
        'typing' | 'unread_update' | 'error';
  payload: {
    userId?: string;
    message?: Message;
    conversationId?: string;
    unreadCount?: number;
    error?: string;
  };
}
```

---

## API Endpoints

### Conversations

```typescript
// List conversations for current user
GET /api/messages/conversations
Response: {
  conversations: Array<{
    id: string;
    other_user: { id, name, avatar_url, role };
    last_message: { content, sent_at, sender_id } | null;
    unread_count: number;
  }>;
}

// Get or create conversation with user
POST /api/messages/conversations
Request: { other_user_id: string }
Response: { conversation: Conversation }

// Get conversation details
GET /api/messages/conversations/:id
Response: { conversation, other_user, unread_count }
```

### Messages

```typescript
// List messages (paginated)
GET /api/messages/conversations/:id/messages?before=<timestamp>&limit=50
Response: {
  messages: Array<Message>;
  has_more: boolean;
}

// Send text message
POST /api/messages/conversations/:id/messages
Request: { content: string }
Response: { message: Message }

// Mark messages as read
POST /api/messages/conversations/:id/read
Request: { up_to_message_id: string }
Response: { success: true }
```

### Voice Memos

```typescript
// Upload voice memo
POST /api/messages/conversations/:id/voice
Request: FormData { audio: Blob, duration_seconds: number }
Response: { message: Message, voice_message: VoiceMessage }

// Get voice memo playback URL (signed, 1-hour expiry)
GET /api/messages/voice/:id/url
Response: { url: string, expires_at: string }
```

### Notifications

```typescript
// Get total unread count
GET /api/messages/unread-count
Response: { total: number }

// Get notification preferences
GET /api/messages/preferences
Response: { preferences: MessagingPreferences }

// Update preferences
PUT /api/messages/preferences
Request: Partial<MessagingPreferences>
Response: { preferences: MessagingPreferences }
```

---

## Frontend Components

### Component Hierarchy

```
<MessagingProvider>              -- WebSocket connection + state
├── <UnreadBadge />              -- Shows total unread (header/nav)
├── <ConversationList />         -- Left panel in messages page
│   └── <ConversationItem />     -- Single conversation row
├── <ChatView />                 -- Main chat interface
│   ├── <ChatHeader />           -- Other user info, actions
│   ├── <MessageList />          -- Virtualized message list
│   │   ├── <TextMessage />      -- Text bubble
│   │   └── <VoiceMessage />     -- Playable voice memo
│   └── <ChatInput />            -- Text input + voice button
│       └── <VoiceRecorder />    -- Recording UI
└── <NotificationCenter />       -- Dropdown with recent messages
```

### Key UI States

1. **Empty state:** No conversations yet
2. **Loading state:** Fetching messages (skeleton)
3. **Real-time update:** New message slides in
4. **Sending state:** Message shows "sending..." 
5. **Failed state:** Message shows retry option
6. **Recording state:** Waveform preview, timer, cancel/send
7. **Playback state:** Play/pause, progress bar, duration

### Voice Recording Flow

```
[Tap mic] → [Recording: waveform + timer] → [Release/Tap]
    ↓                                            ↓
[Cancel button]                          [Preview + Send]
    ↓                                            ↓
[Discard]                               [Upload → Message sent]
```

---

## Implementation Phases

### Phase 6A: Database + Backend Foundation (1 week)

| Task | Days | Details |
|------|------|---------|
| Database migration | 1 | Tables, indexes, RLS policies |
| Conversation APIs | 1 | List, create, get |
| Message APIs | 1.5 | Send, list (paginated), mark read |
| Unread count logic | 0.5 | Materialized counts, triggers |
| Unit tests | 1 | API endpoint tests |

**Deliverable:** REST APIs working, can send/receive via Postman

### Phase 6B: WebSocket Real-Time Layer (1 week)

| Task | Days | Details |
|------|------|---------|
| WebSocket server setup | 1 | Auth, connection management |
| Message broadcast | 1 | Real-time delivery to recipient |
| Connection state management | 1 | Reconnection, heartbeat |
| React WebSocket context | 1 | Hook for components |
| Integration testing | 1 | End-to-end message flow |

**Deliverable:** Messages delivered in real-time between users

### Phase 6C: Chat UI (1.5 weeks)

| Task | Days | Details |
|------|------|---------|
| ConversationList component | 1 | List, search, unread badges |
| ChatView component | 1.5 | Message list, input |
| Message bubbles | 1 | Text, timestamps, status |
| Infinite scroll | 1 | Load older messages |
| Routing + pages | 0.5 | /messages, /messages/:id |
| Responsive design | 1 | Mobile-first, desktop split view |
| Integration with nav | 0.5 | Unread badge in header/sidebar |

**Deliverable:** Fully functional text chat

### Phase 6D: Voice Memos (1 week)

| Task | Days | Details |
|------|------|---------|
| Supabase Storage bucket | 0.5 | voice-memos bucket, RLS |
| MediaRecorder integration | 1 | Browser audio recording |
| Upload flow | 1 | Compress, upload, create message |
| Playback component | 1 | Audio player, progress bar |
| Waveform visualization | 0.5 | Optional: pre-compute or live |
| Expiry cleanup job | 0.5 | Delete expired voice files |
| Error handling | 0.5 | Browser compatibility, permissions |

**Deliverable:** Voice memos working end-to-end

### Phase 6E: Notifications + Polish (1 week)

| Task | Days | Details |
|------|------|---------|
| Notification center UI | 1 | Dropdown with recent messages |
| Preferences UI | 0.5 | Mute, quiet hours |
| Sound effects | 0.5 | New message sound |
| Empty states | 0.5 | No conversations, no messages |
| Error states | 0.5 | Failed send, offline mode |
| Accessibility | 0.5 | Keyboard nav, screen readers |
| Performance tuning | 1 | Virtualization, lazy loading |
| Testing + bug fixes | 0.5 | End-to-end verification |

**Deliverable:** Production-ready messaging system

### Phase 6F: Push Notifications (Optional, +1 week)

| Task | Days | Details |
|------|------|---------|
| Service worker setup | 1 | Registration, background sync |
| FCM integration | 2 | Server-side, client subscription |
| Permission flow | 0.5 | Ask for notification permission |
| Notification handling | 1 | Click to open conversation |
| iOS PWA considerations | 0.5 | Limited support, fallbacks |

**Deliverable:** Push notifications on supported devices

---

## Effort Summary

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 6A: Database + Backend | 5 days | Week 1 |
| 6B: WebSocket Layer | 5 days | Week 2 |
| 6C: Chat UI | 7.5 days | Week 3-4 |
| 6D: Voice Memos | 5 days | Week 4-5 |
| 6E: Notifications + Polish | 5 days | Week 5-6 |
| 6F: Push Notifications | 5 days | Week 6-7 |

**Total MVP:** 32.5 days (~6-7 weeks)

*Note: Estimates assume single developer, focused work. Add buffer for integration issues, testing, and iteration.*

---

## Technical Risks & Mitigations

### 1. WebSocket Reliability
**Risk:** Connection drops, missed messages  
**Mitigation:** 
- Implement reconnection with exponential backoff
- Store messages in DB first, then broadcast (no message loss)
- Client fetches missed messages on reconnect

### 2. Browser Audio Recording Compatibility
**Risk:** MediaRecorder API varies across browsers  
**Mitigation:**
- Use `audio/webm;codecs=opus` (best support)
- Fallback to `audio/mp4` for Safari
- Clear error message if unsupported

### 3. Voice Memo Storage Costs
**Risk:** Large files accumulate  
**Mitigation:**
- 2-minute limit (~200KB-400KB per memo)
- 14-day auto-expiry (then hard delete)
- Compression before upload
- Storage monitoring alerts

### 4. Mobile PWA Limitations
**Risk:** Push notifications unreliable on iOS  
**Mitigation:**
- Clear messaging: "Push works best on Android/Chrome"
- In-app notification center as primary
- Email digest fallback (future)

---

## Integration Points

### With Existing Features

| Feature | Integration |
|---------|-------------|
| Check-ins (Phase 5.5) | "Send as message" for AI suggestions |
| ProClientView | Quick message button in header |
| Client Dashboard | "Message your trainer" CTA |
| Professional Marketplace | "Contact" button on profiles |
| Permission System | New permission: `messaging` (shared) |

### New Permission Type

```sql
INSERT INTO permission_definitions (key, name, description, category, is_exclusive)
VALUES (
  'messaging',
  'Direct Messaging',
  'Send and receive messages with this professional',
  'shared',
  false -- Both parties always have this for any active relationship
);
```

*Decision needed: Is messaging implicit with any connection, or a separate permission?*

---

## Files to Create

```
supabase/migrations/
  031_messaging_schema.sql        -- Tables, indexes, RLS

server/
  messaging-routes.ts             -- REST API handlers
  messaging-websocket.ts          -- WebSocket server
  voice-memo-service.ts           -- Storage + cleanup

client/src/
  lib/messaging.ts                -- React Query hooks
  context/MessagingContext.tsx    -- WebSocket provider
  components/messaging/
    ConversationList.tsx
    ConversationItem.tsx
    ChatView.tsx
    ChatInput.tsx
    MessageBubble.tsx
    VoiceRecorder.tsx
    VoicePlayer.tsx
    UnreadBadge.tsx
    NotificationCenter.tsx
  pages/
    Messages.tsx                  -- /messages route
```

---

## Decisions Made

1. **Messaging is implicit with connection**  
   Any connected professional-client pair can message automatically - no separate permission needed.

2. **Free for all users**  
   Messaging is included for all connected pairs, not a premium feature.

3. **Retention policy**  
   - Text messages: Keep forever
   - Voice memos: Expire after 14 days, then auto-delete from storage

---

## Open Questions (V2)

1. **File attachments - what types?**  
   PDFs, images, workout screenshots? Need to define scope and moderation approach.

---

## Success Metrics

- **Adoption:** % of pro-client pairs with >5 messages
- **Engagement:** Messages per active user per week
- **Voice usage:** % of messages that are voice memos
- **Response time:** Average time to first reply
- **Retention impact:** Churn rate for users with vs. without messaging

---

## Implementation Progress

### Phase 6A: Database + Backend Foundation (COMPLETE)

- [x] **Database migration (031_messaging_schema.sql)**
  - [x] Create `conversations` table with professional_id, client_id, timestamps
  - [x] Create `messages` table with content, sender, delivery/read tracking
  - [x] Create `voice_messages` table with storage path, duration, expiry
  - [x] Create `unread_counts` table for materialized unread counts
  - [x] Create `messaging_preferences` table for notifications settings
  - [x] Add performance indexes on conversation lookups and message retrieval
  - [x] Enable RLS on all tables

- [x] **RLS Policies**
  - [x] Conversations: participants can select, professionals can insert
  - [x] Messages: conversation participants can select/insert, sender can update delivery status
  - [x] Voice messages: linked to message ownership via conversation
  - [x] Unread counts: user can only view/update their own
  - [x] Preferences: user can only view/modify their own

- [x] **Triggers and RPC Functions**
  - [x] `increment_unread_count` trigger on message insert (determines recipient from conversation, not auth.uid())
  - [x] `get_or_create_conversation(p_current_user_id, p_other_user_id)` RPC with relationship verification
  - [x] `mark_messages_read(p_user_id, p_conversation_id, p_up_to_message_id)` RPC
  - [x] `get_total_unread_count(p_user_id)` RPC
  - [x] `cleanup_expired_voice_memos()` RPC for scheduled cleanup
  - [x] All RPCs accept explicit user_id for service-role compatibility (no auth.uid() dependency)

- [x] **Backend Data Layer (server/supabase-messaging-data.ts)**
  - [x] Conversation functions: getOrCreateConversation, getConversationsForUser, getConversationById, canAccessConversation
  - [x] Message functions: getMessagesForConversation, sendMessage, markMessagesAsRead, updateDeliveryStatus
  - [x] Voice memo functions: createVoiceMessage, getVoiceMessageById, getSignedVoiceUrl, markVoiceMemoListened
  - [x] Unread functions: getTotalUnreadCount, getUnreadCountsForUser
  - [x] Preferences functions: getMessagingPreferences, updateMessagingPreferences, registerPushToken

- [x] **REST API Routes (server/routes.ts)**
  - [x] `GET /api/messages/conversations` - List user's conversations
  - [x] `POST /api/messages/conversations` - Get or create conversation
  - [x] `GET /api/messages/conversations/:id` - Get conversation details
  - [x] `GET /api/messages/conversations/search` - Search conversations
  - [x] `GET /api/messages/conversations/:id/messages` - Get messages (paginated)
  - [x] `POST /api/messages/conversations/:id/messages` - Send message
  - [x] `POST /api/messages/conversations/:id/read` - Mark messages as read
  - [x] `GET /api/messages/unread-count` - Get total unread count
  - [x] `GET /api/messages/preferences` - Get preferences
  - [x] `PUT /api/messages/preferences` - Update preferences
  - [x] `POST /api/messages/push-token` - Register push token
  - [x] All routes use requireSupabaseAuth middleware and validate with Zod

- [x] **React Query Hooks (client/src/lib/messaging.ts)**
  - [x] `useConversations()` - Fetch all conversations
  - [x] `useConversation(id)` - Fetch single conversation
  - [x] `useMessages(conversationId)` - Fetch messages with pagination
  - [x] `useCreateConversation()` - Mutation to get/create conversation
  - [x] `useSendMessage()` - Mutation to send message
  - [x] `useMarkMessagesRead()` - Mutation to mark messages read
  - [x] `useTotalUnreadCount()` - Fetch total unread badge count
  - [x] `useMessagingPreferences()` - Fetch preferences
  - [x] `useUpdateMessagingPreferences()` - Update preferences mutation
  - [x] Proper cache invalidation patterns for all mutations

- [x] **Security Review**
  - [x] Verified relationship check in get_or_create_conversation (joins professional_client_relationships)
  - [x] Confirmed no auth.uid() in triggers/RPCs (service-role safe)
  - [x] All auth.uid() usage confined to RLS policies (correct)
  - [x] API routes verify conversation access before operations

**Phase 6A Deliverable:** REST APIs working, database schema ready. Migration 031 needs manual application to Supabase.

---

### Phase 6B: WebSocket Real-Time Layer (COMPLETE)

**Architecture Decisions:**
- Use native `ws` package (already installed) instead of Supabase Realtime
- Attach WebSocket server to existing httpServer from Express
- In-memory connection registry (sufficient for single-node; Redis needed for horizontal scale)
- JWT auth on first message, not URL params (more secure)

**Message Protocol (MVP):**

| Direction | Type | Payload | Purpose |
|-----------|------|---------|---------|
| Client→Server | `auth` | `{token}` | Authenticate connection |
| Client→Server | `ping` | - | Heartbeat |
| Server→Client | `auth_ok` | `{userId}` | Auth success |
| Server→Client | `auth_error` | `{error}` | Auth failed |
| Server→Client | `new_message` | `{message}` | Real-time message delivery |
| Server→Client | `message_delivered` | `{messageId, conversationId, deliveredAt}` | Delivery confirmation |
| Server→Client | `unread_update` | `{conversationId, unreadCount}` | Badge update |
| Server→Client | `pong` | - | Heartbeat response |

**Tasks:**

- [x] **WebSocket Server Bootstrap**
  - [x] Create WebSocket server module (server/websocket.ts)
  - [x] Attach to httpServer in server startup
  - [x] Export init/teardown helpers for tests

- [x] **Auth Handshake & Connection Registry**
  - [x] Implement auth message handling
  - [x] Verify Supabase JWT using existing validateSupabaseToken
  - [x] Build in-memory Map<userId, Set<WebSocket>>
  - [x] Handle disconnection cleanup

- [x] **Protocol & Message Types**
  - [x] Define TypeScript types for all message types
  - [x] JSON parsing with error handling
  - [x] Validation of incoming messages

- [x] **Real-Time Message Delivery**
  - [x] Hook REST POST /messages to broadcast new_message
  - [x] Update delivery_status when recipient socket connected
  - [x] Emit message_delivered to sender with conversationId
  - [x] Handle offline recipients (no-op, unread already in DB)

- [x] **Heartbeat & Connection Health**
  - [x] Implement ping/pong mechanism
  - [x] 30-second ping interval
  - [x] Cleanup sockets that don't respond

- [x] **Frontend MessagingProvider**
  - [x] Create WebSocket context (client/src/contexts/MessagingContext.tsx)
  - [x] useMessaging() hook for connection state
  - [x] Reconnection with exponential backoff
  - [x] Merge new_message events into React Query cache
  - [x] Update unread counts on unread_update events
  - [x] Handle message_delivered for cache invalidation

- [x] **Unread Update Notifications**
  - [x] Emit unread_update to both participants when messages marked as read
  - [x] Bilateral notifications ensure both sides' badges stay in sync

**Phase 6B Deliverable:** Messages delivered in real-time between connected users

**Implementation Notes:**
- WebSocket URL: `wss://{host}/ws` (or custom via `VITE_WS_URL`)
- Auth sent as first message after connection (not in URL)
- Connection auto-reconnects with exponential backoff (1s, 2s, 4s, 8s, 16s, 30s)
- All messaging WebSocket logs prefixed with `[ws]` to distinguish from Vite HMR noise
- Vite HMR WebSocket errors in browser console are Replit-specific and unrelated to messaging

**WebSocket URL Configuration:**

| Environment | VITE_WS_URL | Behavior |
|-------------|-------------|----------|
| Local dev | Unset | Uses `ws://localhost:{port}/ws` from window.location |
| Replit | Unset | Uses `wss://{repl-host}/ws` from window.location |
| Production (same-origin) | Unset | Uses `wss://{host}/ws` from window.location |
| Production (separate backend) | Set full URL | Uses provided URL, e.g., `wss://api.example.com/ws` |

The `resolveWsUrl()` helper validates URLs and logs which source is being used.

---

### Phase 6C: Chat UI (COMPLETE)

**Design Decisions:**
- Mobile-first design - NO sidebar for messages navigation
- Mobile: Full-screen conversation list → tap → full-screen chat view
- Desktop (≥768px): Split panel layout (list on left, chat on right)
- Professionals access via: client cards, ProClientView header, Messages page
- Clients access via: "My Pro" tab, Messages page
- Future-proof: Supports multiple professionals per client (each shown with role badge)

**Routing:**

| Route | Mobile | Desktop |
|-------|--------|---------|
| `/messages` | Full-screen list | Split: list (left) + empty state (right) |
| `/messages/:id` | Full-screen chat | Split: list (left) + chat (right) |
| `/pro/messages` | Full-screen list | Split: list (left) + empty state (right) |
| `/pro/messages/:id` | Full-screen chat | Split: list (left) + chat (right) |

**Component Hierarchy:**

```
/messages (MessagesList page)
├── ConversationListItem (repeated)
│   ├── Avatar
│   ├── Name + Role Badge (e.g., "Sarah - Personal Trainer")
│   ├── Last message preview + timestamp
│   └── Unread count badge

/messages/:id (ConversationView page)
├── ChatHeader (other user info, back button on mobile)
├── MessageList (scrollable, infinite scroll up)
│   └── MessageBubble (repeated, sent/received styling)
├── ChatComposer (text input + send button)
└── Connection status indicator (optional)
```

**File Structure:**

| File | Purpose |
|------|---------|
| `client/src/pages/MessagesList.tsx` | Conversation list page |
| `client/src/pages/ConversationView.tsx` | Individual chat page |
| `client/src/pages/Messages.tsx` | Responsive container (mobile stack / desktop split) |
| `client/src/components/messages/ConversationListItem.tsx` | Single conversation row |
| `client/src/components/messages/MessageBubble.tsx` | Message display (sent/received) |
| `client/src/components/messages/ChatComposer.tsx` | Text input + send |
| `client/src/components/messages/ChatHeader.tsx` | Chat header with back button |
| `client/src/components/messages/MessageButton.tsx` | Entry point button (get-or-create + navigate) |

**Tasks:**

- [x] **Routing Setup**
  - [x] Register `/messages` and `/messages/:id` routes in App.tsx (client app)
  - [x] Register `/pro/messages` and `/pro/messages/:id` routes (professional app)
  - [x] Pro/client context detection via URL path for correct navigation

- [x] **MessagesList Page**
  - [x] Query conversations using `useConversations()`
  - [x] Sort by `last_message_at` descending
  - [x] Show other user's name + role badge
  - [x] Display last message preview + relative timestamp
  - [x] Show unread count badge per conversation
  - [x] Loading skeleton state
  - [x] Empty state ("No conversations yet")
  - [x] Click to navigate to context-aware route (`/messages/:id` or `/pro/messages/:id`)

- [x] **ConversationView Page**
  - [x] Chat header with other user info
  - [x] Back button (mobile) returns to context-aware list route
  - [x] Query messages using `useMessages(conversationId)`
  - [x] Auto-scroll to bottom on new messages
  - [x] Mark messages as read on mount/focus using `useMarkMessagesRead()`
  - [x] Fixed: Real-time mark-as-read when new messages arrive while viewing

- [x] **MessageBubble Component**
  - [x] Sent messages: right-aligned, primary color
  - [x] Received messages: left-aligned, muted color
  - [x] Timestamp display
  - [x] Voice message placeholder (message_type check)

- [x] **ChatComposer Component**
  - [x] Text input field
  - [x] Send button (disabled when empty or sending)
  - [x] Use `useSendMessage()` mutation
  - [x] Clear input on successful send
  - [x] Voice button placeholder (for Phase 6D)

- [x] **Desktop Split Layout**
  - [x] Responsive breakpoint at ≥768px (md: breakpoint)
  - [x] List panel: fixed width (~320px)
  - [x] Chat panel: flexible width
  - [x] Keep list visible while viewing conversation
  - [x] Highlight selected conversation in list

- [x] **Entry Points**
  - [x] Add "Message" button to client cards (ProDashboard via ClientQuickActions)
  - [x] Add "Message" icon button to ProClientView header
  - [x] Add "Message" button to "My Pro" section (Client Dashboard)
  - [x] MessageButton component handles get-or-create and navigates to conversation

**Data Flow:**
- `useConversations()` → fetches list with last message preview
- `useMessages(id)` → fetches paginated messages for conversation
- `useSendMessage()` → sends message, invalidates queries
- `useMarkMessagesRead()` → marks read, triggers unread_update via WebSocket
- MessagingContext → real-time updates invalidate React Query caches

**Implementation Notes:**
- Pro/client context detected from `location.pathname.startsWith('/pro')`
- MessageButton uses `useCreateConversation()` to get-or-create before navigation
- Mark-as-read tracks `lastMarkedMessageIdRef` to handle incoming messages while viewing
- Desktop split view uses CSS grid with responsive `hidden md:block` classes

**Phase 6C Deliverable:** Fully functional text chat interface with mobile-first design and desktop split view

---

### Phase 6D: Voice Memos (COMPLETE)

- [x] **Supabase Storage Setup**
  - [x] Create voice-memos bucket (SQL provided, needs manual creation)
  - [x] RLS policies for bucket access
  - [x] Signed URL generation (1-hour expiry)

- [x] **MediaRecorder Integration**
  - [x] Browser audio recording (VoiceRecorder.tsx)
  - [x] Waveform visualization during recording
  - [x] 2-minute maximum duration (auto-stop)
  - [x] Cancel/confirm recording flow

- [x] **Upload Flow**
  - [x] Compress audio (WebM/Opus primary, MP4/AAC Safari fallback)
  - [x] Upload to Supabase Storage via REST API
  - [x] Create voice_messages record
  - [x] Link to message record

- [x] **Playback Component**
  - [x] Audio player with play/pause (VoicePlayer.tsx)
  - [x] Progress bar with seek
  - [x] Duration display
  - [x] Expired memo handling with user-friendly message

- [x] **Expiry Cleanup**
  - [x] cleanup_expired_voice_memos RPC function created
  - [x] Delete expired files from storage
  - [x] 14-day retention policy (cron job needs external scheduling)

**Phase 6D Deliverable:** Voice memos working end-to-end

---

### Phase 6E: Notifications + Polish (COMPLETE)

- [x] **Notification Center UI**
  - [x] Dropdown in header (NotificationCenter.tsx)
  - [x] Recent messages list with unread badges
  - [x] Click to navigate to conversation

- [x] **Preferences UI**
  - [x] Toggle notifications on/off (MessagingPreferences.tsx)
  - [x] Toggle sounds on/off
  - [x] Quiet hours configuration (including overnight ranges)
  - [x] Mute individual conversations

- [x] **Sound Effects**
  - [x] New message notification sound (notificationSound.ts)
  - [x] Preference-gated playback (waits for preferences to load)
  - [x] Respects quiet hours, muted conversations, sound/notifications toggles

- [x] **Empty States**
  - [x] No conversations yet (MessagesList empty state)
  - [x] No messages in conversation
  - [x] Encouraging CTAs

- [x] **Error States**
  - [x] Failed to send message (retry option)
  - [x] Voice recording errors (browser compatibility)
  - [x] Connection error handling

- [x] **Accessibility**
  - [x] Keyboard navigation throughout
  - [x] Screen reader support (aria-labels, aria-live)
  - [x] Focus management in modals/dialogs

- [x] **Performance**
  - [x] React Query caching and invalidation
  - [x] Lazy loading of voice memo signed URLs
  - [x] Optimized re-renders with refs

**Phase 6E Deliverable:** Production-ready messaging system

---

### Phase 6F: Push Notifications (OPTIONAL)

- [ ] **Service Worker**
  - [ ] Registration
  - [ ] Background sync
  - [ ] Notification display

- [ ] **FCM Integration**
  - [ ] Server-side FCM setup
  - [ ] Client subscription flow
  - [ ] Token storage

- [ ] **Permission Flow**
  - [ ] Request notification permission
  - [ ] Handle denial gracefully
  - [ ] Settings to revoke

- [ ] **Notification Handling**
  - [ ] Click to open conversation
  - [ ] Badge update
  - [ ] Quiet hours respect

**Phase 6F Deliverable:** Push notifications on supported devices

---

## Testing Notes

### Manual Testing Checklist

#### Text Messaging
- [ ] Send text message from client to professional
- [ ] Send text message from professional to client
- [ ] Verify real-time delivery via WebSocket
- [ ] Verify message persistence after page refresh
- [ ] Test message ordering (newest at bottom)
- [ ] Test long messages with word wrapping
- [ ] Test empty message prevention

#### Voice Memos
- [ ] Record voice memo (test 2-minute limit auto-stop)
- [ ] Preview before sending
- [ ] Cancel recording (discard audio)
- [ ] Send voice memo
- [ ] Play received voice memo
- [ ] Test expiry display for old memos (14-day limit)
- [ ] Verify WebM format in Chrome/Firefox
- [ ] Verify MP4 fallback in Safari

#### WebSocket Real-time
- [ ] Verify connection on login
- [ ] Verify reconnection after network drop
- [ ] Verify ping/pong heartbeat (25s interval)
- [ ] Verify graceful disconnect on logout
- [ ] Check console for `[ws]` logs showing successful auth

#### Notification Center
- [ ] Unread badge count updates correctly
- [ ] Click conversation navigates to chat
- [ ] Recent conversations sorted by last message
- [ ] Empty state shows for no messages

#### Messaging Preferences
- [ ] Toggle notifications enabled/disabled
- [ ] Toggle sounds enabled/disabled
- [ ] Set quiet hours start/end time (including overnight ranges like 22:00-07:00)
- [ ] Mute individual conversations
- [ ] Preferences persist after page refresh
- [ ] Sound blocked until preferences load on session start (race condition protection)
- [ ] Sound respects all conditions: preferences loaded, sound_enabled, notifications_enabled, not muted, not in quiet hours

#### Accessibility
- [ ] All buttons have aria-labels
- [ ] Voice player has progress bar role
- [ ] Recording state announced via aria-live
- [ ] Keyboard navigation works throughout

### Known Issues & Limitations

1. **Vite HMR WebSocket Error**: Browser console shows `wss://localhost:undefined` errors from Vite's HMR client - this is a Replit environment issue and does not affect the messaging WebSocket (which logs `[ws]` prefix).

2. **Voice Memo Storage Bucket**: The `voice-memos` Supabase Storage bucket needs manual creation with RLS policies. See schema section for SQL.

3. **Voice Memo Cleanup**: The `cleanup_expired_voice_memos()` RPC needs to be called periodically (via cron job) to delete expired files.

4. **Push Notifications**: Phase 6F is optional and not yet implemented. Requires service worker and FCM setup.

### Database Migrations Required

The following tables must exist in Supabase:
- `conversations`
- `messages`
- `voice_messages`
- `unread_counts`
- `messaging_preferences`

Run the schema SQL from the Database Schema section in the Supabase SQL Editor.

---

## Next Steps

**Phase 6F (Optional - Push Notifications):**
1. Set up service worker for background notifications
2. Integrate Firebase Cloud Messaging (FCM)
3. Implement notification permission flow
4. Handle notification clicks to open conversations

**Future Enhancements (V2):**
- Typing indicators
- Read receipts (privacy-gated)
- File attachments
- Message reactions
- Message search

---

## Bug Fix: Consolidate Relationship Lookup (Phase 6G)

### Problem

The messaging system returns "No active relationship with this user" (403) even when a client appears in the professional's "Active" clients list. This is caused by inconsistent relationship validation across the codebase.

### Root Cause

**UPDATED**: There is a mismatch between the schema documentation and actual data:

| Source | `professional_id` Meaning |
|--------|---------------------------|
| Schema documentation | `professional_profiles.id` |
| **Actual data in database** | `profiles.id` (user_id) |
| conversations table | `profiles.id` (user_id) |

The existing data was created with `user.id` (profiles.id), not `professional_profiles.id`. This caused:
1. ProDashboard to show "no relationships" when querying with `professionalProfile.id`
2. Messaging relationship checks to fail when using profile ID mapping

### Current Fix (Temporary)

The messaging `hasActiveRelationship()` function now checks BOTH formats:
1. Direct `user.id` check (matches existing data)
2. `professional_profiles.id` mapping check (for future compatibility)

ProDashboard and ProClientView continue using `user.id` for queries.

### Database Fields Reference (Actual vs Documented)

**`professional_client_relationships`** (Base Connection):
- `professional_id` → **Currently stores `profiles.id` (user_id)** in existing data
- `client_id` → `profiles.id` (user_id)
- `status` → 'pending' | 'active' | 'ended'

**Note**: A future data migration should convert `professional_id` to use `professional_profiles.id` for consistency.

**`client_permissions`** (Permission Check):
- `relationship_id` → links to relationship
- `permission_slug` → e.g., 'view_nutrition', 'assign_programmes'
- `status` → 'pending' | 'granted' | 'revoked'

### Task List

- [x] **6G.1: Create consolidated relationship helper**
  - Created `server/supabase-relationships.ts` with functions:
  - `hasActiveConnection(proUserId, clientId)` - checks base connection with ID mapping
  - `hasPermission(proUserId, clientId, permissionSlug)` - checks specific permission
  - `getProfessionalProfileId(userId)` - maps user_id to professional_profiles.id

- [x] **6G.2: Fix messaging relationship check**
  - Fixed `hasActiveRelationship()` in `server/supabase-messaging-data.ts`
  - Now properly looks up professional_profiles.id before querying relationships
  - Handles both directions: pro→client and client→pro

- [ ] **6G.3: Update existing relationship checks to use new helper**
  - Replace `verifyProClientRelationship()` calls in routes.ts
  - Update assign-programme relationship check
  - Update assign-check-in relationship check
  - Update any other relationship verifications

- [ ] **6G.4: Test all affected features**
  - Test messaging from pro dashboard client card
  - Test assign programme flow
  - Test assign check-in flow
  - Test client→pro messaging
  - Verify "Active" filter matches actual relationship state

### Debug Test: Verify ID Mapping

To debug the relationship lookup issue, check the browser console for these logs:

1. Log in as professional (cesar@delpino.com / FIT2025)
2. Navigate to /pro
3. Open browser console (F12 → Console tab)
4. Look for `[ProDashboard]` log messages showing:
   - `professional_id` being used (should be `professional_profiles.id`)
   - `user.id` (the auth user ID)
   - Query results (data array or empty)

**Expected behavior:**
- `professionalProfile.id` should be the `professional_profiles.id` from Supabase
- Query should return active relationships where `professional_id` matches

**If relationships return empty:**
- Compare `professionalProfile.id` vs what's stored in `professional_client_relationships.professional_id`
- They should match for the query to work

### Success Criteria

1. Clicking message icon on ProDashboard client card opens conversation without 403 error
2. All relationship checks use the same consolidated helper
3. Permission-gated features (nutrition, workouts) still respect individual permissions
4. Both pro→client and client→pro messaging work correctly

---

*Document created: December 2024*  
*Last updated: December 3, 2024 - Added Phase 6G relationship consolidation task list*
