import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { Conversation } from "@/lib/messaging";

interface ConversationListItemProps {
  conversation: Conversation;
  isSelected?: boolean;
  onClick: () => void;
}

export function ConversationListItem({ 
  conversation, 
  isSelected,
  onClick 
}: ConversationListItemProps) {
  const { other_user, last_message_preview, last_message_at, unread_count } = conversation;
  
  const initials = other_user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleLabel = other_user.role === "professional" ? "Pro" : "Client";

  return (
    <button
      onClick={onClick}
      data-testid={`conversation-item-${conversation.id}`}
      className={`w-full flex items-center gap-3 p-3 text-left hover-elevate active-elevate-2 rounded-lg transition-colors ${
        isSelected ? "bg-accent" : ""
      }`}
    >
      <Avatar className="h-12 w-12 flex-shrink-0">
        <AvatarImage src={other_user.avatar_url || undefined} alt={other_user.name} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{other_user.name}</span>
          <Badge variant="secondary" className="text-xs flex-shrink-0">
            {roleLabel}
          </Badge>
        </div>
        
        {last_message_preview && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {last_message_preview}
          </p>
        )}
      </div>
      
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {last_message_at && (
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(last_message_at), { addSuffix: false })}
          </span>
        )}
        
        {unread_count > 0 && (
          <Badge 
            variant="default" 
            className="h-5 min-w-5 flex items-center justify-center text-xs"
            data-testid={`unread-badge-${conversation.id}`}
          >
            {unread_count > 99 ? "99+" : unread_count}
          </Badge>
        )}
      </div>
    </button>
  );
}
