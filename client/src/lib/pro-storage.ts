import { supabaseUntyped } from "./supabase";
import type { ProfessionalCertification } from "@shared/supabase-types";

const BUCKET_NAME = "professional-assets";

export async function uploadCertificateImage(
  userId: string,
  certificationId: string,
  file: File
): Promise<{ path: string; url: string } | null> {
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filePath = `${userId}/certifications/${certificationId}.${fileExt}`;
  
  const { error: uploadError } = await supabaseUntyped.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });
  
  if (uploadError) {
    console.error("Failed to upload certificate image:", uploadError);
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

export async function getCertificateImageSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  
  const { data, error } = await supabaseUntyped.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, 60 * 60);
  
  if (error || !data) {
    console.error("Failed to get signed URL for certificate image:", error);
    return null;
  }
  
  return data.signedUrl;
}

export async function createCertification(
  userId: string,
  data: {
    name: string;
    issuing_organization: string;
    date_earned: string;
    expiration_date?: string;
  }
): Promise<ProfessionalCertification | null> {
  const { data: cert, error } = await supabaseUntyped
    .from("professional_certifications")
    .insert({
      user_id: userId,
      ...data,
    })
    .select()
    .single();
  
  if (error) {
    console.error("Failed to create certification:", error);
    return null;
  }
  
  return cert as ProfessionalCertification;
}

export async function updateCertification(
  certId: string,
  data: Partial<{
    name: string;
    issuing_organization: string;
    date_earned: string;
    expiration_date: string | null;
    certificate_image_path: string | null;
  }>
): Promise<ProfessionalCertification | null> {
  const { data: cert, error } = await supabaseUntyped
    .from("professional_certifications")
    .update(data)
    .eq("id", certId)
    .select()
    .single();
  
  if (error) {
    console.error("Failed to update certification:", error);
    return null;
  }
  
  return cert as ProfessionalCertification;
}

export async function deleteCertification(certId: string): Promise<boolean> {
  const { error } = await supabaseUntyped
    .from("professional_certifications")
    .delete()
    .eq("id", certId);
  
  return !error;
}

export async function getCertifications(userId: string): Promise<ProfessionalCertification[]> {
  const { data, error } = await supabaseUntyped
    .from("professional_certifications")
    .select("*")
    .eq("user_id", userId)
    .order("date_earned", { ascending: false });
  
  if (error) {
    console.error("Failed to fetch certifications:", error);
    return [];
  }
  
  return (data || []) as ProfessionalCertification[];
}
