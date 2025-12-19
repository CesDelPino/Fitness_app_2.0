import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Camera, 
  Upload, 
  ChevronDown, 
  ChevronUp, 
  Lightbulb,
  Trash2,
  Loader2,
  ImageIcon,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { supabaseUntyped } from "@/lib/supabase";
import {
  uploadProgressPhoto,
  deleteProgressPhoto,
  getProgressPhotos,
  validatePhotoFile,
  type ProgressPhotoWithUrl,
} from "@/lib/progress-photos-storage";
import type { ProgressPhotoPose } from "@shared/supabase-types";

interface ProgressPhotosProps {
  userId: string;
}

export default function ProgressPhotos({ userId }: ProgressPhotosProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isTipsOpen, setIsTipsOpen] = useState(false);
  const [selectedPose, setSelectedPose] = useState<ProgressPhotoPose>("front");
  const [isFlexed, setIsFlexed] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);
  const [showAllPhotos, setShowAllPhotos] = useState(false);

  const { data: photos = [], isLoading: photosLoading } = useQuery<ProgressPhotoWithUrl[]>({
    queryKey: ["progress-photos", userId],
    queryFn: () => getProgressPhotos(userId, { limit: showAllPhotos ? 50 : 6 }),
    enabled: !!userId,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      return uploadProgressPhoto({
        userId,
        file: selectedFile,
        pose: selectedPose,
        isFlexed,
      });
    },
    onSuccess: (photo) => {
      if (photo) {
        queryClient.invalidateQueries({ queryKey: ["progress-photos", userId] });
        toast({
          title: "Photo uploaded",
          description: "Your progress photo has been saved.",
        });
        resetUpload();
      } else {
        toast({
          title: "Upload failed",
          description: "Failed to upload photo. Please try again.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      return deleteProgressPhoto(photoId, userId);
    },
    onSuccess: (success) => {
      if (success) {
        queryClient.invalidateQueries({ queryKey: ["progress-photos", userId] });
        toast({
          title: "Photo deleted",
          description: "The progress photo has been removed.",
        });
      } else {
        toast({
          title: "Delete failed",
          description: "Failed to delete photo. Please try again.",
          variant: "destructive",
        });
      }
      setDeletePhotoId(null);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validatePhotoFile(file);
    if (!validation.valid) {
      toast({
        title: "Invalid file",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsFlexed(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync();
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getPoseLabel = (pose: ProgressPhotoPose) => {
    const labels: Record<ProgressPhotoPose, string> = {
      front: "Front",
      side: "Side",
      back: "Back",
    };
    return labels[pose];
  };

  const displayedPhotos = showAllPhotos ? photos : photos.slice(0, 6);
  const hasMorePhotos = photos.length > 6;

  return (
    <div className="space-y-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="p-4">
          <CollapsibleTrigger asChild>
            <button 
              className="w-full flex items-center justify-between"
              data-testid="button-toggle-progress-photos"
            >
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Progress Photos</span>
              </div>
              {isOpen ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-4 space-y-4">
            <Collapsible open={isTipsOpen} onOpenChange={setIsTipsOpen}>
              <CollapsibleTrigger asChild>
                <button 
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-photo-tips"
                >
                  <Lightbulb className="w-4 h-4" />
                  <span>Tips for great progress photos</span>
                  {isTipsOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
                  <ul className="space-y-1.5 text-muted-foreground">
                    <li>Choose a consistent location with good lighting</li>
                    <li>Take photos at the same time each day (morning works best)</li>
                    <li>Wear similar fitted clothing for accurate comparison</li>
                    <li>Capture front, side, and back angles</li>
                    <li>Stand naturally with relaxed posture</li>
                  </ul>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="pose-select" className="text-sm text-muted-foreground mb-1.5 block">
                    Pose
                  </Label>
                  <Select
                    value={selectedPose}
                    onValueChange={(value) => setSelectedPose(value as ProgressPhotoPose)}
                  >
                    <SelectTrigger id="pose-select" data-testid="select-pose">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="front">Front</SelectItem>
                      <SelectItem value="side">Side</SelectItem>
                      <SelectItem value="back">Back</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    id="flexed-toggle"
                    checked={isFlexed}
                    onCheckedChange={setIsFlexed}
                    data-testid="switch-flexed"
                  />
                  <Label htmlFor="flexed-toggle" className="text-sm">
                    Flexed
                  </Label>
                </div>
              </div>

              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 bg-background/80 hover:bg-background"
                    onClick={resetUpload}
                    data-testid="button-clear-preview"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="dropzone-photo"
                >
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Tap to select a photo
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    JPEG, PNG, or WebP up to 5MB
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-photo-file"
              />

              {previewUrl && (
                <Button
                  onClick={handleUpload}
                  disabled={isUploading || !selectedFile}
                  className="w-full"
                  data-testid="button-upload-photo"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Photo
                    </>
                  )}
                </Button>
              )}
            </div>

            {photosLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : photos.length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Your Photos</h4>
                <div className="grid grid-cols-3 gap-2">
                  {displayedPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative group aspect-square rounded-lg overflow-hidden bg-muted"
                      data-testid={`photo-${photo.id}`}
                    >
                      {photo.signedUrl ? (
                        <img
                          src={photo.signedUrl}
                          alt={`${getPoseLabel(photo.pose)}${photo.is_flexed ? " (Flexed)" : ""}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                      <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
                        <p className="text-[10px] text-white/90 truncate">
                          {getPoseLabel(photo.pose)}{photo.is_flexed ? " (F)" : ""}
                        </p>
                        <p className="text-[9px] text-white/70">
                          {formatDate(photo.captured_at)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => setDeletePhotoId(photo.id)}
                        data-testid={`button-delete-photo-${photo.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                {hasMorePhotos && !showAllPhotos && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowAllPhotos(true)}
                    data-testid="button-show-more-photos"
                  >
                    Show all photos
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No progress photos yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Upload your first photo to start tracking
                </p>
              </div>
            )}
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <AlertDialog open={!!deletePhotoId} onOpenChange={() => setDeletePhotoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this progress photo. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePhotoId && deleteMutation.mutate(deletePhotoId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
