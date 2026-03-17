import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FotoShoot",
  description: "AI image direction and enhancement workspace for FotoShoot",
  icons: {
    icon: "/assets/Favicon.png",
  },
  openGraph: {
    title: "FotoShoot",
    description: "AI image direction and enhancement workspace for FotoShoot",
    images: ["/assets/Share.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "FotoShoot",
    description: "AI image direction and enhancement workspace for FotoShoot",
    images: ["/assets/Share.png"],
  },
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
