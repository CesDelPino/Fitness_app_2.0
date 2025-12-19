import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Edit3, Sparkles, LayoutTemplate, Loader2, AlertTriangle, Dumbbell } from "lucide-react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateProRoutine, useAiGenerateProRoutine } from "@/lib/pro-routines";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const programmeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  sessions_per_week: z.number().int().min(1).max(7).optional(),
  duration_weeks: z.number().int().min(1).max(52).optional(),
});

type ProgrammeFormData = z.infer<typeof programmeSchema>;

const aiSchema = z.object({
  prompt_text: z.string().min(10, "Please provide more details (at least 10 characters)").max(1000),
  sessions_per_week: z.number().int().min(1).max(7),
  duration_weeks: z.number().int().min(1).max(12),
  goal_type_id: z.string().uuid().nullable().optional(),
});

type AiFormData = z.infer<typeof aiSchema>;

type CreationMethod = "manual" | "template" | "ai";

interface EquipmentOption {
  id: string;
  name: string;
  category: string;
}

interface GoalType {
  id: string;
  name: string;
  description: string | null;
}

export default function ProProgrammeNew() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  
  const params = new URLSearchParams(searchString);
  const initialMethod = params.get("method") as CreationMethod || "manual";
  const [method, setMethod] = useState<CreationMethod>(initialMethod);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  
  const createRoutine = useCreateProRoutine();
  const aiGenerate = useAiGenerateProRoutine();
  
  const { data: equipmentOptions } = useQuery<EquipmentOption[]>({
    queryKey: ['/api/equipment-options'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/equipment-options');
      return res.json();
    },
  });
  
  const { data: goalTypes } = useQuery<GoalType[]>({
    queryKey: ['/api/goal-types'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/goal-types');
      return res.json();
    },
  });
  
  const form = useForm<ProgrammeFormData>({
    resolver: zodResolver(programmeSchema),
    defaultValues: {
      name: "",
      description: "",
      sessions_per_week: 3,
      duration_weeks: 4,
    },
  });
  
  const aiForm = useForm<AiFormData>({
    resolver: zodResolver(aiSchema),
    defaultValues: {
      prompt_text: "",
      sessions_per_week: 3,
      duration_weeks: 4,
      goal_type_id: null,
    },
  });
  
  const onSubmit = async (data: ProgrammeFormData) => {
    try {
      const result = await createRoutine.mutateAsync({
        name: data.name,
        description: data.description,
        sessions_per_week: data.sessions_per_week,
        duration_weeks: data.duration_weeks,
        creation_method: "manual",
      });
      
      toast({
        title: "Programme Created",
        description: `"${data.name}" has been created successfully.`,
      });
      
      setLocation(`/pro/programmes/${result.blueprint.id}/edit`);
    } catch (error: any) {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create programme",
        variant: "destructive",
      });
    }
  };
  
  const onAiSubmit = async (data: AiFormData) => {
    try {
      const result = await aiGenerate.mutateAsync({
        prompt_text: data.prompt_text,
        equipment_selected: selectedEquipment,
        goal_type_id: data.goal_type_id,
        sessions_per_week: data.sessions_per_week,
        duration_weeks: data.duration_weeks,
      });
      
      if (result.warnings && result.warnings.length > 0) {
        toast({
          title: "Programme Generated",
          description: `Created with ${result.warnings.length} exercise(s) that couldn't be matched to the library.`,
        });
      } else {
        toast({
          title: "Programme Generated",
          description: "AI has created your programme. Review and customize it below.",
        });
      }
      
      setLocation(`/pro/programmes/${result.blueprint.id}/edit`);
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate AI programme",
        variant: "destructive",
      });
    }
  };
  
  const toggleEquipment = (id: string) => {
    setSelectedEquipment(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const equipmentByCategory = equipmentOptions?.reduce((acc, eq) => {
    if (!acc[eq.category]) acc[eq.category] = [];
    acc[eq.category].push(eq);
    return acc;
  }, {} as Record<string, EquipmentOption[]>) || {};

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="mb-6">
        <Link href="/pro" className="inline-flex items-center text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Create New Programme</CardTitle>
          <CardDescription>
            Choose how you'd like to create your training programme
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={method} onValueChange={(v) => setMethod(v as CreationMethod)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="manual" className="gap-2" data-testid="tab-method-manual">
                <Edit3 className="h-4 w-4" />
                <span className="hidden sm:inline">Manual</span>
              </TabsTrigger>
              <TabsTrigger value="template" className="gap-2" data-testid="tab-method-template">
                <LayoutTemplate className="h-4 w-4" />
                <span className="hidden sm:inline">Template</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-2" data-testid="tab-method-ai">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">AI Build</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="manual">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Programme Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Upper/Lower Split" 
                            data-testid="input-programme-name"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Brief description of this programme..."
                            data-testid="input-programme-description"
                            className="resize-none"
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="sessions_per_week"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sessions per Week</FormLabel>
                          <Select 
                            value={field.value?.toString()} 
                            onValueChange={(v) => field.onChange(parseInt(v))}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-sessions-per-week">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                                <SelectItem key={n} value={n.toString()}>
                                  {n} day{n > 1 ? 's' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="duration_weeks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration (Weeks)</FormLabel>
                          <Select 
                            value={field.value?.toString()} 
                            onValueChange={(v) => field.onChange(parseInt(v))}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-duration-weeks">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {[1, 2, 3, 4, 6, 8, 10, 12].map((n) => (
                                <SelectItem key={n} value={n.toString()}>
                                  {n} week{n > 1 ? 's' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="pt-4">
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={createRoutine.isPending}
                      data-testid="button-create-programme"
                    >
                      {createRoutine.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Programme"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
            
            <TabsContent value="template">
              <div className="text-center py-8 text-muted-foreground">
                <LayoutTemplate className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Browse system templates from the Programmes tab.</p>
                <p className="text-sm mt-2">
                  Click "Use Template" on any template to clone it to your library.
                </p>
                <Link href="/pro">
                  <Button variant="outline" className="mt-4" data-testid="button-browse-templates">
                    Browse Templates
                  </Button>
                </Link>
              </div>
            </TabsContent>
            
            <TabsContent value="ai">
              <Form {...aiForm}>
                <form onSubmit={aiForm.handleSubmit(onAiSubmit)} className="space-y-4">
                  <FormField
                    control={aiForm.control}
                    name="prompt_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Describe the Programme</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="e.g., A 4-day push/pull/legs split for an intermediate lifter focusing on building muscle mass. Include compound movements as the main lifts with accessory work for arms and shoulders."
                            data-testid="input-ai-prompt"
                            className="resize-none"
                            rows={4}
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Be specific about goals, experience level, and any preferences
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={aiForm.control}
                    name="goal_type_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Training Goal</FormLabel>
                        <Select 
                          value={field.value ?? "none"} 
                          onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-ai-goal">
                              <SelectValue placeholder="Select goal type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No specific goal</SelectItem>
                            {goalTypes?.map((goal) => (
                              <SelectItem key={goal.id} value={goal.id}>
                                {goal.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={aiForm.control}
                      name="sessions_per_week"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sessions per Week</FormLabel>
                          <Select 
                            value={field.value?.toString()} 
                            onValueChange={(v) => field.onChange(parseInt(v))}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-ai-sessions">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                                <SelectItem key={n} value={n.toString()}>
                                  {n} day{n > 1 ? 's' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={aiForm.control}
                      name="duration_weeks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration (Weeks)</FormLabel>
                          <Select 
                            value={field.value?.toString()} 
                            onValueChange={(v) => field.onChange(parseInt(v))}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-ai-duration">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {[1, 2, 3, 4, 6, 8, 10, 12].map((n) => (
                                <SelectItem key={n} value={n.toString()}>
                                  {n} week{n > 1 ? 's' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <Label>Available Equipment</Label>
                    <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                      {Object.keys(equipmentByCategory).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          Loading equipment options...
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {Object.entries(equipmentByCategory).map(([category, items]) => (
                            <div key={category}>
                              <p className="text-sm font-medium text-muted-foreground mb-2">{category}</p>
                              <div className="flex flex-wrap gap-2">
                                {items.map((eq) => (
                                  <Badge
                                    key={eq.id}
                                    variant={selectedEquipment.includes(eq.id) ? "default" : "outline"}
                                    className="cursor-pointer"
                                    onClick={() => toggleEquipment(eq.id)}
                                    data-testid={`equipment-${eq.id}`}
                                  >
                                    {eq.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedEquipment.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {selectedEquipment.length} equipment item{selectedEquipment.length > 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>
                  
                  {selectedEquipment.length === 0 && (
                    <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-500">
                        Select at least one equipment item for better exercise suggestions
                      </p>
                    </div>
                  )}
                  
                  <div className="pt-4">
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={aiGenerate.isPending}
                      data-testid="button-generate-ai"
                    >
                      {aiGenerate.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating Programme...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate with AI
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      After generation, you can review and edit the programme
                    </p>
                  </div>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
