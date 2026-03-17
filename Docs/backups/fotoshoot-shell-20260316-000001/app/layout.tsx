import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FotoShoot Dashboard",
  description: "Image enhancement and generation workspace for FotoShoot",
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
