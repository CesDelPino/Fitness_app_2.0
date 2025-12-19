import { supabaseAdmin } from './supabase-admin';

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
}

export interface ConversationWithOtherUser extends Conversation {
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
}

export interface MessageWithVoice extends Message {
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

export interface UnreadCount {
  user_id: string;
  conversation_id: string;
  unread_count: number;
  last_updated: string;
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

// ============================================================================
// CONVERSATION FUNCTIONS
// ============================================================================

/**
 * Get or create a conversation between two users
 * Bypasses the RPC function and handles the logic directly in backend
 * to work around the data inconsistency in professional_client_relationships
 */
export async function getOrCreateConversation(
  userId: string,
  otherUserId: string
): Promise<string | null> {
  // First, check if current user is a professional
  const { data: proProfile } = await supabaseAdmin
    .from('professional_profiles')
    .select('id, user_id')
    .eq('user_id', userId)
    .single();
  
  const isCurrentUserPro = !!proProfile;
  
  // Determine professional_id and client_id based on roles
  let proId: string;
  let cliId: string;
  
  if (isCurrentUserPro) {
    proId = userId;
    cliId = otherUserId;
  } else {
    proId = otherUserId;
    cliId = userId;
  }
  
  // Verify there's an active relationship using the consolidated helper
  const hasRelationship = await hasActiveRelationship(userId, otherUserId);
  
  if (!hasRelationship) {
    console.error('No active relationship exists between users:', { userId, otherUserId });
    return null;
  }
  
  // Try to find existing conversation
  const { data: existingConv } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('professional_id', proId)
    .eq('client_id', cliId)
    .single();
  
  if (existingConv) {
    return existingConv.id;
  }
  
  // Create new conversation
  const { data: newConv, error: createError } = await supabaseAdmin
    .from('conversations')
    .insert({
      professional_id: proId,
      client_id: cliId
    })
    .select()
    .single();
  
  if (createError) {
    console.error('Create conversation error:', createError);
    return null;
  }
  
  return newConv.id;
}

/**
 * Get all conversations for a user with other user info and unread counts
 */
export async function getConversationsForUser(
  userId: string
): Promise<ConversationWithOtherUser[]> {
  // First get all conversations
  const { data: conversations, error: convError } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .or(`professional_id.eq.${userId},client_id.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (convError || !conversations) {
    console.error('Get conversations error:', convError);
    return [];
  }

  if (conversations.length === 0) {
    return [];
  }

  // Get unread counts for this user
  const { data: unreadCounts } = await supabaseAdmin
    .from('unread_counts')
    .select('conversation_id, unread_count')
    .eq('user_id', userId);

  const unreadMap = new Map<string, number>();
  if (unreadCounts) {
    for (const uc of unreadCounts) {
      unreadMap.set(uc.conversation_id, uc.unread_count);
    }
  }

  // Get other user IDs
  const otherUserIds = conversations.map(c => 
    c.professional_id === userId ? c.client_id : c.professional_id
  );

  // Get profiles for other users
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name, profile_photo_path, preset_avatar_id')
    .in('id', otherUserIds);

  // Check which are professionals and get their profile photo paths
  const { data: proProfiles } = await supabaseAdmin
    .from('professional_profiles')
    .select('user_id, profile_photo_path')
    .in('user_id', otherUserIds);

  const proUserIds = new Set(proProfiles?.map(p => p.user_id) || []);
  const proPhotoMap = new Map<string, string | null>();
  if (proProfiles) {
    for (const p of proProfiles) {
      proPhotoMap.set(p.user_id, p.profile_photo_path);
    }
  }

  // Get preset avatars for lookup
  const presetAvatarIds = profiles?.filter(p => p.preset_avatar_id).map(p => p.preset_avatar_id!) || [];
  const { data: presetAvatars } = presetAvatarIds.length > 0 
    ? await supabaseAdmin
        .from('preset_avatars')
        .select('id, image_path')
        .in('id', presetAvatarIds)
    : { data: [] };

  const presetAvatarMap = new Map<string, string | null>();
  if (presetAvatars) {
    for (const pa of presetAvatars) {
      // Generate signed URL for preset avatar
      if (pa.image_path) {
        const { data: signedData } = await supabaseAdmin.storage
          .from('preset-avatars')
          .createSignedUrl(pa.image_path, 3600);
        presetAvatarMap.set(pa.id, signedData?.signedUrl || null);
      }
    }
  }

  // Build profile map with resolved avatar URLs
  const profileMap = new Map<string, { name: string; avatar_url: string | null }>();
  if (profiles) {
    for (const p of profiles) {
      let avatarUrl: string | null = null;

      // Priority 1: Client's uploaded profile photo
      if (p.profile_photo_path) {
        const { data: signedData } = await supabaseAdmin.storage
          .from('profile-photos')
          .createSignedUrl(p.profile_photo_path, 3600);
        avatarUrl = signedData?.signedUrl || null;
      }
      // Priority 2: Professional's uploaded photo
      if (!avatarUrl && proPhotoMap.has(p.id)) {
        const proPhotoPath = proPhotoMap.get(p.id);
        if (proPhotoPath) {
          const { data: signedData } = await supabaseAdmin.storage
            .from('professional-assets')
            .createSignedUrl(proPhotoPath, 3600);
          avatarUrl = signedData?.signedUrl || null;
        }
      }
      // Priority 3: Preset avatar
      if (!avatarUrl && p.preset_avatar_id) {
        avatarUrl = presetAvatarMap.get(p.preset_avatar_id) || null;
      }

      profileMap.set(p.id, { 
        name: p.display_name || 'Unknown User', 
        avatar_url: avatarUrl
      });
    }
  }

  return conversations.map(conv => {
    const otherId = conv.professional_id === userId ? conv.client_id : conv.professional_id;
    const profile = profileMap.get(otherId);
    
    return {
      ...conv,
      other_user: {
        id: otherId,
        name: profile?.name || 'Unknown User',
        avatar_url: profile?.avatar_url || null,
        role: proUserIds.has(otherId) ? 'professional' as const : 'client' as const,
      },
      unread_count: unreadMap.get(conv.id) || 0,
    };
  });
}

/**
 * Get a single conversation by ID
 */
export async function getConversationById(
  conversationId: string,
  userId: string
): Promise<ConversationWithOtherUser | null> {
  const { data: conv, error } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .or(`professional_id.eq.${userId},client_id.eq.${userId}`)
    .single();

  if (error || !conv) {
    console.error('Get conversation error:', error);
    return null;
  }

  // Get unread count
  const { data: unread } = await supabaseAdmin
    .from('unread_counts')
    .select('unread_count')
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
    .single();

  // Get other user info
  const otherId = conv.professional_id === userId ? conv.client_id : conv.professional_id;
  
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name, profile_photo_path, preset_avatar_id')
    .eq('id', otherId)
    .single();

  const { data: proProfile } = await supabaseAdmin
    .from('professional_profiles')
    .select('user_id, profile_photo_path')
    .eq('user_id', otherId)
    .single();

  // Resolve avatar URL with priority: uploaded photo > pro photo > preset avatar
  let avatarUrl: string | null = null;

  // Priority 1: Client's uploaded profile photo
  if (profile?.profile_photo_path) {
    const { data: signedData } = await supabaseAdmin.storage
      .from('profile-photos')
      .createSignedUrl(profile.profile_photo_path, 3600);
    avatarUrl = signedData?.signedUrl || null;
  }
  // Priority 2: Professional's uploaded photo
  if (!avatarUrl && proProfile?.profile_photo_path) {
    const { data: signedData } = await supabaseAdmin.storage
      .from('professional-assets')
      .createSignedUrl(proProfile.profile_photo_path, 3600);
    avatarUrl = signedData?.signedUrl || null;
  }
  // Priority 3: Preset avatar
  if (!avatarUrl && profile?.preset_avatar_id) {
    const { data: presetAvatar } = await supabaseAdmin
      .from('preset_avatars')
      .select('image_path')
      .eq('id', profile.preset_avatar_id)
      .single();
    if (presetAvatar?.image_path) {
      const { data: signedData } = await supabaseAdmin.storage
        .from('preset-avatars')
        .createSignedUrl(presetAvatar.image_path, 3600);
      avatarUrl = signedData?.signedUrl || null;
    }
  }

  return {
    ...conv,
    other_user: {
      id: otherId,
      name: profile?.display_name || 'Unknown User',
      avatar_url: avatarUrl,
      role: proProfile ? 'professional' : 'client',
    },
    unread_count: unread?.unread_count || 0,
  };
}

// ============================================================================
// MESSAGE FUNCTIONS
// ============================================================================

/**
 * Get messages for a conversation (paginated)
 */
export async function getMessagesForConversation(
  conversationId: string,
  options: { before?: string; limit?: number } = {}
): Promise<{ messages: MessageWithVoice[]; hasMore: boolean }> {
  const limit = options.limit || 50;
  
  let query = supabaseAdmin
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: false })
    .limit(limit + 1); // Fetch one extra to check if there are more

  if (options.before) {
    query = query.lt('sent_at', options.before);
  }

  const { data: messages, error } = await query;

  if (error || !messages) {
    console.error('Get messages error:', error);
    return { messages: [], hasMore: false };
  }

  const hasMore = messages.length > limit;
  const resultMessages = messages.slice(0, limit);

  // Get voice messages for any voice type messages
  const voiceMessageIds = resultMessages
    .filter(m => m.message_type === 'voice')
    .map(m => m.id);

  let voiceMap = new Map<string, VoiceMessage>();
  if (voiceMessageIds.length > 0) {
    const { data: voiceMessages } = await supabaseAdmin
      .from('voice_messages')
      .select('*')
      .in('message_id', voiceMessageIds)
      .is('deleted_at', null);

    if (voiceMessages) {
      for (const vm of voiceMessages) {
        voiceMap.set(vm.message_id, vm);
      }
    }
  }

  return {
    messages: resultMessages.map(m => ({
      ...m,
      voice_message: voiceMap.get(m.id) || null,
    })),
    hasMore,
  };
}

/**
 * Send a text message
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  messageType: 'text' | 'voice' | 'system' = 'text'
): Promise<Message | null> {
  const { data: message, error } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type: messageType,
      delivery_status: 'sent',
    })
    .select()
    .single();

  if (error) {
    console.error('Send message error:', error);
    return null;
  }

  return message;
}

/**
 * Mark messages as read using the RPC function
 */
export async function markMessagesAsRead(
  userId: string,
  conversationId: string,
  upToMessageId?: string
): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('mark_messages_read', {
    p_user_id: userId,
    p_conversation_id: conversationId,
    p_up_to_message_id: upToMessageId || null,
  });

  if (error) {
    console.error('Mark messages read error:', error);
    return 0;
  }

  return data || 0;
}

/**
 * Update message delivery status
 */
export async function updateMessageDeliveryStatus(
  messageId: string,
  status: 'delivered' | 'failed'
): Promise<boolean> {
  const updates: any = { delivery_status: status };
  if (status === 'delivered') {
    updates.delivered_at = new Date().toISOString();
  }

  const { error } = await supabaseAdmin
    .from('messages')
    .update(updates)
    .eq('id', messageId);

  if (error) {
    console.error('Update delivery status error:', error);
    return false;
  }

  return true;
}

// ============================================================================
// VOICE MESSAGE FUNCTIONS
// ============================================================================

/**
 * Create a voice message record
 */
export async function createVoiceMessage(
  messageId: string,
  storagePath: string,
  durationSeconds: number,
  fileSizeBytes?: number,
  mimeType: string = 'audio/webm'
): Promise<VoiceMessage | null> {
  const { data, error } = await supabaseAdmin
    .from('voice_messages')
    .insert({
      message_id: messageId,
      storage_path: storagePath,
      duration_seconds: durationSeconds,
      file_size_bytes: fileSizeBytes,
      mime_type: mimeType,
    })
    .select()
    .single();

  if (error) {
    console.error('Create voice message error:', error);
    return null;
  }

  return data;
}

/**
 * Get voice message by ID
 */
export async function getVoiceMessageById(
  voiceMessageId: string
): Promise<VoiceMessage | null> {
  const { data, error } = await supabaseAdmin
    .from('voice_messages')
    .select('*')
    .eq('id', voiceMessageId)
    .is('deleted_at', null)
    .single();

  if (error) {
    console.error('Get voice message error:', error);
    return null;
  }

  return data;
}

/**
 * Get voice message by message ID
 */
export async function getVoiceMessageByMessageId(
  messageId: string
): Promise<VoiceMessage | null> {
  const { data, error } = await supabaseAdmin
    .from('voice_messages')
    .select('*')
    .eq('message_id', messageId)
    .is('deleted_at', null)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Get voice message by message ID error:', error);
    return null;
  }

  return data;
}

/**
 * Upload voice memo to Supabase Storage and create record
 */
export async function uploadVoiceMemo(
  messageId: string,
  fileBuffer: Buffer,
  durationSeconds: number,
  mimeType: string = 'audio/webm'
): Promise<VoiceMessage | null> {
  const fileExtension = mimeType === 'audio/mp4' ? 'mp4' : 'webm';
  const storagePath = `${messageId}.${fileExtension}`;
  
  const { error: uploadError } = await supabaseAdmin.storage
    .from('voice-memos')
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error('Upload voice memo error:', uploadError);
    return null;
  }

  const voiceMessage = await createVoiceMessage(
    messageId,
    storagePath,
    durationSeconds,
    fileBuffer.length,
    mimeType
  );

  return voiceMessage;
}

/**
 * Get signed URL for voice message playback
 */
export async function getSignedVoiceUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from('voice-memos')
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    console.error('Get signed voice URL error:', error);
    return null;
  }

  return data?.signedUrl || null;
}

/**
 * Delete voice memo file from storage
 */
export async function deleteVoiceMemoFile(storagePath: string): Promise<boolean> {
  const { error } = await supabaseAdmin.storage
    .from('voice-memos')
    .remove([storagePath]);

  if (error) {
    console.error('Delete voice memo file error:', error);
    return false;
  }

  return true;
}

/**
 * Check if voice memo is expired
 */
export function isVoiceMemoExpired(voiceMessage: VoiceMessage): boolean {
  return new Date(voiceMessage.expires_at) < new Date();
}

// ============================================================================
// UNREAD COUNT FUNCTIONS
// ============================================================================

/**
 * Get total unread count for a user
 */
export async function getTotalUnreadCount(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('get_total_unread_count', {
    p_user_id: userId
  });

  if (error) {
    console.error('Get total unread count error:', error);
    return 0;
  }

  return data || 0;
}

/**
 * Get unread counts per conversation for a user
 */
export async function getUnreadCountsForUser(
  userId: string
): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin
    .from('unread_counts')
    .select('conversation_id, unread_count')
    .eq('user_id', userId);

  if (error) {
    console.error('Get unread counts error:', error);
    return new Map();
  }

  const map = new Map<string, number>();
  if (data) {
    for (const uc of data) {
      map.set(uc.conversation_id, uc.unread_count);
    }
  }

  return map;
}

// ============================================================================
// MESSAGING PREFERENCES FUNCTIONS
// ============================================================================

/**
 * Get messaging preferences for a user
 */
export async function getMessagingPreferences(
  userId: string
): Promise<MessagingPreferences | null> {
  const { data, error } = await supabaseAdmin
    .from('messaging_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // Not found is OK
    console.error('Get messaging preferences error:', error);
  }

  return data;
}

/**
 * Update messaging preferences for a user (upsert)
 */
export async function updateMessagingPreferences(
  userId: string,
  updates: Partial<Omit<MessagingPreferences, 'user_id' | 'updated_at'>>
): Promise<MessagingPreferences | null> {
  const { data, error } = await supabaseAdmin
    .from('messaging_preferences')
    .upsert({
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Update messaging preferences error:', error);
    return null;
  }

  return data;
}

/**
 * Register push token for a user
 */
export async function registerPushToken(
  userId: string,
  token: string,
  platform: 'web' | 'android' | 'ios'
): Promise<boolean> {
  const result = await updateMessagingPreferences(userId, {
    push_token: token,
    push_platform: platform,
  });

  return result !== null;
}

// ============================================================================
// CLEANUP FUNCTIONS
// ============================================================================

/**
 * Cleanup expired voice memos
 * Returns the storage paths that need to be deleted from storage
 */
export async function cleanupExpiredVoiceMemos(): Promise<{
  deletedCount: number;
  storagePaths: string[];
}> {
  const { data, error } = await supabaseAdmin.rpc('cleanup_expired_voice_memos');

  if (error) {
    console.error('Cleanup expired voice memos error:', error);
    return { deletedCount: 0, storagePaths: [] };
  }

  return {
    deletedCount: data?.[0]?.deleted_count || 0,
    storagePaths: data?.[0]?.storage_paths || [],
  };
}

// ============================================================================
// RELATIONSHIP VERIFICATION
// ============================================================================

/**
 * Check if two users have an active relationship
 * Handles both directions: userId1 as pro or userId1 as client
 * 
 * Note: The professional_client_relationships table currently stores
 * professional_id as user.id (profiles.id), not professional_profiles.id.
 * This function checks both formats for backwards compatibility.
 */
export async function hasActiveRelationship(
  userId1: string,
  userId2: string
): Promise<boolean> {
  // Check if relationship exists with userId1 as professional (direct user.id check)
  // This is the current format used in the database
  const { data: rel1Direct } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id')
    .eq('professional_id', userId1)
    .eq('client_id', userId2)
    .eq('status', 'active')
    .single();

  if (rel1Direct) return true;

  // Check reverse direction
  const { data: rel2Direct } = await supabaseAdmin
    .from('professional_client_relationships')
    .select('id')
    .eq('professional_id', userId2)
    .eq('client_id', userId1)
    .eq('status', 'active')
    .single();

  if (rel2Direct) return true;

  // Also check with professional_profiles.id mapping for future compatibility
  const { data: proProfile1 } = await supabaseAdmin
    .from('professional_profiles')
    .select('id')
    .eq('user_id', userId1)
    .single();

  if (proProfile1) {
    const { data: rel1 } = await supabaseAdmin
      .from('professional_client_relationships')
      .select('id')
      .eq('professional_id', proProfile1.id)
      .eq('client_id', userId2)
      .eq('status', 'active')
      .single();

    if (rel1) return true;
  }

  const { data: proProfile2 } = await supabaseAdmin
    .from('professional_profiles')
    .select('id')
    .eq('user_id', userId2)
    .single();

  if (proProfile2) {
    const { data: rel2 } = await supabaseAdmin
      .from('professional_client_relationships')
      .select('id')
      .eq('professional_id', proProfile2.id)
      .eq('client_id', userId1)
      .eq('status', 'active')
      .single();

    if (rel2) return true;
  }

  return false;
}

/**
 * Verify user can access a conversation
 */
export async function canAccessConversation(
  userId: string,
  conversationId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .or(`professional_id.eq.${userId},client_id.eq.${userId}`)
    .single();

  if (error) {
    return false;
  }

  return !!data;
}
