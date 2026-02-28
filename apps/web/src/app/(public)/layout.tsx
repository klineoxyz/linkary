import "@/figma/styles/index.css";
import PublicToaster from "./Toaster";
import { PublicPageBackgroundAccents } from "./PublicPageBackgroundAccents";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <PublicPageBackgroundAccents />
      <div className="relative z-10">
        {children}
      </div>
      <PublicToaster />
    </div>
  );
}
