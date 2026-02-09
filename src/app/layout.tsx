import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Podletter",
  description: "Tägliche Newsletter zu deinen Lieblings-Podcasts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
