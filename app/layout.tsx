import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};
import {
  Geist, Geist_Mono, Fraunces,
  Poppins, Playfair_Display, Montserrat, Lato,
  Merriweather, Raleway, Nunito, Oswald, Cormorant_Garamond,
} from "next/font/google";
import { LocaleProvider } from "./lib/LocaleProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["400", "700"], display: "swap" });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], display: "swap" });
const lato = Lato({ variable: "--font-lato", subsets: ["latin"], weight: ["400", "700"], display: "swap" });
const merriweather = Merriweather({ variable: "--font-merriweather", subsets: ["latin"], weight: ["400", "700"], display: "swap" });
const raleway = Raleway({ variable: "--font-raleway", subsets: ["latin"], display: "swap" });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], display: "swap" });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });
const cormorant = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: "LyteApp — Tu negocio. Más liviano. Más rápido.",
  description: "La plataforma todo-en-uno para vender, cobrar y entregar sin fricción. Hecha para emprendedores LATAM.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LyteApp",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${poppins.variable} ${playfair.variable} ${montserrat.variable} ${lato.variable} ${merriweather.variable} ${raleway.variable} ${nunito.variable} ${oswald.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
