import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in to Linkary",
  description:
    "Sign in to Linkary with your Coinbase wallet. Web3 reputation-driven gigs and reviews. No email or password required.",
  openGraph: {
    title: "Sign in to Linkary",
    description:
      "Sign in with your Coinbase wallet. Web3 reputation-driven gigs and reviews.",
    type: "website",
  },
  robots: "index, follow",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
