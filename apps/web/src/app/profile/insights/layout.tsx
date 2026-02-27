import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Insights | Linkary",
  robots: { index: false, follow: false },
};

export default function ProfileInsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
