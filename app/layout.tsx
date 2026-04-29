import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "../components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <script
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
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
