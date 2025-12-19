import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import ProgressRing from "@/components/ProgressRing";
import MacroRing from "@/components/MacroRing";
import MealSection, { type FoodLogItem } from "@/components/MealSection";
import ReviewModal, { type AIFoodData } from "@/components/ReviewModal";
import BarcodeScannerDialog from "@/components/BarcodeScannerDialog";
import EditFoodModal, { type EditableFoodLog } from "@/components/EditFoodModal";
import TextFallbackDialog from "@/components/TextFallbackDialog";
import ManualEntryModal from "@/components/ManualEntryModal";
import FoodSearchModal, { type FDAFoodSelection, type FoodSelectionResult } from "@/components/FoodSearchModal";
import FoodMatchSelector from "@/components/FoodMatchSelector";
import { type FDAFood, type FoodNutrient, extractMacrosFromSnapshot } from "@/hooks/use-nutrition";
import FastSetup from "@/components/FastSetup";
import ActiveFast from "@/components/ActiveFast";
import EndFastConfirmModal from "@/components/EndFastConfirmModal";
import { PendingNutritionTargetsBanner } from "@/components/PendingNutritionTargetsBanner";
import FastCompleteCelebration from "@/components/FastCompleteCelebration";
import Footer from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageButton } from "@/components/messages/MessageButton";
import { queryClient, apiRequest, fetchJson } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useFastingController } from "@/hooks/useFastingController";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useClientPermissions, findExclusiveHolder } from "@/lib/permissions";
import { useWaterIntake, useAddWater } from "@/lib/water";
import type { Food } from "@shared/schema";
import { 
  getFoodLogs, 
  createFoodLog, 
  updateFoodLog as updateFoodLogSupabase, 
  deleteFoodLog as deleteFoodLogSupabase,
  getUserProfile,
  startFast as startFastSupabase,
  type FoodWithBarcodes,
  type UserProfile,
} from "@/lib/supabase-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Coffee, Sun, Sunset, Cookie } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Camera, Type, ChevronLeft, ChevronRight, Scan, UserPlus, Droplets, Plus, Clock } from "lucide-react";
import { format } from "date-fns";
import { useUnitPreferences } from "@/hooks/useUnitPreferences";
import { Progress } from "@/components/ui/progress";

interface BarcodeFoodData {
  barcode: string;
  foodName: string;
  brand?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [inputMode, setInputMode] = useState<"text" | "camera">("text");
  const [textDescription, setTextDescription] = useState("");
  const [reviewData, setReviewData] = useState<AIFoodData | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string>("");
  const [showFastSetup, setShowFastSetup] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFoodLog, setEditingFoodLog] = useState<EditableFoodLog | null>(null);
  const [pendingFoodData, setPendingFoodData] = useState<AIFoodData | null>(null);
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [showFindProComingSoon, setShowFindProComingSoon] = useState(false);
  const [barcodeFoodForPortion, setBarcodeFoodForPortion] = useState<FDAFood | null>(null);
  const [fallbackPrefillData, setFallbackPrefillData] = useState<Partial<AIFoodData> | null>(null);
  const [manualFormData, setManualFormData] = useState<{
    foodName: string;
    servingSize: string;
    numberOfServings: number;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    isInitialized: boolean;
  }>({
    foodName: "",
    servingSize: "1 serving",
    numberOfServings: 1,
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    isInitialized: false,
  });
  
  const fastingController = useFastingController();
  const { isPremium } = useFeatureAccess();
  
  const { data: permissionsData } = useClientPermissions();
  const nutritionTargetsPro = permissionsData?.relationships 
    ? findExclusiveHolder('set_nutrition_targets', permissionsData.relationships)
    : null;

  // Water intake tracking
  const { data: waterData } = useWaterIntake(selectedDate);
  const addWaterMutation = useAddWater();
  const { foodVolume } = useUnitPreferences();

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Water display helpers based on unit preference
  const formatWaterAmount = (ml: number) => {
    if (foodVolume.unit === 'fl_oz') {
      const flOz = ml * 0.033814;
      return `${Math.round(flOz)} fl oz`;
    }
    return `${ml} ml`;
  };

  const waterProgress = waterData?.target_ml ? (waterData.total_ml / waterData.target_ml) * 100 : 0;
  const waterPresets = foodVolume.unit === 'fl_oz' ? [8, 16] : [250, 500]; // fl oz or ml

  const today = new Date();
  const startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const endOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1);
  const isToday = selectedDate.toDateString() === today.toDateString();
  const dateString = format(startOfDay, "yyyy-MM-dd");

  // Helper to get timestamp for backfill logging based on meal type
  const getLoggedAtTimestamp = (mealType: string): string | undefined => {
    if (isToday) return undefined; // Use server default for today
    
    // Default times for each meal type
    const mealTimes: Record<string, number> = {
      breakfast: 8,  // 8:00 AM
      lunch: 12,     // 12:00 PM
      dinner: 19,    // 7:00 PM
      snack: 15,     // 3:00 PM
    };
    
    const hour = mealTimes[mealType] ?? 12; // Default to noon if unknown
    const logDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), hour, 0, 0);
    return logDate.toISOString();
  };

  const { data: user } = useQuery<UserProfile | null>({
    queryKey: ["user-profile"],
    queryFn: () => getUserProfile(),
  });

  const { data: foodLogs = [], isLoading } = useQuery({
    queryKey: ["food-logs", dateString],
    queryFn: async () => {
      const result = await getFoodLogs(startOfDay, endOfDay);
      return result ?? [];
    },
  });



  const analyzeMutation = useMutation({
    mutationFn: async ({ type, data }: { type: "text" | "image"; data: string | File }) => {
      if (type === "text") {
        const response = await apiRequest("POST", "/api/analyze/text", { description: data });
        return response.json();
      } else {
        const formData = new FormData();
        formData.append("image", data as File);
        const response = await fetch("/api/analyze/image", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to analyze image");
        return response.json();
      }
    },
    onSuccess: (data) => {
      setReviewData(data);
      setShowReviewModal(true);
      setShowInputModal(false);
      setTextDescription("");
    },
    onError: () => {
      toast({
        title: "Analysis failed",
        description: "Could not analyze the food. Please try again.",
        variant: "destructive",
      });
    },
  });

  const barcodeLookupMutation = useMutation({
    mutationFn: async (barcode: string) => {
      return fetchJson<FDAFood>(`/api/nutrition/barcode/${barcode}`, { allow404: false });
    },
    onSuccess: (data) => {
      if (!data) return;
      setBarcodeFoodForPortion(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Barcode not found",
        description: error.message?.includes("404") || error.message?.includes("not found")
          ? "Product not found. Try scanning again or use camera/text input." 
          : "Failed to lookup barcode. Please try again.",
        variant: "destructive",
      });
      setShowBarcodeScanner(false);
    },
  });

  const handleBarcodePortionConfirm = (result: FoodSelectionResult) => {
    const food = barcodeFoodForPortion;
    setBarcodeFoodForPortion(null);
    
    const aiData: AIFoodData = {
      foodName: result.foodName,
      servingSize: result.servingSize,
      servingSizeGrams: result.servingSizeGrams ?? undefined,
      numberOfServings: result.numberOfServings,
      macrosPerServing: result.macrosPerServing,
      barcode: food?.gtinUpc,
      fdcId: result.fdcId,
      nutrientSnapshot: result.nutrientSnapshot,
      portions: result.portions,
      nutrientsPer100g: {
        calories: result.nutrientsPer100g.calories ?? 0,
        protein: result.nutrientsPer100g.protein ?? 0,
        carbs: result.nutrientsPer100g.carbs ?? 0,
        fat: result.nutrientsPer100g.fat ?? 0,
      },
    };
    
    setReviewData(aiData);
    setShowReviewModal(true);
    setShowInputModal(false);
  };

  const createLogMutation = useMutation({
    mutationFn: async (data: AIFoodData & { mealType: string; breaksFast?: boolean; loggedAt?: string }) => {
      const totalCalories = Math.round(data.numberOfServings * data.macrosPerServing.calories);
      const totalProtein = Math.round(data.numberOfServings * data.macrosPerServing.protein * 10) / 10;
      const totalCarbs = Math.round(data.numberOfServings * data.macrosPerServing.carbs * 10) / 10;
      const totalFat = Math.round(data.numberOfServings * data.macrosPerServing.fat * 10) / 10;

      const result = await createFoodLog({
        foodName: data.foodName,
        quantityValue: data.numberOfServings,
        quantityUnit: data.servingSize,
        calories: totalCalories,
        proteinG: totalProtein,
        carbsG: totalCarbs,
        fatG: totalFat,
        caloriesPerUnit: data.macrosPerServing.calories,
        proteinPerUnit: data.macrosPerServing.protein,
        carbsPerUnit: data.macrosPerServing.carbs,
        fatPerUnit: data.macrosPerServing.fat,
        micronutrientsDump: (data as any).micronutrients || {},
        mealType: data.mealType,
        breaksFast: data.breaksFast,
        barcode: data.barcode,
        loggedAt: data.loggedAt,
        nutrientSnapshot: data.nutrientSnapshot,
      });
      
      fetch("/api/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          canonicalName: data.foodName,
          caloriesPerServing: data.macrosPerServing.calories,
          proteinPerServing: data.macrosPerServing.protein,
          carbsPerServing: data.macrosPerServing.carbs,
          fatPerServing: data.macrosPerServing.fat,
          defaultServingSize: data.servingSize,
          barcode: data.barcode,
          source: "ai_text" as const,
        }),
      }).catch(() => {});
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food-logs", dateString] });
      queryClient.invalidateQueries({ queryKey: ["food-logs-history"] });
      queryClient.invalidateQueries({ queryKey: ["active-fast"] });
      setShowReviewModal(false);
      setPendingFoodData(null);
      setSelectedMealType("");
      setTextDescription("");
      toast({
        title: "Food logged",
        description: "Your meal has been added successfully.",
      });
    },
    onError: (error: Error) => {
      console.error("Failed to save food log:", error);
      toast({
        title: "Failed to save",
        description: error.message || "Could not save the food entry. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteLogMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteFoodLogSupabase(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food-logs", dateString] });
      queryClient.invalidateQueries({ queryKey: ["food-logs-history"] });
      toast({
        title: "Food removed",
        description: "The entry has been deleted.",
      });
    },
  });

  const updateFoodLogMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: {
      quantityValue: number;
      calories: number;
      proteinG: number | null;
      carbsG: number | null;
      fatG: number | null;
    }}) => {
      return await updateFoodLogSupabase(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food-logs", dateString] });
      queryClient.invalidateQueries({ queryKey: ["food-logs-history"] });
      setShowEditModal(false);
      setEditingFoodLog(null);
      toast({
        title: "Food updated",
        description: "Your entry has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Could not update the food entry.",
        variant: "destructive",
      });
    },
  });

  const startFastMutation = useMutation({
    mutationFn: async (endTime: Date) => {
      const now = new Date();
      const durationMinutes = Math.round((endTime.getTime() - now.getTime()) / (1000 * 60));
      return startFastSupabase({
        endTime: endTime.toISOString(),
        plannedDurationMinutes: durationMinutes,
        fastMode: 'duration',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-fast"] });
      setShowFastSetup(false);
      toast({
        title: "Fast started",
        description: "Your fast is now active. Good luck!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start fast",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const transformedLogs: FoodLogItem[] = foodLogs.map((log: any) => {
    const snapshotMacros = log.nutrientSnapshot ? extractMacrosFromSnapshot(log.nutrientSnapshot) : null;
    
    return {
      id: log.id,
      time: new Date(log.timestamp).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      foodName: log.foodName,
      calories: snapshotMacros?.calories ?? log.calories ?? 0,
      protein: snapshotMacros?.protein ?? log.proteinG ?? null,
      carbs: snapshotMacros?.carbs ?? log.carbsG ?? null,
      fat: snapshotMacros?.fat ?? log.fatG ?? null,
      fiber: snapshotMacros?.fiber ?? log.fiberG ?? null,
      sugar: snapshotMacros?.sugar ?? log.sugarG ?? null,
      mealType: log.mealType,
      quantityValue: log.quantityValue,
      quantityUnit: log.quantityUnit,
      caloriesPerUnit: log.caloriesPerUnit,
      proteinPerUnit: log.proteinPerUnit,
      carbsPerUnit: log.carbsPerUnit,
      fatPerUnit: log.fatPerUnit,
      fiberPerUnit: log.fiberPerUnit ?? null,
      sugarPerUnit: log.sugarPerUnit ?? null,
      nutrientSnapshot: log.nutrientSnapshot ?? null,
    };
  });

  const handleEditFood = (log: FoodLogItem) => {
    setEditingFoodLog({
      id: log.id,
      foodName: log.foodName,
      quantityValue: log.quantityValue || 1,
      quantityUnit: log.quantityUnit || "serving",
      calories: log.calories,
      proteinG: log.protein,
      carbsG: log.carbs,
      fatG: log.fat,
      caloriesPerUnit: log.caloriesPerUnit ?? null,
      proteinPerUnit: log.proteinPerUnit ?? null,
      carbsPerUnit: log.carbsPerUnit ?? null,
      fatPerUnit: log.fatPerUnit ?? null,
    });
    setShowEditModal(true);
  };

  const handleSaveFoodEdit = (id: string, updates: {
    quantityValue: number;
    calories: number;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  }) => {
    updateFoodLogMutation.mutate({ id, updates });
  };

  const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snacks"];
  const mealTypeMap: Record<string, string> = {
    "breakfast": "Breakfast",
    "lunch": "Lunch",
    "dinner": "Dinner",
    "snack": "Snacks",
  };
  
  const logsByMeal = mealTypes.reduce((acc, displayMealType) => {
    const serverMealType = Object.keys(mealTypeMap).find(
      key => mealTypeMap[key] === displayMealType
    );
    acc[displayMealType] = transformedLogs.filter(
      log => log.mealType === serverMealType
    );
    return acc;
  }, {} as Record<string, FoodLogItem[]>);

  const totalCalories = transformedLogs.reduce((sum, log) => sum + log.calories, 0);
  const totalProtein = transformedLogs.reduce((sum, log) => sum + (log.protein ?? 0), 0);
  const totalCarbs = transformedLogs.reduce((sum, log) => sum + (log.carbs ?? 0), 0);
  const totalFat = transformedLogs.reduce((sum, log) => sum + (log.fat ?? 0), 0);

  const handleSelectMeal = (mealType: string) => {
    setSelectedMealType(mealType);
    setShowFoodSearch(true);
  };

  const handleAddWater = (amountMl: number) => {
    addWaterMutation.mutate(
      { date: dateString, amount_ml: amountMl },
      {
        onSuccess: (data) => {
          const displayAmount = formatWaterAmount(amountMl);
          toast({
            title: "Water logged",
            description: `Added ${displayAmount} of water`,
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to log water intake",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleSelectFDAFood = async (food: FDAFoodSelection) => {
    setShowFoodSearch(false);
    
    let fullFoodDetails: FDAFood | null = null;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(`/api/nutrition/foods/${food.fdcId}`, { headers });
      if (response.ok) {
        const data = await response.json();
        fullFoodDetails = data.food || data;
      }
    } catch (err) {
      console.warn("Could not fetch full food details, using search data", err);
    }
    
    const nutrients = fullFoodDetails?.nutrients || food.nutrients;
    const portions = fullFoodDetails?.portions || undefined;
    
    const getNutrient = (id: number) => {
      const n = nutrients.find(n => n.fdcNutrientId === id);
      if (!n) return 0;
      return n.amountPer100g ?? n.amountPerServing ?? 0;
    };
    const calories = getNutrient(1008);
    const protein = getNutrient(1003);
    const carbs = getNutrient(1005);
    const fat = getNutrient(1004);

    const servingLabel = food.householdServingFullText
      ? food.householdServingFullText
      : food.servingSize && food.servingSizeUnit
        ? `${food.servingSize}${food.servingSizeUnit}`
        : "100g";
    
    const aiData: AIFoodData = {
      foodName: food.brandOwner || food.brandName
        ? `${food.brandOwner || food.brandName} ${food.description}`
        : food.description,
      servingSize: servingLabel,
      servingSizeGrams: food.servingSize || undefined,
      numberOfServings: 1,
      macrosPerServing: {
        calories: Math.round(calories),
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat),
      },
      fdcId: food.fdcId,
      nutrientSnapshot: {
        fdcId: food.fdcId,
        dataType: food.dataType,
        nutrients: nutrients.map(n => ({
          id: n.fdcNutrientId,
          name: n.name,
          unit: n.unit,
          value: n.amountPer100g ?? n.amountPerServing ?? 0,
        })),
        fetchedAt: new Date().toISOString(),
      },
      portions,
      nutrientsPer100g: {
        calories: Math.round(calories),
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat),
      },
    };
    
    setReviewData(aiData);
    setShowReviewModal(true);
  };

  const handleSelectFoodWithPortion = (result: FoodSelectionResult) => {
    setShowFoodSearch(false);
    
    const aiData: AIFoodData = {
      foodName: result.foodName,
      servingSize: result.servingSize,
      servingSizeGrams: result.servingSizeGrams ?? undefined,
      numberOfServings: result.numberOfServings,
      macrosPerServing: result.macrosPerServing,
      fdcId: result.fdcId,
      nutrientSnapshot: result.nutrientSnapshot,
      portions: result.portions,
      nutrientsPer100g: {
        calories: result.nutrientsPer100g.calories ?? 0,
        protein: result.nutrientsPer100g.protein ?? 0,
        carbs: result.nutrientsPer100g.carbs ?? 0,
        fat: result.nutrientsPer100g.fat ?? 0,
      },
    };
    
    setReviewData(aiData);
    setShowReviewModal(true);
  };

  const handleSearchFallbackText = () => {
    setShowFoodSearch(false);
    setInputMode("text");
    setShowInputModal(true);
  };

  const handleSearchFallbackPhoto = () => {
    setShowFoodSearch(false);
    handleCameraClick();
  };

  const handleSearchFallbackBarcode = () => {
    setShowFoodSearch(false);
    setShowBarcodeScanner(true);
  };

  const handleSearchFallbackManual = () => {
    setShowFoodSearch(false);
    setManualFormData({
      foodName: "",
      servingSize: "1 serving",
      numberOfServings: 1,
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
      isInitialized: false,
    });
    setShowManualEntry(true);
  };

  const handleStartFast = () => {
    setShowFastSetup(true);
  };

  const handleCameraClick = () => {
    setInputMode("camera");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        setImageFile(file);
        analyzeMutation.mutate({ type: "image", data: file });
        setShowInputModal(false);
      }
    };
    input.click();
  };

  const handleTextSubmit = () => {
    if (textDescription.trim()) {
      analyzeMutation.mutate({ type: "text", data: textDescription });
      setShowInputModal(false);
    }
  };

  const handleSaveFood = (data: AIFoodData) => {
    const normalizeMealType = (type: string): string => {
      const mapping: Record<string, string> = {
        "Breakfast": "breakfast",
        "Lunch": "lunch",
        "Dinner": "dinner",
        "Snacks": "snack",
      };
      return mapping[type] || type.toLowerCase();
    };
    
    const normalizedMealType = normalizeMealType(selectedMealType);
    const loggedAt = getLoggedAtTimestamp(normalizedMealType);
    
    if (fastingController.activeFast) {
      setPendingFoodData(data);
      setShowReviewModal(false);
      fastingController.requestEndForFood(() => {
        createLogMutation.mutate({ ...data, mealType: normalizedMealType, loggedAt });
        setPendingFoodData(null);
      });
    } else {
      createLogMutation.mutate({ ...data, mealType: normalizedMealType, loggedAt });
    }
  };

  const handleDeleteLog = (id: string) => {
    deleteLogMutation.mutate(id);
  };

  const handleFallbackToText = () => {
    setFallbackPrefillData(reviewData);
    setShowReviewModal(false);
    setShowTextFallback(true);
  };

  const handleTextFallbackAnalyze = (description: string) => {
    analyzeMutation.mutate(
      { type: "text", data: description },
      {
        onSuccess: (data) => {
          setReviewData(data);
          setShowTextFallback(false);
          setShowReviewModal(true);
        },
      }
    );
  };

  const handleManualEntry = () => {
    setShowTextFallback(false);
    if (!manualFormData.isInitialized && fallbackPrefillData) {
      setManualFormData({
        foodName: fallbackPrefillData.foodName || "",
        servingSize: fallbackPrefillData.servingSize || "1 serving",
        numberOfServings: fallbackPrefillData.numberOfServings || 1,
        calories: fallbackPrefillData.macrosPerServing?.calories?.toString() || "",
        protein: fallbackPrefillData.macrosPerServing?.protein?.toString() || "",
        carbs: fallbackPrefillData.macrosPerServing?.carbs?.toString() || "",
        fat: fallbackPrefillData.macrosPerServing?.fat?.toString() || "",
        isInitialized: true,
      });
    }
    setShowManualEntry(true);
  };

  const handleManualSave = (data: AIFoodData) => {
    const normalizeMealType = (type: string): string => {
      const mapping: Record<string, string> = {
        "Breakfast": "breakfast",
        "Lunch": "lunch",
        "Dinner": "dinner",
        "Snacks": "snack",
      };
      return mapping[type] || type.toLowerCase();
    };
    
    const normalizedMealType = normalizeMealType(selectedMealType);
    const loggedAt = getLoggedAtTimestamp(normalizedMealType);
    
    if (fastingController.activeFast) {
      setPendingFoodData(data);
      setShowManualEntry(false);
      fastingController.requestEndForFood(() => {
        createLogMutation.mutate({ ...data, mealType: normalizedMealType, loggedAt });
        setPendingFoodData(null);
      });
    } else {
      createLogMutation.mutate(
        { ...data, mealType: normalizedMealType, loggedAt },
        {
          onSuccess: () => {
            setShowManualEntry(false);
            setFallbackPrefillData(null);
            setManualFormData({
              foodName: "",
              servingSize: "1 serving",
              numberOfServings: 1,
              calories: "",
              protein: "",
              carbs: "",
              fat: "",
              isInitialized: false,
            });
          },
        }
      );
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        <section className="text-center space-y-1" data-testid="greeting-section">
          <p className="text-sm text-muted-foreground">{getGreeting()},</p>
          <h2 className="text-2xl font-semibold tracking-tight">{user?.displayName?.split(' ')[0] || 'there'}</h2>
        </section>

        <ProgressRing
          eaten={totalCalories}
          target={user?.dailyCalorieTarget || 2100}
        />

        <PendingNutritionTargetsBanner />

        {fastingController.activeFast && (
          <ActiveFast
            fast={fastingController.activeFast}
            onEnd={fastingController.requestManualEnd}
            onTimerExpired={fastingController.handleTimerExpired}
            isPending={fastingController.isPending}
          />
        )}

        {user?.proteinTargetG != null && user?.carbsTargetG != null && user?.fatTargetG != null && (
          <section data-testid="nutrition-targets-section">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">Nutrition Targets</h2>
              {nutritionTargetsPro ? (
                <div 
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  data-testid="nutrition-pro-attribution"
                >
                  <span>Monitored by</span>
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={nutritionTargetsPro.professional_avatar || undefined} />
                    <AvatarFallback className="text-xs">
                      {nutritionTargetsPro.professional_name?.charAt(0) || 'P'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-foreground">
                    {nutritionTargetsPro.professional_name}
                  </span>
                  <MessageButton
                    userId={nutritionTargetsPro.professional_id}
                    userName={nutritionTargetsPro.professional_name}
                    size="sm"
                    className="h-6 w-6"
                  />
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFindProComingSoon(true)}
                  className="flex items-center gap-2"
                  data-testid="button-find-professional"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{isPremium ? "Find a Professional" : "Unlock with Premium"}</span>
                </Button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <MacroRing
                label="Protein"
                current={totalProtein}
                target={user.proteinTargetG}
                color="hsl(var(--chart-1))"
              />
              <MacroRing
                label="Carbs"
                current={totalCarbs}
                target={user.carbsTargetG}
                color="hsl(var(--chart-2))"
              />
              <MacroRing
                label="Fat"
                current={totalFat}
                target={user.fatTargetG}
                color="hsl(var(--chart-3))"
              />
            </div>
          </section>
        )}

        <section className="space-y-4" data-testid="water-tracker-section">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Droplets className="w-5 h-5 text-blue-500" />
              Water
            </h3>
            <span className="text-sm text-muted-foreground">
              {formatWaterAmount(waterData?.total_ml || 0)} / {formatWaterAmount(waterData?.target_ml || 2000)}
            </span>
          </div>
          <div className="space-y-2">
            <Progress value={waterProgress} className="h-2" data-testid="progress-water" />
            <div className="flex gap-2">
              {waterPresets.map((amount) => {
                const mlAmount = foodVolume.unit === 'fl_oz' ? Math.round(amount * 29.5735) : amount;
                const displayLabel = foodVolume.unit === 'fl_oz' ? `${amount} fl oz` : `${amount}ml`;
                return (
                  <Button 
                    key={amount} 
                    size="sm" 
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white border-blue-600"
                    onClick={() => handleAddWater(mlAmount)}
                    disabled={addWaterMutation.isPending}
                    data-testid={`button-add-water-${amount}`}
                  >
                    {addWaterMutation.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3 mr-1" />
                    )}
                    {displayLabel}
                  </Button>
                );
              })}
            </div>
          </div>
          <Button
            size="sm"
            className={`w-full ${
              fastingController.activeFast 
                ? "bg-red-500 hover:bg-red-600 text-white border-red-600" 
                : "bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
            }`}
            onClick={fastingController.activeFast ? fastingController.requestManualEnd : handleStartFast}
            disabled={fastingController.isPending}
            data-testid={fastingController.activeFast ? "button-stop-fasting" : "button-start-fasting"}
          >
            <Clock className="w-4 h-4 mr-1" />
            {fastingController.activeFast ? "Stop Fasting" : "Start Fasting"}
          </Button>
        </section>

        
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() - 1);
              setSelectedDate(newDate);
            }}
            disabled={(() => {
              // Calculate 7 days ago from today (start of that day)
              const sevenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
              // Compare date strings to avoid time component issues
              return format(selectedDate, "yyyy-MM-dd") <= format(sevenDaysAgo, "yyyy-MM-dd");
            })()}
            data-testid="button-prev-day"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <h2 className="text-lg font-semibold">
            {isToday ? "Today's Meals" : format(selectedDate, "dd MMM yy")}
          </h2>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() + 1);
              if (newDate <= today) {
                setSelectedDate(newDate);
              }
            }}
            disabled={isToday}
            data-testid="button-next-day"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {!isToday && (
          <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-md py-2 px-3" data-testid="backfill-indicator">
            Food logged will be added to {format(selectedDate, "MMMM d")}
          </div>
        )}

        <div className="space-y-4">
          <h2 className="sr-only">Meals for {format(selectedDate, "MMMM d, yyyy")}</h2>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4" data-testid="meals-container">
              {mealTypes.map((mealType) => (
                <MealSection
                  key={mealType}
                  mealType={mealType}
                  logs={logsByMeal[mealType]}
                  onDelete={handleDeleteLog}
                  onEdit={handleEditFood}
                  onAdd={handleSelectMeal}
                  defaultExpanded={logsByMeal[mealType].length > 0}
                />
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    size="lg"
                    className="w-full h-14 text-base gap-2"
                    data-testid="button-add-food"
                  >
                    <Plus className="w-5 h-5" />
                    Add Food
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="center">
                  <DropdownMenuItem
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    onClick={() => handleSelectMeal("Breakfast")}
                    data-testid="dropdown-item-breakfast"
                  >
                    <Coffee className="w-5 h-5" />
                    <span className="text-base">Breakfast</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    onClick={() => handleSelectMeal("Lunch")}
                    data-testid="dropdown-item-lunch"
                  >
                    <Sun className="w-5 h-5" />
                    <span className="text-base">Lunch</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    onClick={() => handleSelectMeal("Dinner")}
                    data-testid="dropdown-item-dinner"
                  >
                    <Sunset className="w-5 h-5" />
                    <span className="text-base">Dinner</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    onClick={() => handleSelectMeal("Snacks")}
                    data-testid="dropdown-item-snacks"
                  >
                    <Cookie className="w-5 h-5" />
                    <span className="text-base">Snacks</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

      </main>

      <Dialog open={showInputModal} onOpenChange={setShowInputModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to {selectedMealType}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => {
                  setShowBarcodeScanner(true);
                  setShowInputModal(false);
                }}
                data-testid="button-scan-barcode"
              >
                <Scan className="w-6 h-6" />
                <span>Scan Barcode</span>
              </Button>
              <Button
                variant={inputMode === "camera" ? "default" : "outline"}
                className="h-24 flex-col gap-2"
                onClick={handleCameraClick}
                data-testid="button-camera"
              >
                <Camera className="w-6 h-6" />
                <span>Food Picture</span>
              </Button>
              <Button
                variant={inputMode === "text" ? "default" : "outline"}
                className="h-24 flex-col gap-2"
                onClick={() => setInputMode("text")}
                data-testid="button-text"
              >
                <Type className="w-6 h-6" />
                <span>Text</span>
              </Button>
            </div>

            {inputMode === "text" && (
              <>
                <div>
                  <Label htmlFor="description">Food Description</Label>
                  <Textarea
                    id="description"
                    value={textDescription}
                    onChange={(e) => setTextDescription(e.target.value)}
                    placeholder="e.g., Two scrambled eggs with cheese and whole wheat toast"
                    className="mt-2 min-h-24"
                    data-testid="input-text-description"
                  />
                </div>
                <Button
                  onClick={handleTextSubmit}
                  disabled={!textDescription.trim() || analyzeMutation.isPending}
                  className="w-full"
                  data-testid="button-analyze-text"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    "Find / Analyse Food"
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ReviewModal
        open={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setFallbackPrefillData(null);
          setManualFormData({
            foodName: "",
            servingSize: "1 serving",
            numberOfServings: 1,
            calories: "",
            protein: "",
            carbs: "",
            fat: "",
            isInitialized: false,
          });
        }}
        data={reviewData}
        onSave={handleSaveFood}
        isSaving={createLogMutation.isPending}
        onFallbackToText={handleFallbackToText}
      />

      <TextFallbackDialog
        open={showTextFallback}
        onClose={() => {
          setShowTextFallback(false);
          if (reviewData) {
            setShowReviewModal(true);
          }
        }}
        onAnalyze={handleTextFallbackAnalyze}
        onManualEntry={handleManualEntry}
        isAnalyzing={analyzeMutation.isPending}
        mealType={selectedMealType}
      />

      <ManualEntryModal
        open={showManualEntry}
        onClose={() => {
          setShowManualEntry(false);
          setShowTextFallback(true);
        }}
        onSave={handleManualSave}
        isSaving={createLogMutation.isPending}
        formData={manualFormData}
        onFormChange={setManualFormData}
      />

      <EditFoodModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        foodLog={editingFoodLog}
        onSave={handleSaveFoodEdit}
        isPending={updateFoodLogMutation.isPending}
      />

      <EndFastConfirmModal
        open={fastingController.showConfirmModal}
        trigger={fastingController.confirmTrigger === "timer_expired" ? null : fastingController.confirmTrigger}
        duration={fastingController.fastDuration}
        isPending={fastingController.isPending}
        onConfirm={fastingController.confirmEndFast}
        onCancel={fastingController.cancelEndFast}
      />
      
      <FastCompleteCelebration
        open={fastingController.showCelebrationModal}
        duration={fastingController.fastDuration}
        onDismiss={fastingController.dismissCelebration}
      />

      <BarcodeScannerDialog
        open={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onBarcodeDetected={(barcode) => {
          setShowBarcodeScanner(false);
          barcodeLookupMutation.mutate(barcode);
        }}
      />

      {barcodeFoodForPortion && (
        <FoodMatchSelector
          open={!!barcodeFoodForPortion}
          onClose={() => setBarcodeFoodForPortion(null)}
          food={barcodeFoodForPortion}
          onSave={handleBarcodePortionConfirm}
        />
      )}

      <FastSetup
        open={showFastSetup}
        onClose={() => setShowFastSetup(false)}
        onStartFast={(endTime) => startFastMutation.mutate(endTime)}
        isPending={startFastMutation.isPending}
      />
      
      <FoodSearchModal
        open={showFoodSearch}
        onClose={() => setShowFoodSearch(false)}
        onSelectFood={handleSelectFDAFood}
        onSelectFoodWithPortion={handleSelectFoodWithPortion}
        enablePortionSelector={true}
        onFallbackText={handleSearchFallbackText}
        onFallbackPhoto={handleSearchFallbackPhoto}
        onFallbackBarcode={handleSearchFallbackBarcode}
        onFallbackManual={handleSearchFallbackManual}
      />

      <Dialog open={showFindProComingSoon} onOpenChange={setShowFindProComingSoon}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-find-professional">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Find a Professional
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-muted-foreground mb-2">
              Our professional marketplace is coming soon!
            </p>
            <p className="text-sm text-muted-foreground">
              Connect with certified trainers, nutritionists, and coaches to help you reach your health goals.
            </p>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => setShowFindProComingSoon(false)}
              data-testid="button-close-find-professional"
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
