import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CdpAppIdProvider } from "./CdpAppIdProvider";
import { ClientErrorBoundary } from "./ClientErrorBoundary";
import GlobalErrorCapture from "./GlobalErrorCapture";
import { WebVitalsReporter } from "./WebVitalsReporter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const site = (process.env.NEXT_PUBLIC_APP_URL ?? "https://linkary.xyz").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Linkary", template: "%s · Linkary" },
  description: "Link-in-bio, verified gigs, and reputation for Web3 creators and projects.",
  icons: {
    icon: "/icons/linkary-icon.png",
    apple: "/icons/linkary-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Linkary",
    locale: "en_US",
    url: site,
    title: "Linkary",
    description: "Link-in-bio, verified gigs, and reputation for Web3 creators and projects.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Linkary",
    description: "Link-in-bio, verified gigs, and reputation for Web3 creators and projects.",
  },
  alternates: { canonical: site },
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
        <CdpAppIdProvider appId={cdpAppId}>
          <WebVitalsReporter />
          <GlobalErrorCapture />
          <ClientErrorBoundary>{children}</ClientErrorBoundary>
        </CdpAppIdProvider>
      </body>
    </html>
  );
}
