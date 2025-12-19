import { format } from "date-fns";
import { Check, CheckCheck, Clock } from "lucide-react";
import type { Message } from "@/lib/messaging";
import { VoicePlayer } from "./VoicePlayer";

interface MessageBubbleProps {
  message: Message;
  isSent: boolean;
}

export function MessageBubble({ message, isSent }: MessageBubbleProps) {
  const isVoice = message.message_type === "voice";
  const isSystem = message.message_type === "system";

  if (isSystem) {
    return (
      <div 
        className="flex justify-center my-2"
        data-testid={`message-system-${message.id}`}
      >
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const DeliveryIcon = () => {
    if (!isSent) return null;
    
    switch (message.delivery_status) {
      case "pending":
        return <Clock className="h-3 w-3 text-muted-foreground" />;
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-primary" />;
      default:
        return null;
    }
  };

  const isExpired = message.voice_message 
    ? new Date(message.voice_message.expires_at) < new Date() 
    : false;

  return (
    <div
      className={`flex ${isSent ? "justify-end" : "justify-start"} mb-2`}
      data-testid={`message-${isSent ? "sent" : "received"}-${message.id}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isSent
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted rounded-bl-md"
        }`}
      >
        {isVoice && message.voice_message ? (
          <VoicePlayer
            messageId={message.id}
            durationSeconds={message.voice_message.duration_seconds}
            isExpired={isExpired}
            isSent={isSent}
          />
        ) : isVoice ? (
          <div className="flex items-center gap-2">
            <div className="w-32 h-8 bg-background/20 rounded flex items-center justify-center">
              <span className="text-xs opacity-70">Voice memo</span>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        )}
        
        <div className={`flex items-center gap-1 mt-1 ${isSent ? "justify-end" : "justify-start"}`}>
          <span className={`text-xs ${isSent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {format(new Date(message.sent_at), "HH:mm")}
          </span>
          <DeliveryIcon />
        </div>
      </div>
    </div>
  );
}
