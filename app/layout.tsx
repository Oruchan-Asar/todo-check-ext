import "./globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ClientLayout from "./ClientLayout";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Routine Check Extension",
  description:
    "Manage your daily routines and sync them with your calendar seamlessly",
  openGraph: {
    title: "Routine Check Extension 📝",
    description:
      "Manage your daily routines and sync them with your calendar seamlessly",
    type: "website",
    url: "https://www.routinest.com",
    siteName: "Routine Check",
    locale: "en_US",
    images: [
      {
        url: "/images/routinest-cover.png",
        width: 128,
        height: 128,
        alt: "Routine Check Extension - Manage your daily routines",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Routine Check Extension 📝",
    description:
      "Manage your daily routines and sync them with your calendar seamlessly",
    images: ["/images/routinest-cover.png"],
    creator: "@oruchanasar",
    site: "@routinest",
  },
  keywords: [
    "routine management",
    "calendar integration",
    "chrome extension",
    "task management",
    "daily routines",
    "productivity",
    "auto sync",
    "routine tracking",
  ],
  authors: [{ name: "Oruchan Asar", url: "https://oruchanasar.com" }],
  category: "Productivity",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <ClientLayout
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh flex flex-col justify-between items-center`}
      >
        {children}
      </ClientLayout>
    </html>
  );
}
