// Backward-compatible facade for existing imports.
// New code should import from "@/lib/pdf/invoice" directly.
export { generateInvoicePdf, downloadInvoicePdf } from "./pdf/invoice";
export type { PdfInvoice, PdfClient, PdfLineItem as PdfInvoiceItem } from "./pdf/types";
