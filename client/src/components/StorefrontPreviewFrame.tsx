import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye } from "lucide-react";
import { Link } from "wouter";

interface StorefrontPreviewFrameProps {
  children: ReactNode;
}

export default function StorefrontPreviewFrame({ children }: StorefrontPreviewFrameProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-50 bg-muted border-b">
        <div className="container max-w-4xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Preview Mode</span>
            <Badge variant="secondary" className="text-xs">
              This is how clients see your storefront
            </Badge>
          </div>
          <Link href="/pro/storefront">
            <Button 
              size="sm" 
              variant="outline"
              data-testid="button-return-pro-portal"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Return to Pro Portal
            </Button>
          </Link>
        </div>
      </div>
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
