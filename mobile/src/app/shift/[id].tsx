import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Button, Card, ErrorView, Field, Loading, Notice, Screen, StickyBar } from "@/components/ui";
import { dayFormBody, toDayForms, WeekEditor, type DayForm, type DayRule } from "@/components/WeekEditor";
import { useDialog } from "@/components/dialog";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { useUnsavedGuard } from "@/lib/unsaved";

interface ShiftRow { id: string; name: string; dayRules: DayRule[]; weeklyOffDays: number[]; staff: number }

/** Create (id = "new") or edit a shift: name, per-day times, grace in / out and weekly off. */
export default function ShiftScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload } = useLoad(
    () => Promise.all([api.get<{ shifts: ShiftRow[] }>("/api/m/shifts"), api.get<{ dayRules: DayRule[]; weeklyOffDays: number[] }>("/api/m/settings")]),
    [id],
  );
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const [list, business] = data;
  const shift = id === "new" ? null : list.shifts.find((s) => s.id === id) ?? null;
  if (id !== "new" && !shift) return <ErrorView message="This shift was removed." />;
  return <ShiftForm key={shift?.id ?? "new"} shift={shift} business={business} />;
}

function ShiftForm({ shift, business }: { shift: ShiftRow | null; business: { dayRules: DayRule[]; weeklyOffDays: number[] } }) {
  const dialog = useDialog();
  const [name, setName] = useState(shift?.name ?? "");
  // A new shift starts from the business hours.
  const [days, setDays] = useState<DayForm[]>(() => (shift ? toDayForms(shift.dayRules, shift.weeklyOffDays) : toDayForms(business.dayRules, business.weeklyOffDays)));
  const [initial] = useState(() => JSON.stringify({ name, days }));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { allowLeave } = useUnsavedGuard(!busy && JSON.stringify({ name, days }) !== initial);

  async function save() {
    setBusy("save");
    setError(null);
    try {
      await api.action("saveShift", { ...(shift ? { shiftId: shift.id } : {}), name, ...dayFormBody(days) });
      allowLeave();
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!shift) return;
    const ok = await dialog.confirm({
      title: `Remove ${shift.name}?`,
      message: `Its ${shift.staff} staff go back to the business hours, and their past days are worked out again with those hours.`,
      confirmText: "Remove",
      danger: true,
    });
    if (!ok) return;
    setBusy("remove");
    try {
      await api.action("removeShift", { shiftId: shift.id });
      allowLeave();
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
      <Screen
        footer={
          <StickyBar>
            {error ? <Notice tone="red" text={error} /> : null}
            <Button title={shift ? "Save shift" : "Add shift"} loading={busy === "save"} disabled={!name.trim()} onPress={save} />
          </StickyBar>
        }
      >
        <Stack.Screen options={{ title: shift ? shift.name : "New shift" }} />
        <Card>
          <Field label="Shift name" value={name} onChangeText={setName} placeholder="e.g. Morning, Night" maxLength={40} />
        </Card>
        <Card>
          <WeekEditor days={days} setDays={setDays} />
        </Card>
        {shift ? (
          <Button title="Remove shift" variant="danger" loading={busy === "remove"} onPress={remove} />
        ) : null}
      </Screen>
  );
}
