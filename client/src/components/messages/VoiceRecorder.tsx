import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, X, Send, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, durationSeconds: number) => void;
  onCancel: () => void;
  isSending?: boolean;
  maxDuration?: number;
}

type RecordingState = "idle" | "requesting" | "recording" | "preview" | "error";

function getSupportedMimeType(): string | null {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return null;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function VoiceRecorder({
  onSend,
  onCancel,
  isSending = false,
  maxDuration = 120,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const isSupported = typeof MediaRecorder !== "undefined" && getSupportedMimeType() !== null;

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  }, [audioUrl]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = async () => {
    if (!isSupported) {
      setError("Voice recording is not supported in this browser");
      setState("error");
      return;
    }

    setState("requesting");
    setError(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType()!;
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setState("preview");
      };

      mediaRecorder.onerror = () => {
        setError("Recording failed");
        setState("error");
        cleanup();
      };

      mediaRecorder.start(100);
      startTimeRef.current = Date.now();
      setState("recording");

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);

        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 100);
    } catch (err: any) {
      console.error("Microphone access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Microphone access denied. Please allow microphone access to record voice messages.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setError("No microphone found. Please connect a microphone to record voice messages.");
      } else {
        setError("Could not access microphone. Please try again.");
      }
      setState("error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const cancelRecording = () => {
    cleanup();
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setState("idle");
    onCancel();
  };

  const sendRecording = () => {
    if (audioBlob && duration > 0) {
      onSend(audioBlob, duration);
    }
  };

  const retryRecording = () => {
    cleanup();
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
    setState("idle");
  };

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span>Voice recording not supported</span>
        <Button variant="ghost" size="sm" onClick={onCancel} data-testid="button-voice-close">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex items-center gap-2 p-3">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <span className="text-sm text-destructive flex-1">{error}</span>
        <Button variant="ghost" size="sm" onClick={retryRecording} data-testid="button-voice-retry">
          Retry
        </Button>
        <Button variant="ghost" size="sm" onClick={cancelRecording} data-testid="button-voice-cancel">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (state === "idle" || state === "requesting") {
    return (
      <div className="flex items-center gap-2 p-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={startRecording}
          disabled={state === "requesting"}
          data-testid="button-voice-start"
          aria-label={state === "requesting" ? "Requesting microphone access" : "Start recording"}
        >
          {state === "requesting" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Mic className="h-5 w-5 text-primary" />
          )}
        </Button>
        <span className="text-sm text-muted-foreground">
          {state === "requesting" ? "Requesting microphone..." : "Tap to record"}
        </span>
        <Button variant="ghost" size="sm" onClick={onCancel} data-testid="button-voice-cancel" aria-label="Cancel recording">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (state === "recording") {
    return (
      <div 
        className="flex items-center gap-3 p-3 bg-destructive/10 rounded-lg"
        role="status"
        aria-live="polite"
        aria-label={`Recording in progress. Duration: ${formatDuration(duration)}`}
      >
        <div className="relative" aria-hidden="true">
          <div className="absolute inset-0 bg-destructive/20 rounded-full animate-ping" />
          <div className="relative h-3 w-3 bg-destructive rounded-full" />
        </div>
        <span className="text-sm font-medium tabular-nums" data-testid="text-voice-duration">
          {formatDuration(duration)}
        </span>
        <span className="text-sm text-muted-foreground">/ {formatDuration(maxDuration)}</span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={cancelRecording}
          data-testid="button-voice-cancel"
          aria-label="Cancel and discard recording"
        >
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={stopRecording}
          data-testid="button-voice-stop"
          aria-label="Stop recording and preview"
        >
          <Square className="h-4 w-4 mr-1" />
          Stop
        </Button>
      </div>
    );
  }

  if (state === "preview") {
    return (
      <div 
        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
        role="region"
        aria-label={`Voice memo preview, ${formatDuration(duration)} seconds`}
      >
        {audioUrl && (
          <audio
            src={audioUrl}
            controls
            className="h-8 flex-1"
            data-testid="audio-voice-preview"
            aria-label="Voice memo audio preview"
          />
        )}
        <span className="text-sm tabular-nums" data-testid="text-voice-preview-duration">
          {formatDuration(duration)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={retryRecording}
          disabled={isSending}
          data-testid="button-voice-retry"
          aria-label="Discard and record again"
        >
          <X className="h-4 w-4 mr-1" />
          Discard
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={sendRecording}
          disabled={isSending}
          data-testid="button-voice-send"
          aria-label={isSending ? "Sending voice memo" : "Send voice memo"}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-1" />
          )}
          Send
        </Button>
      </div>
    );
  }

  return null;
}
