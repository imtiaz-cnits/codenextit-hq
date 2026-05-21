"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "../../lib/utils";

interface FlatTimePickerProps {
  value: string;           // HH:MM (24h)
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

const HOURS   = Array.from({ length: 12 }, (_, i) => String(i === 0 ? 12 : i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function nowHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function to12h(hhmm: string): { hh: string; mm: string; ampm: "AM" | "PM" } {
  if (!hhmm) {
    const t = to12h(nowHHMM());
    return t;
  }
  const [hStr, mStr] = hhmm.split(":");
  let h = parseInt(hStr) || 0;
  const m = parseInt(mStr) || 0;
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return { hh: String(h).padStart(2, "0"), mm: String(m).padStart(2, "0"), ampm };
}

function to24h(hh: string, mm: string, ampm: "AM" | "PM"): string {
  let h = parseInt(hh) || 12;
  if (ampm === "AM" && h === 12) h = 0;
  if (ampm === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${mm}`;
}

function formatDisplay(hhmm: string): string {
  if (!hhmm) return "";
  const { hh, mm, ampm } = to12h(hhmm);
  return `${hh}:${mm} ${ampm}`;
}

export function FlatTimePicker({
  value,
  onChange,
  placeholder = "Pick a time",
  className,
}: FlatTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [manualInput, setManualInput] = React.useState("");
  const [manualMode, setManualMode] = React.useState(false);

  // Auto-seed current time when picker opens with no value
  const handleOpen = (nextOpen: boolean) => {
    if (nextOpen && !value) {
      onChange(nowHHMM());
    }
    setOpen(nextOpen);
  };

  const { hh, mm, ampm } = to12h(value || nowHHMM());

  // Refs for scroll columns
  const hourRef = React.useRef<HTMLDivElement>(null);
  const minRef  = React.useRef<HTMLDivElement>(null);
  const hourScrollTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const minScrollTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll selected item into view when panel opens
  React.useEffect(() => {
    if (!open) return;
    const scrollToSelected = (ref: React.RefObject<HTMLDivElement | null>) => {
      const el = ref.current?.querySelector("[data-selected='true']") as HTMLElement | null;
      if (el) el.scrollIntoView({ block: "center", behavior: "instant" });
    };
    setTimeout(() => {
      scrollToSelected(hourRef);
      scrollToSelected(minRef);
    }, 30);
  }, [open]);

  // Auto-select item closest to center when scroll stops
  const handleScrollSnap = (ref: React.RefObject<HTMLDivElement | null>, items: string[], onSelect: (val: string) => void, timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const container = ref.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;
      let closestEl: HTMLElement | null = null;
      let closestDist = Infinity;
      container.querySelectorAll("button").forEach((btn) => {
        const btnRect = btn.getBoundingClientRect();
        const btnCenterY = btnRect.top + btnRect.height / 2;
        const dist = Math.abs(btnCenterY - centerY);
        if (dist < closestDist) {
          closestDist = dist;
          closestEl = btn as HTMLElement;
        }
      });
      if (closestEl) {
        const idx = Array.from(container.querySelectorAll("button")).indexOf(closestEl);
        if (idx >= 0 && idx < items.length) {
          onSelect(items[idx]);
        }
      }
    }, 100);
  };

  const selectHour = (h: string) => onChange(to24h(h, mm, ampm));
  const selectMin  = (m: string) => onChange(to24h(hh, m, ampm));
  const selectAmpm = (ap: "AM" | "PM") => onChange(to24h(hh, mm, ap));

  // Manual input: accept HH:MM or HH:MM AM/PM
  const commitManual = () => {
    const raw = manualInput.trim();
    const match24 = raw.match(/^(\d{1,2}):(\d{2})$/);
    const match12 = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (match24) {
      const h = Math.min(23, parseInt(match24[1]));
      const m = Math.min(59, parseInt(match24[2]));
      onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      setManualMode(false);
      setManualInput("");
    } else if (match12) {
      const h = String(parseInt(match12[1])).padStart(2, "0");
      const m = String(Math.min(59, parseInt(match12[2]))).padStart(2, "0");
      const ap = match12[3].toUpperCase() as "AM" | "PM";
      onChange(to24h(h, m, ap));
      setManualMode(false);
      setManualInput("");
    }
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpen} modal>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm",
            "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-colors",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className={cn("flex-1 text-left", !value && "text-muted-foreground")}>
            {value ? formatDisplay(value) : placeholder}
          </span>
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Content
        sideOffset={4}
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="z-[9999] w-52 rounded-xl border bg-popover shadow-2xl outline-none overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold">Select Time</span>
          </div>
          <div className="text-base font-bold font-mono text-primary tracking-wider">
            {formatDisplay(value || nowHHMM())}
          </div>
        </div>

        {/* Manual input */}
        <div className="px-2 pt-2 pb-1">
          {manualMode ? (
            <div className="flex gap-1.5">
              <input
                autoFocus
                type="text"
                value={manualInput}
                placeholder="e.g. 10:30 PM"
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitManual();
                  if (e.key === "Escape") { setManualMode(false); setManualInput(""); }
                }}
                className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              <button
                type="button"
                onClick={commitManual}
                className="h-7 px-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
              >
                Set
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setManualMode(true); setManualInput(value ? formatDisplay(value) : ""); }}
              className="w-full h-6 rounded-md border border-dashed border-input text-[11px] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              ✏️ Type manually
            </button>
          )}
        </div>

        {/* Scroll columns */}
        <div className="flex items-start justify-center px-2 pb-2 pt-1 gap-1">
          {/* Hours */}
          <div className="flex-1 flex flex-col items-center min-w-0">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5 font-medium">Hr</div>
            <div className="relative w-full h-36">
              {/* Selection marker - perfectly aligned with center item */}
              <div className="pointer-events-none absolute inset-x-0.5 top-1/2 -translate-y-1/2 h-8 rounded-lg bg-primary/15 border border-primary/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.08)_inset] z-0" />
              <div ref={hourRef} className="h-full w-full overflow-y-auto scroll-smooth scrollbar-none" onScroll={() => handleScrollSnap(hourRef, HOURS, selectHour, hourScrollTimer)}>
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    data-selected={h === hh}
                    onClick={() => selectHour(h)}
                    className={cn(
                      "flex h-8 w-full items-center justify-center rounded-md text-xs font-mono transition-colors relative z-10",
                      h === hh ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Colon separator */}
          <div className="flex-none flex items-center self-center text-muted-foreground font-bold text-base select-none" style={{ paddingTop: 18 }}>:</div>

          {/* Minutes */}
          <div className="flex-1 flex flex-col items-center min-w-0">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5 font-medium">Min</div>
            <div className="relative w-full h-36">
              <div className="pointer-events-none absolute inset-x-0.5 top-1/2 -translate-y-1/2 h-8 rounded-lg bg-primary/15 border border-primary/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.08)_inset] z-0" />
              <div ref={minRef} className="h-full w-full overflow-y-auto scroll-smooth scrollbar-none" onScroll={() => handleScrollSnap(minRef, MINUTES, selectMin, minScrollTimer)}>
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-selected={m === mm}
                    onClick={() => selectMin(m)}
                    className={cn(
                      "flex h-8 w-full items-center justify-center rounded-md text-xs font-mono transition-colors relative z-10",
                      m === mm ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* AM / PM */}
          <div className="flex-none flex flex-col items-center justify-center gap-1.5 mt-5">
            {(["AM", "PM"] as const).map((ap) => (
              <button
                key={ap}
                type="button"
                data-selected={ap === ampm}
                onClick={() => selectAmpm(ap)}
                className={cn(
                  "h-8 w-10 rounded-lg text-xs font-bold transition-all",
                  ap === ampm
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {ap}
              </button>
            ))}
          </div>
        </div>

        {/* Done */}
        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full h-7 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  );
}
