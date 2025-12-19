import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ChevronLeft, ChevronRight, RefreshCw, Database } from "lucide-react";
import { format } from "date-fns";

type AdminFoodItem = {
  id: string;
  fdc_id: number | null;
  description: string;
  brand_name: string | null;
  data_type: string;
  gtin_upc: string | null;
  serving_size_description: string | null;
  serving_size_grams: number | null;
  household_serving_text: string | null;
  times_used: number;
  fetch_timestamp: string | null;
  created_at: string;
  updated_at: string;
  portion_count: number;
};

type AdminFoodDetail = AdminFoodItem & {
  fdc_published_date: string | null;
  confidence_score: number | null;
  portions: Array<{
    id: string;
    description: string;
    amount: number | null;
    gram_weight: number | null;
    unit: string | null;
    modifier: string | null;
    is_default: boolean;
    sequence: number | null;
  }>;
  nutrients: Array<{
    id: string;
    amount_per_100g: number | null;
    amount_per_serving: number | null;
    nutrient_definitions: {
      name: string;
      unit: string;
      nutrient_group: string;
      is_core_macro: boolean;
    };
  }>;
};

type FoodListResponse = {
  foods: AdminFoodItem[];
  total: number;
  limit: number;
  offset: number;
};

export function FoodLibrarySection() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dataSource, setDataSource] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedFoodId, setSelectedFoodId] = useState<string | null>(null);
  const pageSize = 25;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: foodsData, isLoading, refetch } = useQuery<FoodListResponse>({
    queryKey: ["/api/admin/foods", debouncedSearch, dataSource, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedSearch,
        dataSource,
        limit: pageSize.toString(),
        offset: ((page - 1) * pageSize).toString(),
      });
      const response = await apiRequest("GET", `/api/admin/foods?${params}`);
      return response.json();
    },
  });

  const { data: selectedFood, isLoading: loadingDetails } = useQuery<AdminFoodDetail>({
    queryKey: ["/api/admin/foods", selectedFoodId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/foods/${selectedFoodId}`);
      return response.json();
    },
    enabled: !!selectedFoodId,
  });

  const foods = foodsData?.foods || [];
  const total = foodsData?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const groupedNutrients = selectedFood?.nutrients?.reduce((acc, n) => {
    const group = n.nutrient_definitions?.nutrient_group || 'other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(n);
    return acc;
  }, {} as Record<string, typeof selectedFood.nutrients>) || {};

  const nutrientGroupLabels: Record<string, string> = {
    macro: 'Macronutrients',
    mineral: 'Minerals',
    vitamin: 'Vitamins',
    lipid: 'Lipids',
    other: 'Other',
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Food Library
          </CardTitle>
          <CardDescription>
            Browse and search all cached foods in the database ({total} total)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search foods by name, brand, or barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-food-search"
              />
            </div>
            <Select value={dataSource} onValueChange={(v) => { setDataSource(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]" data-testid="select-data-source">
                <SelectValue placeholder="Data Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="fda_foundation">FDA Foundation</SelectItem>
                <SelectItem value="fda_sr_legacy">FDA SR Legacy</SelectItem>
                <SelectItem value="fda_branded">FDA Branded</SelectItem>
                <SelectItem value="openfoodfacts">Open Food Facts</SelectItem>
                <SelectItem value="user_manual">User Manual</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => refetch()} data-testid="button-refresh-foods">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : foods.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No foods found
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Food</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Portions</TableHead>
                    <TableHead className="text-right">Uses</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {foods.map((food) => (
                    <TableRow
                      key={food.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedFoodId(food.id)}
                      data-testid={`row-food-${food.id}`}
                    >
                      <TableCell>
                        <div className="font-medium">{food.description}</div>
                        {food.brand_name && (
                          <div className="text-sm text-muted-foreground">{food.brand_name}</div>
                        )}
                        {food.gtin_upc && (
                          <div className="text-xs text-muted-foreground font-mono">{food.gtin_upc}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {food.data_type.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {food.portion_count > 0 ? (
                          <Badge variant="secondary">{food.portion_count}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {food.times_used}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                data-testid="button-prev-foods-page"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground" data-testid="text-foods-page-info">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                data-testid="button-next-foods-page"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedFoodId} onOpenChange={(open) => { if (!open) setSelectedFoodId(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Food Details</DialogTitle>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : selectedFood ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg">{selectedFood.description}</h3>
                {selectedFood.brand_name && (
                  <p className="text-muted-foreground">{selectedFood.brand_name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">FDC ID:</span>
                  <p className="font-mono">{selectedFood.fdc_id || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Data Source:</span>
                  <p><Badge variant="outline">{selectedFood.data_type.replace(/_/g, ' ')}</Badge></p>
                </div>
                {selectedFood.gtin_upc && (
                  <div>
                    <span className="text-muted-foreground">UPC/GTIN:</span>
                    <p className="font-mono">{selectedFood.gtin_upc}</p>
                  </div>
                )}
                {selectedFood.serving_size_grams && (
                  <div>
                    <span className="text-muted-foreground">Serving Size:</span>
                    <p>{selectedFood.serving_size_grams}g {selectedFood.serving_size_description && `(${selectedFood.serving_size_description})`}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Times Used:</span>
                  <p>{selectedFood.times_used}</p>
                </div>
                {selectedFood.fetch_timestamp && (
                  <div>
                    <span className="text-muted-foreground">Last Fetched:</span>
                    <p>{format(new Date(selectedFood.fetch_timestamp), 'MMM d, yyyy')}</p>
                  </div>
                )}
              </div>

              {selectedFood.portions && selectedFood.portions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Portions ({selectedFood.portions.length})</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedFood.portions.map(p => (
                      <div key={p.id} className="text-sm p-2 border rounded">
                        <span>{p.description}</span>
                        {p.gram_weight && <span className="text-muted-foreground ml-2">({p.gram_weight}g)</span>}
                        {p.is_default && <Badge variant="secondary" className="ml-2 text-xs">Default</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(groupedNutrients).length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Nutrients</h4>
                  <div className="space-y-4">
                    {Object.entries(groupedNutrients).map(([group, nutrients]) => (
                      <div key={group}>
                        <h5 className="text-sm font-medium text-muted-foreground mb-1">
                          {nutrientGroupLabels[group] || group}
                        </h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {nutrients.map(n => (
                            <div key={n.id} className="text-sm">
                              <span>{n.nutrient_definitions?.name}:</span>
                              <span className="ml-1 font-medium">
                                {n.amount_per_100g?.toFixed(1) || 'N/A'} {n.nutrient_definitions?.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
