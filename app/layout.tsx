import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import Disclaimer from "@/components/Disclaimer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lupp",
  description:
    "Läser livsmedels- och kosmetikaetiketter och förklarar ingredienserna i klarspråk.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <body>
        <header className="site-header">
          <div className="inner">
            <Link href="/" className="brand">
              <Logo />
              lupp
            </Link>
            <nav className="site-nav">
              <Link href="/">Skanna</Link>
              <Link href="/profil">Profil</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="inner">
            <Disclaimer />
          </div>
        </footer>
      </body>
    </html>
  );
}
