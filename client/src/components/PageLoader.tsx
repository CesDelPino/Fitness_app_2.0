import { Loader2 } from "lucide-react";

export default function PageLoader() {
  return (
    <div 
      className="flex items-center justify-center min-h-screen"
      data-testid="page-loader"
    >
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
