import jsPDF from "jspdf";
import {
  drawClientAndMeta, drawFooter, drawHeader, drawNotesBlock, drawWatermark,
  formatCurrency, formatDate, hexToRgb, loadLogoDataUrl, MARGIN, MUTED, SLATE, SUCCESS,
} from "./engine";
import type { PdfReceiptInput } from "./types";
import { fetchWorkspaceSettings, type WorkspaceSettings } from "../../hooks/use-workspace-settings";

export async function generateReceiptPdf(
  input: PdfReceiptInput,
  brandingOverride?: WorkspaceSettings,
): Promise<jsPDF> {
  const branding = brandingOverride ?? (await fetchWorkspaceSettings());
  const logo = await loadLogoDataUrl(branding.logo_url);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const primary = hexToRgb(branding.primary_color);
  const receiptNumber = `RCP-${input.invoice.number}`;

  drawHeader(doc, {
    title: "RECEIPT",
    subtitle: receiptNumber,
    status: "PAID",
    branding,
    logoDataUrl: logo,
  });

  // PAID watermark
  drawWatermark(doc, "PAID", SUCCESS);

  const blockY = drawClientAndMeta(doc, input.client, [
    ["Invoice #", input.invoice.number],
    ["Payment date", formatDate(input.paidAt)],
    ["Method", input.paymentMethod || "—"],
    ["Reference", input.reference || "—"],
  ]);

  // Big amount paid card
  const pageW = doc.internal.pageSize.getWidth();
  const cardX = MARGIN;
  const cardW = pageW - MARGIN * 2;
  const cardY = blockY + 12;
  doc.setFillColor(...primary);
  doc.roundedRect(cardX, cardY, cardW, 110, 10, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("AMOUNT RECEIVED", cardX + 24, cardY + 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text(
    formatCurrency(input.amountPaid, input.invoice.currency),
    cardX + 24,
    cardY + 70,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`for ${input.invoice.title}`, cardX + 24, cardY + 92);

  // Status summary
  let y = cardY + 140;
  const balance = Math.max(input.invoice.total - input.invoice.paid_amount, 0);
  doc.setTextColor(...MUTED);
  doc.setFontSize(9.5);
  doc.text("Invoice total", cardX, y);
  doc.setTextColor(...SLATE);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(input.invoice.total, input.invoice.currency), pageW - MARGIN, y, { align: "right" });
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("Total paid to date", cardX, y);
  doc.setTextColor(...SUCCESS);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(input.invoice.paid_amount, input.invoice.currency), pageW - MARGIN, y, { align: "right" });
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("Outstanding balance", cardX, y);
  doc.setTextColor(...SLATE);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(balance, input.invoice.currency), pageW - MARGIN, y, { align: "right" });

  drawNotesBlock(
    doc,
    "ACKNOWLEDGEMENT",
    `We acknowledge receipt of the amount stated above against invoice ${input.invoice.number}. This serves as your official receipt.`,
    y + 32,
  );

  drawFooter(doc, branding);
  return doc;
}

export async function downloadReceiptPdf(input: PdfReceiptInput) {
  const doc = await generateReceiptPdf(input);
  doc.save(`RCP-${input.invoice.number}.pdf`);
}
