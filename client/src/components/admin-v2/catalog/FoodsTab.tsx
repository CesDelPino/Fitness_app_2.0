import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Database } from "lucide-react";
import { FoodLibrarySection } from "./FoodLibrarySection";
import { FoodVerificationSection } from "./FoodVerificationSection";

export function FoodsTab() {
  const [activeTab, setActiveTab] = useState<"library" | "verification">("library");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Food Management</h2>
        <p className="text-sm text-muted-foreground">Browse food library and manage AI-generated food entries</p>
      </div>
      
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === "library" ? "default" : "ghost"}
          onClick={() => setActiveTab("library")}
          data-testid="tab-food-library"
        >
          <Database className="w-4 h-4 mr-2" />
          Food Library
        </Button>
        <Button
          variant={activeTab === "verification" ? "default" : "ghost"}
          onClick={() => setActiveTab("verification")}
          data-testid="tab-food-verification"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          AI Verification
        </Button>
      </div>
      
      <div className="mt-6">
        {activeTab === "library" ? (
          <FoodLibrarySection key="library-section" />
        ) : (
          <FoodVerificationSection key="verification-section" />
        )}
      </div>
    </div>
  );
}
