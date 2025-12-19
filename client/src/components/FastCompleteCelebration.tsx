import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Sparkles, Star } from "lucide-react";

interface FastCompleteCelebrationProps {
  open: boolean;
  duration: string | null;
  onDismiss: () => void;
}

interface ConfettiPiece {
  id: number;
  left: number;
  animationDelay: number;
  color: string;
  size: number;
  rotation: number;
}

function Confetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  
  useEffect(() => {
    const colors = [
      "hsl(var(--primary))",
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
    ];
    
    const newPieces: ConfettiPiece[] = [];
    for (let i = 0; i < 50; i++) {
      newPieces.push({
        id: i,
        left: Math.random() * 100,
        animationDelay: Math.random() * 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
      });
    }
    setPieces(newPieces);
  }, []);
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${piece.left}%`,
            top: "-20px",
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            backgroundColor: piece.color,
            borderRadius: piece.id % 2 === 0 ? "50%" : "2px",
            transform: `rotate(${piece.rotation}deg)`,
            animationDelay: `${piece.animationDelay}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function FastCompleteCelebration({
  open,
  duration,
  onDismiss,
}: FastCompleteCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  
  useEffect(() => {
    if (open) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [open]);
  
  return (
    <>
      {showConfetti && <Confetti />}
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
        <DialogContent 
          className="text-center"
          data-testid="dialog-fast-celebration"
        >
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center animate-pulse">
                  <Trophy className="w-10 h-10 text-primary-foreground" />
                </div>
                <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-chart-1 animate-bounce" />
                <Star className="absolute -bottom-1 -left-2 w-5 h-5 text-chart-2 animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
            </div>
            <DialogTitle className="text-2xl" data-testid="text-celebration-title">
              Congratulations!
            </DialogTitle>
            <DialogDescription className="text-base">
              You completed your fast!
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6">
            <div className="text-4xl font-bold text-primary" data-testid="text-fast-duration">
              {duration}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Total fasting time
            </p>
          </div>
          
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Great job staying committed to your health goals!</p>
          </div>
          
          <Button 
            onClick={onDismiss} 
            className="w-full mt-4"
            data-testid="button-dismiss-celebration"
          >
            Continue
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
