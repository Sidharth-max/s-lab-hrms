import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, View } from "react-native";
import { Text, TextInput } from "./Text";
import { ChevronDown as CaretDown, Search as MagnifyingGlass } from "./icons";
import { Avatar } from "./ui";
import { C } from "@/lib/theme";

export interface PickEmployee { id: string; name: string; code: string; site: string }

/** Choose one employee from a searchable sheet. */
export function EmployeePicker({ label = "Employee", employees, value, onChange }: { label?: string; employees: PickEmployee[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const chosen = employees.find((e) => e.id === value);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return employees.filter((e) => !s || e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s));
  }, [employees, q]);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: "500", color: C.muted }}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chosen ? chosen.name : "choose"}`}
        style={({ pressed }) => ({ minHeight: 48, borderWidth: 1, borderColor: "#e4e4e4", borderRadius: 14, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: pressed ? C.soft : C.white })}
      >
        {chosen ? <Avatar name={chosen.name} size={26} /> : null}
        <Text style={{ flex: 1, fontSize: 15, color: chosen ? C.text : "#a3a3a3" }} numberOfLines={1}>{chosen ? `${chosen.name} (${chosen.code})` : "Choose employee…"}</Text>
        <CaretDown size={16} color={C.muted} />
      </Pressable>
      {open ? (
        <Modal transparent visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setOpen(false)}>
          <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(10,10,10,0.55)", justifyContent: "flex-end" }}>
            <Pressable onPress={() => {}} style={{ backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 24, gap: 12, maxHeight: "80%" }}>
              <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: C.line }} />
              <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>Choose employee</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12 }}>
                <MagnifyingGlass size={18} color={C.muted} />
                <TextInput value={q} onChangeText={setQ} placeholder="Search name or code…" placeholderTextColor="#a3a3a3" style={{ flex: 1, minHeight: 44, fontSize: 16, color: C.text }} />
              </View>
              <FlatList
                data={list}
                keyExtractor={(e) => e.id}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={{ color: C.muted, padding: 8 }}>No employee found.</Text>}
                renderItem={({ item: e }) => (
                  <Pressable
                    onPress={() => { onChange(e.id); setOpen(false); setQ(""); }}
                    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14, backgroundColor: e.id === value ? C.soft : pressed ? C.soft : "transparent" })}
                  >
                    <Avatar name={e.name} size={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>{e.name} <Text style={{ color: C.muted, fontWeight: "400" }}>{e.code}</Text></Text>
                      <Text style={{ fontSize: 13, color: C.muted }}>{e.site}</Text>
                    </View>
                  </Pressable>
                )}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
