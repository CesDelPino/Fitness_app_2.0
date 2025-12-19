import { supabaseUntyped } from "./supabase";

const BUCKET_NAME = "profile-photos";

export async function uploadProfilePhoto(
  userId: string,
  file: File
): Promise<{ path: string; url: string } | null> {
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filePath = `${userId}/profile-photo.${fileExt}`;
  
  const { error: uploadError } = await supabaseUntyped.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });
  
  if (uploadError) {
    console.error("Failed to upload profile photo:", uploadError);
    return null;
  }
  
  const { data: signedUrlData, error: signedUrlError } = await supabaseUntyped.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 60 * 60);
  
  if (signedUrlError || !signedUrlData) {
    console.error("Failed to create signed URL:", signedUrlError);
    return null;
  }
  
  return {
    path: filePath,
    url: signedUrlData.signedUrl,
  };
}

export async function deleteProfilePhoto(userId: string): Promise<boolean> {
  const { data: files } = await supabaseUntyped.storage
    .from(BUCKET_NAME)
    .list(userId);
  
  const photoFile = files?.find((f: { name: string }) => f.name.startsWith("profile-photo"));
  if (!photoFile) return true;
  
  const { error } = await supabaseUntyped.storage
    .from(BUCKET_NAME)
    .remove([`${userId}/${photoFile.name}`]);
  
  return !error;
}

export async function getProfilePhotoSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  
  const { data, error } = await supabaseUntyped.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, 60 * 60);
  
  if (error || !data) {
    console.error("Failed to get signed URL for profile photo:", error);
    return null;
  }
  
  return data.signedUrl;
}

export const uploadClientProfilePhoto = uploadProfilePhoto;
export const deleteClientProfilePhoto = deleteProfilePhoto;
export const getClientProfilePhotoSignedUrl = getProfilePhotoSignedUrl;
