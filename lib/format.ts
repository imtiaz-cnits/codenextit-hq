export function formatCurrency(amount: number, currency: string = "BDT"): string {
  if (currency === "BDT") {
    return `৳${Math.round(amount).toLocaleString("en-BD")}`;
  }
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatRelativeDays(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 30) return `in ${diff}d`;
  if (diff < 365) return `in ${Math.round(diff / 30)}mo`;
  return `in ${Math.round(diff / 365)}y`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function avatarColor(seed: string): string {
  const colors = [
    "bg-chart-1/20 text-chart-1",
    "bg-chart-2/20 text-chart-2",
    "bg-chart-3/20 text-chart-3",
    "bg-chart-4/20 text-chart-4",
    "bg-chart-5/20 text-chart-5",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}
