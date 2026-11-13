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
  themeColor: "#f3f4f7",
};

const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("hrms.theme");var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";if(d){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#0b0c10")}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <head>
        {/* Sets the theme before the page paints (saved choice, else the device setting): no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster />
        <ConfirmHost />
        <LeaveGuard />
      </body>
    </html>
  );
}
