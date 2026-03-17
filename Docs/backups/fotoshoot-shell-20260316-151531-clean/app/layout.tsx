import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FotoShoot",
  description: "AI image direction and enhancement workspace for FotoShoot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
