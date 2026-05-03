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
    icon: [
      {
        url: "/icons/pup-seal.png?v=2",
        type: "image/png",
      },
    ],
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
      <head>
        <link rel="icon" href="/icons/pup-seal.png?v=2" type="image/png" />
        <link
          rel="shortcut icon"
          href="/icons/pup-seal.png?v=2"
          type="image/png"
        />
        <link rel="apple-touch-icon" href="/icons/pup-seal.png?v=2" />
      </head>
      <body className="min-h-full flex flex-col text-[var(--foreground)]">
        {children}
      </body>
    </html>
  );
}
