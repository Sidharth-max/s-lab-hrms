import { router, Stack } from "expo-router";
import { Card, Loading, Notice, Screen } from "@/components/ui";
import { useLoad } from "@/lib/useLoad";
import { EmployeeForm, employeeBody } from "@/components/EmployeeForm";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function today() {
  const d = new Date(Date.now() + 5.5 * 3600000);
  return d.toISOString().slice(0, 10);
}

export default function NewEmployee() {
  const { me, can } = useAuth();
  const sites = me?.sites ?? [];
  // The server suggests the next free code (E001, E002, …); leaving it empty also works.
  const { data, error } = useLoad(() => api.get<{ nextCode: string }>("/api/m/employees"));
  if (!data && !error) return <Loading />;
  return (
    <Screen>
      <Stack.Screen options={{ title: "Add employee" }} />
      {sites.length === 0 ? <Notice tone="red" text="Add a site first in More > Settings." /> : null}
      <Card>
        <EmployeeForm
          isNew
          canSalary={can("salary.edit")}
          sites={sites}
          submitTitle="Add employee"
          initial={{
            name: "", code: data?.nextCode ?? "", phone: "", siteId: sites[0]?.id ?? "", joinedOn: today(), wageType: "MONTHLY", wage: "", basicPercent: "100",
            pfEnabled: false, esiEnabled: false, customWeeklyOff: false, weeklyOffDays: [], inHouse: false,
          }}
          onSubmit={async (v, allowLeave) => {
            try {
              const r = await api.post<{ data?: { id?: string } }>("/api/m/employees", employeeBody(v, can("salary.edit"), true));
              if (r.data?.id) {
                allowLeave();
                router.replace({ pathname: "/employee/[id]", params: { id: r.data.id, created: "1" } });
              }
              return null;
            } catch (e) {
              return (e as Error).message;
            }
          }}
        />
      </Card>
    </Screen>
  );
}
