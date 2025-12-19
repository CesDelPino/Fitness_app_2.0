import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Mic, Crown, Lock } from "lucide-react";
import { VoiceRecorder } from "./VoiceRecorder";
import type { TeaserStatusResponse } from "@/lib/messaging";

interface ChatComposerProps {
  onSend: (content: string) => void;
  onSendVoice?: (audioBlob: Blob, durationSeconds: number) => void;
  isSending?: boolean;
  isVoiceSending?: boolean;
  disabled?: boolean;
  teaserStatus?: TeaserStatusResponse | null;
}

export function ChatComposer({ 
  onSend, 
  onSendVoice, 
  isSending, 
  isVoiceSending,
  disabled,
  teaserStatus 
}: ChatComposerProps) {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [, navigate] = useLocation();

  // Determine if messaging is blocked due to teaser limit
  const isBlocked = teaserStatus && !teaserStatus.canSend;
  const isPremium = teaserStatus?.status?.isPremium ?? false;
  const showTeaserCounter = teaserStatus && !isPremium && teaserStatus.remaining >= 0;
  const remainingMessages = teaserStatus?.remaining ?? 0;
  const totalLimit = teaserStatus?.limit ?? 4;

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || isSending || disabled) return;
    
    onSend(trimmed);
    setMessage("");
    
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleVoiceSend = (audioBlob: Blob, durationSeconds: number) => {
    if (onSendVoice) {
      onSendVoice(audioBlob, durationSeconds);
      setIsRecording(false);
    }
  };

  const handleVoiceCancel = () => {
    setIsRecording(false);
  };

  useEffect(() => {
    if (!isRecording) {
      textareaRef.current?.focus();
    }
  }, [isRecording]);

  const canSend = message.trim().length > 0 && !isSending && !disabled && !isBlocked;
  const voiceSupported = typeof MediaRecorder !== "undefined";

  if (isRecording) {
    return (
      <div className="border-t bg-background">
        <VoiceRecorder
          onSend={handleVoiceSend}
          onCancel={handleVoiceCancel}
          isSending={isVoiceSending}
        />
      </div>
    );
  }

  // Show upgrade prompt when teaser limit is reached
  if (isBlocked) {
    return (
      <div className="border-t bg-background p-4" data-testid="teaser-limit-reached">
        <div className="flex flex-col items-center justify-center gap-3 py-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="h-5 w-5" />
            <span className="text-sm">
              {teaserStatus?.isClient 
                ? "You've used all your teaser messages with this trainer"
                : "This client has used all their teaser messages"
              }
            </span>
          </div>
          {teaserStatus?.isClient && (
            <Button
              onClick={() => navigate("/subscription")}
              className="gap-2"
              data-testid="button-upgrade-premium"
            >
              <Crown className="h-4 w-4" />
              Upgrade to Premium
            </Button>
          )}
          {teaserStatus?.isTrainer && (
            <p className="text-xs text-muted-foreground text-center">
              The client needs to upgrade to Premium to continue messaging
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t bg-background">
      {showTeaserCounter && remainingMessages <= 4 && (
        <div className="px-3 pt-2 pb-1">
          <div 
            className={`text-xs text-center ${
              remainingMessages <= 1 ? 'text-destructive' : 
              remainingMessages <= 2 ? 'text-amber-600 dark:text-amber-400' : 
              'text-muted-foreground'
            }`}
            data-testid="teaser-counter"
          >
            {remainingMessages} of {totalLimit} teaser {remainingMessages === 1 ? 'message' : 'messages'} remaining
          </div>
        </div>
      )}
      <div className="flex items-end gap-2 p-3 pt-2">
        {voiceSupported && onSendVoice && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="flex-shrink-0"
            onClick={() => setIsRecording(true)}
            disabled={disabled || isSending}
            aria-label="Record voice memo"
            data-testid="button-voice-memo"
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}
        
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="min-h-[40px] max-h-[120px] resize-none flex-1"
          rows={1}
          disabled={disabled}
          aria-label="Message input"
          data-testid="input-message"
        />
        
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={!canSend}
          aria-label={isSending ? "Sending message" : "Send message"}
          data-testid="button-send-message"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
