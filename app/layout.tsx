import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PointerProvider } from "./lib/hooks/pointer-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://prism.sammii.dev"),
  title: {
    default: "Prism — cursor-reactive design engineering components",
    template: "%s · Prism",
  },
  description:
    "Cursor-reactive React component library by Sammii Kellow. Spring physics, zero runtime dependencies, one file per component. Every spring and colour tuned by hand.",
  keywords: [
    "react components",
    "ui library",
    "cursor reactive",
    "spring physics",
    "tailwindcss",
    "design engineering",
    "next.js",
  ],
  authors: [{ name: "Sammii Kellow", url: "https://sammii.dev" }],
  creator: "Sammii Kellow",
  openGraph: {
    title: "Prism — cursor-reactive design engineering components",
    description:
      "Spring physics, zero runtime dependencies, one file per component.",
    url: "https://prism.sammii.dev",
    siteName: "Prism",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@technicalyblond",
  },
  alternates: {
    canonical: "https://prism.sammii.dev",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="antialiased bg-[#050505] text-white">
        <PointerProvider>{children}</PointerProvider>
      </body>
    </html>
  );
}
