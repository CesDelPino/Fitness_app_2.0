import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, CheckCircle, XCircle, Clock, DollarSign, User, Calendar, Loader2, Eye, AlertCircle, TrendingUp, ShoppingCart, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatPrice, formatBillingInterval, productTypeLabels } from "@/lib/trainer-products";
import { format } from "date-fns";
import type { ProductSalesMetrics } from "@shared/schema";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'draft', label: 'Draft' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
];

function getStatusBadge(status: string) {
  switch (status) {
    case 'approved':
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Approved</Badge>;
    case 'pending_review':
      return <Badge variant="secondary">Pending Review</Badge>;
    case 'draft':
      return <Badge variant="outline">Draft</Badge>;
    case 'rejected':
      return <Badge variant="destructive">Rejected</Badge>;
    case 'archived':
      return <Badge variant="outline" className="text-muted-foreground">Archived</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function ProductSalesTable() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: productSales, isLoading, error } = useQuery<ProductSalesMetrics[]>({
    queryKey: ['/api/admin/marketplace/product-sales', { status: statusFilter, search: searchTerm }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (searchTerm) params.set('search', searchTerm);
      const url = `/api/admin/marketplace/product-sales${params.toString() ? `?${params}` : ''}`;
      const response = await apiRequest("GET", url);
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Product Sales Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Sales Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load product sales: {(error as Error).message}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const filteredProducts = productSales?.filter(p => {
    if (searchTerm && !p.productName.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (statusFilter !== 'all' && p.productStatus !== statusFilter) {
      return false;
    }
    return true;
  }) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Product Sales Metrics
            </CardTitle>
            <CardDescription>Revenue and sales data per product</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-[180px]"
                data-testid="input-search-products"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-product-status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No products found</p>
          </div>
        ) : (
          <ScrollArea className="h-[350px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Buyers</TableHead>
                  <TableHead className="text-right">Refunds</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.productId} data-testid={`row-product-sales-${product.productId}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{product.productName}</div>
                        <div className="text-xs text-muted-foreground capitalize">{product.productType}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{product.trainerName || 'Unknown'}</TableCell>
                    <TableCell>{getStatusBadge(product.productStatus)}</TableCell>
                    <TableCell className="text-right font-medium">{product.totalSales}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(product.totalRevenueCents)}
                    </TableCell>
                    <TableCell className="text-right">{product.uniqueBuyers}</TableCell>
                    <TableCell className="text-right">
                      {product.totalRefunds > 0 ? (
                        <Badge variant="destructive">{product.totalRefunds}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

interface PendingProduct {
  id: string;
  trainerId: string;
  name: string;
  description: string | null;
  productType: 'one_time' | 'subscription' | 'package' | 'free';
  status: string;
  submittedAt: string | null;
  createdAt: string;
  pricing: {
    id: string;
    amountCents: number;
    currency: string;
    billingInterval: string | null;
    intervalCount: number | null;
  }[];
  trainerName?: string;
}

export function ProductApprovalQueue() {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<PendingProduct | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: pendingProducts, isLoading, error } = useQuery<PendingProduct[]>({
    queryKey: ['/api/admin/products/pending'],
    queryFn: async () => {
      const response = await fetch('/api/admin/products/pending', { credentials: 'include' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch pending products');
      }
      return response.json();
    },
  });

  const approveProduct = useMutation({
    mutationFn: async (productId: string) => {
      return apiRequest('POST', `/api/admin/products/${productId}/approve`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Product approved successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products/pending'] });
      setSelectedProduct(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rejectProduct = useMutation({
    mutationFn: async ({ productId, reason }: { productId: string; reason: string }) => {
      return apiRequest('POST', `/api/admin/products/${productId}/reject`, { reason });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Product rejected" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products/pending'] });
      setSelectedProduct(null);
      setShowRejectDialog(false);
      setRejectionReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleApprove = async (product: PendingProduct) => {
    await approveProduct.mutateAsync(product.id);
  };

  const handleReject = async () => {
    if (!selectedProduct || !rejectionReason.trim()) {
      toast({ title: "Error", description: "Please provide a rejection reason", variant: "destructive" });
      return;
    }
    await rejectProduct.mutateAsync({ productId: selectedProduct.id, reason: rejectionReason.trim() });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Approval Queue</CardTitle>
          <CardDescription>Review and approve trainer products for the marketplace</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Approval Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load pending products: {(error as Error).message}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ProductSalesTable />
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Approval Queue
              </CardTitle>
              <CardDescription>Review and approve trainer products for the marketplace</CardDescription>
            </div>
            {pendingProducts && pendingProducts.length > 0 && (
              <Badge variant="secondary">
                {pendingProducts.length} pending
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!pendingProducts || pendingProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">All caught up!</p>
              <p>No products pending review</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingProducts.map(product => (
                  <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        {product.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {product.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{product.trainerName || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{productTypeLabels[product.productType]}</Badge>
                    </TableCell>
                    <TableCell>
                      {product.productType === 'free' ? (
                        <span className="text-muted-foreground">Free</span>
                      ) : product.pricing.length > 0 ? (
                        <span>
                          {formatPrice(product.pricing[0].amountCents, product.pricing[0].currency)}
                          {product.pricing[0].billingInterval && (
                            <span className="text-muted-foreground text-xs">
                              /{product.pricing[0].billingInterval}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No price</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {product.submittedAt 
                          ? format(new Date(product.submittedAt), 'MMM d, yyyy')
                          : 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedProduct(product)}
                          data-testid={`button-view-${product.id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(product)}
                          disabled={approveProduct.isPending}
                          data-testid={`button-approve-${product.id}`}
                        >
                          {approveProduct.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-1" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedProduct(product);
                            setShowRejectDialog(true);
                          }}
                          data-testid={`button-reject-${product.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedProduct && !showRejectDialog} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
            <DialogDescription>
              Review the product details before approving or rejecting
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-muted-foreground">Product Name</Label>
                <p className="text-lg font-medium">{selectedProduct.name}</p>
              </div>
              {selectedProduct.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p>{selectedProduct.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p><Badge variant="outline">{productTypeLabels[selectedProduct.productType]}</Badge></p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Price</Label>
                  <p>
                    {selectedProduct.productType === 'free' 
                      ? 'Free' 
                      : selectedProduct.pricing.length > 0
                        ? formatPrice(selectedProduct.pricing[0].amountCents, selectedProduct.pricing[0].currency)
                        : 'No price set'}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Trainer</Label>
                <p>{selectedProduct.trainerName || 'Unknown'}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProduct(null)}>
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowRejectDialog(true)}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button
              onClick={() => selectedProduct && handleApprove(selectedProduct)}
              disabled={approveProduct.isPending}
            >
              {approveProduct.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectDialog} onOpenChange={(open) => {
        if (!open) {
          setShowRejectDialog(false);
          setRejectionReason("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Product</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this product. The trainer will see this feedback.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Product description needs more detail, pricing unclear..."
                rows={4}
                data-testid="input-rejection-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectDialog(false);
              setRejectionReason("");
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectProduct.isPending || !rejectionReason.trim()}
              data-testid="button-confirm-reject"
            >
              {rejectProduct.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Reject Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
