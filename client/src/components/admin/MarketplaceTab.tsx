import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, DollarSign, TrendingUp, Users, ShoppingCart, RefreshCw, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { format } from "date-fns";
import type { 
  MarketplaceGmvMetrics, 
  TrainerEarningsSummary, 
  RecentPurchaseAdmin,
  CheckoutAbandonmentMetrics,
  WebhookEventSummary
} from "@shared/schema";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function MetricsCards({ metrics }: { metrics: MarketplaceGmvMetrics }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-sm font-medium">Total GMV</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-total-gmv">
            {formatCurrency(metrics.totalGmvCents)}
          </div>
          <p className="text-xs text-muted-foreground">
            {metrics.totalCompletedPurchases} completed purchases
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-sm font-medium">Trainer Earnings</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-trainer-earnings">
            {formatCurrency(metrics.totalTrainerEarningsCents)}
          </div>
          <p className="text-xs text-muted-foreground">
            {metrics.trainersWithSales} trainers with sales
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-sm font-medium">Unique Clients</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-unique-clients">
            {metrics.uniquePayingClients}
          </div>
          <p className="text-xs text-muted-foreground">
            {metrics.productsWithSales} products sold
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-sm font-medium">Refunds</CardTitle>
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-refunds">
            {formatCurrency(metrics.totalRefundedCents)}
          </div>
          <p className="text-xs text-muted-foreground">
            {metrics.totalRefundedPurchases} refunded | {metrics.totalPendingPurchases} pending
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TrainerEarningsTable({ earnings }: { earnings: TrainerEarningsSummary[] }) {
  if (earnings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trainer Earnings</CardTitle>
          <CardDescription>Revenue breakdown by trainer</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No trainer sales yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trainer Earnings</CardTitle>
        <CardDescription>Revenue breakdown by trainer (sorted by earnings)</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trainer</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Earnings</TableHead>
                <TableHead className="text-right">Clients</TableHead>
                <TableHead className="text-right">Refunds</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {earnings.map((trainer) => (
                <TableRow key={trainer.trainerId} data-testid={`row-trainer-${trainer.trainerId}`}>
                  <TableCell>
                    <div className="font-medium">{trainer.trainerName || 'Unknown'}</div>
                  </TableCell>
                  <TableCell className="text-right">{trainer.totalSales}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(trainer.totalEarningsCents)}
                  </TableCell>
                  <TableCell className="text-right">{trainer.uniqueClients}</TableCell>
                  <TableCell className="text-right">
                    {trainer.totalRefunds > 0 ? (
                      <Badge variant="destructive">{trainer.totalRefunds}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function RecentPurchasesTable({ purchases }: { purchases: RecentPurchaseAdmin[] }) {
  const getStatusBadge = (status: string, frozenAt: string | null) => {
    if (frozenAt) {
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Frozen</Badge>;
    }
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/30">Completed</Badge>;
      case 'refunded':
        return <Badge variant="destructive">Refunded</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (purchases.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Purchases</CardTitle>
          <CardDescription>Latest marketplace transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No purchases yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Purchases</CardTitle>
        <CardDescription>Latest 50 marketplace transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Trainer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase) => (
                <TableRow key={purchase.purchaseId} data-testid={`row-purchase-${purchase.purchaseId}`}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{purchase.productName}</div>
                      <div className="text-xs text-muted-foreground capitalize">{purchase.productType}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{purchase.clientName || 'Unknown'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{purchase.trainerName || 'Unknown'}</div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(purchase.amountTotalCents)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(purchase.status, purchase.frozenAt as string | null)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(purchase.purchasedAt), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function CheckoutMetricsCard({ metrics }: { metrics: CheckoutAbandonmentMetrics }) {
  const abandonmentRate = metrics.totalSessions > 0 
    ? (100 - (metrics.completionRatePercent || 0)).toFixed(1)
    : '0';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          Checkout Analytics
        </CardTitle>
        <CardDescription>Last 30 days checkout performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <div>
            <div className="text-sm text-muted-foreground">Total Sessions</div>
            <div className="text-xl font-bold">{metrics.totalSessions}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Completed</div>
            <div className="text-xl font-bold text-green-600">{metrics.completedSessions}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Abandoned</div>
            <div className="text-xl font-bold text-amber-600">{metrics.abandonedSessions}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Abandonment Rate</div>
            <div className="text-xl font-bold">{abandonmentRate}%</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Revenue Lost to Abandonment</span>
            <span className="font-medium text-amber-600">
              {formatCurrency(metrics.abandonedRevenueCents)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WebhookEventsCard({ events, pending }: { events: WebhookEventSummary[], pending: any[] }) {
  const hasIssues = pending.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {hasIssues ? (
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
          Webhook Health
        </CardTitle>
        <CardDescription>
          {hasIssues 
            ? `${pending.length} event(s) need attention` 
            : 'All webhook events processed successfully'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No webhook events in the last 7 days</p>
        ) : (
          <div className="space-y-3">
            {events.slice(0, 6).map((event) => (
              <div key={event.eventType} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded">{event.eventType}</code>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{event.totalEvents} total</span>
                  {event.pendingCount > 0 ? (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {event.pendingCount} pending
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-600">
                      All processed
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {pending.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium mb-2 text-amber-600">Events Requiring Attention</h4>
            <div className="space-y-2">
              {pending.slice(0, 5).map((event: any) => (
                <div key={event.id} className="text-xs bg-amber-50 dark:bg-amber-950/20 p-2 rounded flex justify-between">
                  <code>{event.event_type}</code>
                  <span className="text-muted-foreground">
                    {Math.round(event.hours_since_created)}h ago
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MarketplaceTab() {
  const [purchaseStatus, setPurchaseStatus] = useState<string>('all');

  const { data: metrics, isLoading: metricsLoading } = useQuery<MarketplaceGmvMetrics>({
    queryKey: ['/api/admin/marketplace/metrics'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  const { data: earnings, isLoading: earningsLoading } = useQuery<TrainerEarningsSummary[]>({
    queryKey: ['/api/admin/marketplace/trainer-earnings'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  const { data: purchases, isLoading: purchasesLoading } = useQuery<RecentPurchaseAdmin[]>({
    queryKey: ['/api/admin/marketplace/purchases', purchaseStatus],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  const { data: checkoutMetrics, isLoading: checkoutLoading } = useQuery<CheckoutAbandonmentMetrics>({
    queryKey: ['/api/admin/marketplace/checkout-abandonment'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  const { data: webhookEvents } = useQuery<WebhookEventSummary[]>({
    queryKey: ['/api/admin/marketplace/webhook-events'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  const { data: pendingWebhooks } = useQuery<any[]>({
    queryKey: ['/api/admin/marketplace/webhook-events/pending'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  const isLoading = metricsLoading || earningsLoading || purchasesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {metrics && <MetricsCards metrics={metrics} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {earnings && <TrainerEarningsTable earnings={earnings} />}
        
        <div className="space-y-6">
          {checkoutMetrics && !checkoutLoading && (
            <CheckoutMetricsCard metrics={checkoutMetrics} />
          )}
          
          {webhookEvents && (
            <WebhookEventsCard 
              events={webhookEvents} 
              pending={pendingWebhooks || []} 
            />
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Purchases</h3>
          <Select value={purchaseStatus} onValueChange={setPurchaseStatus}>
            <SelectTrigger className="w-[180px]" data-testid="select-purchase-status">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {purchases && <RecentPurchasesTable purchases={purchases} />}
      </div>
    </div>
  );
}
