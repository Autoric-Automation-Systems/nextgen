import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NextGen — gestão de escola de futebol",
  description:
    "Matrícula, pedagogia, avaliação e financeiro em um só lugar, com consentimento e proteção de dados desde o primeiro dia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
