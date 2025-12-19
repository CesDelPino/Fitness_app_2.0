import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ChevronLeft, 
  Send, 
  Loader2, 
  CheckCircle, 
  UserPlus,
  Mail,
  Globe,
  Instagram,
  MapPin
} from "lucide-react";
import { useProfessionalDetail, getProfessionLabel } from "@/hooks/useMarketplace";

export default function ClientRequestConnection() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  
  const { data: pro, isLoading, error } = useProfessionalDetail(id || "");
  
  const requestMutation = useMutation({
    mutationFn: async (data: { professionalId: string; message: string }) => {
      const res = await apiRequest('POST', '/api/client/connection-requests', data);
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Request Sent",
        description: "Your request has been sent to the trainer. They will review it and send you an invitation if interested.",
      });
    },
    onError: (err: any) => {
      let errorMessage = "Please try again later";
      
      // Try to parse JSON error from the error message
      if (err.message) {
        const jsonMatch = err.message.match(/\{.*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            errorMessage = parsed.error || errorMessage;
          } catch {
            errorMessage = err.message;
          }
        } else {
          errorMessage = err.message;
        }
      }
      
      toast({
        title: "Failed to send request",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    requestMutation.mutate({ professionalId: id, message });
  };
  
  if (!user) {
    return (
      <div className="container max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>
              Please sign in to request a connection with a trainer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button data-testid="button-login">Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (error || !pro) {
    return (
      <div className="container max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Professional Not Found</CardTitle>
            <CardDescription>
              This professional profile could not be loaded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/marketplace">
              <Button variant="outline" data-testid="button-back-marketplace">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Marketplace
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (submitted) {
    return (
      <div className="container max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle>Request Sent!</CardTitle>
            <CardDescription>
              Your connection request has been sent to {pro.displayName}. 
              They will review your request and send you an invitation if they'd like to work with you.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-4">
            <Link href="/marketplace">
              <Button variant="outline" data-testid="button-browse-more">
                Browse More Trainers
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button data-testid="button-go-dashboard">
                Go to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container max-w-2xl mx-auto p-6 space-y-6">
      <Button 
        variant="ghost" 
        onClick={() => setLocation(`/marketplace/pro/${id}`)}
        className="gap-2"
        data-testid="button-back"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Profile
      </Button>
      
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <UserAvatar
              name={pro.displayName || undefined}
              photoPath={pro.photoPath}
              className="w-12 h-12"
            />
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Request to Work Together
              </CardTitle>
              <CardDescription className="mt-1">
                Send a connection request to {pro.displayName}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <UserAvatar
                name={pro.displayName || undefined}
                photoPath={pro.photoPath}
                className="w-10 h-10"
              />
              <div>
                <p className="font-medium" data-testid="text-pro-name">{pro.displayName}</p>
                {pro.businessName && (
                  <p className="text-sm text-muted-foreground">{pro.businessName}</p>
                )}
                {pro.professionTypes && pro.professionTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pro.professionTypes.slice(0, 2).map(type => (
                      <Badge key={type} variant="secondary" className="text-xs">
                        {getProfessionLabel(type)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {(pro.locationCity || pro.locationState) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{[pro.locationCity, pro.locationState].filter(Boolean).join(', ')}</span>
              </div>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message">
                Introduce yourself (optional)
              </Label>
              <Textarea
                id="message"
                placeholder="Tell the trainer about your goals, experience level, and what you're looking for in a fitness professional..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="resize-none"
                data-testid="input-message"
              />
              <p className="text-xs text-muted-foreground">
                This message will be shared with {pro.displayName} along with your request.
              </p>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                How connection requests work:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>You send a request to the trainer</li>
                <li>They review your profile and message</li>
                <li>If interested, they'll send you an invitation</li>
                <li>You accept the invitation to connect</li>
              </ol>
            </div>
            
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={requestMutation.isPending}
                className="flex-1 gap-2"
                data-testid="button-send-request"
              >
                {requestMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Request
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
