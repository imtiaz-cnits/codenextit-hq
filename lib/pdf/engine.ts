import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "../format";
import type { WorkspaceSettings } from "../../hooks/use-workspace-settings";
import type { PdfClient, PdfLineItem } from "./types";

export type RGB = [number, number, number];
export const SLATE: RGB = [30, 41, 59];
export const MUTED: RGB = [100, 116, 139];
export const LINE: RGB = [226, 232, 240];
export const SUCCESS: RGB = [22, 163, 74];

export function hexToRgb(hex: string): RGB {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [79, 70, 229];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

export const MARGIN = 48;

// Logo image cache (data URL keyed by source URL)
const logoCache = new Map<string, string | null>();

export async function loadLogoDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (logoCache.has(url)) return logoCache.get(url)!;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      logoCache.set(url, null);
      return null;
    }
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    logoCache.set(url, dataUrl);
    return dataUrl;
  } catch {
    logoCache.set(url, null);
    return null;
  }
}

export interface HeaderOptions {
  title: string;
  subtitle: string;
  status: string;
  branding: WorkspaceSettings;
  logoDataUrl: string | null;
}

export function drawHeader(doc: jsPDF, opts: HeaderOptions) {
  const pageW = doc.internal.pageSize.getWidth();
  const primary = hexToRgb(opts.branding.primary_color);
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageW, 90, "F");

  doc.setTextColor(255, 255, 255);

  // Logo on left if available
  if (opts.logoDataUrl) {
    try {
      doc.addImage(opts.logoDataUrl, "PNG", MARGIN, 22, 46, 46);
      const textX = MARGIN + 56;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(opts.branding.company_name, textX, 42);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      if (opts.branding.tagline) doc.text(opts.branding.tagline, textX, 56);
      if (opts.branding.address) doc.text(opts.branding.address, textX, 70);
    } catch {
      drawCompanyText(doc, opts.branding, MARGIN);
    }
  } else {
    drawCompanyText(doc, opts.branding, MARGIN);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text(opts.title, pageW - MARGIN, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(opts.subtitle, pageW - MARGIN, 60, { align: "right" });
  doc.setFontSize(9);
  doc.text(opts.status.toUpperCase(), pageW - MARGIN, 74, { align: "right" });
}

function drawCompanyText(doc: jsPDF, b: WorkspaceSettings, x: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(b.company_name, x, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (b.tagline) doc.text(b.tagline, x, 58);
  if (b.address) doc.text(b.address, x, 72);
}

export function drawClientAndMeta(
  doc: jsPDF,
  client: PdfClient | null,
  metaRows: Array<[string, string]>,
  startY = 130,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const metaX = pageW / 2 + 10;
  let y = startY;

  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("BILL TO", MARGIN, y);
  doc.text("DETAILS", metaX, y);

  y += 16;
  doc.setTextColor(...SLATE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(client?.company_name ?? "—", MARGIN, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  let by = y + 14;
  if (client?.contact_person) { doc.text(client.contact_person, MARGIN, by); by += 12; }
  if (client?.email) { doc.text(client.email, MARGIN, by); by += 12; }
  if (client?.phone) { doc.text(client.phone, MARGIN, by); by += 12; }
  if (client?.address) {
    const addr = doc.splitTextToSize(client.address, 220);
    doc.text(addr, MARGIN, by); by += addr.length * 12;
  }
  if (client?.vat_bin) { doc.text(`VAT/BIN: ${client.vat_bin}`, MARGIN, by); by += 12; }

  // Meta block
  let ry = y + 14;
  for (const [label, value] of metaRows) {
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.text(label, metaX, ry);
    doc.setTextColor(...SLATE);
    doc.setFont("helvetica", "bold");
    doc.text(value, pageW - MARGIN, ry, { align: "right" });
    ry += 14;
  }

  return Math.max(by, ry) + 12;
}

export function drawItemsTable(
  doc: jsPDF,
  items: PdfLineItem[],
  currency: string,
  startY: number,
  headFill: RGB,
): number {
  autoTable(doc, {
    startY,
    head: [["Description", "Qty", "Unit price", "Amount"]],
    body: items.map((it) => [
      it.description,
      String(it.quantity),
      formatCurrency(Number(it.unit_price), currency),
      formatCurrency(Number(it.amount ?? Number(it.quantity) * Number(it.unit_price)), currency),
    ]),
    margin: { left: MARGIN, right: MARGIN },
    styles: { font: "helvetica", fontSize: 9.5, cellPadding: 8, textColor: SLATE, lineColor: LINE, lineWidth: 0.5 },
    headStyles: { fillColor: headFill, textColor: [255, 255, 255], fontStyle: "bold", halign: "left" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 50, halign: "right" },
      2: { cellWidth: 90, halign: "right" },
      3: { cellWidth: 100, halign: "right" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  type WithLast = jsPDF & { lastAutoTable?: { finalY: number } };
  return (doc as WithLast).lastAutoTable?.finalY ?? startY + 40;
}

export interface TotalsRow {
  label: string;
  value: string;
  bold?: boolean;
  color?: RGB;
}

export function drawTotalsBox(
  doc: jsPDF,
  startY: number,
  rows: TotalsRow[],
  pillLabel: string,
  pillValue: string,
  pillColor: RGB,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const boxW = 240;
  const boxX = pageW - MARGIN - boxW;
  let ty = startY;

  for (const r of rows) {
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(r.label, boxX + 10, ty);
    doc.setTextColor(...(r.color ?? SLATE));
    doc.setFont("helvetica", r.bold ? "bold" : "normal");
    doc.text(r.value, boxX + boxW - 10, ty, { align: "right" });
    ty += 16;
  }

  doc.setFillColor(...pillColor);
  doc.roundedRect(boxX, ty, boxW, 32, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(pillLabel, boxX + 10, ty + 20);
  doc.setFontSize(13);
  doc.text(pillValue, boxX + boxW - 10, ty + 20, { align: "right" });

  return ty + 40;
}

export function drawNotesBlock(doc: jsPDF, label: string, body: string | null, startY: number): number {
  if (!body) return startY;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let ny = startY;
  if (ny > pageH - 140) { doc.addPage(); ny = 80; }
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(label, MARGIN, ny);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...SLATE);
  const lines = doc.splitTextToSize(body, pageW - MARGIN * 2);
  doc.text(lines, MARGIN, ny + 14);
  return ny + 14 + lines.length * 12;
}

export function drawFooter(doc: jsPDF, branding: WorkspaceSettings) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const pageH = doc.internal.pageSize.getHeight();
    const footerY = pageH - 40;
    doc.setDrawColor(...LINE);
    doc.line(MARGIN, footerY - 14, pageW - MARGIN, footerY - 14);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const left = [branding.email, branding.website].filter(Boolean).join("  ·  ");
    doc.text(left, MARGIN, footerY);
    doc.text(branding.footer_note ?? "", pageW / 2, footerY, { align: "center" });
    doc.text(`Page ${p} / ${pageCount}`, pageW - MARGIN, footerY, { align: "right" });
  }
}

/** Diagonal watermark stamp across the page. */
export function drawWatermark(doc: jsPDF, text: string, color: RGB) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const gs = doc.GState({ opacity: 0.12 });
  doc.setGState(gs);
  doc.setTextColor(...color);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(120);
  doc.text(text, pageW / 2, pageH / 2, { align: "center", angle: -28, baseline: "middle" });
  doc.setGState(doc.GState({ opacity: 1 }));
}

export { formatCurrency, formatDate };
