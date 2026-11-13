import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Toaster } from "@/components/Toaster";
import { ConfirmHost } from "@/components/controls";
import { LeaveGuard } from "@/components/LeaveGuard";

export const metadata: Metadata = {
  title: "S-Lab HRMS",
  description: "Attendance and salary for your staff",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster />
        <ConfirmHost />
        <LeaveGuard />
      </body>
    </html>
  );
}
