import { Camera, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";

interface QuickActionsProps {
  onCameraClick: () => void;
  onTextClick: () => void;
}

export default function QuickActions({
  onCameraClick,
  onTextClick,
}: QuickActionsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card
        className="flex flex-col items-center justify-center min-h-32 hover-elevate active-elevate-2 cursor-pointer"
        onClick={onCameraClick}
        data-testid="button-camera"
      >
        <Camera className="w-10 h-10 text-primary mb-2" />
        <span className="text-lg font-medium">Camera</span>
      </Card>

      <Card
        className="flex flex-col items-center justify-center min-h-32 hover-elevate active-elevate-2 cursor-pointer"
        onClick={onTextClick}
        data-testid="button-text"
      >
        <MessageSquare className="w-10 h-10 text-primary mb-2" />
        <span className="text-lg font-medium">Text</span>
      </Card>
    </div>
  );
}
