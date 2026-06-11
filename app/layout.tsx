import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, Roboto_Mono, Noto_Sans_Bengali } from "next/font/google";
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

const bengaliFont = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
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
import NextTopLoader from "nextjs-toploader";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${primaryFont.variable} ${secondaryFont.variable} ${monoFont.variable} ${bengaliFont.variable} antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Anek+Bangla:wght@400;600;700&family=Baloo+Da+2:wght@400;600;700&family=Cinzel:wght@400;600;700&family=Dancing+Script:wght@400;600;700&family=Fira+Code:wght@400;500;600&family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Josefin+Sans:wght@400;600;700&family=Lato:wght@300;400;700&family=Lora:ital,wght@0,400;0,700;1,400&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;600;700&family=Nunito:wght@400;600;700&family=Open+Sans:wght@400;600;700&family=Oswald:wght@400;500;700&family=Outfit:wght@400;600;700;800&family=Pacifico&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Poppins:wght@400;600;700&family=Roboto:wght@400;500;700&family=Source+Code+Pro:wght@400;500;600&family=Ubuntu:wght@400;500;700&family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
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
        <NextTopLoader 
          color="#7c3aed"
          showSpinner={false}
          shadow="0 0 10px #7c3aed,0 0 5px #7c3aed"
        />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
