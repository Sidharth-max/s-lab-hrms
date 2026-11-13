import Link from "next/link";
import { ChevronLeft } from "@/components/icons";

export function BackLink({ href, label, className = "" }: { href: string; label: string; className?: string }) {
  return (
    <Link href={href} className={`no-print inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--text)] ${className}`}>
      <ChevronLeft size={16} aria-hidden />
      {label}
    </Link>
  );
}
