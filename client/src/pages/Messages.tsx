import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import MessagesList from "./MessagesList";
import ConversationView from "./ConversationView";

export default function Messages() {
  const params = useParams<{ id?: string }>();
  const [location, navigate] = useLocation();
  const [selectedId, setSelectedId] = useState<string | undefined>(params.id);
  const [isMobile, setIsMobile] = useState(false);

  const isProContext = location.startsWith("/pro");
  const baseRoute = isProContext ? "/pro/messages" : "/messages";

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setSelectedId(params.id);
  }, [params.id]);

  const handleSelect = (conversationId: string) => {
    setSelectedId(conversationId);
    navigate(`${baseRoute}/${conversationId}`);
  };

  const handleBack = () => {
    setSelectedId(undefined);
    navigate(baseRoute);
  };

  if (isMobile) {
    if (selectedId) {
      return (
        <div className="h-[calc(100vh-4rem)]">
          <ConversationView 
            conversationId={selectedId} 
            onBack={handleBack}
          />
        </div>
      );
    }
    
    return (
      <div className="h-[calc(100vh-4rem)]">
        <MessagesList onSelect={handleSelect} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex" data-testid="messages-split-view">
      <div className="w-80 border-r flex-shrink-0">
        <MessagesList 
          selectedId={selectedId} 
          onSelect={handleSelect}
        />
      </div>
      
      <div className="flex-1">
        {selectedId ? (
          <ConversationView 
            conversationId={selectedId}
            embedded
          />
        ) : (
          <div className="h-full flex items-center justify-center p-4 text-center">
            <p className="text-muted-foreground">
              Select a conversation to start messaging
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
