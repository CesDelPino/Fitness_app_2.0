import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { Route, Switch, Redirect } from "wouter";
import { AdminLayout } from "@/components/admin-v2/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch as SwitchUI } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Target, Calendar, CreditCard, Users, 
  TrendingUp, TrendingDown, DollarSign, Tag, 
  AlertCircle, CheckCircle, XCircle, Clock, 
  Filter, RefreshCw, ExternalLink, ChevronLeft, ChevronRight
} from "lucide-react";
import { MarketplaceTab } from "@/components/admin/MarketplaceTab";
import { ProductApprovalQueue } from "@/components/admin/ProductApprovalQueue";
import { format } from "date-fns";

type AdminKPIs = {
  verified_professionals: number;
  pending_verifications: number;
  active_connections: number;
  forced_connections: number;
  total_permission_grants: number;
  exclusive_grants: number;
  pending_permission_requests: number;
  active_presets: number;
  total_professionals: number;
  total_clients: number;
};

type ActivityEntry = {
  id: string;
  event_type: string;
  actor_type: string;
  actor_id: string;
  actor_name: string;
  target_client_id: string | null;
  target_client_name: string | null;
  target_professional_id: string | null;
  target_professional_name: string | null;
  permission_slug: string | null;
  permission_name: string | null;
  reason: string | null;
  created_at: string;
};

type SubscriptionMetrics = {
  totalActive: number;
  totalTrialing: number;
  totalCanceled: number;
  totalPastDue: number;
  newThisMonth: number;
  canceledThisMonth: number;
};

type Subscriber = {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete';
  current_period_start: string | null;
  current_period_end: string | null;
  trial_start: string | null;
  trial_end: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
  grace_period_end: string | null;
  created_at: string;
  updated_at: string;
  profiles: {
    email: string;
    display_name: string | null;
  };
};

type PromoCode = {
  id: string;
  code: string;
  stripe_coupon_id: string | null;
  discount_type: 'percent' | 'amount';
  discount_value: number;
  max_redemptions: number | null;
  redemption_count: number;
  first_time_only: boolean;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
};

type StripePrice = {
  id: string;
  unit_amount: number | null;
  currency: string;
  nickname: string | null;
  recurring: {
    interval: 'day' | 'week' | 'month' | 'year';
    interval_count: number;
  } | null;
  metadata: Record<string, string>;
  active: boolean;
};

type StripeProduct = {
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, string>;
  prices: StripePrice[];
};

function AdminStatsTab() {
  const { data: kpis, isLoading } = useQuery<AdminKPIs>({
    queryKey: ["/api/admin/dashboard/kpis"],
    queryFn: async () => {
      const response = await fetch("/api/admin/dashboard/kpis", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch KPIs");
      return response.json();
    },
  });

  const { data: activity = [] } = useQuery<ActivityEntry[]>({
    queryKey: ["/api/admin/dashboard/activity"],
    queryFn: async () => {
      const response = await fetch("/api/admin/dashboard/activity?limit=10", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch activity");
      return response.json();
    },
  });

  const kpiCards = kpis ? [
    { label: "Verified Pros", value: kpis.verified_professionals, color: "text-green-600" },
    { label: "Pending Verifications", value: kpis.pending_verifications, color: "text-amber-600" },
    { label: "Active Connections", value: kpis.active_connections, color: "text-blue-600" },
    { label: "Forced Connections", value: kpis.forced_connections, color: "text-purple-600" },
    { label: "Permission Grants", value: kpis.total_permission_grants, color: "text-cyan-600" },
    { label: "Exclusive Grants", value: kpis.exclusive_grants, color: "text-orange-600" },
    { label: "Pending Requests", value: kpis.pending_permission_requests, color: "text-yellow-600" },
    { label: "Active Presets", value: kpis.active_presets, color: "text-indigo-600" },
  ] : [];

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            System Overview
          </CardTitle>
          <CardDescription>Key performance indicators</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {kpiCards.map((kpi, i) => (
                <div key={i} className="p-4 border rounded-lg text-center" data-testid={`kpi-card-${i}`}>
                  <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{kpi.label}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest permission events</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No recent activity</div>
          ) : (
            <div className="space-y-3">
              {activity.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`activity-entry-${entry.id}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{entry.event_type.replace(/_/g, " ")}</Badge>
                      <span className="text-sm font-medium">{entry.actor_name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {entry.target_client_name && <span>Client: {entry.target_client_name}</span>}
                      {entry.target_professional_name && <span className="ml-2">Pro: {entry.target_professional_name}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(entry.created_at), "MMM d, HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SubscriptionsTab() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<'metrics' | 'subscribers' | 'promos' | 'pricing' | 'connect'>('metrics');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscountType, setNewPromoDiscountType] = useState<'percent' | 'amount'>('percent');
  const [newPromoDiscountValue, setNewPromoDiscountValue] = useState('');
  const [newPromoMaxRedemptions, setNewPromoMaxRedemptions] = useState('');
  const [newPromoFirstTimeOnly, setNewPromoFirstTimeOnly] = useState(false);
  const [newPromoExpiresAt, setNewPromoExpiresAt] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const { data: metrics, isLoading: loadingMetrics } = useQuery<SubscriptionMetrics>({
    queryKey: ['/api/admin/stripe/metrics'],
    queryFn: async () => {
      const response = await fetch('/api/admin/stripe/metrics', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    },
  });

  const { data: subscribersData, isLoading: loadingSubscribers, refetch: refetchSubscribers } = useQuery<{ subscriptions: Subscriber[]; total: number }>({
    queryKey: ['/api/admin/stripe/subscribers', statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const response = await fetch(`/api/admin/stripe/subscribers?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch subscribers');
      return response.json();
    },
  });

  const { data: promoCodes = [], isLoading: loadingPromos, refetch: refetchPromos } = useQuery<PromoCode[]>({
    queryKey: ['/api/admin/stripe/promo-codes'],
    queryFn: async () => {
      const response = await fetch('/api/admin/stripe/promo-codes?includeInactive=true', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch promo codes');
      const data = await response.json();
      return data.codes || [];
    },
  });

  const createPromoMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/admin/stripe/promo-codes', {
        code: newPromoCode,
        discountType: newPromoDiscountType,
        discountValue: Number(newPromoDiscountValue),
        maxRedemptions: newPromoMaxRedemptions ? Number(newPromoMaxRedemptions) : null,
        firstTimeOnly: newPromoFirstTimeOnly,
        expiresAt: newPromoExpiresAt || null,
      });
      if (!response.ok) throw new Error('Failed to create promo code');
      return response.json();
    },
    onSuccess: () => {
      refetchPromos();
      toast({ title: 'Promo code created successfully' });
      setPromoDialogOpen(false);
      setNewPromoCode('');
      setNewPromoDiscountValue('');
      setNewPromoMaxRedemptions('');
      setNewPromoFirstTimeOnly(false);
      setNewPromoExpiresAt('');
    },
    onError: () => {
      toast({ title: 'Failed to create promo code', variant: 'destructive' });
    },
  });

  const togglePromoMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest('PATCH', `/api/admin/stripe/promo-codes/${id}`, { isActive });
      if (!response.ok) throw new Error('Failed to update promo code');
      return response.json();
    },
    onSuccess: () => {
      refetchPromos();
      toast({ title: 'Promo code updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update promo code', variant: 'destructive' });
    },
  });

  const { data: productsData, isLoading: loadingProducts, refetch: refetchProducts } = useQuery<{ products: StripeProduct[] }>({
    queryKey: ['/api/admin/stripe/prices'],
    queryFn: async () => {
      const response = await fetch('/api/admin/stripe/prices', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch prices');
      return response.json();
    },
  });

  const togglePriceActiveMutation = useMutation({
    mutationFn: async ({ priceId, active }: { priceId: string; active: boolean }) => {
      const response = await apiRequest('PATCH', `/api/admin/stripe/prices/${priceId}`, { active });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to toggle price');
      }
      return response.json();
    },
    onSuccess: (_, { active }) => {
      refetchProducts();
      toast({ 
        title: active ? 'Price tier enabled' : 'Price tier disabled',
        description: active 
          ? 'This tier is now visible on the subscription page for new customers.' 
          : 'This tier is hidden from new signups. Existing subscribers are NOT affected.'
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Cannot toggle price',
        description: error.message,
        variant: 'destructive' 
      });
      refetchProducts();
    },
  });

  const handleTogglePriceActive = (productId: string, priceId: string, newActive: boolean) => {
    const product = productsData?.products?.find(p => p.id === productId);
    const activePrices = product?.prices?.filter(p => p.active) || [];
    
    if (!newActive && activePrices.length === 1 && activePrices[0].id === priceId) {
      toast({
        title: 'Cannot disable last active price',
        description: 'At least one price tier must remain active for checkout to work.',
        variant: 'destructive',
      });
      return;
    }
    
    togglePriceActiveMutation.mutate({ priceId, active: newActive });
  };

  const formatInterval = (recurring: StripePrice['recurring']) => {
    if (!recurring) return 'One-time';
    const count = recurring.interval_count;
    const interval = recurring.interval;
    if (count === 1) return `per ${interval}`;
    return `every ${count} ${interval}s`;
  };

  const getStatusBadge = (status: Subscriber['status']) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>;
      case 'trialing': return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Trialing</Badge>;
      case 'past_due': return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Past Due</Badge>;
      case 'canceled': return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Canceled</Badge>;
      case 'unpaid': return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Unpaid</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const totalPages = Math.ceil((subscribersData?.total || 0) / pageSize);

  return (
    <div className="space-y-6 p-6">
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={activeSection === 'metrics' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('metrics')}
          data-testid="button-section-metrics"
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Metrics
        </Button>
        <Button
          variant={activeSection === 'subscribers' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('subscribers')}
          data-testid="button-section-subscribers"
        >
          <Users className="w-4 h-4 mr-2" />
          Subscribers
        </Button>
        <Button
          variant={activeSection === 'promos' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('promos')}
          data-testid="button-section-promos"
        >
          <Tag className="w-4 h-4 mr-2" />
          Promo Codes
        </Button>
        <Button
          variant={activeSection === 'pricing' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('pricing')}
          data-testid="button-section-pricing"
        >
          <DollarSign className="w-4 h-4 mr-2" />
          Pricing
        </Button>
        <Button
          variant={activeSection === 'connect' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('connect')}
          data-testid="button-section-connect"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Connect Accounts
        </Button>
      </div>

      {activeSection === 'metrics' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Subscription Overview
              </CardTitle>
              <CardDescription>Key subscription metrics at a glance</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMetrics ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : metrics ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="p-4 border rounded-lg text-center" data-testid="metric-active">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{metrics.totalActive}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg text-center" data-testid="metric-trialing">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{metrics.totalTrialing}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3" />
                      Trialing
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg text-center" data-testid="metric-past-due">
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{metrics.totalPastDue}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Past Due
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg text-center" data-testid="metric-canceled">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{metrics.totalCanceled}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                      <XCircle className="w-3 h-3" />
                      Canceled
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg text-center" data-testid="metric-new-month">
                    <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{metrics.newThisMonth}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      New (Month)
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg text-center" data-testid="metric-churned-month">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{metrics.canceledThisMonth}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                      <TrendingDown className="w-3 h-3" />
                      Churned (Month)
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">No metrics available</p>
              )}
            </CardContent>
          </Card>

          {metrics && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Revenue Indicators
                </CardTitle>
                <CardDescription>Monthly recurring revenue estimates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Est. Monthly MRR</div>
                    <div className="text-2xl font-bold text-primary mt-1">
                      ${((metrics.totalActive * 9.99) + (metrics.totalTrialing * 0)).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Based on {metrics.totalActive} active @ $9.99/mo
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Trial Conversion Potential</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      ${(metrics.totalTrialing * 9.99).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      If {metrics.totalTrialing} trials convert
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">At-Risk Revenue</div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      ${(metrics.totalPastDue * 9.99).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {metrics.totalPastDue} past due subscriptions
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeSection === 'subscribers' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Subscribers
                </CardTitle>
                <CardDescription>View and filter all subscription records</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-36" data-testid="select-status-filter">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trialing">Trialing</SelectItem>
                    <SelectItem value="past_due">Past Due</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => refetchSubscribers()} data-testid="button-refresh-subscribers">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingSubscribers ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : !subscribersData?.subscriptions.length ? (
              <p className="text-center text-muted-foreground py-8">No subscribers found</p>
            ) : (
              <div className="space-y-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {subscribersData.subscriptions.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-2"
                        data-testid={`subscriber-row-${sub.id}`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{sub.profiles?.email || 'Unknown'}</span>
                            {getStatusBadge(sub.status)}
                          </div>
                          {sub.profiles?.display_name && (
                            <p className="text-sm text-muted-foreground">{sub.profiles.display_name}</p>
                          )}
                        </div>
                        <div className="text-right text-sm text-muted-foreground space-y-1">
                          <div>
                            Started: {sub.created_at ? format(new Date(sub.created_at), 'MMM d, yyyy') : 'N/A'}
                          </div>
                          {sub.current_period_end && (
                            <div>
                              Next billing: {format(new Date(sub.current_period_end), 'MMM d, yyyy')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Page {page + 1} of {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        data-testid="button-next-page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === 'promos' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Promo Codes
                </CardTitle>
                <CardDescription>Manage promotional discount codes</CardDescription>
              </div>
              <Button onClick={() => setPromoDialogOpen(true)} data-testid="button-create-promo">
                Create Promo Code
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingPromos ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : promoCodes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No promo codes created yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Redemptions</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promoCodes.map((promo) => (
                    <TableRow key={promo.id} data-testid={`promo-row-${promo.id}`}>
                      <TableCell className="font-mono font-medium">{promo.code}</TableCell>
                      <TableCell>
                        {promo.discount_type === 'percent' 
                          ? `${promo.discount_value}%` 
                          : `$${(promo.discount_value / 100).toFixed(2)}`}
                      </TableCell>
                      <TableCell>
                        {promo.redemption_count}
                        {promo.max_redemptions && ` / ${promo.max_redemptions}`}
                      </TableCell>
                      <TableCell>
                        {promo.expires_at ? format(new Date(promo.expires_at), 'MMM d, yyyy') : 'Never'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={promo.is_active ? 'default' : 'secondary'}>
                          {promo.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <SwitchUI
                          checked={promo.is_active}
                          onCheckedChange={(checked) => togglePromoMutation.mutate({ id: promo.id, isActive: checked })}
                          data-testid={`switch-promo-${promo.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === 'pricing' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Pricing Tiers
            </CardTitle>
            <CardDescription>Manage subscription pricing</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingProducts ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : !productsData?.products?.length ? (
              <p className="text-center text-muted-foreground py-8">No products configured</p>
            ) : (
              <div className="space-y-6">
                {productsData.products.map((product) => (
                  <div key={product.id} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3">{product.name}</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Price</TableHead>
                          <TableHead>Interval</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Active</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {product.prices.map((price) => (
                          <TableRow key={price.id} data-testid={`price-row-${price.id}`}>
                            <TableCell>
                              ${((price.unit_amount || 0) / 100).toFixed(2)} {price.currency.toUpperCase()}
                            </TableCell>
                            <TableCell>{formatInterval(price.recurring)}</TableCell>
                            <TableCell>
                              <Badge variant={price.active ? 'default' : 'secondary'}>
                                {price.active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <SwitchUI
                                checked={price.active}
                                onCheckedChange={(checked) => handleTogglePriceActive(product.id, price.id, checked)}
                                disabled={togglePriceActiveMutation.isPending}
                                data-testid={`switch-price-${price.id}`}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === 'connect' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              Stripe Connect Accounts
            </CardTitle>
            <CardDescription>Trainer payment account status</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground py-8">
              Connect account management coming soon
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={promoDialogOpen} onOpenChange={setPromoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Promo Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="promo-code">Code</Label>
              <Input
                id="promo-code"
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                placeholder="e.g., WELCOME20"
                data-testid="input-promo-code"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={newPromoDiscountType} onValueChange={(v: 'percent' | 'amount') => setNewPromoDiscountType(v)}>
                  <SelectTrigger data-testid="select-discount-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="amount">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount-value">Value</Label>
                <Input
                  id="discount-value"
                  type="number"
                  value={newPromoDiscountValue}
                  onChange={(e) => setNewPromoDiscountValue(e.target.value)}
                  placeholder={newPromoDiscountType === 'percent' ? '20' : '5.00'}
                  data-testid="input-discount-value"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-redemptions">Max Redemptions (optional)</Label>
              <Input
                id="max-redemptions"
                type="number"
                value={newPromoMaxRedemptions}
                onChange={(e) => setNewPromoMaxRedemptions(e.target.value)}
                placeholder="Leave empty for unlimited"
                data-testid="input-max-redemptions"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expires-at">Expires At (optional)</Label>
              <Input
                id="expires-at"
                type="date"
                value={newPromoExpiresAt}
                onChange={(e) => setNewPromoExpiresAt(e.target.value)}
                data-testid="input-expires-at"
              />
            </div>
            <div className="flex items-center gap-2">
              <SwitchUI
                id="first-time-only"
                checked={newPromoFirstTimeOnly}
                onCheckedChange={setNewPromoFirstTimeOnly}
                data-testid="switch-first-time-only"
              />
              <Label htmlFor="first-time-only">First-time customers only</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createPromoMutation.mutate()}
              disabled={!newPromoCode || !newPromoDiscountValue || createPromoMutation.isPending}
              data-testid="button-confirm-create-promo"
            >
              {createPromoMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MarketplaceTabWrapper() {
  return (
    <div className="p-6">
      <MarketplaceTab />
    </div>
  );
}

function ProductsTabWrapper() {
  return (
    <div className="p-6">
      <ProductApprovalQueue />
    </div>
  );
}

export default function AdminBusinessPage() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin/business/stats" component={AdminStatsTab} />
        <Route path="/admin/business/subscriptions" component={SubscriptionsTab} />
        <Route path="/admin/business/marketplace" component={MarketplaceTabWrapper} />
        <Route path="/admin/business/products" component={ProductsTabWrapper} />
        <Route path="/admin/business">
          <Redirect to="/admin/business/stats" />
        </Route>
      </Switch>
    </AdminLayout>
  );
}
