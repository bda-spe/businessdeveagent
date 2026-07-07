import { useState, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetBusiness,
  useUpdateBusiness,
  useGetBusinessOperations,
  useSaveBusinessOperations,
  useListServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  useGetPricing,
  useSavePricing,
  useGetBusinessPolicies,
  useSaveBusinessPolicies,
  useAiDraftPolicy,
  useGetEstimateRules,
  useSaveEstimateRules,
  useGetBusinessTone,
  useSaveBusinessTone,
  useConfirmBusinessProfile,
  getGetBusinessQueryKey,
  getGetMeQueryKey,
  getGetBusinessOperationsQueryKey,
  getGetBusinessPoliciesQueryKey,
  getGetEstimateRulesQueryKey,
  getGetBusinessToneQueryKey,
  getGetPricingQueryKey,
  getListServicesQueryKey,
} from "@workspace/api-client-react";
import type {
  Business,
  BusinessOperations,
  BusinessPolicies,
  EstimateRules,
  BusinessTone,
  PricingRules,
  Service,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Sparkles,
  Plus,
  Trash2,
  Pencil,
  HelpCircle,
  X,
  Check,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  "HVAC", "Plumbing", "Electrical", "Roofing", "Landscaping",
  "Asphalt Striping", "Painting", "Pest Control", "Cleaning",
  "General Contractor", "Other",
];
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","Outside US",
];
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 === 0 ? 12 : i % 12;
  const ampm = i < 12 ? "AM" : "PM";
  return { value: `${String(i).padStart(2, "0")}:00`, label: `${h}:00 ${ampm}` };
});
const TONE_OPTIONS = [
  "Professional","Friendly","Casual","Premium","Technical",
  "Direct","Warm","Family-Owned","Corporate",
];
const STEPS = [
  "Basic Info","Operations","Services","Pricing","Policies","Tone & Review",
];
const YEAR_NOW = new Date().getFullYear();
const YEARS = Array.from({ length: YEAR_NOW - 1899 }, (_, i) => YEAR_NOW - i);

// ── Helper: TagInput ──────────────────────────────────────────────────────────

function TagInput({ tags, onChange, placeholder }: {
  tags: string[];
  onChange: (t: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1 pr-1">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? "Type and press Enter"}
          className="text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>Add</Button>
      </div>
    </div>
  );
}

// ── Helper: BusinessHoursEditor ───────────────────────────────────────────────

type DayHours = { open: string; close: string; closed: boolean };
type WeekHours = Record<string, DayHours>;

function defaultWeekHours(): WeekHours {
  return Object.fromEntries(DAYS.map((d) => [d, { open: "08:00", close: "17:00", closed: d === "Sunday" }]));
}

function BusinessHoursEditor({ value, onChange }: {
  value: WeekHours;
  onChange: (v: WeekHours) => void;
}) {
  const set = (day: string, field: keyof DayHours, val: string | boolean) =>
    onChange({ ...value, [day]: { ...value[day], [field]: val } });
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden text-sm">
      {DAYS.map((day, i) => {
        const h = value[day] ?? { open: "08:00", close: "17:00", closed: false };
        return (
          <div key={day} className={`flex items-center gap-3 px-4 py-2 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
            <span className="w-24 font-medium text-slate-700">{day.slice(0, 3)}</span>
            <Switch checked={!h.closed} onCheckedChange={(v) => set(day, "closed", !v)} />
            {!h.closed ? (
              <>
                <select value={h.open} onChange={(e) => set(day, "open", e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1 text-sm bg-white">
                  {HOURS.map((hr) => <option key={hr.value} value={hr.value}>{hr.label}</option>)}
                </select>
                <span className="text-slate-400">to</span>
                <select value={h.close} onChange={(e) => set(day, "close", e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1 text-sm bg-white">
                  {HOURS.map((hr) => <option key={hr.value} value={hr.value}>{hr.label}</option>)}
                </select>
              </>
            ) : (
              <span className="text-slate-400 italic">Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function WizardProgress({ step, completedSteps, onJump }: {
  step: number;
  completedSteps: Set<number>;
  onJump: (s: number) => void;
}) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const num = i + 1;
        const active = num === step;
        const done = completedSteps.has(num);
        const clickable = done || num <= step;
        return (
          <div key={num} className="flex items-center flex-1 min-w-0">
            <button
              type="button"
              onClick={() => clickable && onJump(num)}
              className={`flex flex-col items-center gap-1 min-w-0 ${clickable ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                done ? "bg-emerald-600 border-emerald-600 text-white"
                : active ? "bg-[#1e3a5f] border-[#1e3a5f] text-white"
                : "bg-white border-slate-300 text-slate-400"
              }`}>
                {done ? <Check className="h-4 w-4" /> : num}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${active ? "text-[#1e3a5f]" : done ? "text-emerald-700" : "text-slate-400"}`}>
                {label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${done ? "bg-emerald-400" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── BDA Helper Card ───────────────────────────────────────────────────────────

function BdaHelperCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3">
      <button type="button" onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 text-left">
        <div className="h-8 w-8 shrink-0 rounded-full bg-[#1e3a5f] flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#1e3a5f]">BDA Setup Helper</p>
          <p className="text-xs text-slate-500">Need help? I can help with questions about a field we capture, write policies, estimate rules, and customer-facing language after you enter the basics.</p>
        </div>
        <HelpCircle className="h-4 w-4 text-slate-400 shrink-0" />
      </button>
    </div>
  );
}

// ── Nav buttons ───────────────────────────────────────────────────────────────

function StepNav({ step, onBack, saving, saveLabel = "Save & Continue" }: {
  step: number;
  onBack: () => void;
  saving: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-6">
      <Button type="button" variant="outline" onClick={onBack} disabled={step === 1}>
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back
      </Button>
      <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#162d4d]">
        {saving ? "Saving…" : saveLabel}
        {!saving && step < 6 && <ChevronRight className="h-4 w-4 ml-1" />}
      </Button>
    </div>
  );
}

// ── Step 1: Basic Business Info ───────────────────────────────────────────────

const s1Schema = z.object({
  name: z.string().min(1, "Business name is required"),
  industry: z.string().min(1, "Industry is required"),
  industryOther: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Valid email required"),
  serviceArea: z.string().min(1, "Service area is required"),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressZip: z.string().optional(),
});
type S1 = z.infer<typeof s1Schema>;

function Step1({ biz, onSave }: { biz: Business | undefined; onSave: (d: S1) => Promise<void> }) {
  const form = useForm<S1>({ resolver: zodResolver(s1Schema),
    defaultValues: { name: "", industry: "", website: "", phone: "", email: "", serviceArea: "" } });
  const [saving, setSaving] = useState(false);
  const industry = form.watch("industry");

  useEffect(() => {
    if (biz) form.reset({
      name: biz.name ?? "",
      industry: biz.industry ?? "",
      industryOther: biz.industryOther ?? "",
      website: biz.website ?? "",
      phone: biz.phone ?? "",
      email: biz.email ?? "",
      serviceArea: biz.serviceArea ?? "",
      addressLine1: biz.addressLine1 ?? "",
      addressLine2: biz.addressLine2 ?? "",
      addressCity: biz.addressCity ?? "",
      addressState: biz.addressState ?? "",
      addressZip: biz.addressZip ?? "",
    });
  }, [biz]);

  const onSubmit = async (d: S1) => { setSaving(true); await onSave(d).finally(() => setSaving(false)); };

  const fe = form.formState.errors;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Business Name *</Label>
          <Input {...form.register("name")} placeholder="Acme Plumbing Co." />
          {fe.name && <p className="text-xs text-red-500">{fe.name.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Industry *</Label>
          <select {...form.register("industry")} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">Select industry…</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          {fe.industry && <p className="text-xs text-red-500">{fe.industry.message}</p>}
        </div>
        {industry === "Other" && (
          <div className="space-y-1 sm:col-span-2">
            <Label>Specify Industry</Label>
            <Input {...form.register("industryOther")} placeholder="Describe your trade" />
          </div>
        )}
        <div className="space-y-1">
          <Label>Phone *</Label>
          <Input {...form.register("phone")} placeholder="(555) 123-4567" type="tel" />
          {fe.phone && <p className="text-xs text-red-500">{fe.phone.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Email *</Label>
          <Input {...form.register("email")} placeholder="hello@business.com" type="email" />
          {fe.email && <p className="text-xs text-red-500">{fe.email.message}</p>}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Website</Label>
          <Input {...form.register("website")} placeholder="https://yourbusiness.com" type="url" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Service Area * <span className="text-slate-400 font-normal">(cities, counties, or ZIPs you serve)</span></Label>
          <Input {...form.register("serviceArea")} placeholder="Greater Denver, Douglas County, 80202–80239" />
          {fe.serviceArea && <p className="text-xs text-red-500">{fe.serviceArea.message}</p>}
        </div>
      </div>
      <Separator />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Business Address (optional)</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1 sm:col-span-2">
          <Label>Address Line 1</Label>
          <Input {...form.register("addressLine1")} placeholder="123 Main St" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Address Line 2</Label>
          <Input {...form.register("addressLine2")} placeholder="Suite 400" />
        </div>
        <div className="space-y-1">
          <Label>City</Label>
          <Input {...form.register("addressCity")} placeholder="Denver" />
        </div>
        <div className="space-y-1">
          <Label>State</Label>
          <select {...form.register("addressState")} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">Select…</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>ZIP Code</Label>
          <Input {...form.register("addressZip")} placeholder="80202" />
        </div>
      </div>
      <StepNav step={1} onBack={() => {}} saving={saving} />
    </form>
  );
}

// ── Step 2: Company Operations ────────────────────────────────────────────────

const s2Schema = z.object({
  customerType: z.string().optional(),
  employeeCount: z.coerce.number().int().nonnegative().optional().nullable(),
  yearFounded: z.coerce.number().int().optional().nullable(),
  emergencyAvailable: z.boolean().optional(),
  emergencyNotes: z.string().optional(),
  seasonalAvailability: z.string().optional(),
  seasonalNotes: z.string().optional(),
  typicalResponseTime: z.string().optional(),
});
type S2 = z.infer<typeof s2Schema>;

function Step2({ ops, onSave, onBack }: {
  ops: BusinessOperations | undefined;
  onSave: (d: S2, hours: WeekHours) => Promise<void>;
  onBack: () => void;
}) {
  const form = useForm<S2>({ resolver: zodResolver(s2Schema) });
  const [saving, setSaving] = useState(false);
  const [hours, setHours] = useState<WeekHours>(defaultWeekHours());
  const emergencyOn = form.watch("emergencyAvailable");

  useEffect(() => {
    if (ops) {
      form.reset({
        customerType: ops.customerType ?? "",
        employeeCount: ops.employeeCount ?? null,
        yearFounded: ops.yearFounded ?? null,
        emergencyAvailable: ops.emergencyAvailable,
        emergencyNotes: ops.emergencyNotes ?? "",
        seasonalAvailability: ops.seasonalAvailability ?? "",
        seasonalNotes: ops.seasonalNotes ?? "",
        typicalResponseTime: ops.typicalResponseTime ?? "",
      });
      if (ops.businessHours && typeof ops.businessHours === "object") {
        setHours(ops.businessHours as WeekHours);
      }
    }
  }, [ops]);

  const onSubmit = async (d: S2) => { setSaving(true); await onSave(d, hours).finally(() => setSaving(false)); };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1">
        <Label>Customer Type</Label>
        <div className="flex flex-wrap gap-3">
          {["Residential","Commercial","Both","Other"].map((v) => (
            <label key={v} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value={v} {...form.register("customerType")} className="accent-[#1e3a5f]" />
              <span className="text-sm">{v}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Number of Employees</Label>
          <Input type="number" min={0} step={1} {...form.register("employeeCount")} placeholder="e.g. 5" />
        </div>
        <div className="space-y-1">
          <Label>Year Founded</Label>
          <select {...form.register("yearFounded")} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">Select year…</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Typical Response Time</Label>
          <select {...form.register("typicalResponseTime")} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">Select…</option>
            {["Immediate","Within 1 hour","Same day","Within 24 hours","1-2 business days"].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Seasonal Availability</Label>
          <div className="flex gap-3">
            <select {...form.register("seasonalAvailability")} className="flex-1 border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">Select…</option>
              {["Year-round","Seasonal","Weather-dependent","Custom"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Input {...form.register("seasonalNotes")} placeholder="Additional notes on availability…" />
        </div>
      </div>
      <Separator />
      <div className="space-y-3">
        <Label>Normal Business Hours</Label>
        <BusinessHoursEditor value={hours} onChange={setHours} />
      </div>
      <Separator />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Emergency / After-Hours Availability</Label>
          <Switch checked={!!emergencyOn} onCheckedChange={(v) => form.setValue("emergencyAvailable", v)} />
        </div>
        {emergencyOn && (
          <Textarea {...form.register("emergencyNotes")} placeholder="e.g. 24/7 emergency service available, $150 call-out fee applies" className="resize-none h-20" />
        )}
      </div>
      <StepNav step={2} onBack={onBack} saving={saving} />
    </form>
  );
}

// ── Step 3: Services ──────────────────────────────────────────────────────────

const svcSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  category: z.string().optional(),
  description: z.string().max(1000).optional(),
  basePrice: z.coerce.number().nonnegative().optional().nullable(),
  hourlyRate: z.coerce.number().nonnegative().optional().nullable(),
  minimumPrice: z.coerce.number().nonnegative().optional().nullable(),
  estimatedDuration: z.string().optional(),
  requiresInspection: z.boolean().optional(),
  active: z.boolean().optional(),
});
type SvcForm = z.infer<typeof svcSchema>;

function ServiceCard({ svc, onSave, onDelete }: {
  svc: Service;
  onSave: (id: number, d: SvcForm) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const form = useForm<SvcForm>({ resolver: zodResolver(svcSchema),
    defaultValues: {
      name: svc.name, category: svc.category ?? "", description: svc.description ?? "",
      basePrice: svc.basePrice ?? null, hourlyRate: svc.hourlyRate ?? null,
      minimumPrice: svc.minimumPrice ?? null, estimatedDuration: svc.estimatedDuration ?? "",
      requiresInspection: svc.requiresInspection, active: svc.active,
    }});

  if (!editing) return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 bg-white">
      <div>
        <p className="font-medium text-sm">{svc.name}</p>
        <p className="text-xs text-slate-500">{svc.category || "No category"} {svc.basePrice ? `· $${svc.basePrice}` : ""}</p>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => onDelete(svc.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">Service Name *</Label><Input {...form.register("name")} /></div>
        <div className="space-y-1"><Label className="text-xs">Category</Label><Input {...form.register("category")} placeholder="e.g. Repair, Installation" /></div>
        <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Description</Label><Textarea {...form.register("description")} className="resize-none h-16 text-sm" placeholder="Describe the service…" /></div>
        <div className="space-y-1"><Label className="text-xs">Base Price ($)</Label><Input type="number" step="0.01" {...form.register("basePrice")} /></div>
        <div className="space-y-1"><Label className="text-xs">Hourly Rate ($/hr)</Label><Input type="number" step="0.01" {...form.register("hourlyRate")} /></div>
        <div className="space-y-1"><Label className="text-xs">Minimum Price ($)</Label><Input type="number" step="0.01" {...form.register("minimumPrice")} /></div>
        <div className="space-y-1"><Label className="text-xs">Estimated Duration</Label><Input {...form.register("estimatedDuration")} placeholder="e.g. 2-4 hours" /></div>
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" {...form.register("requiresInspection")} className="accent-[#1e3a5f]" />
          Requires inspection before quote
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" {...form.register("active")} className="accent-[#1e3a5f]" />
          Active
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={saving} onClick={form.handleSubmit(async (d) => {
          setSaving(true);
          await onSave(svc.id, d).finally(() => setSaving(false));
          setEditing(false);
        })}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function Step3({ services, onSave, onDelete, onAdd, onBack, onNext }: {
  services: Service[];
  onSave: (id: number, d: SvcForm) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onAdd: (d: SvcForm) => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const form = useForm<SvcForm>({ resolver: zodResolver(svcSchema),
    defaultValues: { name: "", category: "", description: "", active: true, requiresInspection: false } });

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {services.map((s) => (
          <ServiceCard key={s.id} svc={s} onSave={onSave} onDelete={onDelete} />
        ))}
        {services.length === 0 && !adding && (
          <p className="text-sm text-slate-400 text-center py-8">No services yet. Add your first service below.</p>
        )}
      </div>
      {!adding ? (
        <Button type="button" variant="outline" onClick={() => setAdding(true)} className="w-full border-dashed">
          <Plus className="h-4 w-4 mr-2" />Add Service
        </Button>
      ) : (
        <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-3">
          <p className="text-sm font-semibold text-[#1e3a5f]">New Service</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Service Name *</Label><Input {...form.register("name")} /></div>
            <div className="space-y-1"><Label className="text-xs">Category</Label><Input {...form.register("category")} placeholder="e.g. Repair, Installation" /></div>
            <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Description</Label><Textarea {...form.register("description")} className="resize-none h-16 text-sm" placeholder="Describe the service…" /></div>
            <div className="space-y-1"><Label className="text-xs">Base Price ($)</Label><Input type="number" step="0.01" {...form.register("basePrice")} /></div>
            <div className="space-y-1"><Label className="text-xs">Hourly Rate ($/hr)</Label><Input type="number" step="0.01" {...form.register("hourlyRate")} /></div>
            <div className="space-y-1"><Label className="text-xs">Minimum Price ($)</Label><Input type="number" step="0.01" {...form.register("minimumPrice")} /></div>
            <div className="space-y-1"><Label className="text-xs">Estimated Duration</Label><Input {...form.register("estimatedDuration")} placeholder="e.g. 2-4 hours" /></div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...form.register("requiresInspection")} className="accent-[#1e3a5f]" />
              Requires inspection
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...form.register("active")} className="accent-[#1e3a5f]" />
              Active
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={saving} onClick={form.handleSubmit(async (d) => {
              setSaving(true);
              await onAdd(d).finally(() => setSaving(false));
              form.reset({ name: "", category: "", description: "", active: true, requiresInspection: false });
              setAdding(false);
            })}>
              {saving ? "Adding…" : "Add Service"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-6">
        <Button type="button" variant="outline" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1" />Back</Button>
        <Button type="button" onClick={onNext} className="bg-[#1e3a5f] hover:bg-[#162d4d]">
          Continue <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 4: Pricing ───────────────────────────────────────────────────────────

const s4Schema = z.object({
  laborRate: z.coerce.number().nonnegative().optional().nullable(),
  minimumJobCost: z.coerce.number().nonnegative().optional().nullable(),
  travelFeeType: z.string().optional(),
  travelFee: z.coerce.number().nonnegative().optional().nullable(),
  freeTravelRadius: z.coerce.number().int().nonnegative().optional().nullable(),
  materialMarkup: z.coerce.number().nonnegative().optional().nullable(),
  weekendFeeType: z.string().optional(),
  weekendFeeValue: z.coerce.number().nonnegative().optional().nullable(),
  emergencyFeeType: z.string().optional(),
  emergencyFee: z.coerce.number().nonnegative().optional().nullable(),
  cancellationFee: z.coerce.number().nonnegative().optional().nullable(),
  cancellationWindow: z.string().optional(),
  depositRequired: z.boolean().optional(),
  depositType: z.string().optional(),
  depositValue: z.coerce.number().nonnegative().optional().nullable(),
  taxRate: z.coerce.number().nonnegative().optional().nullable(),
  pricingNotes: z.string().max(1500).optional(),
});
type S4 = z.infer<typeof s4Schema>;

function CurrencyInput(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
        <Input type="number" step="0.01" min={0} className="pl-6 text-sm" {...rest} />
      </div>
    </div>
  );
}

function PctInput(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input type="number" step="0.01" min={0} max={100} className="pr-7 text-sm" {...rest} />
        <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
      </div>
    </div>
  );
}

function Step4({ pricing, onSave, onBack }: {
  pricing: PricingRules | undefined;
  onSave: (d: S4) => Promise<void>;
  onBack: () => void;
}) {
  const form = useForm<S4>({ resolver: zodResolver(s4Schema) });
  const [saving, setSaving] = useState(false);
  const travelType = form.watch("travelFeeType");
  const weekendType = form.watch("weekendFeeType");
  const emergencyType = form.watch("emergencyFeeType");
  const depositOn = form.watch("depositRequired");

  useEffect(() => {
    if (pricing) form.reset({
      laborRate: pricing.laborRate ?? null,
      minimumJobCost: pricing.minimumJobCost ?? null,
      travelFeeType: pricing.travelFeeType ?? "",
      travelFee: pricing.travelFee ?? null,
      freeTravelRadius: pricing.freeTravelRadius ?? null,
      materialMarkup: pricing.materialMarkup ?? null,
      weekendFeeType: pricing.weekendFeeType ?? "",
      weekendFeeValue: pricing.weekendFeeValue ?? null,
      emergencyFeeType: pricing.emergencyFeeType ?? "",
      emergencyFee: pricing.emergencyFee ?? null,
      cancellationFee: pricing.cancellationFee ?? null,
      cancellationWindow: pricing.cancellationWindow ?? "",
      depositRequired: pricing.depositRequired,
      depositType: pricing.depositType ?? "",
      depositValue: pricing.depositValue ?? null,
      taxRate: pricing.taxRate ?? null,
      pricingNotes: pricing.pricingNotes ?? "",
    });
  }, [pricing]);

  const onSubmit = async (d: S4) => { setSaving(true); await onSave(d).finally(() => setSaving(false)); };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <CurrencyInput label="Default Labor Rate (per hr)" {...form.register("laborRate")} />
        <CurrencyInput label="Minimum Job Charge" {...form.register("minimumJobCost")} />
        <PctInput label="Material Markup" {...form.register("materialMarkup")} />
        <PctInput label="Tax Rate" {...form.register("taxRate")} />
      </div>
      <Separator />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Travel</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Travel Fee Type</Label>
          <select {...form.register("travelFeeType")} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">None</option>
            {["Flat Fee","Distance-Based","Custom"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        {travelType === "Flat Fee" && <CurrencyInput label="Flat Travel Fee" {...form.register("travelFee")} />}
        {travelType === "Distance-Based" && (
          <div className="space-y-1">
            <Label className="text-xs">Free Travel Radius (miles)</Label>
            <Input type="number" min={0} step={1} {...form.register("freeTravelRadius")} />
          </div>
        )}
      </div>
      <Separator />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Weekend & Emergency</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Weekend Fee Type</Label>
          <select {...form.register("weekendFeeType")} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">None</option>
            {["Flat Fee","Percentage Increase","Custom"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        {(weekendType === "Flat Fee") && <CurrencyInput label="Weekend Fee ($)" {...form.register("weekendFeeValue")} />}
        {(weekendType === "Percentage Increase") && <PctInput label="Weekend Fee (%)" {...form.register("weekendFeeValue")} />}
        <div className="space-y-1">
          <Label className="text-xs">Emergency Fee Type</Label>
          <select {...form.register("emergencyFeeType")} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">None</option>
            {["Flat Fee","Percentage Increase","Custom"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        {(emergencyType === "Flat Fee") && <CurrencyInput label="Emergency Fee ($)" {...form.register("emergencyFee")} />}
        {(emergencyType === "Percentage Increase") && <PctInput label="Emergency Fee (%)" {...form.register("emergencyFee")} />}
      </div>
      <Separator />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cancellation & Deposit</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <CurrencyInput label="Cancellation Fee" {...form.register("cancellationFee")} />
        <div className="space-y-1">
          <Label className="text-xs">Cancellation Window</Label>
          <select {...form.register("cancellationWindow")} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">None</option>
            {["Same day","Less than 24 hours","Less than 48 hours","Less than 72 hours","Custom"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Deposit Required</Label>
            <Switch checked={!!depositOn} onCheckedChange={(v) => form.setValue("depositRequired", v)} />
          </div>
          {depositOn && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Deposit Type</Label>
                <select {...form.register("depositType")} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
                  <option value="">Select…</option>
                  <option value="Flat Amount">Flat Amount</option>
                  <option value="Percentage">Percentage</option>
                </select>
              </div>
              {form.watch("depositType") === "Flat Amount"
                ? <CurrencyInput label="Deposit Amount ($)" {...form.register("depositValue")} />
                : <PctInput label="Deposit (%)" {...form.register("depositValue")} />
              }
            </div>
          )}
        </div>
      </div>
      <Separator />
      <div className="space-y-1">
        <Label className="text-xs">Pricing Notes</Label>
        <Textarea {...form.register("pricingNotes")} maxLength={1500} rows={3} className="resize-none text-sm" placeholder="Any additional pricing context…" />
      </div>
      <StepNav step={4} onBack={onBack} saving={saving} />
    </form>
  );
}

// ── Step 5: Policies & Estimate Rules ─────────────────────────────────────────

const POLICY_FIELDS: { key: keyof S5Policies; label: string }[] = [
  { key: "paymentTerms", label: "Payment Terms" },
  { key: "cancellationPolicy", label: "Cancellation Policy" },
  { key: "warrantyPolicy", label: "Warranty / Guarantee Policy" },
  { key: "refundPolicy", label: "Refund Policy" },
  { key: "weatherDelayPolicy", label: "Weather Delay Policy" },
  { key: "customerResponsibilities", label: "Customer Responsibilities Before Service" },
];

type S5Policies = {
  paymentTerms: string;
  cancellationPolicy: string;
  warrantyPolicy: string;
  refundPolicy: string;
  weatherDelayPolicy: string;
  customerResponsibilities: string;
};

type S5Estimate = {
  whenToGivePriceRange: string;
  whenToRecommendVisit: string;
  estimateDisclaimer: string;
};

function PolicyField({ fieldKey, label, value, onChange, onAiDraft, drafting }: {
  fieldKey: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onAiDraft: (field: string, current: string) => Promise<void>;
  drafting: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <Button type="button" size="sm" variant="outline" disabled={drafting}
          onClick={() => onAiDraft(fieldKey, value)}
          className="h-7 text-xs gap-1.5 border-blue-200 text-[#1e3a5f] hover:bg-blue-50">
          <Sparkles className="h-3 w-3" />
          {drafting ? "Writing…" : "Help Me Write This"}
        </Button>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={2000}
        rows={4}
        className="resize-none text-sm"
        placeholder={`Write your ${label.toLowerCase()}…`}
      />
      <p className="text-xs text-slate-400 text-right">{value.length}/2000</p>
    </div>
  );
}

function Step5({ policies, estimateRules, onSave, onBack, aiDraft }: {
  policies: BusinessPolicies | undefined;
  estimateRules: EstimateRules | undefined;
  onSave: (p: S5Policies, e: S5Estimate, required: string[], questions: string[]) => Promise<void>;
  onBack: () => void;
  aiDraft: (field: string, current: string) => Promise<string>;
}) {
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [pols, setPols] = useState<S5Policies>({
    paymentTerms: "", cancellationPolicy: "", warrantyPolicy: "",
    refundPolicy: "", weatherDelayPolicy: "", customerResponsibilities: "",
  });
  const [est, setEst] = useState<S5Estimate>({
    whenToGivePriceRange: "", whenToRecommendVisit: "", estimateDisclaimer: "",
  });
  const [required, setRequired] = useState<string[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);

  useEffect(() => {
    if (policies) setPols({
      paymentTerms: policies.paymentTerms ?? "",
      cancellationPolicy: policies.cancellationPolicy ?? "",
      warrantyPolicy: policies.warrantyPolicy ?? "",
      refundPolicy: policies.refundPolicy ?? "",
      weatherDelayPolicy: policies.weatherDelayPolicy ?? "",
      customerResponsibilities: policies.customerResponsibilities ?? "",
    });
  }, [policies]);

  useEffect(() => {
    if (estimateRules) {
      setEst({
        whenToGivePriceRange: estimateRules.whenToGivePriceRange ?? "",
        whenToRecommendVisit: estimateRules.whenToRecommendVisit ?? "",
        estimateDisclaimer: estimateRules.estimateDisclaimer ?? "",
      });
      setRequired((estimateRules.requiredInfoBeforeQuoting as string[] | null) ?? []);
      setQuestions((estimateRules.bdaQuestionsToAsk as string[] | null) ?? []);
    }
  }, [estimateRules]);

  const handleAiDraft = async (field: string, current: string) => {
    setDrafting(field);
    const wording = await aiDraft(field, current).finally(() => setDrafting(null));
    if (wording) setPols((p) => ({ ...p, [field]: wording }));
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-4">Policy Language</p>
        <div className="space-y-5">
          {POLICY_FIELDS.map((f) => (
            <PolicyField
              key={f.key}
              fieldKey={f.key}
              label={f.label}
              value={pols[f.key]}
              onChange={(v) => setPols((p) => ({ ...p, [f.key]: v }))}
              onAiDraft={handleAiDraft}
              drafting={drafting === f.key}
            />
          ))}
        </div>
      </div>
      <Separator />
      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-700">Estimate Rules</p>
        <div className="space-y-1">
          <Label className="text-xs">Required Information Before Quoting</Label>
          <p className="text-xs text-slate-400 mb-2">e.g. address, photos, measurements, project size</p>
          <TagInput tags={required} onChange={setRequired} placeholder="Type item and press Enter" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Questions BDA Should Ask Customers</Label>
          <TagInput tags={questions} onChange={setQuestions} placeholder="Type question and press Enter" />
        </div>
        {(["whenToGivePriceRange","whenToRecommendVisit","estimateDisclaimer"] as const).map((k) => {
          const labels: Record<string, string> = {
            whenToGivePriceRange: "When to Give a Price Range",
            whenToRecommendVisit: "When to Recommend an On-Site Visit",
            estimateDisclaimer: "Estimate Disclaimer",
          };
          return (
            <div key={k} className="space-y-1">
              <Label className="text-xs">{labels[k]}</Label>
              <Textarea
                value={est[k]}
                onChange={(e) => setEst((p) => ({ ...p, [k]: e.target.value }))}
                maxLength={1500}
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-6 border-t border-slate-100">
        <Button type="button" variant="outline" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1" />Back</Button>
        <Button type="button" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#162d4d]"
          onClick={async () => { setSaving(true); await onSave(pols, est, required, questions).finally(() => setSaving(false)); }}>
          {saving ? "Saving…" : "Save & Continue"}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 6: Tone & Review ─────────────────────────────────────────────────────

function Step6({ biz, ops, services, pricing, policies, tone, onSaveTone, onConfirm, onBack, onEdit }: {
  biz: Business | undefined;
  ops: BusinessOperations | undefined;
  services: Service[];
  pricing: PricingRules | undefined;
  policies: BusinessPolicies | undefined;
  tone: BusinessTone | undefined;
  onSaveTone: (toneOpts: string[], use: string[], avoid: string[], voice: string) => Promise<void>;
  onConfirm: () => Promise<void>;
  onBack: () => void;
  onEdit: (step: number) => void;
}) {
  const [savingTone, setSavingTone] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selectedTones, setSelectedTones] = useState<string[]>([]);
  const [phrasesToUse, setPhrasesToUse] = useState<string[]>([]);
  const [phrasesToAvoid, setPhrasesToAvoid] = useState<string[]>([]);
  const [brandVoice, setBrandVoice] = useState("");

  useEffect(() => {
    if (tone) {
      setSelectedTones((tone.toneOptions as string[] | null) ?? []);
      setPhrasesToUse((tone.phrasesToUse as string[] | null) ?? []);
      setPhrasesToAvoid((tone.phrasesToAvoid as string[] | null) ?? []);
      setBrandVoice(tone.brandVoice ?? "");
    }
  }, [tone]);

  const toggleTone = (t: string) =>
    setSelectedTones((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const SectionReview = ({ title, step, children }: { title: string; step: number; children: React.ReactNode }) => (
    <Card className="border-slate-200">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onEdit(step)}>
          <Pencil className="h-3 w-3 mr-1" />Edit
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4 text-sm text-slate-600 space-y-1">{children}</CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-700">Business Tone</p>
        <div className="space-y-1">
          <Label className="text-xs">Tone (select all that apply)</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {TONE_OPTIONS.map((t) => (
              <button key={t} type="button" onClick={() => toggleTone(t)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  selectedTones.includes(t)
                    ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phrases to Use</Label>
          <TagInput tags={phrasesToUse} onChange={setPhrasesToUse} placeholder="e.g. No job too small" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phrases to Avoid</Label>
          <TagInput tags={phrasesToAvoid} onChange={setPhrasesToAvoid} placeholder="e.g. cheap, discount" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">How the Company Should Sound</Label>
          <Textarea value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)}
            maxLength={1500} rows={3} className="resize-none text-sm"
            placeholder="Describe your brand voice and communication style…" />
        </div>
        <Button type="button" disabled={savingTone} variant="outline" size="sm"
          onClick={async () => { setSavingTone(true); await onSaveTone(selectedTones, phrasesToUse, phrasesToAvoid, brandVoice).finally(() => setSavingTone(false)); }}>
          {savingTone ? "Saving…" : "Save Tone"}
        </Button>
      </div>
      <Separator />
      <p className="text-sm font-semibold text-slate-700">Profile Summary</p>
      <div className="space-y-3">
        <SectionReview title="Basic Business Info" step={1}>
          {biz?.name && <p><span className="font-medium">Name:</span> {biz.name}</p>}
          {biz?.industry && <p><span className="font-medium">Industry:</span> {biz.industry}{biz.industryOther ? ` – ${biz.industryOther}` : ""}</p>}
          {biz?.phone && <p><span className="font-medium">Phone:</span> {biz.phone}</p>}
          {biz?.email && <p><span className="font-medium">Email:</span> {biz.email}</p>}
          {biz?.serviceArea && <p><span className="font-medium">Service area:</span> {biz.serviceArea}</p>}
        </SectionReview>
        <SectionReview title="Operations" step={2}>
          {ops?.customerType && <p><span className="font-medium">Customers:</span> {ops.customerType}</p>}
          {ops?.typicalResponseTime && <p><span className="font-medium">Response time:</span> {ops.typicalResponseTime}</p>}
          {ops?.seasonalAvailability && <p><span className="font-medium">Availability:</span> {ops.seasonalAvailability}</p>}
          <p><span className="font-medium">Emergency available:</span> {ops?.emergencyAvailable ? "Yes" : "No"}</p>
        </SectionReview>
        <SectionReview title="Services" step={3}>
          {services.length === 0 ? <p className="text-slate-400">No services added</p>
            : services.map((s) => <p key={s.id}>• {s.name}{s.basePrice ? ` — $${s.basePrice}` : ""}</p>)}
        </SectionReview>
        <SectionReview title="Pricing" step={4}>
          {pricing?.laborRate && <p><span className="font-medium">Labor rate:</span> ${pricing.laborRate}/hr</p>}
          {pricing?.minimumJobCost && <p><span className="font-medium">Minimum job:</span> ${pricing.minimumJobCost}</p>}
          {pricing?.taxRate && <p><span className="font-medium">Tax rate:</span> {pricing.taxRate}%</p>}
          {pricing?.depositRequired && <p><span className="font-medium">Deposit:</span> required</p>}
        </SectionReview>
        <SectionReview title="Policies" step={5}>
          {policies?.paymentTerms ? <p className="line-clamp-2">{policies.paymentTerms}</p>
            : <p className="text-slate-400">No policies entered</p>}
        </SectionReview>
      </div>
      <Separator />
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 space-y-3">
        <p className="font-semibold text-emerald-800">Ready to confirm your Business Profile?</p>
        <p className="text-sm text-emerald-700">Confirming unlocks the next onboarding steps and activates your BDA.</p>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1" />Back</Button>
          <Button type="button" disabled={confirming}
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={async () => { setConfirming(true); await onConfirm().finally(() => setConfirming(false)); }}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {confirming ? "Confirming…" : "Confirm Business Profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BusinessPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  // Data fetching
  const { data: biz, isLoading: bizLoading } = useGetBusiness();
  const { data: ops, isLoading: opsLoading } = useGetBusinessOperations();
  const { data: services = [], isLoading: svcsLoading } = useListServices();
  const { data: pricing, isLoading: pricingLoading } = useGetPricing();
  const { data: policies, isLoading: polsLoading } = useGetBusinessPolicies();
  const { data: estimateRules, isLoading: estLoading } = useGetEstimateRules();
  const { data: tone, isLoading: toneLoading } = useGetBusinessTone();

  // Mutations
  const updateBusiness = useUpdateBusiness();
  const saveOps = useSaveBusinessOperations();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();
  const savePricing = useSavePricing();
  const savePolicies = useSaveBusinessPolicies();
  const saveEstimate = useSaveEstimateRules();
  const saveTone = useSaveBusinessTone();
  const aiDraft = useAiDraftPolicy();
  const confirmProfile = useConfirmBusinessProfile();

  const isLoading = bizLoading || opsLoading || svcsLoading || pricingLoading || polsLoading || estLoading || toneLoading;

  const markDone = (s: number) => setCompleted((prev) => new Set([...prev, s]));
  const goNext = () => setStep((s) => Math.min(s + 1, 6));
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const invalidate = (...keys: (() => readonly unknown[])[]) =>
    keys.forEach((k) => qc.invalidateQueries({ queryKey: k() }));

  const handleSave1 = async (d: S1) => {
    await updateBusiness.mutateAsync({ data: d });
    invalidate(getGetBusinessQueryKey, getGetMeQueryKey);
    markDone(1);
    goNext();
    toast({ title: "Basic info saved" });
  };

  const handleSave2 = async (d: S2, hours: WeekHours) => {
    await saveOps.mutateAsync({ data: { ...d, businessHours: hours } });
    invalidate(getGetBusinessOperationsQueryKey);
    markDone(2);
    goNext();
    toast({ title: "Operations saved" });
  };

  const handleAddService = async (d: SvcForm) => {
    await createService.mutateAsync({ data: d });
    invalidate(getListServicesQueryKey);
    toast({ title: `Service "${d.name}" added` });
  };

  const handleSaveService = async (id: number, d: SvcForm) => {
    await updateService.mutateAsync({ id, data: d });
    invalidate(getListServicesQueryKey);
  };

  const handleDeleteService = async (id: number) => {
    await deleteService.mutateAsync({ id });
    invalidate(getListServicesQueryKey);
    toast({ title: "Service deleted" });
  };

  const handleNext3 = () => { markDone(3); goNext(); };

  const handleSave4 = async (d: S4) => {
    await savePricing.mutateAsync({ data: d });
    invalidate(getGetPricingQueryKey);
    markDone(4);
    goNext();
    toast({ title: "Pricing saved" });
  };

  const handleAiDraft = async (field: string, current: string): Promise<string> => {
    const result = await aiDraft.mutateAsync({ data: { field, currentValue: current || undefined } });
    return result.wording;
  };

  const handleSave5 = async (p: S5Policies, e: S5Estimate, required: string[], questions: string[]) => {
    await Promise.all([
      savePolicies.mutateAsync({ data: p }),
      saveEstimate.mutateAsync({ data: { ...e, requiredInfoBeforeQuoting: required, bdaQuestionsToAsk: questions } }),
    ]);
    invalidate(getGetBusinessPoliciesQueryKey, getGetEstimateRulesQueryKey);
    markDone(5);
    goNext();
    toast({ title: "Policies & estimate rules saved" });
  };

  const handleSaveTone = async (toneOpts: string[], use: string[], avoid: string[], voice: string) => {
    await saveTone.mutateAsync({ data: { toneOptions: toneOpts, phrasesToUse: use, phrasesToAvoid: avoid, brandVoice: voice } });
    invalidate(getGetBusinessToneQueryKey);
    toast({ title: "Tone saved" });
  };

  const handleConfirm = async () => {
    await confirmProfile.mutateAsync(undefined);
    invalidate(getGetBusinessQueryKey, getGetMeQueryKey);
    markDone(6);
    toast({ title: "Business Profile confirmed!", description: "Next onboarding steps are now unlocked." });
  };

  if (isLoading) return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="flex gap-2">{STEPS.map((_, i) => <Skeleton key={i} className="h-8 flex-1" />)}</div>
      <Skeleton className="h-[500px]" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Business Profile</h2>
        <p className="text-slate-500 text-sm mt-1">Complete all 6 steps to activate your BDA.</p>
      </div>
      <WizardProgress step={step} completedSteps={completed} onJump={setStep} />
      <BdaHelperCard />
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 py-4">
          <CardTitle className="text-base">Step {step}: {STEPS[step - 1]}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {step === 1 && <Step1 biz={biz} onSave={handleSave1} />}
          {step === 2 && <Step2 ops={ops} onSave={handleSave2} onBack={goBack} />}
          {step === 3 && (
            <Step3
              services={services}
              onSave={handleSaveService}
              onDelete={handleDeleteService}
              onAdd={handleAddService}
              onBack={goBack}
              onNext={handleNext3}
            />
          )}
          {step === 4 && <Step4 pricing={pricing} onSave={handleSave4} onBack={goBack} />}
          {step === 5 && (
            <Step5
              policies={policies}
              estimateRules={estimateRules}
              onSave={handleSave5}
              onBack={goBack}
              aiDraft={handleAiDraft}
            />
          )}
          {step === 6 && (
            <Step6
              biz={biz}
              ops={ops}
              services={services}
              pricing={pricing}
              policies={policies}
              tone={tone}
              onSaveTone={handleSaveTone}
              onConfirm={handleConfirm}
              onBack={goBack}
              onEdit={setStep}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
