import { useLocalSearchParams } from "expo-router";
import { EmployeeDetailView } from "@/components/EmployeeDetailView";

export default function EmployeeDetail() {
  const { id, created, tab, saved } = useLocalSearchParams<{ id: string; created?: string; tab?: string; saved?: string }>();
  return <EmployeeDetailView id={id} created={created} saved={saved} initialTab={tab === "ledger" || tab === "hisaab" ? "ledger" : tab === "attendance" ? "attendance" : undefined} />;
}
