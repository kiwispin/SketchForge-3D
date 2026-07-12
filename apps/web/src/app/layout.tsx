import type { Metadata } from "next";
import { PwaRegistration } from "@/components/PwaRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "SketchForge 3D editor",
  description: "Browser-based SketchForge editor workspace",
  applicationName: "SketchForge 3D",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SketchForge",
    statusBarStyle: "default",
  },
  icons: {
    icon: "assets/sketchforge/sketchforge-logo.png",
    apple: "assets/sketchforge/sketchforge-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
