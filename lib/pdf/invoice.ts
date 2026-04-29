import jsPDF from "jspdf";
import {
  drawClientAndMeta, drawFooter, drawHeader, drawItemsTable, drawNotesBlock,
  drawTotalsBox, formatCurrency, formatDate, hexToRgb, loadLogoDataUrl, MARGIN, SUCCESS,
} from "./engine";
import type { PdfClient, PdfInvoice, PdfLineItem } from "./types";
import {
  fetchWorkspaceSettings, type WorkspaceSettings,
} from "../../hooks/use-workspace-settings";

export async function generateInvoicePdf(
  invoice: PdfInvoice,
  items: PdfLineItem[],
  client: PdfClient | null,
  brandingOverride?: WorkspaceSettings,
): Promise<jsPDF> {
  const branding = brandingOverride ?? (await fetchWorkspaceSettings());
  const logo = await loadLogoDataUrl(branding.logo_url);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const primary = hexToRgb(branding.primary_color);

  drawHeader(doc, {
    title: "INVOICE",
    subtitle: invoice.number,
    status: invoice.status,
    branding,
    logoDataUrl: logo,
  });

  const tableY = drawClientAndMeta(doc, client, [
    ["Issue date", formatDate(invoice.issued_at)],
    ["Due date", invoice.due_at ? formatDate(invoice.due_at) : "—"],
    ["Currency", invoice.currency],
    ["Project", invoice.title],
  ]);

  const afterTable = drawItemsTable(doc, items, invoice.currency, tableY, primary);

  const balance = Math.max(invoice.total - invoice.paid_amount, 0);
  const totalsEnd = drawTotalsBox(
    doc,
    afterTable + 18,
    [
      { label: "Subtotal", value: formatCurrency(invoice.subtotal, invoice.currency) },
      { label: `Tax (${invoice.tax_rate}%)`, value: formatCurrency(invoice.tax_amount, invoice.currency) },
      { label: "Total", value: formatCurrency(invoice.total, invoice.currency), bold: true },
      { label: "Paid", value: formatCurrency(invoice.paid_amount, invoice.currency), color: SUCCESS },
    ],
    "BALANCE DUE",
    formatCurrency(balance, invoice.currency),
    primary,
  );

  let cursor = drawNotesBlock(doc, "NOTES", invoice.notes, totalsEnd + 24);
  cursor = drawNotesBlock(doc, "PAYMENT INSTRUCTIONS", branding.payment_instructions, cursor + 12);

  drawFooter(doc, branding);
  return doc;
}

export async function downloadInvoicePdf(
  invoice: PdfInvoice,
  items: PdfLineItem[],
  client: PdfClient | null,
) {
  const doc = await generateInvoicePdf(invoice, items, client);
  doc.save(`${invoice.number}.pdf`);
}
