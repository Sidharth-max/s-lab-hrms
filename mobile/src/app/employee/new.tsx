import { router, Stack } from "expo-router";
import { Card, Notice, Screen } from "@/components/ui";
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
  return (
    <Screen>
      <Stack.Screen options={{ title: "Add employee" }} />
      {sites.length === 0 ? <Notice tone="red" text="Add a site first (on the website: Settings)." /> : null}
      <Card>
        <EmployeeForm
          isNew
          canSalary={can("salary.edit")}
          sites={sites}
          submitTitle="Add employee"
          initial={{
            name: "", code: "", phone: "", siteId: sites[0]?.id ?? "", joinedOn: today(), wageType: "MONTHLY", wage: "", basicPercent: "100",
            pfEnabled: false, esiEnabled: false, customWeeklyOff: false, weeklyOffDays: [],
          }}
          onSubmit={async (v) => {
            try {
              const r = await api.post<{ data?: { id?: string } }>("/api/m/employees", employeeBody(v, can("salary.edit"), true));
              if (r.data?.id) router.replace({ pathname: "/employee/[id]", params: { id: r.data.id, created: "1" } });
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
