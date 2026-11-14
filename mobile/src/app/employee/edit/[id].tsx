import { router, useLocalSearchParams } from "expo-router";
import { EditEmployeeView } from "@/components/EmployeeFormViews";

export default function EditEmployee() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditEmployeeView id={id} onSaved={() => router.back()} />;
}
