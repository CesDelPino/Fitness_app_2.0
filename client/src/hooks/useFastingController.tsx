import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getActiveFast, endFast, type Fast } from "@/lib/supabase-data";

type EndFastTrigger = "manual" | "food_logging" | "timer_expired";

interface FastingControllerState {
  activeFast: Fast | null | undefined;
  isLoading: boolean;
  showConfirmModal: boolean;
  showCelebrationModal: boolean;
  confirmTrigger: EndFastTrigger | null;
  fastDuration: string | null;
  pendingFoodCallback: (() => void) | null;
}

export function useFastingController() {
  const { toast } = useToast();
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [confirmTrigger, setConfirmTrigger] = useState<EndFastTrigger | null>(null);
  const [fastDuration, setFastDuration] = useState<string | null>(null);
  const [pendingFoodCallback, setPendingFoodCallback] = useState<(() => void) | null>(null);
  const [capturedFastId, setCapturedFastId] = useState<string | null>(null);

  const { data: activeFast, isLoading } = useQuery<Fast | null>({
    queryKey: ["active-fast"],
    queryFn: () => getActiveFast(),
    refetchInterval: 30000,
  });

  const calculateDuration = useCallback((startTime: string, endTimeOrNow?: Date) => {
    const start = new Date(startTime);
    const end = endTimeOrNow || new Date();
    const durationMs = end.getTime() - start.getTime();
    
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }, []);

  const endFastMutation = useMutation({
    mutationFn: async ({ fastId }: { fastId: string }) => {
      return endFast(fastId, new Date().toISOString());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-fast"] });
      setShowConfirmModal(false);
      setCapturedFastId(null);
      
      if (confirmTrigger === "timer_expired") {
        setShowCelebrationModal(true);
      } else {
        toast({
          title: "Fast ended",
          description: `You fasted for ${fastDuration}.`,
        });
      }
      
      if (pendingFoodCallback) {
        pendingFoodCallback();
        setPendingFoodCallback(null);
      }
      
      setConfirmTrigger(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to end fast",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const requestManualEnd = useCallback(() => {
    if (!activeFast) return;
    setCapturedFastId(activeFast.id);
    setFastDuration(calculateDuration(activeFast.startTime));
    setConfirmTrigger("manual");
    setShowConfirmModal(true);
  }, [activeFast, calculateDuration]);

  const requestEndForFood = useCallback((onContinue: () => void) => {
    if (!activeFast) {
      onContinue();
      return;
    }
    setCapturedFastId(activeFast.id);
    setFastDuration(calculateDuration(activeFast.startTime));
    setConfirmTrigger("food_logging");
    setPendingFoodCallback(() => onContinue);
    setShowConfirmModal(true);
  }, [activeFast, calculateDuration]);

  const handleTimerExpired = useCallback(() => {
    if (!activeFast) return;
    setCapturedFastId(activeFast.id);
    setFastDuration(calculateDuration(activeFast.startTime, new Date(activeFast.endTime)));
    setConfirmTrigger("timer_expired");
    endFastMutation.mutate({ fastId: activeFast.id });
  }, [activeFast, calculateDuration, endFastMutation]);

  const confirmEndFast = useCallback(() => {
    if (!capturedFastId) return;
    endFastMutation.mutate({ fastId: capturedFastId });
  }, [capturedFastId, endFastMutation]);

  const cancelEndFast = useCallback(() => {
    setShowConfirmModal(false);
    setConfirmTrigger(null);
    setCapturedFastId(null);
    
    if (confirmTrigger === "food_logging" && pendingFoodCallback) {
      pendingFoodCallback();
      setPendingFoodCallback(null);
    }
  }, [confirmTrigger, pendingFoodCallback]);

  const dismissCelebration = useCallback(() => {
    setShowCelebrationModal(false);
    setFastDuration(null);
  }, []);

  useEffect(() => {
    if (showCelebrationModal && showConfirmModal) {
      setShowConfirmModal(false);
      setConfirmTrigger("timer_expired");
    }
  }, [showCelebrationModal, showConfirmModal]);

  return {
    activeFast,
    isLoading,
    showConfirmModal,
    showCelebrationModal,
    confirmTrigger,
    fastDuration,
    isPending: endFastMutation.isPending,
    
    requestManualEnd,
    requestEndForFood,
    handleTimerExpired,
    confirmEndFast,
    cancelEndFast,
    dismissCelebration,
  };
}
