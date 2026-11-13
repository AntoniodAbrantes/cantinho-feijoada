import type { Metadata, Viewport } from "next";
import { Anton, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/shell";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const barlow = Barlow_Condensed({ variable: "--font-barlow", weight: ["400", "500", "600", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cantinho da Feijoada",
  description: "Gestão do Cantinho da Feijoada",
  appleWebApp: { capable: true, title: "Cantinho", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#15110F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${anton.variable} ${barlow.variable}`}>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
