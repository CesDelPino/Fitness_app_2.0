import { useState, useRef, useEffect } from "react";
import { Play, Pause, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceMessageUrl } from "@/lib/messaging";
import { cn } from "@/lib/utils";

interface VoicePlayerProps {
  messageId: string;
  durationSeconds: number;
  isExpired?: boolean;
  isSent?: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function VoicePlayer({
  messageId,
  durationSeconds,
  isExpired = false,
  isSent = false,
}: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const { data: urlData, isLoading, error: urlError } = useVoiceMessageUrl(
    !isExpired ? messageId : undefined
  );

  useEffect(() => {
    if (audioRef.current && urlData?.url) {
      audioRef.current.src = urlData.url;
    }
  }, [urlData?.url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };

    const handleError = () => {
      setHasError(true);
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  const togglePlay = async () => {
    if (!audioRef.current || !urlData?.url) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
        setHasError(false);
      }
    } catch (err) {
      console.error("Playback error:", err);
      setHasError(true);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * durationSeconds;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const progress = durationSeconds > 0 ? (currentTime / durationSeconds) * 100 : 0;

  if (isExpired) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded-lg min-w-[180px]",
          isSent ? "bg-primary/20" : "bg-muted"
        )}
        data-testid="voice-player-expired"
      >
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Voice message expired</span>
      </div>
    );
  }

  if (urlError || hasError) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded-lg min-w-[180px]",
          isSent ? "bg-primary/20" : "bg-muted"
        )}
        data-testid="voice-player-error"
      >
        <AlertCircle className="h-4 w-4 text-destructive" />
        <span className="text-xs text-destructive">Playback failed</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg min-w-[180px]",
        isSent ? "bg-primary/20" : "bg-muted"
      )}
      data-testid={`voice-player-${messageId}`}
    >
      <audio ref={audioRef} preload="none" />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={togglePlay}
        disabled={isLoading || !urlData?.url}
        data-testid="button-voice-play"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      <div className="flex-1 flex flex-col gap-1">
        <div
          ref={progressRef}
          className="h-1.5 bg-muted-foreground/20 rounded-full cursor-pointer overflow-hidden"
          onClick={handleProgressClick}
          role="progressbar"
          aria-valuenow={currentTime}
          aria-valuemin={0}
          aria-valuemax={durationSeconds}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-100",
              isSent ? "bg-primary-foreground" : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span data-testid="text-voice-current">
            {formatDuration(currentTime)}
          </span>
          <span data-testid="text-voice-total">
            {formatDuration(durationSeconds)}
          </span>
        </div>
      </div>
    </div>
  );
}
