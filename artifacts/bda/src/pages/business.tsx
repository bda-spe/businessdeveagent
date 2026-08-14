import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useCreateBusiness,
  useGetBusiness,
  useUpdateBusiness,
  useGetBusinessOperations,
  useSaveBusinessOperations,
  useGetBusinessPolicies,
  useSaveBusinessPolicies,
  useAiDraftPolicy,
  useGetEstimateRules,
  useSaveEstimateRules,
  useGetBusinessTone,
  useSaveBusinessTone,
  useConfirmBusinessProfile,
  useListBusinessIndustries,
  useSetBusinessIndustries,
  useRequestUploadUrl,
  getGetBusinessQueryKey,
  getGetMeQueryKey,
  getGetBusinessOperationsQueryKey,
  getGetBusinessPoliciesQueryKey,
  getGetEstimateRulesQueryKey,
  getGetBusinessToneQueryKey,
  getListBusinessIndustriesQueryKey,
} from "@workspace/api-client-react";
import type {
  Business,
  BusinessIndustry,
  BusinessOperations,
  BusinessPolicies,
  EstimateRules,
  BusinessTone,
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Sparkles,
  Pencil,
  X,
  Check,
  Star,
  Search,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const INDUSTRY_GROUPS: { category: string; items: string[] }[] = [
  { category: "Exterior & Property Services", items: ["Landscaping","Lawn Care","Tree Service","Irrigation","Hardscaping","Fence Installation","Deck & Patio Construction","Concrete Services","Asphalt Paving","Parking Lot Striping","Sealcoating","Snow Removal","Junk Removal","Pressure Washing","Gutter Cleaning","Window Cleaning","Exterior Cleaning","Pool Installation","Pool Maintenance","Pest Control"] },
  { category: "Home Improvement & Remodeling", items: ["General Contractor","Home Remodeling","Kitchen Remodeling","Bathroom Remodeling","Basement Finishing","Flooring","Tile Installation","Drywall","Painting","Wallpaper Installation","Cabinet Installation","Countertop Installation","Insulation","Garage Door Services","Handyman Services"] },
  { category: "Roofing & Exterior Construction", items: ["Roofing","Siding","Gutters","Chimney Services","Masonry","Stucco","Window Installation","Door Installation","Solar Installation"] },
  { category: "Mechanical Trades", items: ["HVAC","Plumbing","Electrical","Appliance Repair","Generator Installation","Fire Sprinkler Systems","Elevator Services"] },
  { category: "Cleaning & Restoration", items: ["Residential Cleaning","Commercial Cleaning","Carpet Cleaning","Upholstery Cleaning","Floor Care","Tile & Grout Cleaning","Water Damage Restoration","Mold Remediation","Fire Damage Restoration"] },
  { category: "Automotive & Equipment", items: ["Mobile Auto Detailing","Auto Repair","Mobile Mechanic","Tire Services","Windshield Replacement","Heavy Equipment Repair"] },
  { category: "Specialty Trades", items: ["Welding","Metal Fabrication","Locksmith","Glass Installation","Sign Installation","Scaffolding Services","Moving Company","Hauling Services","Demolition"] },
  { category: "Agriculture & Land", items: ["Excavation","Grading","Septic Services","Well Drilling","Forestry Services","Land Clearing","Farm Services"] },
  { category: "Commercial Services", items: ["Commercial Maintenance","Property Management Maintenance","Building Maintenance","Facility Services","Janitorial Services","Parking Lot Maintenance","Commercial Refrigeration","Warehouse Services"] },
  { category: "Marine & Recreation", items: ["Dock Construction","Boat Repair","Marine Detailing","RV Repair","Trailer Repair"] },
  { category: "Security & Technology", items: ["Security Systems","Low Voltage Wiring","Home Automation","Audio/Video Installation","Network & IT Cabling"] },
  { category: "Other", items: ["Other (Custom)"] },
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
  "Basics","Operations","Policies","Tone & Review",
];
const TOTAL_STEPS = STEPS.length;
const YEAR_NOW = new Date().getFullYear();
const YEARS = Array.from({ length: YEAR_NOW - 1899 }, (_, i) => YEAR_NOW - i);

// ── Helper: IndustryPicker ────────────────────────────────────────────────────

interface PickedIndustry {
  industryCategory: string;
  industryName: string;
  isPrimary: boolean;
}

function IndustryPicker({
  value,
  onChange,
  customIndustry,
  onCustomIndustryChange,
  error,
}: {
  value: PickedIndustry[];
  onChange: (v: PickedIndustry[]) => void;
  customIndustry: string;
  onCustomIndustryChange: (v: string) => void;
  error?: string;
}) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const isSelected = (industryName: string) =>
    value.some((v) => v.industryName === industryName);

  const toggle = (category: string, industryName: string) => {
    if (isSelected(industryName)) {
      const removed = value.filter((v) => v.industryName !== industryName);
      if (removed.length > 0 && !removed.some((v) => v.isPrimary)) {
        removed[0].isPrimary = true;
      }
      onChange(removed);
    } else {
      const isPrimary = value.length === 0;
      onChange([...value, { industryCategory: category, industryName, isPrimary }]);
    }
  };

  const setPrimary = (industryName: string) => {
    onChange(value.map((v) => ({ ...v, isPrimary: v.industryName === industryName })));
  };

  const remove = (industryName: string) => {
    const removed = value.filter((v) => v.industryName !== industryName);
    if (removed.length > 0 && !removed.some((v) => v.isPrimary)) {
      removed[0] = { ...removed[0], isPrimary: true };
    }
    onChange(removed);
  };

  const q = search.toLowerCase();
  const filtered = INDUSTRY_GROUPS
    .map((g) => ({ ...g, items: q ? g.items.filter((i) => i.toLowerCase().includes(q) || g.category.toLowerCase().includes(q)) : g.items }))
    .filter((g) => g.items.length > 0);

  const hasOtherCustom = value.some((v) => v.industryName === "Other (Custom)");

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Select all categories that apply to your business. These help your BDA ask better estimate questions and generate more accurate estimates.
      </p>

      {value.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">Selected ({value.length}) — click ★ to set primary:</p>
          <div className="flex flex-wrap gap-1.5">
            {value.map((v) => (
              <div
                key={v.industryName}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors ${
                  v.isPrimary
                    ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                    : "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                <button type="button" onClick={() => setPrimary(v.industryName)} title="Set as primary">
                  <Star className={`h-3 w-3 ${v.isPrimary ? "fill-white" : "fill-transparent stroke-current"}`} />
                </button>
                <span>{v.industryName}</span>
                <button type="button" onClick={() => remove(v.industryName)} className={v.isPrimary ? "text-white/70 hover:text-white" : "text-slate-400 hover:text-slate-700"}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasOtherCustom && (
        <div className="space-y-1">
          <Label className="text-xs">Describe Your Trade *</Label>
          <Input
            value={customIndustry}
            onChange={(e) => onCustomIndustryChange(e.target.value.replace(/<[^>]*>/g, "").slice(0, 150))}
            placeholder="e.g. Custom Metal Art Fabrication"
            className="text-sm"
          />
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search industries…"
          className="pl-9 text-sm"
        />
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
        {filtered.map((group) => {
          const isOpen = expanded[group.category] ?? false;
          const selectedInGroup = group.items.filter((i) => isSelected(i)).length;
          return (
            <div key={group.category}>
              <button
                type="button"
                onClick={() => setExpanded((p) => ({ ...p, [group.category]: !isOpen }))}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
              >
                <span className="text-sm font-medium text-slate-700">
                  {group.category}
                  {selectedInGroup > 0 && (
                    <span className="ml-2 text-xs bg-[#1e3a5f] text-white rounded-full px-1.5 py-0.5">{selectedInGroup}</span>
                  )}
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="grid sm:grid-cols-2 gap-0 bg-white">
                  {group.items.map((item) => {
                    const selected = isSelected(item);
                    return (
                      <label
                        key={item}
                        className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors text-sm ${selected ? "text-[#1e3a5f] font-medium" : "text-slate-600"}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggle(group.category, item)}
                          className="accent-[#1e3a5f] h-3.5 w-3.5 shrink-0"
                        />
                        {item}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-400 text-center">No results for "{search}"</p>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

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
          <p className="text-sm font-semibold text-[#1e3a5f]">Stuck on a field?</p>
          <p className="text-xs text-slate-500">Tips for filling this out quickly</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-3 pl-11 space-y-1.5 text-xs text-slate-600 list-disc marker:text-blue-300">
          <li>Only the fields marked with * are required to move on — everything else can be filled in later.</li>
          <li>Use the assistant panel on the right if you want help wording anything.</li>
          <li>You can jump back to any completed step using the progress bar above.</li>
        </ul>
      )}
    </div>
  );
}

// ── Nav buttons ───────────────────────────────────────────────────────────────

function StepNav({ step, onBack, saving, saveLabel = "Save & Continue", onSkip }: {
  step: number;
  onBack: () => void;
  saving: boolean;
  saveLabel?: string;
  onSkip?: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-6">
      <Button type="button" variant="outline" onClick={onBack} disabled={step === 1}>
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back
      </Button>
      <div className="flex items-center gap-4">
        {onSkip && (
          <button type="button" onClick={onSkip} className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2">
            Skip for now
          </button>
        )}
        <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#162d4d]">
          {saving ? "Saving…" : saveLabel}
          {!saving && step < TOTAL_STEPS && <ChevronRight className="h-4 w-4 ml-1" />}
        </Button>
      </div>
    </div>
  );
}

// ── Step 1: Basic Business Info ───────────────────────────────────────────────

const s1Schema = z.object({
  name: z.string().min(1, "Business name is required"),
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

const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const LOGO_ACCEPT = ".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml";
const LOGO_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];

function logoSrc(objectPath: string): string {
  return `/api/storage${objectPath}`;
}

function Step1({
  biz,
  initialIndustries,
  onSave,
}: {
  biz: Business | undefined;
  initialIndustries: PickedIndustry[];
  onSave: (d: S1, industries: PickedIndustry[], customIndustry: string, logoUrl: string | null) => Promise<void>;
}) {
  const form = useForm<S1>({ resolver: zodResolver(s1Schema),
    defaultValues: { name: "", website: "", phone: "", email: "", serviceArea: "" } });
  const [saving, setSaving] = useState(false);
  const [industries, setIndustries] = useState<PickedIndustry[]>(initialIndustries);
  const [customIndustry, setCustomIndustry] = useState(biz?.customIndustry ?? "");
  const [industryError, setIndustryError] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(biz?.logoUrl ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const requestUploadUrl = useRequestUploadUrl();

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError("");
    const typeOk = LOGO_ALLOWED_TYPES.includes(file.type) ||
      /\.(png|jpe?g|svg)$/i.test(file.name);
    if (!typeOk) {
      setLogoError("Please upload a PNG, JPG, or SVG image.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError("Logo must be 5 MB or smaller.");
      return;
    }
    setLogoUploading(true);
    try {
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
        data: {
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        },
      });
      const put = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!put.ok) throw new Error("Upload failed");
      setLogoUrl(objectPath);
    } catch {
      setLogoError("Upload failed. Please try again.");
    } finally {
      setLogoUploading(false);
    }
  };

  useEffect(() => {
    setLogoUrl(biz?.logoUrl ?? null);
  }, [biz?.logoUrl]);

  useEffect(() => {
    if (biz) form.reset({
      name: biz.name ?? "",
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

  useEffect(() => {
    setIndustries(initialIndustries);
  }, [initialIndustries.length]);

  useEffect(() => {
    if (biz?.customIndustry) setCustomIndustry(biz.customIndustry);
  }, [biz?.customIndustry]);

  const onSubmit = async (d: S1) => {
    if (industries.length === 0) {
      setIndustryError("Please select at least one industry.");
      return;
    }
    const hasOtherCustom = industries.some((i) => i.industryName === "Other (Custom)");
    if (hasOtherCustom && !customIndustry.trim()) {
      setIndustryError("Please describe your trade for the 'Other (Custom)' selection.");
      return;
    }
    setIndustryError("");
    setSaving(true);
    await onSave(d, industries, customIndustry.trim(), logoUrl).finally(() => setSaving(false));
  };

  const fe = form.formState.errors;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1 sm:col-span-2">
          <Label>Business Name *</Label>
          <Input {...form.register("name")} placeholder="Acme Plumbing Co." />
          {fe.name && <p className="text-xs text-red-500">{fe.name.message}</p>}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Company Logo <span className="text-slate-400 font-normal">(appears on your estimate PDFs)</span></Label>
          <input
            ref={logoInputRef}
            type="file"
            accept={LOGO_ACCEPT}
            className="hidden"
            onChange={handleLogoSelect}
          />
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoSrc(logoUrl)} alt="Company logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-[10px] text-slate-400 text-center px-1">No logo</span>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={logoUploading}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {logoUploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
                </Button>
                {logoUrl && !logoUploading && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => { setLogoUrl(null); setLogoError(""); }}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-400">PNG, JPG, or SVG · up to 5 MB</p>
              {logoError && <p className="text-xs text-red-500">{logoError}</p>}
            </div>
          </div>
        </div>
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
      <div className="space-y-2">
        <Label>Industry & Services Category *</Label>
        <IndustryPicker
          value={industries}
          onChange={(v) => { setIndustries(v); if (v.length > 0) setIndustryError(""); }}
          customIndustry={customIndustry}
          onCustomIndustryChange={setCustomIndustry}
          error={industryError}
        />
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

function Step2({ ops, onSave, onBack, onSkip }: {
  ops: BusinessOperations | undefined;
  onSave: (d: S2, hours: WeekHours) => Promise<void>;
  onBack: () => void;
  onSkip: () => void;
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
      <StepNav step={2} onBack={onBack} saving={saving} onSkip={onSkip} />
    </form>
  );
}

// ── Step 3: Policies & Estimate Rules ─────────────────────────────────────────

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

function Step5({ policies, estimateRules, onSave, onBack, onSkip, aiDraft }: {
  policies: BusinessPolicies | undefined;
  estimateRules: EstimateRules | undefined;
  onSave: (p: S5Policies, e: S5Estimate, required: string[], questions: string[]) => Promise<void>;
  onBack: () => void;
  onSkip: () => void;
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
        <div className="flex items-center gap-4">
          <button type="button" onClick={onSkip} className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2">
            Skip for now
          </button>
          <Button type="button" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#162d4d]"
            onClick={async () => { setSaving(true); await onSave(pols, est, required, questions).finally(() => setSaving(false)); }}>
            {saving ? "Saving…" : "Save & Continue"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Tone & Review ─────────────────────────────────────────────────────

function Step6({ biz, ops, policies, tone, industryCount, onSaveTone, onConfirm, onBack, onEdit }: {
  biz: Business | undefined;
  ops: BusinessOperations | undefined;
  policies: BusinessPolicies | undefined;
  tone: BusinessTone | undefined;
  industryCount: number;
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
          {biz?.primaryIndustry && <p><span className="font-medium">Primary Industry:</span> {biz.primaryIndustry}{industryCount > 1 ? ` + ${industryCount - 1} more` : ""}</p>}
          {biz?.customIndustry && <p><span className="font-medium">Custom:</span> {biz.customIndustry}</p>}
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
        <SectionReview title="Policies" step={3}>
          {policies?.paymentTerms ? <p className="line-clamp-2">{policies.paymentTerms}</p>
            : <p className="text-slate-400">No policies entered</p>}
        </SectionReview>
      </div>
      <Separator />
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700">Two more things to set up after this</p>
        <p className="text-xs text-slate-500 mt-1">
          Your <span className="font-medium">Services</span> and <span className="font-medium">Pricing Rules</span> live on their own pages in the sidebar —
          add them next so your BDA can quote accurately. They only unlock once you confirm below.
        </p>
      </div>
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 space-y-3">
        <p className="font-semibold text-emerald-800">Ready to confirm your Business Profile?</p>
        <p className="text-sm text-emerald-700">This saves everything above and unlocks Services, Pricing Rules, and the rest of your setup in the sidebar.</p>
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
  const { data: me } = useGetMe();
  // A brand-new user has no business row yet — every business-scoped query
  // below 404s until one exists, so they stay disabled until `me.business`
  // shows up (right after Step 1 creates it).
  const hasBusiness = !!me?.business;
  const { data: biz, isLoading: bizLoading } = useGetBusiness({ query: { queryKey: getGetBusinessQueryKey(), enabled: hasBusiness } });
  const { data: ops, isLoading: opsLoading } = useGetBusinessOperations({ query: { queryKey: getGetBusinessOperationsQueryKey(), enabled: hasBusiness } });
  const { data: policies, isLoading: polsLoading } = useGetBusinessPolicies({ query: { queryKey: getGetBusinessPoliciesQueryKey(), enabled: hasBusiness } });
  const { data: estimateRules, isLoading: estLoading } = useGetEstimateRules({ query: { queryKey: getGetEstimateRulesQueryKey(), enabled: hasBusiness } });
  const { data: tone, isLoading: toneLoading } = useGetBusinessTone({ query: { queryKey: getGetBusinessToneQueryKey(), enabled: hasBusiness } });
  const { data: industriesData = [], isLoading: industriesLoading } = useListBusinessIndustries({ query: { queryKey: getListBusinessIndustriesQueryKey(), enabled: hasBusiness } });

  const isFirstTime = !hasBusiness;

  const initialIndustries: PickedIndustry[] = industriesData.map((i: BusinessIndustry) => ({
    industryCategory: i.industryCategory,
    industryName: i.industryName,
    isPrimary: i.isPrimary,
  }));

  // Mutations
  const createBusiness = useCreateBusiness();
  const updateBusiness = useUpdateBusiness();
  const setBusinessIndustries = useSetBusinessIndustries();
  const saveOps = useSaveBusinessOperations();
  const savePolicies = useSaveBusinessPolicies();
  const saveEstimate = useSaveEstimateRules();
  const saveTone = useSaveBusinessTone();
  const aiDraft = useAiDraftPolicy();
  const confirmProfile = useConfirmBusinessProfile();

  const isLoading = !isFirstTime && (bizLoading || opsLoading || polsLoading || estLoading || toneLoading || industriesLoading);

  const markDone = (s: number) => setCompleted((prev) => new Set([...prev, s]));
  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const invalidate = (...keys: (() => readonly unknown[])[]) =>
    keys.forEach((k) => qc.invalidateQueries({ queryKey: k() }));

  const handleSave1 = async (d: S1, industries: PickedIndustry[], customIndustry: string, logoUrl: string | null) => {
    if (!hasBusiness) {
      await createBusiness.mutateAsync({
        data: { ownerName: me?.user?.ownerName || "", businessName: d.name },
      });
    }
    await Promise.all([
      updateBusiness.mutateAsync({ data: { ...d, logoUrl } }),
      setBusinessIndustries.mutateAsync({ data: { industries, customIndustry: customIndustry || undefined } }),
    ]);
    invalidate(getGetBusinessQueryKey, getGetMeQueryKey, getListBusinessIndustriesQueryKey);
    markDone(1);
    goNext();
    toast({ title: "Business info saved" });
  };

  const handleSave2 = async (d: S2, hours: WeekHours) => {
    await saveOps.mutateAsync({ data: { ...d, businessHours: hours } });
    invalidate(getGetBusinessOperationsQueryKey);
    markDone(2);
    goNext();
    toast({ title: "Operations saved" });
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
    markDone(3);
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
    markDone(4);
    toast({ title: "Business Profile confirmed!", description: "Services and Pricing Rules are now unlocked in the sidebar." });
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
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          {isFirstTime ? "Welcome to BDA — let's set up your business" : "Business Profile"}
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          {isFirstTime
            ? "Just the basics to get started — takes about 5 minutes. You can add services and pricing right after."
            : "Keep your business profile up to date so your BDA stays accurate."}
        </p>
      </div>
      <WizardProgress step={step} completedSteps={completed} onJump={setStep} />
      <BdaHelperCard />
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 py-4">
          <CardTitle className="text-base">Step {step} of {TOTAL_STEPS}: {STEPS[step - 1]}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {step === 1 && <Step1 biz={biz} initialIndustries={initialIndustries} onSave={handleSave1} />}
          {step === 2 && <Step2 ops={ops} onSave={handleSave2} onBack={goBack} onSkip={() => { goNext(); }} />}
          {step === 3 && (
            <Step5
              policies={policies}
              estimateRules={estimateRules}
              onSave={handleSave5}
              onBack={goBack}
              onSkip={() => { goNext(); }}
              aiDraft={handleAiDraft}
            />
          )}
          {step === 4 && (
            <Step6
              biz={biz}
              ops={ops}
              policies={policies}
              tone={tone}
              industryCount={initialIndustries.length}
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
