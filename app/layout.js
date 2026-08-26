import "./globals.css";

export const metadata = {
  title: "Liste de naissance",
  description: "Réservez un cadeau de la liste",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
