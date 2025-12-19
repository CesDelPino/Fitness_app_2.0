import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { supabaseUntyped } from "@/lib/supabase";
import { queryClient, fetchJson, apiRequest } from "@/lib/queryClient";
import { updateUserProfile } from "@/lib/supabase-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Camera, Plus, Trash2, Award, User, Image, Check, UserCircle, Info, ExternalLink } from "lucide-react";
import { getCertifications, createCertification, deleteCertification } from "@/lib/pro-storage";
import { uploadProfilePhoto, deleteProfilePhoto } from "@/lib/profile-storage";
import type { ProfessionalCertification } from "@shared/supabase-types";
import { cn } from "@/lib/utils";
import StripeConnectSetup from "@/components/pro/StripeConnectSetup";
import { Link } from "wouter";

type PresetAvatarOption = {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  image_url: string | null;
};

export default function ProProfileSetup() {
  const { user, profile, professionalProfile, isProfessionalCandidate, refreshProfile } = useSupabaseAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [hasLocalPhotoChange, setHasLocalPhotoChange] = useState(false);
  
  const [certifications, setCertifications] = useState<ProfessionalCertification[]>([]);
  const [isLoadingCerts, setIsLoadingCerts] = useState(false);
  const [showCertDialog, setShowCertDialog] = useState(false);
  const [newCertName, setNewCertName] = useState("");
  const [newCertOrg, setNewCertOrg] = useState("");
  const [newCertDate, setNewCertDate] = useState("");
  const [isSavingCert, setIsSavingCert] = useState(false);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  const { data: presetAvatars = [] } = useQuery<PresetAvatarOption[]>({
    queryKey: ["/api/avatars/presets"],
  });

  const { data: profilePhotoData } = useQuery<{ url: string | null } | null>({
    queryKey: ["/api/profile/photo-url"],
    queryFn: () => fetchJson<{ url: string | null }>("/api/profile/photo-url", { allow404: true }),
    enabled: !!profile?.profile_photo_path,
  });
  const profilePhotoUrl = profilePhotoData?.url ?? null;

  // Fetch storefront data for location (single source of truth)
  const { data: storefrontData } = useQuery<{ location_city?: string | null; location_state?: string | null } | null>({
    queryKey: ["/api/pro/storefront"],
    queryFn: () => fetchJson<{ location_city?: string | null; location_state?: string | null }>("/api/pro/storefront", { allow404: true }),
    enabled: !!professionalProfile,
  });

  const currentPresetAvatar = presetAvatars.find(a => a.id === profile?.preset_avatar_id);
  const femaleAvatars = presetAvatars.filter(a => a.gender === 'female');
  const maleAvatars = presetAvatars.filter(a => a.gender === 'male');
  const neutralAvatars = presetAvatars.filter(a => a.gender === 'neutral');

  const updateAvatarMutation = useMutation({
    mutationFn: async ({ presetAvatarId, avatarUrl }: { presetAvatarId: string | null; avatarUrl: string | null }) => {
      await updateUserProfile({ 
        presetAvatarId, 
        profilePhotoPath: avatarUrl 
      });
      if (presetAvatarId && photoPath) {
        setPhotoPath(avatarUrl);
        setPhotoPreview(avatarUrl);
        setHasLocalPhotoChange(true);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast({ title: "Avatar updated" });
      setIsAvatarPickerOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to update avatar", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (profile?.display_name && !displayName) {
      setDisplayName(profile.display_name);
    }
  }, [profile?.display_name]);

  useEffect(() => {
    if (profile?.profile_photo_path && !photoPath && !hasLocalPhotoChange) {
      setPhotoPath(profile.profile_photo_path);
    }
  }, [profile?.profile_photo_path, hasLocalPhotoChange]);

  // Source location from storefront (single source of truth for public data)
  useEffect(() => {
    if (storefrontData && !isInitialized) {
      if (storefrontData.location_city) setCity(storefrontData.location_city);
      if (storefrontData.location_state) setState(storefrontData.location_state);
      setIsInitialized(true);
    }
  }, [storefrontData, isInitialized]);

  useEffect(() => {
    if (profilePhotoUrl && !hasLocalPhotoChange) {
      setPhotoPreview(profilePhotoUrl);
    }
  }, [profilePhotoUrl, hasLocalPhotoChange]);

  useEffect(() => {
    if (user && professionalProfile) {
      loadCertifications();
    }
  }, [user, professionalProfile]);

  const loadCertifications = async () => {
    if (!user) return;
    setIsLoadingCerts(true);
    const certs = await getCertifications(user.id);
    setCertifications(certs);
    setIsLoadingCerts(false);
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsUploadingPhoto(true);
    const result = await uploadProfilePhoto(user.id, file);
    
    if (result) {
      setPhotoPath(result.path);
      setPhotoPreview(result.url);
      setHasLocalPhotoChange(true);
      toast({
        title: "Photo uploaded",
        description: "Your profile photo has been updated",
      });
    } else {
      toast({
        title: "Upload failed",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    }
    setIsUploadingPhoto(false);
  };

  const handleAddCertification = async () => {
    if (!user || !newCertName || !newCertOrg || !newCertDate) return;
    
    setIsSavingCert(true);
    const cert = await createCertification(user.id, {
      name: newCertName,
      issuing_organization: newCertOrg,
      date_earned: newCertDate,
    });
    
    if (cert) {
      setCertifications([cert, ...certifications]);
      setNewCertName("");
      setNewCertOrg("");
      setNewCertDate("");
      setShowCertDialog(false);
      toast({
        title: "Certification added",
        description: "Your certification has been saved",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to add certification",
        variant: "destructive",
      });
    }
    setIsSavingCert(false);
  };

  const handleDeleteCertification = async (certId: string) => {
    const success = await deleteCertification(certId);
    if (success) {
      setCertifications(certifications.filter(c => c.id !== certId));
      toast({
        title: "Certification removed",
        description: "The certification has been deleted",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to delete certification",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);

    try {
      if (isProfessionalCandidate) {
        // Promote user to professional (creates professional_profile, no location stored there)
        const { data, error } = await supabaseUntyped.rpc("promote_to_professional", {
          p_headline: "Professional", 
          p_bio: null,
          p_specialties: null,
          p_city: null,
          p_state: null,
        });

        if (error) throw error;

        const result = data as { success: boolean; error?: string };
        if (!result.success) {
          throw new Error(result.error || "Failed to create professional profile");
        }

        const { error: profileUpdateError } = await supabaseUntyped
          .from("profiles")
          .update({ 
            display_name: displayName || undefined,
            profile_photo_path: photoPath,
          })
          .eq("id", user.id);
        
        if (profileUpdateError) throw profileUpdateError;

        // After promotion, save location to storefront (single source of truth)
        // Note: Storefront may not exist yet for new pros - location will be saved when storefront is created
        if (city || state) {
          try {
            await apiRequest("PUT", "/api/pro/storefront", {
              location_city: city || null,
              location_state: state || null,
            });
          } catch (storefrontErr) {
            console.log("Storefront location update skipped (storefront not yet created):", storefrontErr);
          }
        }
      } else {
        const { error: profileError } = await supabaseUntyped
          .from("profiles")
          .update({ 
            display_name: displayName,
            profile_photo_path: photoPath,
          })
          .eq("id", user.id);

        if (profileError) throw profileError;

        // Update location in trainer_storefronts (single source of truth for public data)
        try {
          await apiRequest("PUT", "/api/pro/storefront", {
            location_city: city || null,
            location_state: state || null,
          });
        } catch (storefrontErr) {
          console.log("Storefront location update skipped (may not exist yet):", storefrontErr);
        }
      }

      const refreshPromise = refreshProfile();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile refresh timeout')), 10000)
      );
      
      try {
        await Promise.race([refreshPromise, timeoutPromise]);
      } catch {
      }

      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/photo-url"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pro/storefront"] });

      toast({
        title: "Profile Updated",
        description: "Your professional profile has been saved.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Professional Profile</CardTitle>
          <CardDescription>
            Set up your profile to attract clients
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center space-y-3">
              <div className="relative">
                <Avatar className="h-24 w-24 cursor-pointer" onClick={handlePhotoClick}>
                  <AvatarImage src={photoPreview || currentPresetAvatar?.image_url || undefined} alt={displayName} />
                  <AvatarFallback className="bg-sky-100 text-sky-700 text-xl">
                    {displayName ? getInitials(displayName) : <User className="h-10 w-10" />}
                  </AvatarFallback>
                </Avatar>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
                  onClick={handlePhotoClick}
                  disabled={isUploadingPhoto}
                  data-testid="button-upload-photo"
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                  data-testid="input-photo-file"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {photoPreview ? "Your photo" : currentPresetAvatar ? `Using: ${currentPresetAvatar.name}` : "Click to upload your photo"}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAvatarPickerOpen(true)}
                  data-testid="button-choose-avatar"
                >
                  <Image className="w-4 h-4 mr-2" />
                  Choose Avatar
                </Button>
                {(photoPreview || profile?.preset_avatar_id) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (photoPreview) {
                        setPhotoPath(null);
                        setPhotoPreview(null);
                        setHasLocalPhotoChange(true);
                      } else if (profile?.preset_avatar_id) {
                        updateAvatarMutation.mutate({ presetAvatarId: null, avatarUrl: null });
                      }
                    }}
                    disabled={updateAvatarMutation.isPending}
                    data-testid="button-remove-picture"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            <Alert className="bg-muted/50 border-primary/20">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="flex items-center justify-between gap-2">
                <span className="text-sm">
                  Edit your headline, bio, specialties and other public profile details in My Storefront.
                </span>
                <Link href="/pro/storefront">
                  <Button variant="outline" size="sm" type="button" data-testid="link-my-storefront">
                    My Storefront
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <h3 className="font-medium">Basic Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  placeholder="Dr. Jane Smith"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isLoading}
                  required
                  data-testid="input-display-name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="New York"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={isLoading}
                    data-testid="input-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State/Province</Label>
                  <Input
                    id="state"
                    placeholder="NY"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    disabled={isLoading}
                    data-testid="input-state"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Certifications</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCertDialog(true)}
                  data-testid="button-add-certification"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              {isLoadingCerts ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : certifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No certifications added yet
                </p>
              ) : (
                <div className="space-y-2">
                  {certifications.map((cert) => (
                    <div
                      key={cert.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                      data-testid={`cert-item-${cert.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Award className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium text-sm">{cert.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {cert.issuing_organization} • {new Date(cert.date_earned).getFullYear()}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCertification(cert.id)}
                        data-testid={`button-delete-cert-${cert.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-save-profile"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Profile"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6">
        <StripeConnectSetup />
      </div>

      <Dialog open={showCertDialog} onOpenChange={setShowCertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Certification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cert-name">Certification Name</Label>
              <Input
                id="cert-name"
                placeholder="NASM Certified Personal Trainer"
                value={newCertName}
                onChange={(e) => setNewCertName(e.target.value)}
                data-testid="input-cert-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert-org">Issuing Organization</Label>
              <Input
                id="cert-org"
                placeholder="National Academy of Sports Medicine"
                value={newCertOrg}
                onChange={(e) => setNewCertOrg(e.target.value)}
                data-testid="input-cert-org"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert-date">Date Earned</Label>
              <Input
                id="cert-date"
                type="date"
                value={newCertDate}
                onChange={(e) => setNewCertDate(e.target.value)}
                data-testid="input-cert-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCertDialog(false)}
              data-testid="button-cancel-cert"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCertification}
              disabled={isSavingCert || !newCertName || !newCertOrg || !newCertDate}
              data-testid="button-save-cert"
            >
              {isSavingCert ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Add Certification"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => updateAvatarMutation.mutate({ presetAvatarId: avatar.id, avatarUrl: avatar.image_url || null })}
                      disabled={updateAvatarMutation.isPending}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                        avatar.id === profile?.preset_avatar_id ? "border-primary ring-2 ring-primary/20" : "border-border hover-elevate"
                      )}
                      data-testid={`button-avatar-option-${avatar.id}`}
                    >
                      {avatar.image_url ? (
                        <img src={avatar.image_url} alt={avatar.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <UserCircle className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      {avatar.id === profile?.preset_avatar_id && (
                        <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {maleAvatars.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Male</h3>
                <div className="grid grid-cols-4 gap-3">
                  {maleAvatars.map(avatar => (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => updateAvatarMutation.mutate({ presetAvatarId: avatar.id, avatarUrl: avatar.image_url || null })}
                      disabled={updateAvatarMutation.isPending}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                        avatar.id === profile?.preset_avatar_id ? "border-primary ring-2 ring-primary/20" : "border-border hover-elevate"
                      )}
                      data-testid={`button-avatar-option-${avatar.id}`}
                    >
                      {avatar.image_url ? (
                        <img src={avatar.image_url} alt={avatar.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <UserCircle className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      {avatar.id === profile?.preset_avatar_id && (
                        <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {neutralAvatars.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Neutral</h3>
                <div className="grid grid-cols-4 gap-3">
                  {neutralAvatars.map(avatar => (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => updateAvatarMutation.mutate({ presetAvatarId: avatar.id, avatarUrl: avatar.image_url || null })}
                      disabled={updateAvatarMutation.isPending}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                        avatar.id === profile?.preset_avatar_id ? "border-primary ring-2 ring-primary/20" : "border-border hover-elevate"
                      )}
                      data-testid={`button-avatar-option-${avatar.id}`}
                    >
                      {avatar.image_url ? (
                        <img src={avatar.image_url} alt={avatar.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <UserCircle className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      {avatar.id === profile?.preset_avatar_id && (
                        <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
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
            {profile?.preset_avatar_id && (
              <div className="pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => updateAvatarMutation.mutate({ presetAvatarId: null, avatarUrl: null })}
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
    </div>
  );
}
