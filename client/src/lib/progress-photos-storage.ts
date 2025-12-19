import { supabaseUntyped } from "./supabase";
import type { ProgressPhoto, InsertProgressPhoto, ProgressPhotoPose } from "@shared/supabase-types";

const BUCKET_NAME = "progress-photos";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SIGNED_URL_EXPIRY = 3600; // 1 hour

export interface UploadProgressPhotoParams {
  userId: string;
  file: File;
  pose: ProgressPhotoPose;
  isFlexed?: boolean;
  capturedAt?: string;
  notes?: string;
}

export interface ProgressPhotoWithUrl extends ProgressPhoto {
  signedUrl: string | null;
}

export function validatePhotoFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: "Only JPEG, PNG, and WebP images are allowed" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "Image must be less than 5MB" };
  }
  return { valid: true };
}

export async function compressImage(file: File, maxWidth = 1200, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to compress image"));
          }
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadProgressPhoto({
  userId,
  file,
  pose,
  isFlexed = false,
  capturedAt,
  notes,
}: UploadProgressPhotoParams): Promise<ProgressPhoto | null> {
  const validation = validatePhotoFile(file);
  if (!validation.valid) {
    console.error("File validation failed:", validation.error);
    return null;
  }

  try {
    const compressedBlob = await compressImage(file);
    const timestamp = Date.now();
    const flexedSuffix = isFlexed ? "_flexed" : "";
    const filePath = `${userId}/${timestamp}_${pose}${flexedSuffix}.jpg`;

    const { error: uploadError } = await supabaseUntyped.storage
      .from(BUCKET_NAME)
      .upload(filePath, compressedBlob, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Failed to upload progress photo:", uploadError);
      return null;
    }

    const insertData: InsertProgressPhoto = {
      user_id: userId,
      photo_path: filePath,
      pose,
      is_flexed: isFlexed,
      captured_at: capturedAt || new Date().toISOString(),
      notes: notes || null,
    };

    const { data: photo, error: dbError } = await supabaseUntyped
      .from("progress_photos")
      .insert(insertData)
      .select()
      .single();

    if (dbError) {
      console.error("Failed to save photo record:", dbError);
      await supabaseUntyped.storage.from(BUCKET_NAME).remove([filePath]);
      return null;
    }

    return photo as ProgressPhoto;
  } catch (error) {
    console.error("Error uploading progress photo:", error);
    return null;
  }
}

export async function deleteProgressPhoto(photoId: string, userId: string): Promise<boolean> {
  const { data: photo, error: fetchError } = await supabaseUntyped
    .from("progress_photos")
    .select("photo_path")
    .eq("id", photoId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !photo) {
    console.error("Failed to find photo:", fetchError);
    return false;
  }

  const { error: storageError } = await supabaseUntyped.storage
    .from(BUCKET_NAME)
    .remove([photo.photo_path]);

  if (storageError) {
    console.error("Failed to delete photo from storage:", storageError);
  }

  const { error: dbError } = await supabaseUntyped
    .from("progress_photos")
    .delete()
    .eq("id", photoId)
    .eq("user_id", userId);

  if (dbError) {
    console.error("Failed to delete photo record:", dbError);
    return false;
  }

  return true;
}

export async function getSignedUrl(photoPath: string): Promise<string | null> {
  const { data, error } = await supabaseUntyped.storage
    .from(BUCKET_NAME)
    .createSignedUrl(photoPath, SIGNED_URL_EXPIRY);

  if (error) {
    console.error("Failed to create signed URL:", error);
    return null;
  }

  return data.signedUrl;
}

export async function getProgressPhotos(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    pose?: ProgressPhotoPose;
  }
): Promise<ProgressPhotoWithUrl[]> {
  let query = supabaseUntyped
    .from("progress_photos")
    .select("*")
    .eq("user_id", userId)
    .order("captured_at", { ascending: false });

  if (options?.pose) {
    query = query.eq("pose", options.pose);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data: photos, error } = await query;

  if (error) {
    console.error("Failed to fetch progress photos:", error);
    return [];
  }

  const photosWithUrls: ProgressPhotoWithUrl[] = await Promise.all(
    (photos || []).map(async (photo: ProgressPhoto) => {
      const signedUrl = await getSignedUrl(photo.photo_path);
      return { ...photo, signedUrl };
    })
  );

  return photosWithUrls;
}

export async function getProgressPhotoCount(userId: string): Promise<number> {
  const { count, error } = await supabaseUntyped
    .from("progress_photos")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to count progress photos:", error);
    return 0;
  }

  return count || 0;
}

export async function getClientProgressPhotos(
  clientId: string,
  options?: {
    limit?: number;
    offset?: number;
    pose?: ProgressPhotoPose;
  }
): Promise<ProgressPhotoWithUrl[]> {
  let query = supabaseUntyped
    .from("progress_photos")
    .select("*")
    .eq("user_id", clientId)
    .order("captured_at", { ascending: false });

  if (options?.pose) {
    query = query.eq("pose", options.pose);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data: photos, error } = await query;

  if (error) {
    console.error("Failed to fetch client progress photos:", error);
    return [];
  }

  const photosWithUrls: ProgressPhotoWithUrl[] = await Promise.all(
    (photos || []).map(async (photo: ProgressPhoto) => {
      const signedUrl = await getSignedUrl(photo.photo_path);
      return { ...photo, signedUrl };
    })
  );

  return photosWithUrls;
}
