import jsPDF from "jspdf";
import {
  drawClientAndMeta, drawFooter, drawHeader, drawItemsTable, drawNotesBlock,
  drawTotalsBox, formatCurrency, formatDate, hexToRgb, loadLogoDataUrl,
} from "./engine";
import type { PdfClient, PdfLineItem, PdfQuote } from "./types";
import { fetchWorkspaceSettings, type WorkspaceSettings } from "../../hooks/use-workspace-settings";

export async function generateQuotePdf(
  quote: PdfQuote,
  items: PdfLineItem[],
  client: PdfClient | null,
  brandingOverride?: WorkspaceSettings,
): Promise<jsPDF> {
  const branding = brandingOverride ?? (await fetchWorkspaceSettings());
  const logo = await loadLogoDataUrl(branding.logo_url);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const primary = hexToRgb(branding.primary_color);

  drawHeader(doc, {
    title: "QUOTATION",
    subtitle: quote.number,
    status: quote.status,
    branding,
    logoDataUrl: logo,
  });

  const tableY = drawClientAndMeta(doc, client, [
    ["Issue date", formatDate(quote.issued_at)],
    ["Valid until", quote.valid_until ? formatDate(quote.valid_until) : "—"],
    ["Currency", quote.currency],
    ["Subject", quote.title],
  ]);

  const afterTable = drawItemsTable(doc, items, quote.currency, tableY, primary);

  const totalsEnd = drawTotalsBox(
    doc,
    afterTable + 18,
    [
      { label: "Subtotal", value: formatCurrency(quote.subtotal, quote.currency) },
      { label: `Tax (${quote.tax_rate}%)`, value: formatCurrency(quote.tax_amount, quote.currency) },
    ],
    "GRAND TOTAL",
    formatCurrency(quote.total, quote.currency),
    primary,
  );

  let cursor = drawNotesBlock(doc, "NOTES", quote.notes, totalsEnd + 24);
  cursor = drawNotesBlock(doc, "TERMS & CONDITIONS", branding.terms, cursor + 12);

  drawFooter(doc, branding);
  return doc;
}

export async function downloadQuotePdf(
  quote: PdfQuote,
  items: PdfLineItem[],
  client: PdfClient | null,
) {
  const doc = await generateQuotePdf(quote, items, client);
  doc.save(`${quote.number}.pdf`);
}
