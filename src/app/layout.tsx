import type { Metadata, Viewport } from "next";
import "./globals.css";
import { UpdateChecker } from "@/components/UpdateChecker";
import { Toaster } from "@/components/Toaster";
import { LangProvider } from "@/components/LangProvider";
import { getLang } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: "S-Lab HRMS",
  description: "Attendance and salary for your staff",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f6feb",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body className="min-h-dvh antialiased">
        <LangProvider lang={lang}>
          {children}
          <UpdateChecker />
          <Toaster />
        </LangProvider>
      </body>
    </html>
  );
}
