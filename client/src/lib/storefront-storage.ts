import { supabaseUntyped } from "./supabase";

const BUCKET_NAME = "storefront-media";

export type StorefrontMediaType = 'cover' | 'thumbnail' | 'transformation-before' | 'transformation-after';

export async function uploadStorefrontMedia(
  trainerId: string,
  file: File,
  mediaType: StorefrontMediaType
): Promise<{ path: string; url: string } | null> {
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const timestamp = Date.now();
  const filePath = `${trainerId}/${mediaType}-${timestamp}.${fileExt}`;
  
  const { error: uploadError } = await supabaseUntyped.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });
  
  if (uploadError) {
    console.error(`Failed to upload ${mediaType}:`, uploadError);
    return null;
  }
  
  const { data: urlData } = supabaseUntyped.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);
  
  return {
    path: filePath,
    url: urlData.publicUrl,
  };
}

export async function deleteStorefrontMedia(filePath: string): Promise<boolean> {
  const { error } = await supabaseUntyped.storage
    .from(BUCKET_NAME)
    .remove([filePath]);
  
  if (error) {
    console.error("Failed to delete storefront media:", error);
    return false;
  }
  
  return true;
}

export async function getStorefrontMediaUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  
  const { data } = supabaseUntyped.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);
  
  return data.publicUrl;
}
