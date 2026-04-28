import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "PUP FOCUS",
  description:
    "Faculty Online Compliance and Uploading System for Efficient Academic Document Management",
  icons: {
    icon: "/icons/pngkey.com-phillies-logo-png-528919.png",
    shortcut: "/icons/pngkey.com-phillies-logo-png-528919.png",
    apple: "/icons/pngkey.com-phillies-logo-png-528919.png",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col text-[var(--foreground)]">
        {children}
      </body>
    </html>
  );
}
