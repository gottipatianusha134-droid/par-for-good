import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { SITE_NAME } from "@/lib/config";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--f-display", weight: ["600", "700", "800"], display: "swap" });
const body = Figtree({ subsets: ["latin"], variable: "--f-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} — play, give, win`, template: `%s · ${SITE_NAME}` },
  description: "Log your golf scores, enter a monthly prize draw, and fund a charity you choose with every subscription.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
