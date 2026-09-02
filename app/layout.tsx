import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};
import {
  Geist, Geist_Mono, Fraunces,
  Poppins, Playfair_Display, Montserrat, Lato,
  Merriweather, Raleway, Nunito, Oswald, Cormorant_Garamond,
  Inter, Roboto, DM_Sans, Work_Sans, Manrope, Outfit,
  Space_Grotesk, Quicksand, Josefin_Sans, Bebas_Neue,
  Libre_Baskerville, Caveat, Abril_Fatface, Fredoka,
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

const inter          = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const roboto          = Roboto({ variable: "--font-roboto", subsets: ["latin"], weight: ["400", "500", "700"], display: "swap" });
const dmSans          = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], display: "swap" });
const workSans        = Work_Sans({ variable: "--font-work-sans", subsets: ["latin"], display: "swap" });
const manrope         = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });
const outfit          = Outfit({ variable: "--font-outfit", subsets: ["latin"], display: "swap" });
const spaceGrotesk    = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], display: "swap" });
const quicksand       = Quicksand({ variable: "--font-quicksand", subsets: ["latin"], display: "swap" });
const josefinSans     = Josefin_Sans({ variable: "--font-josefin-sans", subsets: ["latin"], display: "swap" });
const bebasNeue       = Bebas_Neue({ variable: "--font-bebas-neue", subsets: ["latin"], weight: "400", display: "swap" });
const libreBaskerville = Libre_Baskerville({ variable: "--font-libre-baskerville", subsets: ["latin"], weight: ["400", "700"], display: "swap" });
const caveat          = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["400", "700"], display: "swap" });
const abrilFatface    = Abril_Fatface({ variable: "--font-abril-fatface", subsets: ["latin"], weight: "400", display: "swap" });
const fredoka          = Fredoka({ variable: "--font-fredoka", subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: "LyteApp — Tu negocio. Más liviano. Más rápido.",
  description: "La plataforma todo-en-uno para vender, cobrar y entregar sin fricción. Hecha para emprendedores LATAM.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
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
  // data-scroll-behavior: Next 16 no longer forces scroll-behavior:auto during
  // route transitions, so the landing's `html { scroll-behavior: smooth }` would
  // animate the scroll-to-top on every navigation. This hands that control back
  // to Next while leaving smooth scrolling intact for the landing's anchor links.
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${poppins.variable} ${playfair.variable} ${montserrat.variable} ${lato.variable} ${merriweather.variable} ${raleway.variable} ${nunito.variable} ${oswald.variable} ${cormorant.variable} ${inter.variable} ${roboto.variable} ${dmSans.variable} ${workSans.variable} ${manrope.variable} ${outfit.variable} ${spaceGrotesk.variable} ${quicksand.variable} ${josefinSans.variable} ${bebasNeue.variable} ${libreBaskerville.variable} ${caveat.variable} ${abrilFatface.variable} ${fredoka.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
