import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "../components/providers";

const primaryFont = Bricolage_Grotesque({
  variable: "--font-primary",
  subsets: ["latin"],
  display: "swap",
});

const secondaryFont = Inter({
  variable: "--font-secondary",
  subsets: ["latin"],
  display: "swap",
});

const monoFont = Roboto_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "CodeNext IT HQ",
  description: "Ultimate ERP for IT agencies: CRM, projects, infrastructure, HR, finance, and client portal.",
  openGraph: {
    title: "CodeNext IT HQ",
    description: "Ultimate ERP for IT agencies: CRM, projects, infrastructure, HR, finance, and client portal.",
    type: "website",
    images: ["https://storage.googleapis.com/gpt-engineer-file-uploads/hrBvWz9fhEd67msHvzSL6rJ3Sb52/social-images/social-1777009682468-cnits-logo-main.webp"],
  },
  twitter: {
    card: "summary_large_image",
    title: "CodeNext IT HQ",
    description: "Ultimate ERP for IT agencies: CRM, projects, infrastructure, HR, finance, and client portal.",
    images: ["https://storage.googleapis.com/gpt-engineer-file-uploads/hrBvWz9fhEd67msHvzSL6rJ3Sb52/social-images/social-1777009682468-cnits-logo-main.webp"],
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
};

import Script from "next/script";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${primaryFont.variable} ${secondaryFont.variable} ${monoFont.variable} antialiased`}
    >
      <head>
        <Script
          id="theme-detection"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('codenext-theme');
                  if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  if (t === 'dark') document.documentElement.classList.add('dark');
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
