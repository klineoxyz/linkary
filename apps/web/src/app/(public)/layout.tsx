import "@/figma/styles/index.css";
import PublicToaster from "./Toaster";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
      <PublicToaster />
    </div>
  );
}
