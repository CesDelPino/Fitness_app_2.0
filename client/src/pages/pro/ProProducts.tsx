import { useState } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { ArrowLeft, Plus, Package, MoreHorizontal, Send, Archive, DollarSign, AlertCircle, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useTrainerProducts,
  useCreateProduct,
  useSubmitProduct,
  useArchiveProduct,
  productStatusLabels,
  productStatusColors,
  productTypeLabels,
  formatPrice,
  formatBillingInterval,
  type ProductWithPricing,
} from "@/lib/trainer-products";

const statusIcons: Record<string, typeof Clock> = {
  draft: Clock,
  pending_review: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  archived: Archive,
};

export default function ProProducts() {
  const { user, professionalProfile } = useSupabaseAuth();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [productToSubmit, setProductToSubmit] = useState<ProductWithPricing | null>(null);
  const [productToArchive, setProductToArchive] = useState<ProductWithPricing | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: products, isLoading } = useTrainerProducts(showArchived);
  const createProduct = useCreateProduct();
  const submitProduct = useSubmitProduct();
  const archiveProduct = useArchiveProduct();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    productType: 'one_time' as 'one_time' | 'subscription' | 'package' | 'free',
    amountCents: 0,
    billingInterval: null as 'day' | 'week' | 'month' | 'year' | null,
    intervalCount: 1,
  });

  const handleCreateProduct = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Product name is required", variant: "destructive" });
      return;
    }
    if (formData.productType !== 'free' && formData.amountCents <= 0) {
      toast({ title: "Error", description: "Price must be greater than 0", variant: "destructive" });
      return;
    }

    try {
      await createProduct.mutateAsync({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        productType: formData.productType,
        amountCents: formData.productType === 'free' ? 0 : formData.amountCents,
        billingInterval: formData.productType === 'subscription' ? formData.billingInterval : null,
        intervalCount: formData.productType === 'subscription' ? formData.intervalCount : null,
      });
      toast({ title: "Success", description: "Product created successfully" });
      setShowCreateDialog(false);
      setFormData({
        name: '',
        description: '',
        productType: 'one_time',
        amountCents: 0,
        billingInterval: null,
        intervalCount: 1,
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create product", variant: "destructive" });
    }
  };

  const handleSubmitForReview = async () => {
    if (!productToSubmit) return;
    try {
      await submitProduct.mutateAsync(productToSubmit.id);
      toast({ title: "Success", description: "Product submitted for review" });
      setProductToSubmit(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to submit product", variant: "destructive" });
    }
  };

  const handleArchive = async () => {
    if (!productToArchive) return;
    try {
      await archiveProduct.mutateAsync(productToArchive.id);
      toast({ title: "Success", description: "Product archived" });
      setProductToArchive(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to archive product", variant: "destructive" });
    }
  };

  if (!user || !professionalProfile) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Please log in as a professional to access products.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/pro">
          <Button variant="ghost" size="icon" data-testid="button-back-to-dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">My Products</h1>
          <p className="text-muted-foreground">Create and manage your marketplace products</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-product">
          <Plus className="h-4 w-4 mr-2" />
          New Product
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={!showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(false)}
            data-testid="button-filter-active"
          >
            Active
          </Button>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(true)}
            data-testid="button-filter-archived"
          >
            Include Archived
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-72" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : products && products.length > 0 ? (
        <div className="grid gap-4">
          {products.map((product) => {
            const StatusIcon = statusIcons[product.status] || Clock;
            return (
              <Card key={product.id} data-testid={`card-product-${product.id}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      <Badge className={productStatusColors[product.status]}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {productStatusLabels[product.status]}
                      </Badge>
                      <Badge variant="outline">{productTypeLabels[product.productType]}</Badge>
                    </div>
                    {product.description && (
                      <CardDescription className="mt-2">{product.description}</CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-product-menu-${product.id}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(product.status === 'draft' || product.status === 'rejected') && (
                        <DropdownMenuItem onClick={() => setProductToSubmit(product)} data-testid={`button-submit-${product.id}`}>
                          <Send className="h-4 w-4 mr-2" />
                          Submit for Review
                        </DropdownMenuItem>
                      )}
                      {product.status !== 'archived' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setProductToArchive(product)}
                            className="text-destructive"
                            data-testid={`button-archive-${product.id}`}
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archive Product
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      <span>
                        {product.productType === 'free' 
                          ? 'Free' 
                          : product.pricing.length > 0
                            ? `${formatPrice(product.pricing[0].amountCents, product.pricing[0].currency)}${product.pricing[0].billingInterval ? ` / ${formatBillingInterval(product.pricing[0].billingInterval, product.pricing[0].intervalCount)}` : ''}`
                            : 'No price set'}
                      </span>
                    </div>
                    {product.rejectionReason && (
                      <div className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span>Rejected: {product.rejectionReason}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No products yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first product to start selling on the marketplace.
            </p>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-product">
              <Plus className="h-4 w-4 mr-2" />
              Create Product
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Product</DialogTitle>
            <DialogDescription>
              Create a product to sell on the marketplace. Products require admin approval before going live.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., 12-Week Training Program"
                data-testid="input-product-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what's included..."
                rows={3}
                data-testid="input-product-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="productType">Product Type</Label>
              <Select
                value={formData.productType}
                onValueChange={(value) => setFormData({ ...formData, productType: value as any })}
              >
                <SelectTrigger data-testid="select-product-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-Time Purchase</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                  <SelectItem value="package">Package</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.productType !== 'free' && (
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={(formData.amountCents / 100).toFixed(2)}
                    onChange={(e) => setFormData({ ...formData, amountCents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                    className="pl-8"
                    data-testid="input-product-price"
                  />
                </div>
              </div>
            )}
            {formData.productType === 'subscription' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="billingInterval">Billing Interval</Label>
                  <Select
                    value={formData.billingInterval || 'month'}
                    onValueChange={(value) => setFormData({ ...formData, billingInterval: value as any })}
                  >
                    <SelectTrigger data-testid="select-billing-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Weekly</SelectItem>
                      <SelectItem value="month">Monthly</SelectItem>
                      <SelectItem value="year">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="intervalCount">Every</Label>
                  <Input
                    id="intervalCount"
                    type="number"
                    min="1"
                    value={formData.intervalCount}
                    onChange={(e) => setFormData({ ...formData, intervalCount: parseInt(e.target.value) || 1 })}
                    data-testid="input-interval-count"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-create">
              Cancel
            </Button>
            <Button
              onClick={handleCreateProduct}
              disabled={createProduct.isPending}
              data-testid="button-confirm-create"
            >
              {createProduct.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!productToSubmit} onOpenChange={() => setProductToSubmit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit for Review</AlertDialogTitle>
            <AlertDialogDescription>
              Your product will be reviewed by our team before it goes live on the marketplace.
              This usually takes 1-2 business days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-submit">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmitForReview} data-testid="button-confirm-submit">
              {submitProduct.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit for Review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!productToArchive} onOpenChange={() => setProductToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Product</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the product from the marketplace. Existing purchases will still have access.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-archive">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-archive">
              {archiveProduct.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Archive Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
