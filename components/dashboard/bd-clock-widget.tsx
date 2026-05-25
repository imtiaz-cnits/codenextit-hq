"use client";

import * as React from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Clock, Sun, Moon, Sunrise, Sunset, Coffee, Briefcase, CalendarDays, Flame, Snowflake, Cloud, Droplets, Sparkles, Timer } from "lucide-react";
import { cn } from "../../lib/utils";

const BD_TIMEZONE = "Asia/Dhaka";

const BENGALI_DAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
const BENGALI_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

// Bengali Calendar (Bangladesh) — approximate. Bengali New Year is 14 April (Pohela Boishakh).
const BENGALI_CALENDAR_MONTHS = ["বৈশাখ", "জ্যৈষ্ঠ", "আষাঢ়", "শ্রাবণ", "ভাদ্র", "আশ্বিন", "কার্তিক", "অগ্রহায়ণ", "পৌষ", "মাঘ", "ফাল্গুন", "চৈত্র"];

// Convert English digits to Bengali
const toBengaliNum = (str: string | number): string => {
  const map: Record<string, string> = { "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪", "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯" };
  return String(str).replace(/[0-9]/g, (d) => map[d] || d);
};

// Approximate Bengali calendar conversion (Bangladesh civil calendar, post-1966 reform)
function getBengaliDate(date: Date): { day: number; month: string; year: number; season: string; seasonBn: string; seasonIcon: React.ReactNode } {
  const d = date.getDate();
  const m = date.getMonth() + 1; // 1-12
  const y = date.getFullYear();
  // Bengali year = Gregorian year - 593 (April onwards), - 594 (Jan-March)
  let bnYear = y - 594;
  let bnMonthIdx = 0;
  let bnDay = 0;

  // Bangladesh civil Bengali calendar:
  // Boishakh: 14 Apr - 14 May (31 days)
  // Jyaishtho: 15 May - 14 Jun (31)
  // Asharh: 15 Jun - 15 Jul (31)
  // Shrabon: 16 Jul - 15 Aug (31)
  // Bhadro: 16 Aug - 15 Sep (31)
  // Ashwin: 16 Sep - 15 Oct (30)
  // Kartik: 16 Oct - 14 Nov (30)
  // Agrahayan: 15 Nov - 14 Dec (30)
  // Poush: 15 Dec - 13 Jan (30)
  // Magh: 14 Jan - 12 Feb (30)
  // Falgun: 13 Feb - 14 Mar (30/31 leap)
  // Chaitra: 15 Mar - 13 Apr (30)
  const dayOfYear = (() => {
    const start = new Date(date.getFullYear(), 0, 0);
    return Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  })();

  // Day of Bengali year: from 14 April (= Boishakh 1) of previous Gregorian year (if before 14 April) or current.
  let bnYearStart: Date;
  if (m < 4 || (m === 4 && d < 14)) {
    bnYearStart = new Date(y - 1, 3, 14); // April is month 3
    bnYear = y - 594;
  } else {
    bnYearStart = new Date(y, 3, 14);
    bnYear = y - 593;
  }

  const daysSinceBnNewYear = Math.floor((date.getTime() - bnYearStart.getTime()) / (1000 * 60 * 60 * 24));
  // Cumulative day counts for each Bengali month
  const monthLengths = [31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 30, 30];
  let acc = 0;
  for (let i = 0; i < 12; i++) {
    if (daysSinceBnNewYear < acc + monthLengths[i]) {
      bnMonthIdx = i;
      bnDay = daysSinceBnNewYear - acc + 1;
      break;
    }
    acc += monthLengths[i];
  }

  // Six seasons: Boishakh-Jyaishtho=Grishmo, Asharh-Shrabon=Borsha, Bhadro-Ashwin=Sharot,
  // Kartik-Agrahayan=Hemonto, Poush-Magh=Sheet, Falgun-Chaitra=Boshonto
  const seasonMap = [
    { name: "Summer", bn: "গ্রীষ্ম", icon: <Flame className="h-3 w-3" /> },
    { name: "Summer", bn: "গ্রীষ্ম", icon: <Flame className="h-3 w-3" /> },
    { name: "Monsoon", bn: "বর্ষা", icon: <Droplets className="h-3 w-3" /> },
    { name: "Monsoon", bn: "বর্ষা", icon: <Droplets className="h-3 w-3" /> },
    { name: "Autumn", bn: "শরৎ", icon: <Cloud className="h-3 w-3" /> },
    { name: "Autumn", bn: "শরৎ", icon: <Cloud className="h-3 w-3" /> },
    { name: "Late Autumn", bn: "হেমন্ত", icon: <Cloud className="h-3 w-3" /> },
    { name: "Late Autumn", bn: "হেমন্ত", icon: <Cloud className="h-3 w-3" /> },
    { name: "Winter", bn: "শীত", icon: <Snowflake className="h-3 w-3" /> },
    { name: "Winter", bn: "শীত", icon: <Snowflake className="h-3 w-3" /> },
    { name: "Spring", bn: "বসন্ত", icon: <Sparkles className="h-3 w-3" /> },
    { name: "Spring", bn: "বসন্ত", icon: <Sparkles className="h-3 w-3" /> },
  ];
  const season = seasonMap[bnMonthIdx];

  return {
    day: bnDay,
    month: BENGALI_CALENDAR_MONTHS[bnMonthIdx],
    year: bnYear,
    season: season.name,
    seasonBn: season.bn,
    seasonIcon: season.icon,
  };
}

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
  // Office hours 11 AM - 7 PM (8h)
  if (totalMin < 11 * 60) return { status: "Before Office", icon: <Coffee className="h-3.5 w-3.5" />, color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" };
  if (totalMin >= 11 * 60 && totalMin < 13 * 60) return { status: "Working Hours", icon: <Briefcase className="h-3.5 w-3.5" />, color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
  if (totalMin >= 13 * 60 && totalMin < 14 * 60) return { status: "Lunch Break", icon: <Coffee className="h-3.5 w-3.5" />, color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30" };
  if (totalMin >= 14 * 60 && totalMin < 19 * 60) return { status: "Working Hours", icon: <Briefcase className="h-3.5 w-3.5" />, color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
  return { status: "After Office", icon: <Moon className="h-3.5 w-3.5" />, color: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30" };
}

// Office context: time until office starts/ends, or off-info
function getOfficeContext(hour: number, minute: number, day: number): { label: string; value: string; icon: React.ReactNode } {
  if (day === 5) return { label: "Office Resumes", value: "Tomorrow 11:00 AM", icon: <Sunrise className="h-3.5 w-3.5" /> };
  const totalMin = hour * 60 + minute;
  const fmt = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };
  if (totalMin < 11 * 60) {
    return { label: "Office Starts In", value: fmt(11 * 60 - totalMin), icon: <Timer className="h-3.5 w-3.5" /> };
  }
  if (totalMin < 19 * 60) {
    return { label: "Office Ends In", value: fmt(19 * 60 - totalMin), icon: <Timer className="h-3.5 w-3.5" /> };
  }
  // After office — calculate hours until tomorrow 11 AM
  const tomorrowDay = (day + 1) % 7;
  if (tomorrowDay === 5) {
    return { label: "Weekend Tomorrow", value: "Friday off", icon: <Coffee className="h-3.5 w-3.5" /> };
  }
  return { label: "Tomorrow Office", value: "11:00 AM", icon: <Sunrise className="h-3.5 w-3.5" /> };
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

// Days remaining in month
function getDaysLeftInMonth(date: Date): number {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return last.getDate() - date.getDate();
}

// Quarter info
function getQuarter(date: Date): { quarter: number; daysIntoQuarter: number; totalDays: number } {
  const month = date.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  const qStart = new Date(date.getFullYear(), (quarter - 1) * 3, 1);
  const qEnd = new Date(date.getFullYear(), quarter * 3, 0);
  const daysInto = Math.floor((date.getTime() - qStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const totalDays = Math.floor((qEnd.getTime() - qStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return { quarter, daysIntoQuarter: daysInto, totalDays };
}

export function BdClockWidget({ userName, ongoingHoliday, upcomingHoliday, daysUntilHoliday }: {
  userName?: string;
  ongoingHoliday?: { baseName: string; days: { date: string; name: string }[]; firstDate: string; lastDate: string } | null;
  upcomingHoliday?: { baseName: string; days: { date: string; name: string }[]; firstDate: string; lastDate: string } | null;
  daysUntilHoliday?: number | null;
}) {
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
  const officeCtx = getOfficeContext(hour24, minute, dayIndex);

  // Day progress (% through the day)
  const dayProgressPct = ((hour24 * 3600 + minute * 60 + second) / 86400) * 100;

  // BD-aware Date object for derived calculations
  const bdNow = new Date(now.toLocaleString("en-US", { timeZone: BD_TIMEZONE }));
  const dayOfYear = getDayOfYear(bdNow);
  const weekNum = getWeekNumber(bdNow);
  const bnDate = getBengaliDate(bdNow);

  // BD-aware date string YYYY-MM-DD (for matching holiday days)
  const bdDateStr = (() => {
    const dParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: BD_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const y = dParts.find(p => p.type === "year")?.value || "1970";
    const mo = dParts.find(p => p.type === "month")?.value || "01";
    const d = dParts.find(p => p.type === "day")?.value || "01";
    return `${y}-${mo}-${d}`;
  })();

  return (
    <Card className={cn("overflow-hidden border-2 border-primary/10 shadow-sm")}>
      <div className={cn("h-1 w-full bg-gradient-to-r", greeting.tone)} />
      <CardContent className="p-5 sm:p-6 space-y-5">
        {/* Top row: Greeting + Username + Big Time + Work Status */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("p-2.5 rounded-xl bg-gradient-to-br shrink-0", greeting.tone)}>
              {greeting.icon}
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs uppercase font-bold text-muted-foreground tracking-widest leading-none">{greeting.greeting}</p>
              <p className="text-lg font-semibold leading-none">
                <span className="font-bengali">{greeting.bnGreeting}</span>
                {userName && <span className="text-foreground/80">, {userName}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-baseline gap-2 ml-auto">
            <div className="text-4xl font-bold font-mono tabular-nums text-primary tracking-tight leading-none">
              {String(h12).padStart(2, "0")}
              <span className="animate-pulse text-primary/60">:</span>
              {String(minute).padStart(2, "0")}
            </div>
            <div className="text-base font-mono tabular-nums text-muted-foreground leading-none">
              :{String(second).padStart(2, "0")}
            </div>
            <div className="text-sm font-bold text-muted-foreground leading-none">{ampm}</div>
          </div>

          <Badge variant="outline" className={cn("gap-1.5 text-xs font-bold px-3 py-1.5",
            ongoingHoliday ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" : workStatus.color
          )}>
            {ongoingHoliday ? <Coffee className="h-3.5 w-3.5" /> : workStatus.icon}
            {ongoingHoliday ? "Holiday" : workStatus.status}
          </Badge>
        </div>

        {/* Date row: English + Bengali calendar + Office Context */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/40 border border-muted-foreground/5">
            <CalendarDays className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none">English Calendar</p>
              <p className="text-sm font-semibold truncate leading-none">{weekday}, {month} {day}, {year}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/40 border border-muted-foreground/5">
            <CalendarDays className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none font-bengali">বাংলা ক্যালেন্ডার</p>
              <p className="text-sm font-semibold truncate leading-none font-bengali">
                {BENGALI_DAYS[dayIndex]}, {toBengaliNum(bnDate.day)} {bnDate.month} {toBengaliNum(bnDate.year)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/15">
            <span className="text-primary shrink-0">
              {ongoingHoliday ? <Coffee className="h-4 w-4" /> : (upcomingHoliday ? <CalendarDays className="h-4 w-4" /> : officeCtx.icon)}
            </span>
            <div className="min-w-0 space-y-1">
              {ongoingHoliday ? (
                <>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none">Currently on Holiday</p>
                  <p className="text-sm font-bold truncate leading-none">
                    {ongoingHoliday.baseName}
                    {ongoingHoliday.days.length > 1 && (
                      <span className="text-muted-foreground font-mono ml-1.5 text-xs">
                        Day {ongoingHoliday.days.findIndex(d => d.date.split("T")[0] === bdDateStr) + 1}/{ongoingHoliday.days.length}
                      </span>
                    )}
                  </p>
                </>
              ) : upcomingHoliday && daysUntilHoliday !== null && daysUntilHoliday !== undefined && daysUntilHoliday <= 30 ? (
                <>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none">Next Holiday</p>
                  <p className="text-sm font-bold truncate leading-none">
                    {upcomingHoliday.baseName} <span className="text-muted-foreground font-mono ml-1 text-xs">in {daysUntilHoliday}d</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none">{officeCtx.label}</p>
                  <p className="text-sm font-bold truncate leading-none font-mono tabular-nums">{officeCtx.value}</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Day Progress with timeline markers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="font-semibold">Day Progress</span>
            <span className="font-mono tabular-nums font-bold text-foreground">{dayProgressPct.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-1000 ease-linear"
              style={{ width: `${dayProgressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 pt-0.5">
            <span className="flex items-center gap-1"><Sunrise className="h-3 w-3" /> 12 AM</span>
            <span className="flex items-center gap-1">12 PM <Sun className="h-3 w-3" /></span>
            <span className="flex items-center gap-1">12 AM <Moon className="h-3 w-3" /></span>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-dashed text-[11px] text-muted-foreground">
            <span>Day <span className="font-bold text-foreground font-mono">{dayOfYear}</span> of {year}</span>
            <span>Week <span className="font-bold text-foreground font-mono">{weekNum}</span></span>
            <span className="font-bengali font-bold">{toBengaliNum(year)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressStat({ label, pct, subtitle, bn }: { label: string; pct: number; subtitle: string; bn: string }) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span className="font-semibold">{label}</span>
        <span className="font-mono tabular-nums font-bold text-foreground">{clampedPct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-1000 ease-linear"
          style={{ width: `${clampedPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/80">
        <span className="italic truncate flex-1 mr-2">{subtitle}</span>
        <span className="font-bengali shrink-0">{bn}</span>
      </div>
    </div>
  );
}
