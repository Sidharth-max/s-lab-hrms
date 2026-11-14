import { router } from "expo-router";
import { NewEmployeeView } from "@/components/EmployeeFormViews";

export default function NewEmployee() {
  return <NewEmployeeView onCreated={(id) => router.replace({ pathname: "/employee/[id]", params: { id, created: "1" } })} />;
}
