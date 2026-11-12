"use client";

import { useT } from "./LangProvider";

export function PrintButton() {
  const t = useT();
  return (
    <button type="button" className="btn-secondary" onClick={() => window.print()}>
      {t("Print / Save PDF", "प्रिंट / PDF सेव करें")}
    </button>
  );
}
