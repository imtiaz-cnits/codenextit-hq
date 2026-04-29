export interface PdfClient {
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  vat_bin: string | null;
}

export interface PdfLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number | null;
}

export interface PdfInvoice {
  number: string;
  title: string;
  status: string;
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  notes: string | null;
}

export interface PdfQuote {
  number: string;
  title: string;
  status: string;
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  issued_at: string;
  valid_until: string | null;
  notes: string | null;
}

export interface PdfReceiptInput {
  invoice: PdfInvoice;
  client: PdfClient | null;
  amountPaid: number;
  paidAt: string;
  paymentMethod: string;
  reference?: string | null;
}
