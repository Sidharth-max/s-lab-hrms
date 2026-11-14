import { Stack } from "expo-router";
import { Pressable, View } from "react-native";
import { Text } from "./Text";
import { X } from "./icons";
import { Card, ErrorView, Loading, Notice, Screen } from "./ui";
import { EmployeeForm, employeeBody, type EmployeeValues } from "./EmployeeForm";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLoad } from "@/lib/useLoad";
import { C } from "@/lib/theme";

/**
 * Add / edit employee. Used as its own screen on phones, and inside the right-hand panel next to
 * the employee list on an open Fold / tablet (embedded), so the whole flow stays in that panel.
 */

function today() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
}

/** Title row for the panel version (the screen version uses the navigation header). */
function PaneTitle({ title, onClose }: { title: string; onClose?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text style={{ flex: 1, fontSize: 22, fontWeight: "700", color: C.text, letterSpacing: -0.4 }} accessibilityRole="header">{title}</Text>
      {onClose ? (
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.track, alignItems: "center", justifyContent: "center" }}>
          <X size={18} color={C.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function NewEmployeeView({ embedded, onCreated, onClose }: { embedded?: boolean; onCreated: (id: string) => void; onClose?: () => void }) {
  const { me, can } = useAuth();
  const sites = me?.sites ?? [];
  // The server suggests the next free code (E001, E002, …); leaving it empty also works.
  const { data, error } = useLoad(() => api.get<{ nextCode: string }>("/api/m/employees"));
  if (!data && !error) return <Loading />;
  return (
    <Screen>
      {embedded ? <PaneTitle title="Add employee" onClose={onClose} /> : <Stack.Screen options={{ title: "Add employee" }} />}
      {sites.length === 0 ? <Notice tone="red" text="Add a site first in More > Settings." /> : null}
      <Card>
        <EmployeeForm
          isNew
          canSalary={can("salary.edit")}
          sites={sites}
          submitTitle="Add employee"
          initial={{
            name: "", code: data?.nextCode ?? "", phone: "", siteId: sites[0]?.id ?? "", joinedOn: today(), wageType: "MONTHLY", wage: "", cashWage: "", basicPercent: "100",
            pfEnabled: false, esiEnabled: false, customWeeklyOff: false, weeklyOffDays: [], inHouse: false,
          }}
          onSubmit={async (v, allowLeave) => {
            try {
              const r = await api.post<{ data?: { id?: string } }>("/api/m/employees", employeeBody(v, can("salary.edit"), true));
              if (r.data?.id) {
                allowLeave();
                onCreated(r.data.id);
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

interface Detail {
  employee: {
    id: string; name: string; code: string; phone: string | null; siteId: string; joinedOn: string;
    wageType: "MONTHLY" | "DAILY"; wage: number; basicPercent: number; pfEnabled: boolean; esiEnabled: boolean; uanNumber: string | null; esicNumber: string | null; customWeeklyOff: boolean; weeklyOffDays: number[]; inHouse: boolean;
    cashWage?: number; bankAccountName?: string | null; bankAccountNumber?: string | null; bankIfsc?: string | null; bankName?: string | null; bankBranch?: string | null; upiId?: string | null;
  };
}

export function EditEmployeeView({ id, embedded, onSaved, onClose }: { id: string; embedded?: boolean; onSaved: () => void; onClose?: () => void }) {
  const { me, can } = useAuth();
  const { data, error, reload } = useLoad(() => api.get<Detail>(`/api/m/employees/${id}`), [id]);
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const e = data.employee;
  const initial: EmployeeValues = {
    name: e.name, code: e.code, phone: e.phone ?? "", siteId: e.siteId, joinedOn: e.joinedOn, wageType: e.wageType,
    wage: String((e.wage - (e.cashWage ?? 0)) / 100), cashWage: e.cashWage ? String(e.cashWage / 100) : "", basicPercent: String(e.basicPercent),
    bankAccountName: e.bankAccountName ?? "", bankAccountNumber: e.bankAccountNumber ?? "", bankAccountNumber2: e.bankAccountNumber ?? "", bankIfsc: e.bankIfsc ?? "", upiId: e.upiId ?? "",
    bankName: e.bankName ? `${e.bankName}${e.bankBranch ? ` · ${e.bankBranch}` : ""}` : "", pfEnabled: e.pfEnabled, esiEnabled: e.esiEnabled, uanNumber: e.uanNumber ?? "", esicNumber: e.esicNumber ?? "",
    customWeeklyOff: e.customWeeklyOff, weeklyOffDays: e.weeklyOffDays, inHouse: e.inHouse,
  };
  return (
    <Screen>
      {embedded ? <PaneTitle title={`Edit · ${e.name}`} onClose={onClose} /> : <Stack.Screen options={{ title: `Edit · ${e.code}` }} />}
      <Card>
        <EmployeeForm
          isNew={false}
          canSalary={can("salary.edit")}
          sites={me?.sites ?? []}
          submitTitle="Save changes"
          initial={initial}
          onSubmit={async (v, allowLeave) => {
            try {
              await api.action("updateEmployee", { id: e.id, ...employeeBody(v, can("salary.edit"), false) });
              allowLeave();
              onSaved();
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
