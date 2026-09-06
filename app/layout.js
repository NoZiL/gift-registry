import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "Liste de naissance",
  description: "Réservez un cadeau de la liste",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
