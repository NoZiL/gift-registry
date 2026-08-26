import "./globals.css";

export const metadata = {
  title: "Baby Registry",
  description: "Reserve something from the list",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
