import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wifi, WifiOff } from "lucide-react";
import { useMessaging } from "@/contexts/MessagingContext";
import type { Conversation } from "@/lib/messaging";

interface ChatHeaderProps {
  conversation: Conversation;
  onBack: () => void;
  showBackButton?: boolean;
}

export function ChatHeader({ conversation, onBack, showBackButton = true }: ChatHeaderProps) {
  const { connectionStatus } = useMessaging();
  const { other_user } = conversation;

  const initials = other_user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleLabel = other_user.role === "professional" ? "Pro" : "Client";

  return (
    <div className="flex items-center gap-3 p-3 border-b bg-background">
      {showBackButton && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="md:hidden"
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}

      <Avatar className="h-10 w-10">
        <AvatarImage src={other_user.avatar_url || undefined} alt={other_user.name} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{other_user.name}</span>
          <Badge variant="secondary" className="text-xs">
            {roleLabel}
          </Badge>
        </div>
      </div>

      <div className="flex-shrink-0">
        {connectionStatus === "connected" ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : connectionStatus === "connecting" ? (
          <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />
        ) : (
          <WifiOff className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
