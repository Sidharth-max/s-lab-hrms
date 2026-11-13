import { useLocalSearchParams } from "expo-router";
import { DayView } from "@/components/DayView";

export default function DayScreen() {
  const { employeeId, date } = useLocalSearchParams<{ employeeId: string; date: string }>();
  return <DayView employeeId={employeeId} date={date} />;
}
