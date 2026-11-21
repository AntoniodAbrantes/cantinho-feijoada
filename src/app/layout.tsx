import type { Metadata, Viewport } from "next";
import { Anton, Barlow_Condensed } from "next/font/google";
import { SITE } from "@/lib/contato";
import "./globals.css";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const barlow = Barlow_Condensed({ variable: "--font-barlow", weight: ["400", "600", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Cantinho da Feijoada · feijoada delivery em João Pessoa",
  description:
    "Feijoada completa com oito carnes, arroz, couve e farofa, no delivery em João Pessoa. Sexta, sábado e domingo, no almoço. Peça pelo site e pague no Pix.",
  openGraph: {
    title: "Cantinho da Feijoada · feijoada delivery em João Pessoa",
    description: "Dessa vez, o Cantinho vai até você. Feijoada completa no delivery, sexta, sábado e domingo, no almoço.",
    siteName: "Cantinho da Feijoada",
    locale: "pt_BR",
    type: "website",
  },
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
