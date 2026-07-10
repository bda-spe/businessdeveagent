import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useListServices, useCreateService, useUpdateService, useDeleteService, getListServicesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, Plus, Edit2, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import type { Service } from "@workspace/api-client-react";

const PRICING_MODELS = [
  { value: "fixed_price", label: "Fixed Price" },
  { value: "hourly", label: "Hourly" },
  { value: "unit_based", label: "Unit-Based" },
  { value: "custom_quote", label: "Custom Quote" },
];

const UNIT_TYPES = [
  { value: "square_foot", label: "Square Foot" },
  { value: "linear_foot", label: "Linear Foot" },
  { value: "per_item", label: "Per Item" },
  { value: "per_visit", label: "Per Visit" },
  { value: "other", label: "Other" },
];

const DURATION_OPTIONS = [
  "1-2 hours",
  "2-8 hours",
  "8-14 hours",
  "2-3 days",
  "1 week+",
  "Varies by job",
];

const optionalNumber = z.coerce.number().optional().nullable();

const serviceSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  category: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  pricingModel: z.string().optional().nullable(),
  basePrice: optionalNumber,
  minimumPrice: optionalNumber,
  billableLaborRate: optionalNumber,
  unitType: z.string().optional().nullable(),
  unitPrice: optionalNumber,
  avgCrewSize: optionalNumber,
  minCrewSize: optionalNumber,
  maxCrewSize: optionalNumber,
  estimatedLaborHours: optionalNumber,
  estimatedDuration: z.string().optional(),
  requiresInspection: z.boolean().default(false),
  requiresMeasurements: z.boolean().default(false),
  requiresMaterialSelection: z.boolean().default(false),
  lowJobCost: optionalNumber,
  avgJobCost: optionalNumber,
  highJobCost: optionalNumber,
  lowCostJobs: z.string().optional(),
  highCostJobs: z.string().optional(),
  priceIncreaseFactorsText: z.string().optional(),
  priceDecreaseFactorsText: z.string().optional(),
  pricingNotes: z.string().optional(),
  active: z.boolean().default(true),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

function csvToText(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  return "";
}

function textToCsv(v?: string): string[] | null {
  if (!v || !v.trim()) return null;
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const emptyValues: ServiceFormValues = {
  name: "",
  category: "",
  description: "",
  pricingModel: null,
  basePrice: null,
  minimumPrice: null,
  billableLaborRate: null,
  unitType: null,
  unitPrice: null,
  avgCrewSize: null,
  minCrewSize: null,
  maxCrewSize: null,
  estimatedLaborHours: null,
  estimatedDuration: "",
  requiresInspection: false,
  requiresMeasurements: false,
  requiresMaterialSelection: false,
  lowJobCost: null,
  avgJobCost: null,
  highJobCost: null,
  lowCostJobs: "",
  highCostJobs: "",
  priceIncreaseFactorsText: "",
  priceDecreaseFactorsText: "",
  pricingNotes: "",
  active: true,
};

function numFmt(n: number | null | undefined): string {
  return n == null ? "—" : `$${n}`;
}

export default function ServicesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: services, isLoading } = useListServices();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: emptyValues,
  });

  const pricingModel = form.watch("pricingModel");

  const openNewDialog = () => {
    setEditingId(null);
    form.reset(emptyValues);
    setIsDialogOpen(true);
  };

  const openEditDialog = (service: Service) => {
    setEditingId(service.id);
    form.reset({
      name: service.name,
      category: service.category || "",
      description: service.description || "",
      pricingModel: service.pricingModel ?? null,
      basePrice: service.basePrice,
      minimumPrice: service.minimumPrice,
      billableLaborRate: service.billableLaborRate,
      unitType: service.unitType ?? null,
      unitPrice: service.unitPrice,
      avgCrewSize: service.avgCrewSize,
      minCrewSize: service.minCrewSize,
      maxCrewSize: service.maxCrewSize,
      estimatedLaborHours: service.estimatedLaborHours,
      estimatedDuration: service.estimatedDuration || "",
      requiresInspection: service.requiresInspection,
      requiresMeasurements: service.requiresMeasurements ?? false,
      requiresMaterialSelection: service.requiresMaterialSelection ?? false,
      lowJobCost: service.lowJobCost,
      avgJobCost: service.avgJobCost,
      highJobCost: service.highJobCost,
      lowCostJobs: service.lowCostJobs || "",
      highCostJobs: service.highCostJobs || "",
      priceIncreaseFactorsText: csvToText(service.priceIncreaseFactors),
      priceDecreaseFactorsText: csvToText(service.priceDecreaseFactors),
      pricingNotes: service.pricingNotes || "",
      active: service.active,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (values: ServiceFormValues) => {
    const { priceIncreaseFactorsText, priceDecreaseFactorsText, ...rest } = values;
    const payload = {
      ...rest,
      priceIncreaseFactors: textToCsv(priceIncreaseFactorsText),
      priceDecreaseFactors: textToCsv(priceDecreaseFactorsText),
    };
    if (editingId) {
      updateService.mutate({ id: editingId, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
          toast({ title: "Service updated" });
          setIsDialogOpen(false);
        }
      });
    } else {
      createService.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
          toast({ title: "Service created" });
          setIsDialogOpen(false);
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this service?")) {
      deleteService.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
          toast({ title: "Service deleted" });
        }
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Services Catalog</h2>
          <p className="text-slate-500 mt-1">Define what you do, how you charge, and the labor and estimating rules for each service. Anything left blank falls back to your company-wide pricing defaults.</p>
        </div>
        <Button onClick={openNewDialog} className="shrink-0" data-testid="button-new-service">
          <Plus className="mr-2 h-4 w-4" /> Add Service
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      ) : services?.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 border-dashed">
          <Wrench className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No services defined</h3>
          <p className="text-slate-500 mt-1 mb-6 max-w-sm mx-auto">
            Your agent needs to know what services you offer to generate estimates for customers.
          </p>
          <Button onClick={openNewDialog}>Create your first service</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services?.map(service => (
            <Card key={service.id} className={`overflow-hidden transition-all hover:shadow-md ${!service.active ? 'opacity-60 grayscale-[0.5]' : ''}`}>
              <CardContent className="p-0">
                <div className="p-5 border-b border-slate-100">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-slate-900 leading-tight pr-4">{service.name}</h3>
                    {service.active ? 
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> : 
                      <AlertCircle className="h-5 w-5 text-slate-400 shrink-0" />
                    }
                  </div>
                  {service.category && (
                    <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded mb-3">
                      {service.category}
                    </span>
                  )}
                  <p className="text-sm text-slate-600 line-clamp-2 min-h-[2.5rem]">
                    {service.description || "No description provided."}
                  </p>
                </div>
                <div className="p-5 bg-slate-50 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-500 block text-xs">
                        {service.pricingModel === "hourly" ? "Billable Rate" : "Base Price"}
                      </span>
                      <span className="font-medium text-slate-900">
                        {service.pricingModel === "hourly"
                          ? service.billableLaborRate ? `$${service.billableLaborRate}/hr` : "—"
                          : numFmt(service.basePrice)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs">Avg Crew Size</span>
                      <span className="font-medium text-slate-900">{service.avgCrewSize ?? "—"}</span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-slate-200">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(service)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                      <Edit2 className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(service.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Service" : "Add Service"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Basic Information</h4>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Name *</FormLabel>
                        <FormControl><Input placeholder="e.g. Asphalt Driveway Repair" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl><Input placeholder="e.g. Asphalt" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description *</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Repair cracks, potholes, and damaged asphalt surfaces." className="h-20" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Pricing Model</h4>
                <FormField
                  control={form.control}
                  name="pricingModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How do you charge for this service?</FormLabel>
                      <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-pricing-model">
                            <SelectValue placeholder="Select a pricing model" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRICING_MODELS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Service Pricing</h4>
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <FormField
                    control={form.control}
                    name="basePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Price ($)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minimumPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Price ($)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billableLaborRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Billable Labor Rate ($/hr)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                        </FormControl>
                        <FormDescription>Overrides your company default labor rate for this service.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div />
                  <FormField
                    control={form.control}
                    name="unitType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Type (optional)</FormLabel>
                        <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-unit-type">
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {UNIT_TYPES.map((u) => (
                              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unitPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Price ($)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {pricingModel && (
                  <p className="text-xs text-slate-500 mt-2">
                    Example: crew size × labor hours × billable rate = labor charge (e.g. 3 workers × 8 hours × $75/hr = $1,800).
                  </p>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Labor Requirements</h4>
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <FormField
                    control={form.control}
                    name="avgCrewSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Average Crew Size</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minCrewSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Crew Size</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxCrewSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Crew Size</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="estimatedLaborHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Labor Hours</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="estimatedDuration"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Estimated Duration</FormLabel>
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-estimated-duration">
                              <SelectValue placeholder="Select duration" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DURATION_OPTIONS.map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Estimate Requirements</h4>
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="requiresInspection"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!mt-0 font-normal">Requires inspection before estimate</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="requiresMeasurements"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!mt-0 font-normal">Requires customer measurements/photos</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="requiresMaterialSelection"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!mt-0 font-normal">Requires material selection before pricing</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Typical Job Pricing Range</h4>
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <FormField
                    control={form.control}
                    name="lowJobCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Typical Low-End Job ($)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="avgJobCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Typical Average Job Cost ($)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="highJobCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Typical High-End Job ($)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">AI Estimating Guidance</h4>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="lowCostJobs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jobs That Are Usually Low-Cost</FormLabel>
                        <FormControl><Textarea className="h-16" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="highCostJobs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jobs That Are Usually High-Cost</FormLabel>
                        <FormControl><Textarea className="h-16" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="priceIncreaseFactorsText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Factors That Increase Price</FormLabel>
                          <FormControl><Input placeholder="e.g. steep terrain, hard-to-reach access" {...field} /></FormControl>
                          <FormDescription>Separate with commas.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="priceDecreaseFactorsText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Factors That Reduce Price</FormLabel>
                          <FormControl><Input placeholder="e.g. easy access, repeat customer" {...field} /></FormControl>
                          <FormDescription>Separate with commas.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="pricingNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pricing Notes</FormLabel>
                        <FormControl><Textarea className="h-20" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <p className="text-sm text-slate-500">Should the agent offer this service right now?</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createService.isPending || updateService.isPending}>
                  {createService.isPending || updateService.isPending ? "Saving..." : "Save Service"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
