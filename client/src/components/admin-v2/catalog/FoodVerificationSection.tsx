import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ChevronLeft, ChevronRight, RefreshCw, Plus, Sparkles, Clock, BadgeCheck, XCircle } from "lucide-react";
import { format } from "date-fns";

type StagingFoodItem = {
  id: string;
  description: string;
  brand_name: string | null;
  serving_size_description: string | null;
  serving_size_grams: number | null;
  household_serving_text: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  submitted_by_user_id: string | null;
  reviewed_by_admin_id: string | null;
};

type StagingFoodDetail = StagingFoodItem & {
  raw_ai_response: Record<string, unknown> | null;
  nutrients: Array<{
    nutrient_id: string;
    amount_per_100g: number | null;
    amount_per_serving: number | null;
    nutrient_definitions: {
      id: string;
      fda_nutrient_id: number;
      name: string;
      unit: string;
      nutrient_group: string;
    };
  }>;
};

type StagingCounts = {
  pending: number;
  approved: number;
  rejected: number;
};

type BulkImportResult = {
  fdcId: number;
  status: 'imported' | 'updated' | 'failed';
  description?: string;
  error?: string;
};

export function FoodVerificationSection() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selectedFoodId, setSelectedFoodId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  
  const [bulkImportIds, setBulkImportIds] = useState("");
  const [bulkImportResults, setBulkImportResults] = useState<BulkImportResult[] | null>(null);
  const [backfillResult, setBackfillResult] = useState<{ backfilled: number; remaining: number; errors?: string[] } | null>(null);

  const { data: counts } = useQuery<StagingCounts>({
    queryKey: ["/api/admin/nutrition/staging/count"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/nutrition/staging/count");
      return response.json();
    },
  });

  const { data: stagingFoods = [], isLoading, refetch } = useQuery<StagingFoodItem[]>({
    queryKey: ["/api/admin/nutrition/staging", statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: statusFilter,
        limit: pageSize.toString(),
        offset: ((page - 1) * pageSize).toString(),
      });
      const response = await apiRequest("GET", `/api/admin/nutrition/staging?${params}`);
      return response.json();
    },
  });

  const { data: selectedFood, isLoading: loadingDetails } = useQuery<StagingFoodDetail>({
    queryKey: ["/api/admin/nutrition/staging", selectedFoodId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/nutrition/staging/${selectedFoodId}`);
      return response.json();
    },
    enabled: !!selectedFoodId,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, decision, rejectionReason }: { id: string; decision: 'approved' | 'rejected'; rejectionReason?: string }) => {
      await apiRequest("PATCH", `/api/admin/nutrition/staging/${id}`, { decision, rejectionReason });
    },
    onSuccess: (_, variables) => {
      toast({ title: `Food ${variables.decision === 'approved' ? 'approved' : 'rejected'} successfully` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/nutrition/staging"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/nutrition/staging/count"] });
      setSelectedFoodId(null);
      setRejectionReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to review food", description: error.message, variant: "destructive" });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (fdcIds: number[]) => {
      const response = await apiRequest("POST", "/api/admin/nutrition/bulk-import", { fdcIds });
      return response.json();
    },
    onSuccess: (data: { imported: number; updated: number; failed: number; results: BulkImportResult[] }) => {
      toast({ title: `Imported ${data.imported} foods (${data.updated} updated, ${data.failed} failed)` });
      setBulkImportResults(data.results);
    },
    onError: (error: Error) => {
      toast({ title: "Bulk import failed", description: error.message, variant: "destructive" });
    },
  });

  const backfillPortionsMutation = useMutation({
    mutationFn: async (limit: number = 50) => {
      const response = await apiRequest("POST", "/api/admin/foods/backfill-portions", { limit });
      return response.json();
    },
    onSuccess: (data: { backfilled: number; remaining: number; errors?: string[] }) => {
      setBackfillResult(data);
      toast({ 
        title: `Backfilled ${data.backfilled} foods`,
        description: data.remaining > 0 ? `${data.remaining} foods still need portions` : "All foods now have portions cached"
      });
    },
    onError: (error: Error) => {
      toast({ title: "Backfill failed", description: error.message, variant: "destructive" });
    },
  });

  const handleBulkImport = () => {
    const ids = bulkImportIds
      .split(/[,\s]+/)
      .map(id => parseInt(id.trim(), 10))
      .filter(id => !isNaN(id) && id > 0);
    
    if (ids.length === 0) {
      toast({ title: "Please enter at least one valid FDC ID", variant: "destructive" });
      return;
    }
    
    if (ids.length > 100) {
      toast({ title: "Maximum 100 IDs allowed per import", variant: "destructive" });
      return;
    }
    
    setBulkImportResults(null);
    bulkImportMutation.mutate(ids);
  };

  const handleApprove = (id: string) => {
    reviewMutation.mutate({ id, decision: 'approved' });
  };

  const handleReject = (id: string) => {
    if (rejectionReason.trim().length < 5) {
      toast({ title: "Please provide a rejection reason (at least 5 characters)", variant: "destructive" });
      return;
    }
    reviewMutation.mutate({ id, decision: 'rejected', rejectionReason });
  };

  const groupedNutrients = selectedFood?.nutrients?.reduce((acc, n) => {
    const group = n.nutrient_definitions?.nutrient_group || 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(n);
    return acc;
  }, {} as Record<string, typeof selectedFood.nutrients>) || {};

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI Food Verification Queue
          </CardTitle>
          <CardDescription>
            Review and approve AI-generated food entries before they become available to users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Button
              variant={statusFilter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter('pending'); setPage(1); }}
              data-testid="button-filter-pending"
            >
              <Clock className="w-4 h-4 mr-1" />
              Pending ({counts?.pending || 0})
            </Button>
            <Button
              variant={statusFilter === 'approved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter('approved'); setPage(1); }}
              data-testid="button-filter-approved"
            >
              <BadgeCheck className="w-4 h-4 mr-1" />
              Approved ({counts?.approved || 0})
            </Button>
            <Button
              variant={statusFilter === 'rejected' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter('rejected'); setPage(1); }}
              data-testid="button-filter-rejected"
            >
              <XCircle className="w-4 h-4 mr-1" />
              Rejected ({counts?.rejected || 0})
            </Button>
            <Button variant="ghost" size="icon" onClick={() => refetch()} data-testid="button-refresh-staging">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : stagingFoods.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No {statusFilter} foods to review
            </div>
          ) : (
            <div className="space-y-2">
              {stagingFoods.map((food) => (
                <Card
                  key={food.id}
                  className={`p-3 cursor-pointer hover-elevate transition-colors ${selectedFoodId === food.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedFoodId(food.id)}
                  data-testid={`card-staging-food-${food.id}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{food.description}</div>
                      {food.brand_name && (
                        <div className="text-sm text-muted-foreground">{food.brand_name}</div>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {food.serving_size_description || food.household_serving_text || 'No serving info'}
                        {food.serving_size_grams && (
                          <span>({food.serving_size_grams}g)</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge variant={food.status === 'pending' ? 'secondary' : food.status === 'approved' ? 'default' : 'outline'}>
                        {food.status}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(food.created_at), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  {food.status === 'rejected' && food.rejection_reason && (
                    <div className="mt-2 text-xs text-destructive">
                      Reason: {food.rejection_reason}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {stagingFoods.length > 0 && (
            <div className="flex justify-between items-center mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                data-testid="button-prev-verification-page"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground" data-testid="text-verification-page-info">
                Page {page}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={stagingFoods.length < pageSize}
                onClick={() => setPage(p => p + 1)}
                data-testid="button-next-verification-page"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedFoodId} onOpenChange={(open) => { if (!open) setSelectedFoodId(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review AI-Generated Food</DialogTitle>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : selectedFood ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedFood.description}</h3>
                {selectedFood.brand_name && (
                  <p className="text-muted-foreground">{selectedFood.brand_name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Serving Size:</span>
                  <p>{selectedFood.serving_size_description || selectedFood.household_serving_text || 'Not specified'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Grams:</span>
                  <p>{selectedFood.serving_size_grams ? `${selectedFood.serving_size_grams}g` : 'Not specified'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p>
                    <Badge variant={selectedFood.status === 'pending' ? 'secondary' : selectedFood.status === 'approved' ? 'default' : 'outline'}>
                      {selectedFood.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Submitted:</span>
                  <p>{format(new Date(selectedFood.created_at), 'MMM d, yyyy HH:mm')}</p>
                </div>
              </div>

              {selectedFood.nutrients?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Nutrients</h4>
                  {Object.entries(groupedNutrients).map(([group, nutrients]) => (
                    <div key={group} className="mb-3">
                      <h5 className="text-sm font-medium text-muted-foreground mb-1">{group}</h5>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        {nutrients.map((n) => (
                          <div key={n.nutrient_id} className="flex justify-between">
                            <span>{n.nutrient_definitions?.name}</span>
                            <span className="tabular-nums">
                              {n.amount_per_100g?.toFixed(1) ?? '-'} {n.nutrient_definitions?.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedFood.status === 'pending' && (
                <div className="space-y-3 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Rejection Reason (if rejecting)</Label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Why is this food entry being rejected?"
                      data-testid="input-rejection-reason"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      className="flex-1"
                      onClick={() => handleApprove(selectedFood.id)}
                      disabled={reviewMutation.isPending}
                      data-testid="button-approve-food"
                    >
                      {reviewMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      <BadgeCheck className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleReject(selectedFood.id)}
                      disabled={reviewMutation.isPending}
                      data-testid="button-reject-food"
                    >
                      {reviewMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {selectedFood.status === 'rejected' && selectedFood.rejection_reason && (
                <div className="p-3 bg-destructive/10 rounded-md text-sm">
                  <strong>Rejection Reason:</strong> {selectedFood.rejection_reason}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Bulk FDA Import
          </CardTitle>
          <CardDescription>
            Import foods from FDA FoodData Central by entering comma-separated FDC IDs (max 100)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-fdc-ids">FDC IDs</Label>
            <Textarea
              id="bulk-fdc-ids"
              placeholder="e.g., 171688, 168462, 173944"
              value={bulkImportIds}
              onChange={(e) => setBulkImportIds(e.target.value)}
              className="font-mono text-sm"
              data-testid="input-bulk-fdc-ids"
            />
            <p className="text-xs text-muted-foreground">
              Enter FDC IDs separated by commas or spaces. Find IDs at{' '}
              <a 
                href="https://fdc.nal.usda.gov/fdc-app.html" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                fdc.nal.usda.gov
              </a>
            </p>
          </div>
          <Button
            onClick={handleBulkImport}
            disabled={bulkImportMutation.isPending || !bulkImportIds.trim()}
            data-testid="button-bulk-import"
          >
            {bulkImportMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Import Foods
          </Button>

          {bulkImportResults && bulkImportResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="font-medium">Import Results</h4>
              <ScrollArea className="h-48 border rounded-md p-2">
                {bulkImportResults.map((result, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between py-1 text-sm ${
                      result.status === 'imported' ? 'text-green-600 dark:text-green-400' :
                      result.status === 'updated' ? 'text-blue-600 dark:text-blue-400' :
                      'text-destructive'
                    }`}
                    data-testid={`import-result-${result.fdcId}`}
                  >
                    <span className="font-mono">{result.fdcId}</span>
                    <span className="flex items-center gap-2">
                      {result.status === 'imported' && <BadgeCheck className="w-4 h-4" />}
                      {result.status === 'updated' && <RefreshCw className="w-4 h-4" />}
                      {result.status === 'failed' && <XCircle className="w-4 h-4" />}
                      <span className="text-xs">{result.description || result.error || result.status}</span>
                    </span>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Backfill Food Portions
          </CardTitle>
          <CardDescription>
            Fetch portion options for cached foods that are missing them. Processes 50 foods per batch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => backfillPortionsMutation.mutate(50)}
            disabled={backfillPortionsMutation.isPending}
            data-testid="button-backfill-portions"
          >
            {backfillPortionsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Backfill Portions (50 foods)
          </Button>

          {backfillResult && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span>{backfillResult.backfilled} foods backfilled</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>{backfillResult.remaining} foods remaining</span>
              </div>
              {backfillResult.errors && backfillResult.errors.length > 0 && (
                <div className="mt-2 p-2 bg-destructive/10 rounded-md">
                  <p className="font-medium text-destructive">Errors:</p>
                  <ul className="list-disc list-inside text-xs">
                    {backfillResult.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {backfillResult.errors.length > 5 && (
                      <li>...and {backfillResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
