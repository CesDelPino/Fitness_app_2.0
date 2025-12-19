import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useStorefront, useStorefrontMutation, useSlugAvailability, useSystemFeature, useServiceMutations, useTestimonialMutations, useTransformationMutations, ACCENT_COLORS, STOREFRONT_VARIATIONS, StorefrontWithDetails } from "@/hooks/useStorefront";
import { uploadStorefrontMedia } from "@/lib/storefront-storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, ExternalLink, Save, Eye, Globe, AlertCircle, Store, 
  User, Palette, ImageIcon, Package, MessageSquare, Camera,
  Plus, Trash2, Star, Copy, QrCode, Link as LinkIcon, Check, Download, Info, Pencil, X, Lock
} from "lucide-react";
import { Link } from "wouter";
import { QRCodeSVG } from "qrcode.react";

// Helper to get UTC offset string for a timezone (e.g., "UTC +10" or "UTC -5")
function getUtcOffset(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    if (tzPart) {
      // tzPart.value is like "GMT+10", "GMT-5", or "GMT" for zero offset
      const gmtValue = tzPart.value;
      
      if (gmtValue === 'GMT') {
        return 'UTC +0';
      }
      
      // Extract sign and offset using regex
      const match = gmtValue.match(/^GMT([+-])(\d+(?::\d+)?)$/);
      if (match) {
        const sign = match[1];
        const offset = match[2];
        return `UTC ${sign}${offset}`;
      }
      
      // Fallback: just replace GMT with UTC
      return gmtValue.replace('GMT', 'UTC ');
    }
  } catch {
    // Fallback if timezone is invalid
  }
  return 'UTC +0';
}

// Base timezone data - labels will be enhanced with UTC offsets
const TIMEZONE_DATA = [
  // North America
  { value: 'America/New_York', city: 'New York' },
  { value: 'America/Chicago', city: 'Chicago' },
  { value: 'America/Denver', city: 'Denver' },
  { value: 'America/Los_Angeles', city: 'Los Angeles' },
  { value: 'America/Phoenix', city: 'Phoenix' },
  { value: 'America/Anchorage', city: 'Anchorage' },
  { value: 'Pacific/Honolulu', city: 'Honolulu' },
  { value: 'America/Toronto', city: 'Toronto' },
  { value: 'America/Vancouver', city: 'Vancouver' },
  { value: 'America/Mexico_City', city: 'Mexico City' },
  // South America
  { value: 'America/Sao_Paulo', city: 'São Paulo' },
  { value: 'America/Buenos_Aires', city: 'Buenos Aires' },
  { value: 'America/Bogota', city: 'Bogotá' },
  { value: 'America/Lima', city: 'Lima' },
  { value: 'America/Santiago', city: 'Santiago' },
  // Europe
  { value: 'Europe/London', city: 'London' },
  { value: 'Europe/Dublin', city: 'Dublin' },
  { value: 'Europe/Paris', city: 'Paris' },
  { value: 'Europe/Berlin', city: 'Berlin' },
  { value: 'Europe/Madrid', city: 'Madrid' },
  { value: 'Europe/Rome', city: 'Rome' },
  { value: 'Europe/Amsterdam', city: 'Amsterdam' },
  { value: 'Europe/Brussels', city: 'Brussels' },
  { value: 'Europe/Zurich', city: 'Zurich' },
  { value: 'Europe/Vienna', city: 'Vienna' },
  { value: 'Europe/Stockholm', city: 'Stockholm' },
  { value: 'Europe/Warsaw', city: 'Warsaw' },
  { value: 'Europe/Prague', city: 'Prague' },
  { value: 'Europe/Athens', city: 'Athens' },
  { value: 'Europe/Helsinki', city: 'Helsinki' },
  { value: 'Europe/Moscow', city: 'Moscow' },
  { value: 'Europe/Istanbul', city: 'Istanbul' },
  // Middle East
  { value: 'Asia/Dubai', city: 'Dubai' },
  { value: 'Asia/Riyadh', city: 'Riyadh' },
  { value: 'Asia/Jerusalem', city: 'Jerusalem' },
  { value: 'Asia/Tehran', city: 'Tehran' },
  // Africa
  { value: 'Africa/Cairo', city: 'Cairo' },
  { value: 'Africa/Lagos', city: 'Lagos' },
  { value: 'Africa/Johannesburg', city: 'Johannesburg' },
  { value: 'Africa/Nairobi', city: 'Nairobi' },
  { value: 'Africa/Casablanca', city: 'Casablanca' },
  // South Asia
  { value: 'Asia/Kolkata', city: 'Mumbai / Delhi' },
  { value: 'Asia/Karachi', city: 'Karachi' },
  { value: 'Asia/Dhaka', city: 'Dhaka' },
  { value: 'Asia/Colombo', city: 'Colombo' },
  // Southeast Asia
  { value: 'Asia/Singapore', city: 'Singapore' },
  { value: 'Asia/Bangkok', city: 'Bangkok' },
  { value: 'Asia/Jakarta', city: 'Jakarta' },
  { value: 'Asia/Manila', city: 'Manila' },
  { value: 'Asia/Ho_Chi_Minh', city: 'Ho Chi Minh' },
  { value: 'Asia/Kuala_Lumpur', city: 'Kuala Lumpur' },
  // East Asia
  { value: 'Asia/Tokyo', city: 'Tokyo' },
  { value: 'Asia/Seoul', city: 'Seoul' },
  { value: 'Asia/Shanghai', city: 'Beijing / Shanghai' },
  { value: 'Asia/Hong_Kong', city: 'Hong Kong' },
  { value: 'Asia/Taipei', city: 'Taipei' },
  // Australia & Pacific
  { value: 'Australia/Sydney', city: 'Sydney' },
  { value: 'Australia/Melbourne', city: 'Melbourne' },
  { value: 'Australia/Brisbane', city: 'Brisbane' },
  { value: 'Australia/Perth', city: 'Perth' },
  { value: 'Australia/Adelaide', city: 'Adelaide' },
  { value: 'Pacific/Auckland', city: 'Auckland' },
  { value: 'Pacific/Fiji', city: 'Fiji' },
];

// Generate timezone options with UTC offset labels (e.g., "(UTC +10) Sydney")
const TIMEZONES = TIMEZONE_DATA.map(tz => ({
  value: tz.value,
  label: `(${getUtcOffset(tz.value)}) ${tz.city}`
}));

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian',
  'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Russian'
];

const PROFESSION_TYPES = [
  { value: 'trainer', label: 'Personal Trainer' },
  { value: 'nutritionist', label: 'Nutritionist / Dietitian' },
  { value: 'yoga', label: 'Yoga / Pilates Instructor' },
  { value: 'wellness', label: 'Wellness Coach' },
];

export default function ProStorefront() {
  const { data: storefront, isLoading, error } = useStorefront();
  const updateMutation = useStorefrontMutation();
  const slugCheck = useSlugAvailability();
  const { data: customSlugsFeature, isLoading: featureLoading } = useSystemFeature('custom_slugs');
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("profile");
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugValue, setSlugValue] = useState("");
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Determine if user can edit their slug
  // Either the system feature is enabled OR they have purchased premium slug
  // Default to true while loading to avoid flicker (API will guard anyway)
  const customSlugsEnabled = featureLoading ? true : (customSlugsFeature?.isActive ?? true);
  const canEditSlug = customSlugsEnabled || storefront?.has_premium_slug;

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Store className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">My Storefront</h1>
            <p className="text-muted-foreground">Manage your public trainer page</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !storefront) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h3 className="font-semibold mb-2">Failed to Load Storefront</h3>
            <p className="text-muted-foreground">Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const storefrontUrl = `${window.location.origin}/s/${storefront.slug}`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(storefrontUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast({ title: "Link copied to clipboard" });
  };

  const handleSlugCheck = async () => {
    if (!slugValue || slugValue.length < 3) return;
    try {
      const result = await slugCheck.mutateAsync(slugValue);
      setSlugAvailable(result.available);
    } catch {
      setSlugAvailable(null);
    }
  };

  const handleSaveSlug = async () => {
    if (!slugAvailable) return;
    await updateMutation.mutateAsync({ slug: slugValue });
    setEditingSlug(false);
    setSlugValue("");
    setSlugAvailable(null);
  };

  const handlePublishToggle = async (published: boolean) => {
    if (published) {
      const missingFields: string[] = [];
      if (!storefront.headline) missingFields.push("headline");
      if (!storefront.bio) missingFields.push("bio");
      if (!storefront.slug) missingFields.push("URL slug");
      
      // Must have at least one content section
      const hasContent = storefront.services.length > 0 || 
                        storefront.testimonials.length > 0 || 
                        storefront.transformations.length > 0;
      if (!hasContent) {
        missingFields.push("at least one service, testimonial, or transformation");
      }
      
      if (missingFields.length > 0) {
        toast({
          title: "Cannot publish",
          description: `Please complete: ${missingFields.join(", ")}`,
          variant: "destructive"
        });
        return;
      }
    }
    await updateMutation.mutateAsync({ is_published: published });
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Store className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">My Storefront</h1>
            <p className="text-muted-foreground">Manage your public trainer page</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {storefront.is_published ? (
            <Badge className="flex items-center gap-1" data-testid="badge-published">
              <Globe className="w-3 h-3" />
              Published
            </Badge>
          ) : (
            <Badge variant="outline" className="flex items-center gap-1" data-testid="badge-draft">
              <Eye className="w-3 h-3" />
              Draft
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              {editingSlug ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">/s/</span>
                  <Input
                    value={slugValue}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                      setSlugValue(value);
                      setSlugAvailable(null);
                    }}
                    placeholder="your-custom-url"
                    className="w-48"
                    data-testid="input-slug"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSlugCheck}
                    disabled={slugCheck.isPending || slugValue.length < 3}
                    data-testid="button-check-slug"
                  >
                    {slugCheck.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
                  </Button>
                  {slugAvailable !== null && (
                    <Badge variant={slugAvailable ? "default" : "destructive"}>
                      {slugAvailable ? "Available" : "Taken"}
                    </Badge>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveSlug}
                    disabled={!slugAvailable || updateMutation.isPending}
                    data-testid="button-save-slug"
                  >
                    {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingSlug(false);
                      setSlugValue("");
                      setSlugAvailable(null);
                    }}
                    data-testid="button-cancel-slug"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  /s/{storefront.slug}
                  {canEditSlug ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        setEditingSlug(true);
                        setSlugValue(storefront.slug);
                      }}
                      data-testid="button-edit-slug"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center">
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Custom URLs require a premium upgrade</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </CardTitle>
              )}
              <CardDescription>Your public storefront URL</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                data-testid="button-copy-link"
              >
                {copiedLink ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedLink ? "Copied" : "Copy Link"}
              </Button>
              <a href={`/s/${storefront.slug}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" data-testid="button-preview-storefront">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </a>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-qr-code">
                    <QrCode className="h-4 w-4 mr-2" />
                    QR Code
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Storefront QR Code</DialogTitle>
                    <DialogDescription>
                      Share this QR code to direct people to your storefront
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="bg-white p-4 rounded-lg" id="qr-code-container">
                      <QRCodeSVG 
                        value={storefrontUrl} 
                        size={200} 
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground text-center break-all">
                      {storefrontUrl}
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        try {
                          const svg = document.querySelector('#qr-code-container svg');
                          if (!svg) {
                            toast({ title: "Error", description: "Could not generate QR code", variant: "destructive" });
                            return;
                          }
                          const svgData = new XMLSerializer().serializeToString(svg);
                          const canvas = document.createElement('canvas');
                          const ctx = canvas.getContext('2d');
                          const img = new Image();
                          img.onerror = () => {
                            toast({ title: "Error", description: "Failed to download QR code", variant: "destructive" });
                          };
                          img.onload = () => {
                            canvas.width = img.width;
                            canvas.height = img.height;
                            ctx?.drawImage(img, 0, 0);
                            const pngUrl = canvas.toDataURL('image/png');
                            const downloadLink = document.createElement('a');
                            downloadLink.href = pngUrl;
                            downloadLink.download = `storefront-qr-${storefront.slug}.png`;
                            downloadLink.click();
                            toast({ title: "QR code downloaded" });
                          };
                          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                        } catch (err) {
                          toast({ title: "Error", description: "Failed to download QR code", variant: "destructive" });
                        }
                      }}
                      data-testid="button-download-qr"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PNG
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Label htmlFor="publish-toggle">Publish Storefront</Label>
              <Switch
                id="publish-toggle"
                checked={storefront.is_published}
                onCheckedChange={handlePublishToggle}
                disabled={updateMutation.isPending}
                data-testid="switch-publish"
              />
            </div>
            {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6" data-testid="tabs-storefront">
          <TabsTrigger value="profile" data-testid="tab-profile">
            <User className="h-4 w-4 mr-2 hidden sm:inline" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="branding" data-testid="tab-branding">
            <Palette className="h-4 w-4 mr-2 hidden sm:inline" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="media" data-testid="tab-media">
            <ImageIcon className="h-4 w-4 mr-2 hidden sm:inline" />
            Media
          </TabsTrigger>
          <TabsTrigger value="services" data-testid="tab-services">
            <Package className="h-4 w-4 mr-2 hidden sm:inline" />
            Services
          </TabsTrigger>
          <TabsTrigger value="testimonials" data-testid="tab-testimonials">
            <MessageSquare className="h-4 w-4 mr-2 hidden sm:inline" />
            Reviews
          </TabsTrigger>
          <TabsTrigger value="transformations" data-testid="tab-transformations">
            <Camera className="h-4 w-4 mr-2 hidden sm:inline" />
            Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileTab storefront={storefront} onUpdate={updateMutation.mutateAsync} isPending={updateMutation.isPending} />
        </TabsContent>

        <TabsContent value="branding" className="mt-6">
          <BrandingTab storefront={storefront} onUpdate={updateMutation.mutateAsync} isPending={updateMutation.isPending} />
        </TabsContent>

        <TabsContent value="media" className="mt-6">
          <MediaTab storefront={storefront} onUpdate={updateMutation.mutateAsync} isPending={updateMutation.isPending} />
        </TabsContent>

        <TabsContent value="services" className="mt-6">
          <ServicesTab storefront={storefront} />
        </TabsContent>

        <TabsContent value="testimonials" className="mt-6">
          <TestimonialsTab storefront={storefront} />
        </TabsContent>

        <TabsContent value="transformations" className="mt-6">
          <TransformationsTab storefront={storefront} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const profileSchema = z.object({
  headline: z.string().max(100, "Headline must be 100 characters or less").optional(),
  bio: z.string().max(2000, "Bio must be 2000 characters or less").optional(),
  experience_years: z.number().min(0).max(50).nullable().optional(),
  specialties: z.array(z.string()).optional(),
  credentials: z.array(z.string()).optional(),
  timezone: z.string().optional(),
  languages: z.array(z.string()).optional(),
  profession_types: z.array(z.string()).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

function ProfileTab({ storefront, onUpdate, isPending }: { 
  storefront: StorefrontWithDetails; 
  onUpdate: (data: Partial<StorefrontWithDetails>) => Promise<any>;
  isPending: boolean;
}) {
  const [specialtiesText, setSpecialtiesText] = useState((storefront.specialties || []).join(', '));
  const [credentialsText, setCredentialsText] = useState((storefront.credentials || []).join(', '));
  
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      headline: storefront.headline || '',
      bio: storefront.bio || '',
      experience_years: storefront.experience_years || null,
      specialties: storefront.specialties || [],
      credentials: storefront.credentials || [],
      timezone: storefront.timezone || '',
      languages: storefront.languages || [],
      profession_types: storefront.profession_types || [],
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    const specialtiesArray = specialtiesText.split(',').map(s => s.trim()).filter(Boolean);
    const credentialsArray = credentialsText.split(',').map(s => s.trim()).filter(Boolean);
    await onUpdate({ ...data, specialties: specialtiesArray, credentials: credentialsArray });
    form.reset({ ...data, specialties: specialtiesArray, credentials: credentialsArray });
  };

  const watchHeadline = form.watch("headline") || "";
  const watchBio = form.watch("bio") || "";
  const watchProfessionTypes = form.watch("profession_types") || [];
  const watchLanguages = form.watch("languages") || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Tell clients about yourself and your expertise</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="headline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Headline</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ''}
                      placeholder="e.g., Certified Personal Trainer & Nutrition Coach"
                      maxLength={100}
                      data-testid="input-headline"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">{watchHeadline.length}/100</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>About Me</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ''}
                      placeholder="Tell potential clients about yourself, your experience, and training philosophy..."
                      rows={5}
                      maxLength={2000}
                      data-testid="input-bio"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground text-right">{watchBio.length}/2000</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="experience_years"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Years of Experience</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="e.g., 5"
                        className="w-32"
                        data-testid="input-experience"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-timezone">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIMEZONES.map(tz => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="profession_types"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profession Types</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {PROFESSION_TYPES.map(pt => (
                      <Badge
                        key={pt.value}
                        variant={watchProfessionTypes.includes(pt.value) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          const newTypes = watchProfessionTypes.includes(pt.value)
                            ? watchProfessionTypes.filter(t => t !== pt.value)
                            : [...watchProfessionTypes, pt.value];
                          field.onChange(newTypes);
                        }}
                        data-testid={`badge-profession-${pt.value}`}
                      >
                        {pt.label}
                      </Badge>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="languages"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Languages</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGES.map(lang => (
                      <Badge
                        key={lang}
                        variant={watchLanguages.includes(lang) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          const newLangs = watchLanguages.includes(lang)
                            ? watchLanguages.filter(l => l !== lang)
                            : [...watchLanguages, lang];
                          field.onChange(newLangs);
                        }}
                        data-testid={`badge-language-${lang.toLowerCase()}`}
                      >
                        {lang}
                      </Badge>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label>Specialties (comma-separated)</Label>
              <Input
                value={specialtiesText}
                onChange={(e) => setSpecialtiesText(e.target.value)}
                placeholder="e.g., Weight Loss, Strength Training, HIIT"
                data-testid="input-specialties"
              />
            </div>

            <div className="space-y-2">
              <Label>Credentials (comma-separated)</Label>
              <Input
                value={credentialsText}
                onChange={(e) => setCredentialsText(e.target.value)}
                placeholder="e.g., NASM-CPT, ACE Certified, BS in Exercise Science"
                data-testid="input-credentials"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={!form.formState.isDirty || isPending} data-testid="button-save-profile">
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

const brandingSchema = z.object({
  business_name: z.string().max(100).optional(),
  accent_color: z.string().refine(c => ACCENT_COLORS.includes(c), "Invalid accent color"),
  storefront_variation: z.enum(['classic', 'bold', 'services-first', 'story-driven']),
  social_links: z.record(z.string()).optional(),
  booking_url: z.string().url().optional().or(z.literal('')),
  accepting_new_clients: z.boolean(),
  waitlist_enabled: z.boolean(),
});

type BrandingFormData = z.infer<typeof brandingSchema>;

function BrandingTab({ storefront, onUpdate, isPending }: { 
  storefront: StorefrontWithDetails; 
  onUpdate: (data: Partial<StorefrontWithDetails>) => Promise<any>;
  isPending: boolean;
}) {
  const form = useForm<BrandingFormData>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      business_name: storefront.business_name || '',
      accent_color: storefront.accent_color || ACCENT_COLORS[0],
      storefront_variation: (storefront.storefront_variation as any) || 'classic',
      social_links: storefront.social_links || {},
      booking_url: storefront.booking_url || '',
      accepting_new_clients: storefront.accepting_new_clients ?? true,
      waitlist_enabled: storefront.waitlist_enabled || false,
    },
  });

  const onSubmit = async (data: BrandingFormData) => {
    await onUpdate(data);
    form.reset(data);
  };

  const watchAccentColor = form.watch("accent_color");
  const watchVariation = form.watch("storefront_variation");
  const watchSocialLinks = form.watch("social_links") || {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding & Appearance</CardTitle>
        <CardDescription>Customize how your storefront looks</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="business_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Name (optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ''}
                      placeholder="e.g., Iron Will Fitness"
                      data-testid="input-business-name"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Leave blank to use your personal name</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accent_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Accent Color</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {ACCENT_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          watchAccentColor === color ? 'border-foreground scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => field.onChange(color)}
                        data-testid={`color-${color.replace('#', '')}`}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="storefront_variation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Layout Variation</FormLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {STOREFRONT_VARIATIONS.map(v => (
                      <div
                        key={v.value}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          watchVariation === v.value 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => field.onChange(v.value)}
                        data-testid={`variation-${v.value}`}
                      >
                        <p className="font-medium">{v.label}</p>
                        <p className="text-sm text-muted-foreground">{v.description}</p>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="social_links"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Social Links</FormLabel>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['instagram', 'youtube', 'tiktok', 'twitter', 'facebook', 'website'].map(platform => (
                      <div key={platform} className="space-y-1">
                        <Label className="text-xs capitalize">{platform}</Label>
                        <Input
                          value={(watchSocialLinks as any)[platform] || ''}
                          onChange={(e) => field.onChange({ ...watchSocialLinks, [platform]: e.target.value })}
                          placeholder={platform === 'website' ? 'https://yourwebsite.com' : `@${platform}handle`}
                          data-testid={`input-social-${platform}`}
                        />
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="booking_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Booking URL (optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ''}
                      placeholder="https://calendly.com/yourname"
                      data-testid="input-booking-url"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">External booking link (Calendly, Acuity, etc.)</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4 p-4 border rounded-lg">
              <h4 className="font-medium">Client Availability</h4>
              
              <FormField
                control={form.control}
                name="accepting_new_clients"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-4">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-accepting-clients"
                      />
                    </FormControl>
                    <div className="flex-1">
                      <FormLabel className="text-base">Accepting New Clients</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        When enabled, visitors can contact you directly
                      </p>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="waitlist_enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-4">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-waitlist"
                      />
                    </FormControl>
                    <div className="flex-1">
                      <FormLabel className="text-base">Enable Waitlist</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Show "Join Waitlist" when you're not accepting new clients
                      </p>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={!form.formState.isDirty || isPending} data-testid="button-save-branding">
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function MediaTab({ storefront, onUpdate, isPending }: { 
  storefront: StorefrontWithDetails; 
  onUpdate: (data: Partial<StorefrontWithDetails>) => Promise<any>;
  isPending: boolean;
}) {
  const { toast } = useToast();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState<'cover' | 'thumbnail' | null>(null);
  
  const [formData, setFormData] = useState({
    cover_image_url: storefront.cover_image_url || '',
    intro_video_url: storefront.intro_video_url || '',
    video_thumbnail_url: storefront.video_thumbnail_url || '',
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setFormData({
      cover_image_url: storefront.cover_image_url || '',
      intro_video_url: storefront.intro_video_url || '',
      video_thumbnail_url: storefront.video_thumbnail_url || '',
    });
    setHasChanges(false);
  }, [storefront.cover_image_url, storefront.intro_video_url, storefront.video_thumbnail_url]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleFileUpload = async (file: File, type: 'cover' | 'thumbnail') => {
    if (!file) return;
    
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please choose an image under 10MB",
        variant: "destructive",
      });
      return;
    }
    
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please choose a JPEG, PNG, WebP, or GIF image",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploading(type);
    try {
      const result = await uploadStorefrontMedia(storefront.trainer_id, file, type);
      if (result) {
        const field = type === 'cover' ? 'cover_image_url' : 'video_thumbnail_url';
        handleChange(field, result.url);
        toast({
          title: "Image uploaded",
          description: "Your image has been uploaded successfully",
        });
      } else {
        toast({
          title: "Upload failed",
          description: "Could not upload the image. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "An error occurred while uploading",
        variant: "destructive",
      });
    } finally {
      setIsUploading(null);
    }
  };

  const handleSave = async () => {
    await onUpdate(formData);
    setHasChanges(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hero Media</CardTitle>
        <CardDescription>Add images and video to make your storefront stand out</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Cover Image</Label>
          <div className="flex gap-2">
            <Input
              value={formData.cover_image_url}
              onChange={(e) => handleChange('cover_image_url', e.target.value)}
              placeholder="https://example.com/your-hero-image.jpg"
              data-testid="input-cover-image"
              className="flex-1"
            />
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, 'cover');
                e.target.value = '';
              }}
            />
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => coverInputRef.current?.click()}
              disabled={isUploading === 'cover'}
              data-testid="button-upload-cover"
            >
              {isUploading === 'cover' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Upload an image or paste a URL. Recommended: 1920x1080px or larger</p>
          {formData.cover_image_url && (
            <img 
              src={formData.cover_image_url} 
              alt="Cover preview" 
              className="w-full max-w-md h-48 object-cover rounded-lg mt-2"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="intro-video">Intro Video URL</Label>
          <Input
            id="intro-video"
            value={formData.intro_video_url}
            onChange={(e) => handleChange('intro_video_url', e.target.value)}
            placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
            data-testid="input-intro-video"
          />
          <p className="text-xs text-muted-foreground">YouTube or Vimeo link</p>
        </div>

        <div className="space-y-2">
          <Label>Video Thumbnail (optional)</Label>
          <div className="flex gap-2">
            <Input
              value={formData.video_thumbnail_url}
              onChange={(e) => handleChange('video_thumbnail_url', e.target.value)}
              placeholder="https://example.com/video-thumbnail.jpg"
              data-testid="input-video-thumbnail"
              className="flex-1"
            />
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, 'thumbnail');
                e.target.value = '';
              }}
            />
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => thumbnailInputRef.current?.click()}
              disabled={isUploading === 'thumbnail'}
              data-testid="button-upload-thumbnail"
            >
              {isUploading === 'thumbnail' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Upload an image or paste a URL. Custom poster image for your video</p>
          {formData.video_thumbnail_url && (
            <img 
              src={formData.video_thumbnail_url} 
              alt="Thumbnail preview" 
              className="w-48 h-28 object-cover rounded-lg mt-2"
            />
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!hasChanges || isPending} data-testid="button-save-media">
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ServicesTab({ storefront }: { storefront: StorefrontWithDetails }) {
  const { createService, updateService, deleteService } = useServiceMutations();
  const [editingService, setEditingService] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSave = async () => {
    if (editingService.id) {
      await updateService.mutateAsync(editingService);
    } else {
      await createService.mutateAsync(editingService);
    }
    setEditingService(null);
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteService.mutateAsync(id);
  };

  const openNewService = () => {
    setEditingService({
      title: '',
      description: '',
      price_display: '',
      duration: '',
      is_featured: false,
      sort_order: storefront.services.length,
    });
    setIsDialogOpen(true);
  };

  const openEditService = (service: any) => {
    setEditingService({ ...service });
    setIsDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Services
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    type="button" 
                    className="cursor-help" 
                    aria-label="More info about services"
                    data-testid="button-services-info"
                  >
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>To sell products and receive payments via Stripe, go to Marketplace and set up your Products.</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription>
              For display only. Showcase your offerings to attract clients.
            </CardDescription>
          </div>
          <Button onClick={openNewService} data-testid="button-add-service">
            <Plus className="h-4 w-4 mr-2" />
            Add Service
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {storefront.services.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No services yet. Add your first service to showcase your offerings.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {storefront.services.map((service) => (
              <div key={service.id} className="flex items-start justify-between p-4 border rounded-lg" data-testid={`service-item-${service.id}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{service.title}</h4>
                    {service.is_featured && <Badge variant="secondary"><Star className="h-3 w-3 mr-1" />Featured</Badge>}
                  </div>
                  {service.price_display && <p className="text-primary font-semibold">{service.price_display}</p>}
                  {service.description && <p className="text-sm text-muted-foreground mt-1">{service.description}</p>}
                  {service.duration && <p className="text-xs text-muted-foreground">{service.duration}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEditService(service)} data-testid={`button-edit-service-${service.id}`}>
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive" data-testid={`button-delete-service-${service.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Service?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(service.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingService(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingService?.id ? 'Edit Service' : 'Add Service'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editingService?.title || ''}
                  onChange={(e) => setEditingService({ ...editingService, title: e.target.value })}
                  placeholder="e.g., 1-on-1 Personal Training"
                  data-testid="input-service-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Price Display</Label>
                <Input
                  value={editingService?.price_display || ''}
                  onChange={(e) => setEditingService({ ...editingService, price_display: e.target.value })}
                  placeholder="e.g., $150/session"
                  data-testid="input-service-price"
                />
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Input
                  value={editingService?.duration || ''}
                  onChange={(e) => setEditingService({ ...editingService, duration: e.target.value })}
                  placeholder="e.g., 60 minutes"
                  data-testid="input-service-duration"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingService?.description || ''}
                  onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                  placeholder="Describe this service..."
                  data-testid="input-service-description"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingService?.is_featured || false}
                  onCheckedChange={(v) => setEditingService({ ...editingService, is_featured: v })}
                  data-testid="switch-service-featured"
                />
                <Label>Featured service</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleSave} 
                disabled={!editingService?.title || createService.isPending || updateService.isPending}
                data-testid="button-save-service"
              >
                {(createService.isPending || updateService.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function TestimonialsTab({ storefront }: { storefront: StorefrontWithDetails }) {
  const { createTestimonial, updateTestimonial, deleteTestimonial } = useTestimonialMutations();
  const [editingTestimonial, setEditingTestimonial] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSave = async () => {
    if (editingTestimonial.id) {
      await updateTestimonial.mutateAsync(editingTestimonial);
    } else {
      await createTestimonial.mutateAsync(editingTestimonial);
    }
    setEditingTestimonial(null);
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteTestimonial.mutateAsync(id);
  };

  const openNewTestimonial = () => {
    setEditingTestimonial({
      client_name: '',
      quote: '',
      rating: 5,
      result_achieved: '',
      is_featured: false,
      sort_order: storefront.testimonials.length,
    });
    setIsDialogOpen(true);
  };

  const openEditTestimonial = (testimonial: any) => {
    setEditingTestimonial({ ...testimonial });
    setIsDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Testimonials</CardTitle>
            <CardDescription>Showcase client reviews and success stories</CardDescription>
          </div>
          <Button onClick={openNewTestimonial} data-testid="button-add-testimonial">
            <Plus className="h-4 w-4 mr-2" />
            Add Testimonial
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {storefront.testimonials.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No testimonials yet. Add client reviews to build trust.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {storefront.testimonials.map((testimonial) => (
              <div key={testimonial.id} className="flex items-start justify-between p-4 border rounded-lg" data-testid={`testimonial-item-${testimonial.id}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{testimonial.client_name}</h4>
                    {testimonial.is_featured && <Badge variant="secondary"><Star className="h-3 w-3 mr-1" />Featured</Badge>}
                  </div>
                  <div className="flex gap-1 my-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} className={`h-4 w-4 ${i <= (testimonial.rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                    ))}
                  </div>
                  <p className="text-sm italic">"{testimonial.quote}"</p>
                  {testimonial.result_achieved && <p className="text-xs text-muted-foreground mt-1">Result: {testimonial.result_achieved}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEditTestimonial(testimonial)} data-testid={`button-edit-testimonial-${testimonial.id}`}>
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive" data-testid={`button-delete-testimonial-${testimonial.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Testimonial?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(testimonial.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingTestimonial(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTestimonial?.id ? 'Edit Testimonial' : 'Add Testimonial'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Input
                  value={editingTestimonial?.client_name || ''}
                  onChange={(e) => setEditingTestimonial({ ...editingTestimonial, client_name: e.target.value })}
                  placeholder="e.g., Sarah M."
                  data-testid="input-testimonial-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setEditingTestimonial({ ...editingTestimonial, rating: i })}
                      data-testid={`rating-star-${i}`}
                    >
                      <Star className={`h-6 w-6 ${i <= (editingTestimonial?.rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Quote</Label>
                <Textarea
                  value={editingTestimonial?.quote || ''}
                  onChange={(e) => setEditingTestimonial({ ...editingTestimonial, quote: e.target.value })}
                  placeholder="What did the client say?"
                  data-testid="input-testimonial-quote"
                />
              </div>
              <div className="space-y-2">
                <Label>Result Achieved (optional)</Label>
                <Input
                  value={editingTestimonial?.result_achieved || ''}
                  onChange={(e) => setEditingTestimonial({ ...editingTestimonial, result_achieved: e.target.value })}
                  placeholder="e.g., Lost 30 lbs in 3 months"
                  data-testid="input-testimonial-result"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingTestimonial?.is_featured || false}
                  onCheckedChange={(v) => setEditingTestimonial({ ...editingTestimonial, is_featured: v })}
                  data-testid="switch-testimonial-featured"
                />
                <Label>Featured testimonial</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleSave} 
                disabled={!editingTestimonial?.client_name || !editingTestimonial?.quote || createTestimonial.isPending || updateTestimonial.isPending}
                data-testid="button-save-testimonial"
              >
                {(createTestimonial.isPending || updateTestimonial.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function TransformationsTab({ storefront }: { storefront: StorefrontWithDetails }) {
  const { createTransformation, updateTransformation, deleteTransformation } = useTransformationMutations();
  const [editingTransformation, setEditingTransformation] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState<'before' | 'after' | null>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageUpload = async (file: File, type: 'before' | 'after') => {
    if (!file.type.startsWith('image/')) {
      toast({ title: "Error", description: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "Image must be less than 5MB", variant: "destructive" });
      return;
    }
    setIsUploading(type);
    try {
      const result = await uploadStorefrontMedia(storefront.trainer_id, file, type === 'before' ? 'transformation-before' : 'transformation-after');
      if (!result) throw new Error('Upload failed');
      setEditingTransformation((prev: any) => ({
        ...prev,
        [type === 'before' ? 'before_image_url' : 'after_image_url']: result.url
      }));
      toast({ title: "Image uploaded" });
    } catch (error) {
      toast({ title: "Upload failed", description: "Please try again", variant: "destructive" });
    } finally {
      setIsUploading(null);
    }
  };

  const handleSave = async () => {
    if (editingTransformation.id) {
      await updateTransformation.mutateAsync(editingTransformation);
    } else {
      await createTransformation.mutateAsync(editingTransformation);
    }
    setEditingTransformation(null);
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteTransformation.mutateAsync(id);
  };

  const openNewTransformation = () => {
    setEditingTransformation({
      title: '',
      description: '',
      before_image_url: '',
      after_image_url: '',
      duration_weeks: null,
      is_featured: false,
      sort_order: storefront.transformations.length,
    });
    setIsDialogOpen(true);
  };

  const openEditTransformation = (transformation: any) => {
    setEditingTransformation({ ...transformation });
    setIsDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Transformations</CardTitle>
            <CardDescription>Show before & after results</CardDescription>
          </div>
          <Button onClick={openNewTransformation} data-testid="button-add-transformation">
            <Plus className="h-4 w-4 mr-2" />
            Add Transformation
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {storefront.transformations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No transformations yet. Add before & after photos to showcase results.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {storefront.transformations.map((transformation) => (
              <div key={transformation.id} className="p-4 border rounded-lg" data-testid={`transformation-item-${transformation.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {transformation.title && <h4 className="font-medium">{transformation.title}</h4>}
                    {transformation.is_featured && <Badge variant="secondary"><Star className="h-3 w-3" /></Badge>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditTransformation(transformation)} data-testid={`button-edit-transformation-${transformation.id}`}>
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive" data-testid={`button-delete-transformation-${transformation.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Transformation?</AlertDialogTitle>
                          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(transformation.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Before</p>
                    {transformation.before_image_url ? (
                      <img src={transformation.before_image_url} alt="Before" className="w-full h-32 object-cover rounded" />
                    ) : (
                      <div className="w-full h-32 bg-muted rounded flex items-center justify-center text-muted-foreground">No image</div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">After</p>
                    {transformation.after_image_url ? (
                      <img src={transformation.after_image_url} alt="After" className="w-full h-32 object-cover rounded" />
                    ) : (
                      <div className="w-full h-32 bg-muted rounded flex items-center justify-center text-muted-foreground">No image</div>
                    )}
                  </div>
                </div>
                {transformation.duration_weeks && (
                  <p className="text-xs text-muted-foreground mt-2">{transformation.duration_weeks} weeks</p>
                )}
              </div>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingTransformation(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTransformation?.id ? 'Edit Transformation' : 'Add Transformation'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title (optional)</Label>
                <Input
                  value={editingTransformation?.title || ''}
                  onChange={(e) => setEditingTransformation({ ...editingTransformation, title: e.target.value })}
                  placeholder="e.g., 12-Week Body Transformation"
                  data-testid="input-transformation-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Before Image</Label>
                <div className="flex gap-2">
                  <Input
                    value={editingTransformation?.before_image_url || ''}
                    onChange={(e) => setEditingTransformation({ ...editingTransformation, before_image_url: e.target.value })}
                    placeholder="Upload or paste URL"
                    className="flex-1"
                    data-testid="input-transformation-before"
                  />
                  <input
                    type="file"
                    ref={beforeInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'before')}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => beforeInputRef.current?.click()}
                    disabled={isUploading === 'before'}
                    data-testid="button-upload-before"
                  >
                    {isUploading === 'before' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </Button>
                </div>
                {editingTransformation?.before_image_url && (
                  <img src={editingTransformation.before_image_url} alt="Before preview" className="w-full h-32 object-cover rounded mt-2" />
                )}
              </div>
              <div className="space-y-2">
                <Label>After Image</Label>
                <div className="flex gap-2">
                  <Input
                    value={editingTransformation?.after_image_url || ''}
                    onChange={(e) => setEditingTransformation({ ...editingTransformation, after_image_url: e.target.value })}
                    placeholder="Upload or paste URL"
                    className="flex-1"
                    data-testid="input-transformation-after"
                  />
                  <input
                    type="file"
                    ref={afterInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'after')}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => afterInputRef.current?.click()}
                    disabled={isUploading === 'after'}
                    data-testid="button-upload-after"
                  >
                    {isUploading === 'after' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </Button>
                </div>
                {editingTransformation?.after_image_url && (
                  <img src={editingTransformation.after_image_url} alt="After preview" className="w-full h-32 object-cover rounded mt-2" />
                )}
              </div>
              <div className="space-y-2">
                <Label>Duration (weeks)</Label>
                <Input
                  type="number"
                  min={1}
                  value={editingTransformation?.duration_weeks || ''}
                  onChange={(e) => setEditingTransformation({ ...editingTransformation, duration_weeks: parseInt(e.target.value) || null })}
                  placeholder="e.g., 12"
                  className="w-24"
                  data-testid="input-transformation-weeks"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={editingTransformation?.description || ''}
                  onChange={(e) => setEditingTransformation({ ...editingTransformation, description: e.target.value })}
                  placeholder="Describe the transformation journey..."
                  data-testid="input-transformation-description"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingTransformation?.is_featured || false}
                  onCheckedChange={(v) => setEditingTransformation({ ...editingTransformation, is_featured: v })}
                  data-testid="switch-transformation-featured"
                />
                <Label>Featured transformation</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleSave} 
                disabled={!editingTransformation?.before_image_url || !editingTransformation?.after_image_url || createTransformation.isPending || updateTransformation.isPending}
                data-testid="button-save-transformation"
              >
                {(createTransformation.isPending || updateTransformation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
