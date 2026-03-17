import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://fotoshoot.cloud"),
  title: "FotoShoot | AI Product Photo Editor & Resize Images for Instagram",
  description:
    "FotoShoot helps brands edit product photos, create studio-quality marketing assets, and resize images for Instagram, ads, ecommerce, and campaign content.",
  icons: {
    icon: "/assets/Favicon.png",
  },
  openGraph: {
    title: "FotoShoot | AI Product Photo Editor & Resize Images for Instagram",
    description:
      "Edit product photos, generate polished brand visuals, and resize images for Instagram with FotoShoot.",
    url: "https://fotoshoot.cloud",
    siteName: "FotoShoot",
    images: ["/assets/Share.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "FotoShoot | AI Product Photo Editor & Resize Images for Instagram",
    description:
      "Edit product photos, generate polished brand visuals, and resize images for Instagram with FotoShoot.",
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
