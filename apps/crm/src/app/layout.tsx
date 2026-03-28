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

const site = (process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.linkary.xyz").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "Linkary CRM",
  description: "Campaign operations and task workspace",
  icons: {
    icon: [{ url: "/icons/linkary-icon.png", type: "image/png", sizes: "any" }],
    apple: [{ url: "/icons/linkary-icon-small.png", type: "image/png" }],
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
