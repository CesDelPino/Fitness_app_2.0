import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./queryClient";

// ============================================================================
// TYPES
// ============================================================================

export interface Conversation {
  id: string;
  professional_id: string;
  client_id: string;
  created_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  other_user: {
    id: string;
    name: string;
    avatar_url: string | null;
    role: 'professional' | 'client';
  };
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'voice' | 'system';
  delivery_status: 'pending' | 'sent' | 'delivered' | 'failed';
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  voice_message?: VoiceMessage | null;
}

export interface VoiceMessage {
  id: string;
  message_id: string;
  storage_path: string;
  duration_seconds: number;
  file_size_bytes: number | null;
  mime_type: string;
  waveform_data: any | null;
  expires_at: string;
  deleted_at: string | null;
  created_at: string;
}

export interface MessagingPreferences {
  user_id: string;
  notifications_enabled: boolean;
  sound_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  muted_conversations: string[];
  push_token: string | null;
  push_platform: 'web' | 'android' | 'ios' | null;
  updated_at: string;
}

export interface TeaserUsageStatus {
  isPremium: boolean;
  clientMessagesSent: number;
  clientLimit: number;
  clientRemaining: number;
  trainerMessagesSent: number;
  trainerLimit: number;
  trainerRemaining: number;
  isClientBlocked: boolean;
  isTrainerBlocked: boolean;
}

export interface TeaserStatusResponse {
  status: TeaserUsageStatus;
  isClient: boolean;
  isTrainer: boolean;
  canSend: boolean;
  remaining: number;
  limit: number;
  sent: number;
}

// ============================================================================
// CONVERSATION HOOKS
// ============================================================================

/**
 * Get all conversations for the current user
 */
export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: ['/api/messages/conversations'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/messages/conversations');
      const data = await res.json();
      return data.conversations;
    },
  });
}

/**
 * Get a single conversation by ID
 */
export function useConversation(conversationId: string | undefined) {
  return useQuery<Conversation>({
    queryKey: ['/api/messages/conversations', conversationId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/messages/conversations/${conversationId}`);
      const data = await res.json();
      return data.conversation;
    },
    enabled: !!conversationId,
  });
}

/**
 * Create or get a conversation with another user
 */
export function useCreateConversation() {
  return useMutation({
    mutationFn: async (otherUserId: string) => {
      const res = await apiRequest('POST', '/api/messages/conversations', {
        other_user_id: otherUserId,
      });
      const data = await res.json();
      return data.conversation as Conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
    },
  });
}

// ============================================================================
// MESSAGE HOOKS
// ============================================================================

/**
 * Get messages for a conversation (paginated)
 */
export function useMessages(
  conversationId: string | undefined,
  options?: { before?: string; limit?: number }
) {
  return useQuery<{ messages: Message[]; hasMore: boolean }>({
    queryKey: ['/api/messages/conversations', conversationId, 'messages', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.before) {
        params.set('before', options.before);
      }
      if (options?.limit) {
        params.set('limit', options.limit.toString());
      }
      const url = `/api/messages/conversations/${conversationId}/messages${params.toString() ? `?${params}` : ''}`;
      const res = await apiRequest('GET', url);
      return res.json();
    },
    enabled: !!conversationId,
  });
}

/**
 * Send a text message
 */
export function useSendMessage() {
  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      const res = await apiRequest('POST', `/api/messages/conversations/${conversationId}/messages`, {
        content,
      });
      const data = await res.json();
      return data.message as Message;
    },
    onSuccess: (message) => {
      // Invalidate messages for this conversation
      queryClient.invalidateQueries({ 
        queryKey: ['/api/messages/conversations', message.conversation_id, 'messages'] 
      });
      // Invalidate conversations list (to update last_message_at)
      queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
    },
  });
}

/**
 * Mark messages as read
 */
export function useMarkMessagesRead() {
  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      upToMessageId 
    }: { 
      conversationId: string; 
      upToMessageId?: string;
    }) => {
      const res = await apiRequest('POST', `/api/messages/conversations/${conversationId}/read`, {
        up_to_message_id: upToMessageId,
      });
      return res.json();
    },
    onSuccess: (_, { conversationId }) => {
      // Invalidate conversations list (to update unread count)
      queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
      // Invalidate messages (to update read_at)
      queryClient.invalidateQueries({ 
        queryKey: ['/api/messages/conversations', conversationId, 'messages'] 
      });
      // Invalidate total unread count
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread-count'] });
    },
  });
}

// ============================================================================
// UNREAD COUNT HOOKS
// ============================================================================

/**
 * Get total unread message count
 */
export function useUnreadCount() {
  return useQuery<number>({
    queryKey: ['/api/messages/unread-count'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/messages/unread-count');
      const data = await res.json();
      return data.total;
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

// ============================================================================
// TEASER MESSAGING HOOKS
// ============================================================================

/**
 * Get teaser usage status for a conversation
 * Returns remaining messages, limits, and whether user can send
 */
export function useTeaserStatus(conversationId: string | undefined) {
  return useQuery<TeaserStatusResponse>({
    queryKey: ['/api/messages/conversations', conversationId, 'teaser-status'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/messages/conversations/${conversationId}/teaser-status`);
      return res.json();
    },
    enabled: !!conversationId,
    staleTime: 10000, // Cache for 10 seconds
  });
}

// ============================================================================
// PREFERENCES HOOKS
// ============================================================================

/**
 * Get messaging preferences
 */
export function useMessagingPreferences() {
  return useQuery<MessagingPreferences>({
    queryKey: ['/api/messages/preferences'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/messages/preferences');
      const data = await res.json();
      return data.preferences;
    },
  });
}

/**
 * Update messaging preferences
 */
export function useUpdateMessagingPreferences() {
  return useMutation({
    mutationFn: async (updates: Partial<Omit<MessagingPreferences, 'user_id' | 'updated_at'>>) => {
      const res = await apiRequest('PUT', '/api/messages/preferences', updates);
      const data = await res.json();
      return data.preferences as MessagingPreferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/preferences'] });
    },
  });
}

/**
 * Register push notification token
 */
export function useRegisterPushToken() {
  return useMutation({
    mutationFn: async ({ token, platform }: { token: string; platform: 'web' | 'android' | 'ios' }) => {
      const res = await apiRequest('POST', '/api/messages/push-token', { token, platform });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/preferences'] });
    },
  });
}

// ============================================================================
// VOICE MESSAGE HOOKS
// ============================================================================

/**
 * Send a voice message
 */
export function useSendVoiceMessage() {
  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      audioBlob, 
      durationSeconds 
    }: { 
      conversationId: string; 
      audioBlob: Blob; 
      durationSeconds: number;
    }) => {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice.webm');
      formData.append('duration_seconds', durationSeconds.toString());

      const res = await fetch(`/api/messages/conversations/${conversationId}/voice`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send voice message');
      }

      const data = await res.json();
      return data.message as Message;
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/messages/conversations', message.conversation_id, 'messages'] 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
    },
  });
}

/**
 * Get signed URL for voice message playback
 */
export function useVoiceMessageUrl(messageId: string | undefined) {
  return useQuery<{ url: string; expires_at: string; duration_seconds: number }>({
    queryKey: ['/api/messages/voice', messageId, 'url'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/messages/voice/${messageId}/url`);
      return res.json();
    },
    enabled: !!messageId,
    staleTime: 55 * 60 * 1000, // Cache for 55 minutes (URLs expire in 1 hour)
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Invalidate all messaging-related queries
 */
export function invalidateMessagingQueries() {
  queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
}

/**
 * Add a message to the cache optimistically
 * Used for real-time updates before server confirmation
 */
export function addMessageToCache(conversationId: string, message: Message) {
  queryClient.setQueryData<{ messages: Message[]; hasMore: boolean }>(
    ['/api/messages/conversations', conversationId, 'messages', undefined],
    (old) => {
      if (!old) return { messages: [message], hasMore: false };
      return {
        ...old,
        messages: [message, ...old.messages],
      };
    }
  );
}

/**
 * Update conversation's last message in cache
 */
export function updateConversationLastMessage(conversationId: string, preview: string) {
  queryClient.setQueryData<Conversation[]>(
    ['/api/messages/conversations'],
    (old) => {
      if (!old) return [];
      return old.map(conv => 
        conv.id === conversationId 
          ? { ...conv, last_message_at: new Date().toISOString(), last_message_preview: preview }
          : conv
      );
    }
  );
}
