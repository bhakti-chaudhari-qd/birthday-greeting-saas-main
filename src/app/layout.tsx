import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { LocaleHtmlSync } from "@/components/i18n/locale-html-sync";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Birthday Greeting SaaS",
  description: "Multi-tenant birthday and occasion greeting platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <LocaleHtmlSync />
        {children}
      </body>
    </html>
  );
}
