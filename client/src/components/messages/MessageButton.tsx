import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageSquare, Loader2 } from "lucide-react";
import { useCreateConversation } from "@/lib/messaging";
import { useToast } from "@/hooks/use-toast";

interface MessageButtonProps {
  userId: string;
  userName?: string;
  variant?: "default" | "ghost" | "outline" | "secondary" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
  className?: string;
}

export function MessageButton({ 
  userId, 
  userName,
  variant = "ghost", 
  size = "icon",
  showLabel = false,
  className,
}: MessageButtonProps) {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const createConversation = useCreateConversation();
  
  const isProContext = location.startsWith("/pro");
  const baseRoute = isProContext ? "/pro/messages" : "/messages";
  
  const handleClick = async () => {
    try {
      const conversation = await createConversation.mutateAsync(userId);
      navigate(`${baseRoute}/${conversation.id}`);
    } catch (error) {
      toast({
        title: "Could not start conversation",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };
  
  if (showLabel) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={createConversation.isPending}
        className={className}
        data-testid={`button-message-${userId}`}
      >
        {createConversation.isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <MessageSquare className="h-4 w-4 mr-2" />
        )}
        Message {userName || ""}
      </Button>
    );
  }
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          onClick={handleClick}
          disabled={createConversation.isPending}
          className={className}
          data-testid={`button-message-${userId}`}
        >
          {createConversation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageSquare className="h-4 w-4" />
          )}
          <span className="sr-only">Message {userName || "user"}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">Message {userName || ""}</p>
      </TooltipContent>
    </Tooltip>
  );
}
