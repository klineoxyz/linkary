import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in to Linkary",
  description:
    "Sign in to Linkary with X. Claim your handle, create your profile, and add a Coinbase wallet in Settings.",
  openGraph: {
    title: "Sign in to Linkary",
    description:
      "Sign in with X. Claim your handle and create your profile.",
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
