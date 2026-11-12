import type { Metadata, Viewport } from "next";
import "./globals.css";
import { UpdateChecker } from "@/components/UpdateChecker";
import { Toaster } from "@/components/Toaster";

export const metadata: Metadata = {
  title: "S-Lab HRMS",
  description: "Attendance and salary for your staff",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f6feb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        {children}
        <UpdateChecker />
        <Toaster />
      </body>
    </html>
  );
}
