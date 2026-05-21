"use client";

import * as React from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Clock, Sun, Moon, Sunrise, Sunset, Coffee, Briefcase } from "lucide-react";
import { cn } from "../../lib/utils";

const BD_TIMEZONE = "Asia/Dhaka";

const BENGALI_DAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
const BENGALI_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

// Convert English digits to Bengali
const toBengaliNum = (str: string | number): string => {
  const map: Record<string, string> = { "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪", "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯" };
  return String(str).replace(/[0-9]/g, (d) => map[d] || d);
};

// Get time-based greeting and icon
function getGreeting(hour: number): { greeting: string; icon: React.ReactNode; tone: string; bnGreeting: string } {
  if (hour >= 4 && hour < 6) return { greeting: "Early Morning", bnGreeting: "ভোর", icon: <Sunrise className="h-4 w-4" />, tone: "from-amber-200/40 to-orange-200/40 dark:from-amber-500/20 dark:to-orange-500/20" };
  if (hour >= 6 && hour < 12) return { greeting: "Good Morning", bnGreeting: "শুভ সকাল", icon: <Sun className="h-4 w-4" />, tone: "from-amber-300/40 to-yellow-200/40 dark:from-amber-400/20 dark:to-yellow-400/20" };
  if (hour >= 12 && hour < 16) return { greeting: "Good Afternoon", bnGreeting: "শুভ দুপুর", icon: <Sun className="h-4 w-4" />, tone: "from-orange-200/40 to-red-200/40 dark:from-orange-500/20 dark:to-red-500/20" };
  if (hour >= 16 && hour < 19) return { greeting: "Good Evening", bnGreeting: "শুভ বিকাল", icon: <Sunset className="h-4 w-4" />, tone: "from-orange-300/40 to-pink-200/40 dark:from-orange-500/20 dark:to-pink-500/20" };
  if (hour >= 19 && hour < 22) return { greeting: "Good Evening", bnGreeting: "শুভ সন্ধ্যা", icon: <Sunset className="h-4 w-4" />, tone: "from-purple-200/40 to-indigo-200/40 dark:from-purple-500/20 dark:to-indigo-500/20" };
  return { greeting: "Good Night", bnGreeting: "শুভ রাত্রি", icon: <Moon className="h-4 w-4" />, tone: "from-indigo-300/40 to-slate-300/40 dark:from-indigo-600/20 dark:to-slate-600/20" };
}

function getWorkStatus(hour: number, minute: number, day: number): { status: string; icon: React.ReactNode; color: string } {
  // Friday is weekend in Bangladesh (day === 5)
  if (day === 5) return { status: "Weekend", icon: <Coffee className="h-3.5 w-3.5" />, color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" };
  const totalMin = hour * 60 + minute;
  // Office hours typically 9 AM - 6 PM
  if (totalMin < 9 * 60) return { status: "Before Office", icon: <Coffee className="h-3.5 w-3.5" />, color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" };
  if (totalMin >= 9 * 60 && totalMin < 13 * 60) return { status: "Working Hours", icon: <Briefcase className="h-3.5 w-3.5" />, color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
  if (totalMin >= 13 * 60 && totalMin < 14 * 60) return { status: "Lunch Break", icon: <Coffee className="h-3.5 w-3.5" />, color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30" };
  if (totalMin >= 14 * 60 && totalMin < 18 * 60) return { status: "Working Hours", icon: <Briefcase className="h-3.5 w-3.5" />, color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
  return { status: "After Office", icon: <Moon className="h-3.5 w-3.5" />, color: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30" };
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

export function BdClockWidget() {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!now) {
    // SSR-safe placeholder
    return (
      <Card className="overflow-hidden border-2 border-primary/10">
        <CardContent className="p-5 h-[180px]" />
      </Card>
    );
  }

  // Build BD time parts
  const bdParts = new Intl.DateTimeFormat("en-US", {
    timeZone: BD_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(now);

  const get = (type: string) => bdParts.find(p => p.type === type)?.value || "";

  const hour24 = parseInt(get("hour"));
  const minute = parseInt(get("minute"));
  const second = parseInt(get("second"));
  const weekday = get("weekday");
  const day = parseInt(get("day"));
  const month = get("month");
  const year = parseInt(get("year"));

  // 12h format for display
  let h12 = hour24 % 12;
  if (h12 === 0) h12 = 12;
  const ampm = hour24 >= 12 ? "PM" : "AM";

  // Day index 0-6
  const dayIndex = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(weekday);
  const monthIndex = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(month);

  const greeting = getGreeting(hour24);
  const workStatus = getWorkStatus(hour24, minute, dayIndex);

  // Day progress (% through the day)
  const dayProgressPct = ((hour24 * 3600 + minute * 60 + second) / 86400) * 100;

  // Day of year + week
  const bdNow = new Date(now.toLocaleString("en-US", { timeZone: BD_TIMEZONE }));
  const dayOfYear = getDayOfYear(bdNow);
  const weekNum = getWeekNumber(bdNow);

  return (
    <Card className={cn("overflow-hidden border-2 border-primary/10 shadow-sm")}>
      <div className={cn("h-1 w-full bg-gradient-to-r", greeting.tone)} />
      <CardContent className="p-5 space-y-4">
        {/* Top: Greeting + Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={cn("p-2 rounded-lg bg-gradient-to-br", greeting.tone)}>
              {greeting.icon}
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{greeting.greeting}</p>
              <p className="text-sm font-semibold">{greeting.bnGreeting}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("gap-1 text-[10px] font-bold px-2 py-1", workStatus.color)}>
            {workStatus.icon}
            {workStatus.status}
          </Badge>
        </div>

        {/* Big Time Display */}
        <div className="flex items-baseline gap-2">
          <div className="text-4xl font-bold font-mono tabular-nums text-primary tracking-tight">
            {String(h12).padStart(2, "0")}
            <span className="animate-pulse text-primary/60">:</span>
            {String(minute).padStart(2, "0")}
          </div>
          <div className="text-sm font-mono tabular-nums text-muted-foreground">
            :{String(second).padStart(2, "0")}
          </div>
          <div className="text-xs font-bold text-muted-foreground ml-1">{ampm}</div>
          <Badge variant="outline" className="ml-auto text-[9px] font-mono px-1.5 py-0 h-5">BD · UTC+6</Badge>
        </div>

        {/* Date row */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/40 border border-muted-foreground/5">
            <Clock className="h-3 w-3 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">English</p>
              <p className="font-semibold truncate">{weekday}, {month} {day}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/40 border border-muted-foreground/5">
            <Clock className="h-3 w-3 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">বাংলা</p>
              <p className="font-semibold truncate">{BENGALI_DAYS[dayIndex]}, {toBengaliNum(day)} {BENGALI_MONTHS[monthIndex]}</p>
            </div>
          </div>
        </div>

        {/* Day progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
            <span>Day Progress</span>
            <span className="font-mono tabular-nums">{dayProgressPct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-1000 ease-linear"
              style={{ width: `${dayProgressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 pt-1">
            <span className="flex items-center gap-1"><Sunrise className="h-3 w-3" /> 12 AM</span>
            <span className="flex items-center gap-1">12 PM <Sun className="h-3 w-3" /></span>
            <span className="flex items-center gap-1">12 AM <Moon className="h-3 w-3" /></span>
          </div>
        </div>

        {/* Footer stats */}
        <div className="flex items-center justify-between pt-2 border-t border-dashed text-[10px] text-muted-foreground">
          <span>Day <span className="font-bold text-foreground font-mono">{dayOfYear}</span> of {year}</span>
          <span>Week <span className="font-bold text-foreground font-mono">{weekNum}</span></span>
          <span className="font-mono">{toBengaliNum(year)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
