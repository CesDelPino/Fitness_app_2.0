import ReviewModal from "../ReviewModal";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ReviewModalExample() {
  const [open, setOpen] = useState(false);

  const mockData = {
    foodName: "Grilled Chicken Breast",
    estimatedQuantity: 200,
    unit: "grams",
    totalMacros: {
      calories: 330,
      protein: 62,
      carbs: 0,
      fat: 7,
    },
    ratePerUnit: {
      unitBasis: "1 gram",
      calories: 1.65,
      protein: 0.31,
      carbs: 0,
      fat: 0.035,
    },
  };

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Review Modal</Button>
      <ReviewModal
        open={open}
        onClose={() => setOpen(false)}
        data={mockData}
        onSave={(data) => {
          console.log("Saved:", data);
          setOpen(false);
        }}
      />
    </div>
  );
}
