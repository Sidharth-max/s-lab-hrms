import { useLocalSearchParams } from "expo-router";
import { EmployeeDetailView } from "@/components/EmployeeDetailView";

export default function EmployeeDetail() {
  const { id, created, tab } = useLocalSearchParams<{ id: string; created?: string; tab?: string }>();
  return <EmployeeDetailView id={id} created={created} initialTab={tab === "ledger" || tab === "hisaab" ? "ledger" : undefined} />;
}
