import { useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { Loader2 } from "lucide-react";
import { useConversation, useMessages, useSendMessage, useSendVoiceMessage, useMarkMessagesRead, useTeaserStatus } from "@/lib/messaging";
import { queryClient } from "@/lib/queryClient";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { ChatHeader } from "@/components/messages/ChatHeader";
import { MessageBubble } from "@/components/messages/MessageBubble";
import { ChatComposer } from "@/components/messages/ChatComposer";

interface ConversationViewProps {
  conversationId?: string;
  onBack?: () => void;
  embedded?: boolean;
}

export default function ConversationView({ 
  conversationId: propConversationId, 
  onBack,
  embedded = false 
}: ConversationViewProps) {
  const params = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  const { user } = useSupabaseAuth();
  
  const conversationId = propConversationId || params.id;
  const isProContext = location.startsWith("/pro");
  const baseRoute = isProContext ? "/pro/messages" : "/messages";
  
  const { data: conversation, isLoading: conversationLoading } = useConversation(conversationId);
  const { data: messagesData, isLoading: messagesLoading } = useMessages(conversationId);
  const { data: teaserStatus } = useTeaserStatus(conversationId);
  const sendMessage = useSendMessage();
  const sendVoiceMessage = useSendVoiceMessage();
  const markRead = useMarkMessagesRead();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMarkedMessageIdRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (messagesData?.messages.length) {
      scrollToBottom();
    }
  }, [messagesData?.messages.length, scrollToBottom]);

  useEffect(() => {
    if (!conversationId || !messagesData?.messages.length || !user) return;
    
    const latestMessage = messagesData.messages[0];
    if (!latestMessage) return;
    
    const isFromOtherUser = latestMessage.sender_id !== user.id;
    const alreadyMarked = lastMarkedMessageIdRef.current === latestMessage.id;
    
    if (isFromOtherUser && !alreadyMarked) {
      lastMarkedMessageIdRef.current = latestMessage.id;
      markRead.mutate({ conversationId });
    }
  }, [conversationId, messagesData?.messages, user, markRead]);

  useEffect(() => {
    lastMarkedMessageIdRef.current = null;
  }, [conversationId]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(baseRoute);
    }
  };

  const handleSend = (content: string) => {
    if (!conversationId) return;
    
    sendMessage.mutate(
      { conversationId, content },
      {
        onSuccess: () => {
          scrollToBottom();
          // Refresh teaser status after sending
          queryClient.invalidateQueries({ 
            queryKey: ['/api/messages/conversations', conversationId, 'teaser-status'] 
          });
        },
      }
    );
  };

  const handleSendVoice = (audioBlob: Blob, durationSeconds: number) => {
    if (!conversationId) return;
    
    sendVoiceMessage.mutate(
      { conversationId, audioBlob, durationSeconds },
      {
        onSuccess: () => {
          scrollToBottom();
          // Refresh teaser status after sending voice
          queryClient.invalidateQueries({ 
            queryKey: ['/api/messages/conversations', conversationId, 'teaser-status'] 
          });
        },
      }
    );
  };

  if (!conversationId) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4 text-center">
        <p className="text-muted-foreground">Select a conversation to start messaging</p>
      </div>
    );
  }

  if (conversationLoading || messagesLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4 text-center">
        <p className="text-muted-foreground">Conversation not found</p>
      </div>
    );
  }

  const messages = messagesData?.messages || [];
  const reversedMessages = [...messages].reverse();

  return (
    <div className="flex flex-col h-full" data-testid="conversation-view">
      <ChatHeader 
        conversation={conversation} 
        onBack={handleBack}
        showBackButton={!embedded}
      />
      
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-3"
      >
        {reversedMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">
              No messages yet. Send the first message!
            </p>
          </div>
        ) : (
          <>
            {reversedMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isSent={message.sender_id === user?.id}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <ChatComposer
        onSend={handleSend}
        onSendVoice={handleSendVoice}
        isSending={sendMessage.isPending}
        isVoiceSending={sendVoiceMessage.isPending}
        teaserStatus={teaserStatus}
      />
    </div>
  );
}
