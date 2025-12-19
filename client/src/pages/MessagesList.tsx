import { useLocation } from "wouter";
import { MessageSquare, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConversations } from "@/lib/messaging";
import { ConversationListItem } from "@/components/messages/ConversationListItem";

interface MessagesListProps {
  selectedId?: string;
  onSelect?: (conversationId: string) => void;
}

export default function MessagesList({ selectedId, onSelect }: MessagesListProps) {
  const [location, navigate] = useLocation();
  const { data: conversations, isLoading, error } = useConversations();

  const isProContext = location.startsWith("/pro");
  const baseRoute = isProContext ? "/pro/messages" : "/messages";

  const handleSelect = (conversationId: string) => {
    if (onSelect) {
      onSelect(conversationId);
    } else {
      navigate(`${baseRoute}/${conversationId}`);
    }
  };

  const sortedConversations = conversations?.slice().sort((a, b) => {
    if (!a.last_message_at) return 1;
    if (!b.last_message_at) return -1;
    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
  });

  const Header = () => (
    <div className="p-4 border-b flex items-center justify-between gap-2">
      <h1 className="text-xl font-semibold">Messages</h1>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate(`${baseRoute}/preferences`)}
        data-testid="button-messaging-settings"
      >
        <Settings className="h-5 w-5" />
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-muted-foreground text-center">
            Failed to load conversations. Please try again.
          </p>
        </div>
      </div>
    );
  }

  if (!sortedConversations || sortedConversations.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="font-medium mb-1">No conversations yet</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Start a conversation with your trainer or client to begin messaging.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="messages-list">
      <Header />
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {sortedConversations.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedId === conversation.id}
              onClick={() => handleSelect(conversation.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
