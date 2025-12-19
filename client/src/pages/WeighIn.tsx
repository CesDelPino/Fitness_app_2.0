import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import WeighInForm, { type MeasurementData } from "@/components/WeighInForm";
import WeighInHistory, { type WeighInRecord } from "@/components/WeighInHistory";
import ProgressPhotos from "@/components/ProgressPhotos";
import MoreSheet from "@/components/MoreSheet";
import Footer from "@/components/Footer";
import { UpcomingCheckIn } from "@/components/check-ins/UpcomingCheckIn";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { getWeighIns, createWeighIn, deleteWeighIn, getUserProfile, type WeighIn as WeighInType, type UserProfile } from "@/lib/supabase-data";

export default function WeighIn() {
  const { toast } = useToast();

  const { data: user } = useQuery<UserProfile | null>({
    queryKey: ["user-profile"],
    queryFn: () => getUserProfile(),
  });

  const { data: weighIns = [], isLoading } = useQuery<WeighInType[]>({
    queryKey: ["weigh-ins"],
    queryFn: () => getWeighIns(30),
  });

  const createWeighInMutation = useMutation({
    mutationFn: async ({ 
      weightKg, 
      notes, 
      measurements 
    }: { 
      weightKg: number; 
      notes?: string;
      measurements?: {
        waistCm?: number;
        hipsCm?: number;
        bustChestCm?: number;
        thighCm?: number;
        armCm?: number;
        calfCm?: number;
        neckCm?: number;
      };
    }) => {
      return createWeighIn({
        date: new Date().toISOString().split("T")[0],
        weightKg,
        notes,
        ...measurements,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weigh-ins"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast({
        title: "Weigh-in saved",
        description: "Your weight has been recorded and your targets updated.",
      });
    },
  });

  const deleteWeighInMutation = useMutation({
    mutationFn: (id: string) => deleteWeighIn(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weigh-ins"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast({
        title: "Entry deleted",
        description: "The weigh-in entry has been removed and your profile has been updated.",
      });
    },
  });

  const isMetric = user ? user.preferredUnitSystem === "metric" : true;
  const currentWeight = user?.currentWeightKg 
    ? isMetric 
      ? parseFloat((user.currentWeightKg).toFixed(1))
      : parseFloat((user.currentWeightKg * 2.20462).toFixed(1))
    : 84;

  const handleSubmit = (weight: number, notes?: string, measurements?: MeasurementData) => {
    const weightKg = isMetric ? weight : weight / 2.20462;
    
    // Convert measurements to cm if in imperial
    const measurementsCm = measurements ? {
      waistCm: measurements.waist ? (isMetric ? measurements.waist : measurements.waist * 2.54) : undefined,
      hipsCm: measurements.hips ? (isMetric ? measurements.hips : measurements.hips * 2.54) : undefined,
      bustChestCm: measurements.bustChest ? (isMetric ? measurements.bustChest : measurements.bustChest * 2.54) : undefined,
      thighCm: measurements.thigh ? (isMetric ? measurements.thigh : measurements.thigh * 2.54) : undefined,
      armCm: measurements.arm ? (isMetric ? measurements.arm : measurements.arm * 2.54) : undefined,
      calfCm: measurements.calf ? (isMetric ? measurements.calf : measurements.calf * 2.54) : undefined,
      neckCm: measurements.neck ? (isMetric ? measurements.neck : measurements.neck * 2.54) : undefined,
    } : undefined;
    
    createWeighInMutation.mutate({ weightKg, notes, measurements: measurementsCm });
  };

  const handleDelete = (id: string) => {
    deleteWeighInMutation.mutate(id);
  };

  const transformedRecords: WeighInRecord[] = weighIns.map((wi: any, index: number) => {
    const weight = isMetric ? wi.weightKg : wi.weightKg * 2.20462;
    const prevWeight = weighIns[index + 1]?.weightKg;
    const change = prevWeight 
      ? isMetric
        ? wi.weightKg - prevWeight
        : (wi.weightKg - prevWeight) * 2.20462
      : undefined;

    // Convert measurements from cm to display unit
    const measurements = (wi.waistCm || wi.hipsCm || wi.bustChestCm || wi.thighCm || wi.armCm || wi.calfCm || wi.neckCm) ? {
      waist: wi.waistCm ? (isMetric ? wi.waistCm : wi.waistCm / 2.54) : undefined,
      hips: wi.hipsCm ? (isMetric ? wi.hipsCm : wi.hipsCm / 2.54) : undefined,
      bustChest: wi.bustChestCm ? (isMetric ? wi.bustChestCm : wi.bustChestCm / 2.54) : undefined,
      thigh: wi.thighCm ? (isMetric ? wi.thighCm : wi.thighCm / 2.54) : undefined,
      arm: wi.armCm ? (isMetric ? wi.armCm : wi.armCm / 2.54) : undefined,
      calf: wi.calfCm ? (isMetric ? wi.calfCm : wi.calfCm / 2.54) : undefined,
      neck: wi.neckCm ? (isMetric ? wi.neckCm : wi.neckCm / 2.54) : undefined,
    } : undefined;

    return {
      id: wi.id,
      date: new Date(wi.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      weight: parseFloat(weight.toFixed(1)),
      change: change ? parseFloat(change.toFixed(1)) : undefined,
      notes: wi.notes,
      measurements,
    };
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Weigh-In</h1>
          <MoreSheet />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        <UpcomingCheckIn />
        
        <WeighInForm
          currentWeight={currentWeight}
          onSubmit={handleSubmit}
          unit={isMetric ? "kg" : "lbs"}
        />

        {user?.id && <ProgressPhotos userId={user.id} />}

        <div>
          <h2 className="text-lg font-semibold mb-4">History</h2>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <WeighInHistory 
              records={transformedRecords} 
              unit={isMetric ? "kg" : "lbs"}
              onDelete={handleDelete}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
