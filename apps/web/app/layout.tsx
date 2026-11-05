import type { Metadata, Viewport } from "next";
import { BRAND_COLOR, BRAND_NAME, FAVICONS } from "@/lib/brand";
import "./globals.css";

const DESCRIPTION =
  "Matrícula, pedagogia, avaliação e financeiro em um só lugar, com consentimento e proteção de dados desde o primeiro dia.";

export const metadata: Metadata = {
  title: `${BRAND_NAME} — gestão de escola de futebol`,
  description: DESCRIPTION,
  applicationName: BRAND_NAME,
  manifest: FAVICONS.manifest,
  icons: {
    icon: [
      { url: FAVICONS.png32, sizes: "32x32", type: "image/png" },
      { url: FAVICONS.png16, sizes: "16x16", type: "image/png" },
      { url: FAVICONS.ico, sizes: "any" },
    ],
    shortcut: FAVICONS.ico,
    apple: FAVICONS.apple,
  },
  appleWebApp: {
    capable: true,
    title: BRAND_NAME,
    statusBarStyle: "default",
  },
  openGraph: {
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} — gestão de escola de futebol`,
    description: DESCRIPTION,
    locale: "pt_BR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: BRAND_COLOR,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
