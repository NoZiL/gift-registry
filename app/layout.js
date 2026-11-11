import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Arapey, Lora, Parisienne } from "next/font/google";
import { BABY } from "../lib/site";

// The two typefaces of the faire-part: Parisienne for the script (her name,
// the headings) and Arapey for the text. Arapey only comes in one weight, so
// anything bold (buttons, labels, item names) is set in Lora, a close serif
// with real bold weights, rather than in browser-faked bold Arapey.
const script = Parisienne({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script",
  display: "swap",
});

const serif = Arapey({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
  display: "swap",
});

// Lora is a variable font: one file covers 400 to 700.
const ui = Lora({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata = {
  title: `Liste de naissance de ${BABY.name}`,
  description: `Bienvenue ${BABY.name} ! Réservez un cadeau de sa liste de naissance.`,
  // A family page, shared by link and QR code: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${script.variable} ${serif.variable} ${ui.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
