import { HexColorPicker } from "react-colorful";
import { Palette } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const PRESETS = [
  "#1e3a5f",
  "#0f172a",
  "#1d4ed8",
  "#0d9488",
  "#7c3aed",
  "#be185d",
  "#b45309",
  "#1f2937",
];

interface ColorPickerPopoverProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  testId?: string;
}

const VALID_HEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export function ColorPickerPopover({
  value,
  onChange,
  label = "Brand Color",
  testId = "button-color-picker",
}: ColorPickerPopoverProps) {
  const wheelColor = VALID_HEX.test(value) ? value : "#1e3a5f";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div
            className="w-5 h-5 rounded border border-slate-200"
            style={{ backgroundColor: value }}
          />
          {value}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Palette className="h-4 w-4 text-blue-600" />
          {label}
        </div>
        <HexColorPicker
          color={wheelColor}
          onChange={onChange}
          style={{ width: "100%" }}
        />
        <div className="flex items-center gap-2">
          <Input
            value={value}
            className="font-mono"
            data-testid="input-color-hex"
            onChange={(e) => onChange(e.target.value)}
          />
          <div
            className="w-10 h-10 rounded-lg border border-slate-200 shrink-0"
            style={{ backgroundColor: value }}
          />
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-2">Presets</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className="w-7 h-7 rounded-full border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{ backgroundColor: c }}
                onClick={() => onChange(c)}
                data-testid={`preset-${c.replace("#", "")}`}
              />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
