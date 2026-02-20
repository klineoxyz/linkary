import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CdpAppIdProvider } from "./CdpAppIdProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Linkary",
  description: "Web3 reputation-driven gigs and reviews",
  icons: {
    icon: "/icons/linkary-icon.png",
    apple: "/icons/linkary-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cdpAppId = process.env.NEXT_PUBLIC_CDP_APP_ID ?? "";
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <CdpAppIdProvider appId={cdpAppId}>{children}</CdpAppIdProvider>
      </body>
    </html>
  );
}
