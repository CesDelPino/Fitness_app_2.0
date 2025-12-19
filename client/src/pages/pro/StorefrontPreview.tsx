import { useQuery } from "@tanstack/react-query";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { supabase } from "@/lib/supabase";
import StorefrontPreviewFrame from "@/components/StorefrontPreviewFrame";
import TrainerStorefront from "@/pages/TrainerStorefront";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ArrowLeft, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import type { StorefrontWithProducts } from "@shared/schema";

export default function StorefrontPreview() {
  const { user, professionalProfile } = useSupabaseAuth();

  // Use the dedicated preview endpoint that validates ownership and returns products
  const { data: storefront, isLoading, error } = useQuery<StorefrontWithProducts & { products: any[] }>({
    queryKey: ['/api/trainer/storefront/preview'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      
      const response = await fetch('/api/trainer/storefront/preview', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch storefront');
      }
      return response.json();
    },
    enabled: !!user && !!professionalProfile,
  });

  if (!professionalProfile) {
    return (
      <div className="container max-w-3xl py-6">
        <Card>
          <CardContent className="py-8 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h3 className="font-semibold mb-2">Professional Access Required</h3>
            <p className="text-muted-foreground mb-4">
              Storefront preview is only available to professional accounts.
            </p>
            <Link href="/pro">
              <Button data-testid="button-back-pro-dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Pro Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !storefront) {
    return (
      <div className="container max-w-3xl py-6">
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h3 className="font-semibold mb-2">Storefront Not Found</h3>
            <p className="text-muted-foreground mb-4">
              Unable to load your storefront. Please set up your storefront first.
            </p>
            <Link href="/pro/storefront">
              <Button data-testid="button-back-storefront-editor">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Storefront Editor
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!storefront.slug) {
    return (
      <div className="container max-w-3xl py-6">
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Storefront URL Not Set</h3>
            <p className="text-muted-foreground mb-4">
              Please set up your storefront URL before previewing.
            </p>
            <Link href="/pro/storefront">
              <Button data-testid="button-setup-storefront">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Set Up Storefront
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (storefront.trainerId !== professionalProfile.id) {
    return (
      <div className="container max-w-3xl py-6">
        <Card>
          <CardContent className="py-8 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h3 className="font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground mb-4">
              You can only preview your own storefront.
            </p>
            <Link href="/pro/storefront">
              <Button data-testid="button-back-storefront">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Storefront
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <StorefrontPreviewFrame>
      <TrainerStorefront 
        previewMode={true} 
        previewSlug={storefront.slug}
        previewStorefrontData={storefront}
      />
    </StorefrontPreviewFrame>
  );
}
