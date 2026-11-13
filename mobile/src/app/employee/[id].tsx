import { useLocalSearchParams } from "expo-router";
import { EmployeeDetailView } from "@/components/EmployeeDetailView";

export default function EmployeeDetail() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  return <EmployeeDetailView id={id} created={created} />;
}
