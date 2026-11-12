import { getT } from "@/lib/i18n-server";

// On phones the list (from the layout) fills the screen. With two panes, this fills the right side.
export default async function EmployeesIndex() {
  const { t } = await getT();
  return (
    <div className="card hidden h-full min-h-60 items-center justify-center text-center fold:flex">
      <p className="muted">{t("Choose an employee from the list to see details.", "विवरण देखने के लिए सूची से कर्मचारी चुनें।")}</p>
    </div>
  );
}
