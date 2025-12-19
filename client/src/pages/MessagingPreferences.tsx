import { useLocation } from "wouter";
import { ArrowLeft, Bell, Volume2, Moon, MessageSquareOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMessagingPreferences, useUpdateMessagingPreferences, useConversations } from "@/lib/messaging";
import { useMessaging } from "@/contexts/MessagingContext";
import { useToast } from "@/hooks/use-toast";

export default function MessagingPreferences() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { setPreferences } = useMessaging();
  
  const { data: preferences, isLoading } = useMessagingPreferences();
  const { data: conversations } = useConversations();
  const updatePreferences = useUpdateMessagingPreferences();

  const isProContext = location.startsWith("/pro");
  const backRoute = isProContext ? "/pro/messages" : "/messages";

  const handleToggle = async (key: string, value: boolean) => {
    try {
      await updatePreferences.mutateAsync({ [key]: value });
      setPreferences({ [key]: value });
      
      toast({
        title: "Settings updated",
        description: "Your messaging preferences have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleQuietHoursChange = async (field: "quiet_hours_start" | "quiet_hours_end", value: string) => {
    try {
      await updatePreferences.mutateAsync({ [field]: value || null });
      setPreferences({ [field]: value || null });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update quiet hours.",
        variant: "destructive",
      });
    }
  };

  const handleMuteConversation = async (conversationId: string, mute: boolean) => {
    if (!preferences) return;
    
    const currentMuted = preferences.muted_conversations || [];
    const newMuted = mute
      ? [...currentMuted, conversationId]
      : currentMuted.filter(id => id !== conversationId);

    try {
      await updatePreferences.mutateAsync({ muted_conversations: newMuted });
      setPreferences({ muted_conversations: newMuted });
      toast({
        title: mute ? "Conversation muted" : "Conversation unmuted",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update mute settings.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const mutedSet = new Set(preferences?.muted_conversations || []);

  return (
    <div className="flex flex-col h-full" data-testid="messaging-preferences-page">
      <header className="flex items-center gap-3 p-4 border-b shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(backRoute)}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-lg">Messaging Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Control how you receive message notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications">Push notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications for new messages
                </p>
              </div>
              <Switch
                id="notifications"
                checked={preferences?.notifications_enabled ?? true}
                onCheckedChange={(checked) => handleToggle("notifications_enabled", checked)}
                disabled={updatePreferences.isPending}
                data-testid="switch-notifications"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Sounds
            </CardTitle>
            <CardDescription>
              Control notification sounds
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sounds">Message sounds</Label>
                <p className="text-sm text-muted-foreground">
                  Play a sound when receiving messages
                </p>
              </div>
              <Switch
                id="sounds"
                checked={preferences?.sound_enabled ?? true}
                onCheckedChange={(checked) => handleToggle("sound_enabled", checked)}
                disabled={updatePreferences.isPending}
                data-testid="switch-sounds"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5" />
              Quiet Hours
            </CardTitle>
            <CardDescription>
              Silence notifications during specific hours
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quiet-start">Start time</Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={preferences?.quiet_hours_start || ""}
                  onChange={(e) => handleQuietHoursChange("quiet_hours_start", e.target.value)}
                  disabled={updatePreferences.isPending}
                  data-testid="input-quiet-start"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiet-end">End time</Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={preferences?.quiet_hours_end || ""}
                  onChange={(e) => handleQuietHoursChange("quiet_hours_end", e.target.value)}
                  disabled={updatePreferences.isPending}
                  data-testid="input-quiet-end"
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Leave empty to disable quiet hours
            </p>
          </CardContent>
        </Card>

        {conversations && conversations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareOff className="h-5 w-5" />
                Muted Conversations
              </CardTitle>
              <CardDescription>
                Mute notifications from specific conversations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{conversation.other_user.name}</span>
                      {conversation.other_user.role === "professional" && (
                        <span className="text-xs text-muted-foreground">Trainer</span>
                      )}
                    </div>
                    <Switch
                      checked={mutedSet.has(conversation.id)}
                      onCheckedChange={(checked) => handleMuteConversation(conversation.id, checked)}
                      disabled={updatePreferences.isPending}
                      data-testid={`switch-mute-${conversation.id}`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
