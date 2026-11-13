import { router, Stack, useLocalSearchParams } from "expo-router";
import { Card, ErrorView, Loading, Screen } from "@/components/ui";
import { EmployeeForm, employeeBody, type EmployeeValues } from "@/components/EmployeeForm";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLoad } from "@/lib/useLoad";

interface Detail {
  employee: {
    id: string; name: string; code: string; phone: string | null; siteId: string; joinedOn: string;
    wageType: "MONTHLY" | "DAILY"; wage: number; basicPercent: number; pfEnabled: boolean; esiEnabled: boolean; uanNumber: string | null; esicNumber: string | null; customWeeklyOff: boolean; weeklyOffDays: number[];
  };
}

export default function EditEmployee() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, can } = useAuth();
  const { data, error, reload } = useLoad(() => api.get<Detail>(`/api/m/employees/${id}`), [id]);
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const e = data.employee;
  const initial: EmployeeValues = {
    name: e.name, code: e.code, phone: e.phone ?? "", siteId: e.siteId, joinedOn: e.joinedOn, wageType: e.wageType,
    wage: String(e.wage / 100), basicPercent: String(e.basicPercent), pfEnabled: e.pfEnabled, esiEnabled: e.esiEnabled, uanNumber: e.uanNumber ?? "", esicNumber: e.esicNumber ?? "",
    customWeeklyOff: e.customWeeklyOff, weeklyOffDays: e.weeklyOffDays,
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: `Edit · ${e.code}` }} />
      <Card>
        <EmployeeForm
          isNew={false}
          canSalary={can("salary.edit")}
          sites={me?.sites ?? []}
          submitTitle="Save changes"
          initial={initial}
          onSubmit={async (v) => {
            try {
              await api.action("updateEmployee", { id: e.id, ...employeeBody(v, can("salary.edit"), false) });
              router.back();
              return null;
            } catch (err) {
              return (err as Error).message;
            }
          }}
        />
      </Card>
    </Screen>
  );
}
