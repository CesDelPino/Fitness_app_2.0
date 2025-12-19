import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import SettingsForm, { type UserProfile } from "@/components/SettingsForm";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { queryClient, fetchJson } from "@/lib/queryClient";
import { getUserProfile, updateUserProfile, type UserProfile as SupabaseProfile } from "@/lib/supabase-data";
import { uploadClientProfilePhoto, deleteClientProfilePhoto } from "@/lib/profile-storage";
import { Loader2, LogOut, Moon, Sun, ChevronLeft, UserCircle, Check, Camera, Image, Trash2, Crown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PermissionsList } from "@/components/PermissionManager";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type PresetAvatarOption = {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  image_url: string | null;
};

export default function Settings() {
  const { toast } = useToast();
  const { signOut } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    const initial = stored || "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const { data: user, isLoading } = useQuery<SupabaseProfile | null>({
    queryKey: ["user-profile"],
    queryFn: () => getUserProfile(),
  });

  const { data: presetAvatars = [] } = useQuery<PresetAvatarOption[]>({
    queryKey: ["/api/avatars/presets"],
  });

  const { data: profilePhotoData } = useQuery<{ url: string | null } | null>({
    queryKey: ["/api/profile/photo-url"],
    queryFn: () => fetchJson<{ url: string | null }>("/api/profile/photo-url", { allow404: true }),
    enabled: !!user?.profilePhotoPath,
  });
  const profilePhotoUrl = profilePhotoData?.url ?? null;

  useEffect(() => {
    if (profilePhotoUrl) {
      setPhotoPreview(profilePhotoUrl);
    }
  }, [profilePhotoUrl]);

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("User not logged in");
      
      const result = await uploadClientProfilePhoto(user.id, file);
      if (!result) throw new Error("Failed to upload photo");
      
      await updateUserProfile({ profilePhotoPath: result.path });
      return result;
    },
    onSuccess: (result) => {
      setPhotoPreview(result.url);
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/photo-url"] });
      toast({
        title: "Photo uploaded",
        description: "Your profile photo has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    },
  });

  const removePhotoMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not logged in");
      
      const success = await deleteClientProfilePhoto(user.id);
      if (!success) throw new Error("Failed to delete photo");
      
      await updateUserProfile({ profilePhotoPath: null });
    },
    onSuccess: () => {
      setPhotoPreview(null);
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/photo-url"] });
      toast({ title: "Photo removed" });
    },
    onError: () => {
      toast({
        title: "Failed to remove photo",
        variant: "destructive",
      });
    },
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB",
        variant: "destructive",
      });
      return;
    }

    uploadPhotoMutation.mutate(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = () => {
    if (!user) return;
    removePhotoMutation.mutate();
  };

  const updateAvatarMutation = useMutation({
    mutationFn: async (presetAvatarId: string | null) => {
      if (!user) throw new Error("User not logged in");
      
      if (presetAvatarId && user.profilePhotoPath) {
        const deleted = await deleteClientProfilePhoto(user.id);
        if (!deleted) {
          throw new Error("Failed to remove existing photo");
        }
        await updateUserProfile({ profilePhotoPath: null });
      }
      
      return updateUserProfile({ presetAvatarId });
    },
    onSuccess: () => {
      setPhotoPreview(null);
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/photo-url"] });
      toast({ title: "Avatar updated" });
      setIsAvatarPickerOpen(false);
    },
    onError: (error) => {
      console.error("Avatar update error:", error);
      toast({ 
        title: "Failed to update avatar", 
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive" 
      });
    },
  });
  
  const isPhotoLoading = uploadPhotoMutation.isPending || removePhotoMutation.isPending;

  const currentAvatar = presetAvatars.find(a => a.id === user?.presetAvatarId);
  const femaleAvatars = presetAvatars.filter(a => a.gender === 'female');
  const maleAvatars = presetAvatars.filter(a => a.gender === 'male');
  const neutralAvatars = presetAvatars.filter(a => a.gender === 'neutral');

  const updateUserMutation = useMutation({
    mutationFn: async (data: UserProfile & { dailyCalorieTarget?: number }) => {
      return updateUserProfile({
        heightCm: data.heightCm,
        birthdate: data.birthdate,
        gender: data.gender,
        activityMultiplier: data.activityMultiplier,
        preferredUnitSystem: data.preferredUnitSystem,
        macroInputType: data.macroInputType,
        proteinTargetG: data.proteinTargetG,
        carbsTargetG: data.carbsTargetG,
        fatTargetG: data.fatTargetG,
        manualCalorieTarget: data.manualCalorieTarget,
        dailyCalorieTarget: data.dailyCalorieTarget,
        showBmiTape: data.showBmiTape,
        unitBodyWeight: data.unitBodyWeight,
        unitBodyMeasurements: data.unitBodyMeasurements,
        unitExerciseWeight: data.unitExerciseWeight,
        unitCardioDistance: data.unitCardioDistance,
        unitFoodWeight: data.unitFoodWeight,
        unitFoodVolume: data.unitFoodVolume,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast({
        title: "Settings saved",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Failed to save settings:", error);
      toast({
        title: "Failed to save settings",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = (data: UserProfile) => {
    updateUserMutation.mutate(data);
  };

  const initialData: UserProfile | undefined = user
    ? {
        heightCm: user.heightCm ?? 170,
        currentWeightKg: user.currentWeightKg ?? 70,
        birthdate: user.birthdate ?? "1990-01-01",
        gender: (user.gender as "M" | "F") ?? "M",
        activityMultiplier: user.activityMultiplier ?? 1.2,
        preferredUnitSystem: (user.preferredUnitSystem as "metric" | "imperial") ?? "metric",
        macroInputType: (user.macroInputType as "percentage" | "grams") ?? "percentage",
        proteinTargetG: user.proteinTargetG,
        carbsTargetG: user.carbsTargetG,
        fatTargetG: user.fatTargetG,
        manualCalorieTarget: user.manualCalorieTarget,
        dailyCalorieTarget: user.dailyCalorieTarget ?? undefined,
        showBmiTape: user.showBmiTape ?? true,
        unitBodyWeight: user.unitBodyWeight ?? null,
        unitBodyMeasurements: user.unitBodyMeasurements ?? null,
        unitExerciseWeight: user.unitExerciseWeight ?? null,
        unitCardioDistance: user.unitCardioDistance ?? null,
        unitFoodWeight: user.unitFoodWeight ?? null,
        unitFoodVolume: user.unitFoodVolume ?? null,
      }
    : undefined;

  return (
    <div className="min-h-screen bg-background pb-20 flex flex-col">
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : initialData ? (
          <SettingsForm initialData={initialData} onSave={handleSave} />
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Profile Picture</CardTitle>
            <CardDescription>Upload a photo or choose an avatar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <button 
                  onClick={handlePhotoClick}
                  disabled={isPhotoLoading}
                  className="relative group"
                  data-testid="button-upload-photo"
                >
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center">
                    {isPhotoLoading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    ) : photoPreview ? (
                      <img 
                        src={photoPreview} 
                        alt="Profile photo"
                        className="w-full h-full object-cover"
                      />
                    ) : currentAvatar?.image_url ? (
                      <img 
                        src={currentAvatar.image_url} 
                        alt={currentAvatar.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UserCircle className="w-12 h-12 text-muted-foreground" />
                    )}
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                  data-testid="input-photo-file"
                />
              </div>
              <div className="flex-1">
                {photoPreview || user?.profilePhotoPath ? (
                  <>
                    <p className="font-medium">Your Photo</p>
                    <p className="text-sm text-muted-foreground">Tap to change or use buttons below</p>
                  </>
                ) : currentAvatar ? (
                  <>
                    <p className="font-medium">{currentAvatar.name}</p>
                    <p className="text-sm text-muted-foreground">Using preset avatar</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">No picture set</p>
                    <p className="text-sm text-muted-foreground">Tap to upload a photo</p>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAvatarPickerOpen(true)}
                className="flex-1"
                data-testid="button-choose-avatar"
              >
                <Image className="w-4 h-4 mr-2" />
                Choose Avatar
              </Button>
              {(photoPreview || user?.profilePhotoPath || user?.presetAvatarId) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (user?.profilePhotoPath) {
                      await handleRemovePhoto();
                    } else if (user?.presetAvatarId) {
                      updateAvatarMutation.mutate(null);
                    }
                  }}
                  disabled={isPhotoLoading || updateAvatarMutation.isPending}
                  data-testid="button-remove-picture"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={isAvatarPickerOpen} onOpenChange={setIsAvatarPickerOpen}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Choose Your Avatar</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              {femaleAvatars.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Female</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {femaleAvatars.map(avatar => (
                      <AvatarOption
                        key={avatar.id}
                        avatar={avatar}
                        isSelected={avatar.id === user?.presetAvatarId}
                        onSelect={() => updateAvatarMutation.mutate(avatar.id)}
                        isPending={updateAvatarMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}
              {maleAvatars.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Male</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {maleAvatars.map(avatar => (
                      <AvatarOption
                        key={avatar.id}
                        avatar={avatar}
                        isSelected={avatar.id === user?.presetAvatarId}
                        onSelect={() => updateAvatarMutation.mutate(avatar.id)}
                        isPending={updateAvatarMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}
              {neutralAvatars.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Neutral</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {neutralAvatars.map(avatar => (
                      <AvatarOption
                        key={avatar.id}
                        avatar={avatar}
                        isSelected={avatar.id === user?.presetAvatarId}
                        onSelect={() => updateAvatarMutation.mutate(avatar.id)}
                        isPending={updateAvatarMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}
              {presetAvatars.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <UserCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No avatars available yet</p>
                </div>
              )}
              {user?.presetAvatarId && (
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => updateAvatarMutation.mutate(null)}
                    disabled={updateAvatarMutation.isPending}
                    data-testid="button-remove-avatar"
                  >
                    Remove Avatar
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === "dark" ? (
                  <Moon className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <Sun className="w-5 h-5 text-muted-foreground" />
                )}
                <Label htmlFor="theme-toggle" className="font-normal">
                  Dark Mode
                </Label>
              </div>
              <Switch
                id="theme-toggle"
                checked={theme === "dark"}
                onCheckedChange={toggleTheme}
                data-testid="switch-theme"
              />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover-elevate" 
          onClick={() => setLocation("/subscription")}
          data-testid="card-subscription"
        >
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Subscription</p>
                <p className="text-sm text-muted-foreground">Manage your Premium plan</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <PermissionsList />

        <div className="pt-6 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full" 
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Logout</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to logout? You'll need to login again to access your data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-logout">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={signOut}
                  data-testid="button-confirm-logout"
                >
                  Logout
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function AvatarOption({
  avatar,
  isSelected,
  onSelect,
  isPending,
}: {
  avatar: PresetAvatarOption;
  isSelected: boolean;
  onSelect: () => void;
  isPending: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={isPending}
      className={cn(
        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
        isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover-elevate"
      )}
      data-testid={`button-avatar-option-${avatar.id}`}
    >
      {avatar.image_url ? (
        <img 
          src={avatar.image_url} 
          alt={avatar.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <UserCircle className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      {isSelected && (
        <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-3 h-3 text-primary-foreground" />
        </div>
      )}
    </button>
  );
}
