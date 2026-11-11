import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Arapey, Parisienne } from "next/font/google";
import { BABY } from "../lib/site";

// The two typefaces of the faire-part: Parisienne for the script (her name,
// the headings) and Arapey for everything else.
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

export const metadata = {
  title: `Liste de naissance de ${BABY.name}`,
  description: `Bienvenue ${BABY.name} ! Réservez un cadeau de sa liste de naissance.`,
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${script.variable} ${serif.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
