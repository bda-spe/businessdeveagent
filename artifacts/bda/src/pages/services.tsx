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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, Plus, Edit2, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import type { Service } from "@workspace/api-client-react";

const serviceSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  basePrice: z.coerce.number().optional().nullable(),
  hourlyRate: z.coerce.number().optional().nullable(),
  minimumPrice: z.coerce.number().optional().nullable(),
  estimatedDuration: z.string().optional(),
  active: z.boolean().default(true),
});

export default function ServicesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: services, isLoading } = useListServices();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const form = useForm<z.infer<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      basePrice: null,
      hourlyRate: null,
      minimumPrice: null,
      estimatedDuration: "",
      active: true,
    },
  });

  const openNewDialog = () => {
    setEditingId(null);
    form.reset({
      name: "",
      description: "",
      category: "",
      basePrice: null,
      hourlyRate: null,
      minimumPrice: null,
      estimatedDuration: "",
      active: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (service: Service) => {
    setEditingId(service.id);
    form.reset({
      name: service.name,
      description: service.description || "",
      category: service.category || "",
      basePrice: service.basePrice,
      hourlyRate: service.hourlyRate,
      minimumPrice: service.minimumPrice,
      estimatedDuration: service.estimatedDuration || "",
      active: service.active,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (values: z.infer<typeof serviceSchema>) => {
    if (editingId) {
      updateService.mutate({ id: editingId, data: values }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
          toast({ title: "Service updated" });
          setIsDialogOpen(false);
        }
      });
    } else {
      createService.mutate({ data: values }, {
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
          <p className="text-slate-500 mt-1">Define what you do and how much it costs. The agent uses this to build estimates.</p>
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
                      <span className="text-slate-500 block text-xs">Base Price</span>
                      <span className="font-medium text-slate-900">{service.basePrice ? `$${service.basePrice}` : '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs">Hourly Rate</span>
                      <span className="font-medium text-slate-900">{service.hourlyRate ? `$${service.hourlyRate}/hr` : '—'}</span>
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Service" : "Add Service"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl><Input placeholder="e.g. Repairs, Installs" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estimatedDuration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Est. Duration</FormLabel>
                      <FormControl><Input placeholder="e.g. 2-4 hours" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (how the agent should explain it)</FormLabel>
                    <FormControl><Textarea className="h-20" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
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
                  name="hourlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hourly Rate ($)</FormLabel>
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
                      <FormLabel>Minimum ($)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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