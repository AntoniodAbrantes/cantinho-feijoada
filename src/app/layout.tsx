import type { Metadata, Viewport } from "next";
import { Anton, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const barlow = Barlow_Condensed({ variable: "--font-barlow", weight: ["400", "500", "600", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cantinho da Feijoada · delivery em João Pessoa",
  description: "Dessa vez, o Cantinho vai até você. Feijoada completa no delivery em João Pessoa, sexta, sábado e domingo, no almoço.",
  openGraph: { title: "Cantinho da Feijoada", description: "Dessa vez, o Cantinho vai até você.", locale: "pt_BR", type: "website" },
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
        {children}
      </body>
    </html>
  );
}
