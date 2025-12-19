import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { useSupabaseAuth } from "./SupabaseAuthContext";
import { queryClient } from "@/lib/queryClient";
import { playNotificationSound, setNotificationSoundEnabled } from "@/lib/notificationSound";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface ServerMessage {
  type: "auth_ok" | "auth_error" | "new_message" | "message_delivered" | "unread_update" | "nutrition_targets_update" | "pong" | "error";
  payload?: Record<string, unknown>;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

interface MessagingPreferences {
  sound_enabled: boolean;
  notifications_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  muted_conversations: string[];
}

interface MessagingContextType {
  connectionStatus: ConnectionStatus;
  connect: () => void;
  disconnect: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  setPreferences: (prefs: Partial<MessagingPreferences>) => void;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];
const PING_INTERVAL = 25000;

function resolveWsUrl(): string | null {
  try {
    const envUrl = import.meta.env.VITE_WS_URL?.trim();
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    
    if (envUrl) {
      let resolvedUrl: string;
      
      if (envUrl.startsWith("ws://") || envUrl.startsWith("wss://")) {
        resolvedUrl = envUrl;
      } else if (envUrl.startsWith("/")) {
        resolvedUrl = `${protocol}//${window.location.host}${envUrl}`;
      } else {
        resolvedUrl = `${protocol}//${window.location.host}/${envUrl}`;
      }
      
      new URL(resolvedUrl);
      console.log("[ws] Using VITE_WS_URL:", resolvedUrl);
      return resolvedUrl;
    }
    
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    new URL(wsUrl);
    console.log("[ws] Using same-origin URL:", wsUrl);
    return wsUrl;
  } catch (error) {
    console.error("[ws] Invalid WebSocket URL configuration:", error);
    return null;
  }
}

function isInQuietHours(start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

export function MessagingProvider({ children }: { children: ReactNode }) {
  const { session, getAccessToken } = useSupabaseAuth();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  
  const preferencesRef = useRef<MessagingPreferences>({
    sound_enabled: true,
    notifications_enabled: true,
    quiet_hours_start: null,
    quiet_hours_end: null,
    muted_conversations: [],
  });
  const preferencesLoadedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: ServerMessage = JSON.parse(event.data);

      switch (data.type) {
        case "auth_ok":
          setConnectionStatus("connected");
          reconnectAttemptRef.current = 0;
          console.log("[ws] Authenticated successfully");
          break;

        case "auth_error":
          console.error("[ws] Auth error:", data.payload?.error);
          setConnectionStatus("error");
          break;

        case "new_message":
          const message = data.payload?.message as Message;
          if (message) {
            queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations", message.conversation_id, "messages"] });
            queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
            queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
            
            if (preferencesLoadedRef.current) {
              const prefs = preferencesRef.current;
              const shouldPlaySound = 
                prefs.sound_enabled && 
                prefs.notifications_enabled &&
                !prefs.muted_conversations.includes(message.conversation_id) &&
                !isInQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end);
              
              if (shouldPlaySound) {
                playNotificationSound();
              }
            }
          }
          break;

        case "message_delivered":
          const deliveredMessageId = data.payload?.messageId as string;
          const deliveredConversationId = data.payload?.conversationId as string;
          if (deliveredMessageId && deliveredConversationId) {
            queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations", deliveredConversationId, "messages"] });
          }
          break;

        case "unread_update":
          queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
          queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
          break;

        case "nutrition_targets_update":
          queryClient.invalidateQueries({ queryKey: ["/api/nutrition-targets"] });
          if (preferencesLoadedRef.current && preferencesRef.current.sound_enabled && preferencesRef.current.notifications_enabled) {
            playNotificationSound();
          }
          break;

        case "pong":
          break;

        case "error":
          console.error("[ws] Server error:", data.payload?.error);
          break;
      }
    } catch (error) {
      console.error("[ws] Failed to parse message:", error);
    }
  }, []);

  const connect = useCallback(async () => {
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (!session) {
      console.log("[ws] No session, skipping connection");
      return;
    }

    const wsUrl = resolveWsUrl();
    if (!wsUrl) {
      console.error("[ws] Cannot connect: invalid WebSocket URL");
      setConnectionStatus("error");
      return;
    }

    isConnectingRef.current = true;
    setConnectionStatus("connecting");

    try {
      const token = await getAccessToken();
      if (!token) {
        console.error("[ws] No access token available");
        setConnectionStatus("error");
        isConnectingRef.current = false;
        return;
      }

      console.log("[ws] Connecting to", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[ws] Connected, sending auth");
        ws.send(JSON.stringify({ type: "auth", token }));

        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, PING_INTERVAL);
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log("[ws] Connection closed:", event.code, event.reason);
        wsRef.current = null;
        isConnectingRef.current = false;
        clearTimers();

        if (event.code !== 1000 && event.code !== 1001) {
          setConnectionStatus("disconnected");
          
          const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)];
          reconnectAttemptRef.current++;
          
          console.log(`[ws] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          setConnectionStatus("disconnected");
        }
      };

      ws.onerror = (error) => {
        console.error("[ws] WebSocket error:", error);
        isConnectingRef.current = false;
      };

    } catch (error) {
      console.error("[ws] Connection error:", error);
      setConnectionStatus("error");
      isConnectingRef.current = false;
    }
  }, [session, getAccessToken, handleMessage, clearTimers]);

  const disconnect = useCallback(() => {
    clearTimers();
    reconnectAttemptRef.current = 0;
    
    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnect");
      wsRef.current = null;
    }
    
    setConnectionStatus("disconnected");
  }, [clearTimers]);

  useEffect(() => {
    if (session) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [session, connect, disconnect]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && session && connectionStatus === "disconnected") {
        reconnectAttemptRef.current = 0;
        connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [session, connectionStatus, connect]);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setNotificationSoundEnabled(enabled);
    preferencesRef.current.sound_enabled = enabled;
  }, []);

  const setPreferences = useCallback((prefs: Partial<MessagingPreferences>) => {
    preferencesRef.current = { ...preferencesRef.current, ...prefs };
    if (prefs.sound_enabled !== undefined) {
      setNotificationSoundEnabled(prefs.sound_enabled);
    }
  }, []);

  useEffect(() => {
    if (!session) {
      preferencesLoadedRef.current = false;
      return;
    }
    
    const loadPreferences = async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          preferencesLoadedRef.current = true;
          return;
        }
        const response = await fetch("/api/messages/preferences", {
          credentials: "include",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data) {
            preferencesRef.current = {
              sound_enabled: data.sound_enabled ?? true,
              notifications_enabled: data.notifications_enabled ?? true,
              quiet_hours_start: data.quiet_hours_start ?? null,
              quiet_hours_end: data.quiet_hours_end ?? null,
              muted_conversations: data.muted_conversations ?? [],
            };
            setNotificationSoundEnabled(preferencesRef.current.sound_enabled);
          }
        }
        preferencesLoadedRef.current = true;
      } catch (error) {
        console.error("[ws] Failed to load messaging preferences:", error);
        preferencesLoadedRef.current = true;
      }
    };
    
    loadPreferences();
  }, [session]);

  return (
    <MessagingContext.Provider
      value={{
        connectionStatus,
        connect,
        disconnect,
        setSoundEnabled,
        setPreferences,
      }}
    >
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const context = useContext(MessagingContext);
  if (context === undefined) {
    throw new Error("useMessaging must be used within a MessagingProvider");
  }
  return context;
}
