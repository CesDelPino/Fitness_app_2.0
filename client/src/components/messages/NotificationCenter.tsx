import { useState } from "react";
import { useLocation } from "wouter";
import { Bell, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useConversations, useUnreadCount } from "@/lib/messaging";
import { formatDistanceToNow } from "date-fns";

interface NotificationCenterProps {
  isPro?: boolean;
}

export function NotificationCenter({ isPro = false }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  
  const { data: totalUnread = 0 } = useUnreadCount();
  const { data: conversations, isLoading } = useConversations();

  const baseRoute = isPro ? "/pro/messages" : "/messages";

  const handleConversationClick = (conversationId: string) => {
    setOpen(false);
    navigate(`${baseRoute}/${conversationId}`);
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate(baseRoute);
  };

  const recentConversations = conversations
    ?.filter(c => c.last_message_at)
    .slice(0, 5) || [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notification-center"
          aria-label={`Notifications${totalUnread > 0 ? `, ${totalUnread} unread` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {totalUnread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs"
              data-testid="badge-unread-count"
            >
              {totalUnread > 99 ? "99+" : totalUnread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        data-testid="popover-notification-center"
      >
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Messages</h3>
          {totalUnread > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalUnread} unread
            </Badge>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start a conversation with your {isPro ? "clients" : "trainer"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {recentConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => handleConversationClick(conversation.id)}
                  className="w-full flex items-start gap-3 p-3 hover-elevate text-left transition-colors"
                  data-testid={`notification-item-${conversation.id}`}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage
                      src={conversation.other_user.avatar_url || undefined}
                      alt={conversation.other_user.name}
                    />
                    <AvatarFallback>
                      {conversation.other_user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">
                        {conversation.other_user.name}
                      </span>
                      {conversation.last_message_at && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(conversation.last_message_at), {
                            addSuffix: false,
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conversation.last_message_preview || "No messages"}
                    </p>
                  </div>

                  {conversation.unread_count > 0 && (
                    <Badge
                      variant="default"
                      className="shrink-0 h-5 min-w-5 px-1.5"
                    >
                      {conversation.unread_count}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t">
          <Button
            variant="ghost"
            className="w-full justify-center"
            onClick={handleViewAll}
            data-testid="button-view-all-messages"
          >
            View all messages
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
