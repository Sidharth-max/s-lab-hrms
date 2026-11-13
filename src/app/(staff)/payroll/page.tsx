import { redirect } from "next/navigation";

// Month-wise salary was replaced by one running balance per employee.
export default function OldPayroll() {
  redirect("/salary");
}
