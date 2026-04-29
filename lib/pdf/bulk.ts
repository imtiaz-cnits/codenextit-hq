import { PDFDocument } from "pdf-lib";
import { generateInvoicePdf } from "./invoice";
import { fetchWorkspaceSettings } from "../../hooks/use-workspace-settings";
import type { PdfClient, PdfInvoice, PdfLineItem } from "./types";

export interface BulkInvoiceJob {
  invoice: PdfInvoice;
  items: PdfLineItem[];
  client: PdfClient | null;
}

/** Build each invoice PDF, merge them into a single PDF, return as Blob. */
export async function buildMergedInvoicesPdf(jobs: BulkInvoiceJob[]): Promise<Blob> {
  const branding = await fetchWorkspaceSettings();
  const merged = await PDFDocument.create();

  for (const job of jobs) {
    const doc = await generateInvoicePdf(job.invoice, job.items, job.client, branding);
    const bytes = doc.output("arraybuffer") as ArrayBuffer;
    const part = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(part, part.getPageIndices());
    pages.forEach((p: any) => merged.addPage(p));
  }

  const out = await merged.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
}

/** Build each invoice PDF as a separate file, zip them up, return as Blob. */
export async function buildInvoicesZip(jobs: BulkInvoiceJob[]): Promise<Blob> {
  const [{ default: JSZip }, branding] = await Promise.all([
    import("jszip"),
    fetchWorkspaceSettings(),
  ]);
  const zip = new JSZip();
  for (const job of jobs) {
    const doc = await generateInvoicePdf(job.invoice, job.items, job.client, branding);
    const bytes = doc.output("arraybuffer") as ArrayBuffer;
    zip.file(`${job.invoice.number}.pdf`, bytes);
  }
  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
