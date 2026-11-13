import { router, usePathname, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Text, TextInput } from "./Text";
import { ArrowUpRight, Search, X } from "./icons";
import { Sheet } from "./Sheet";
import { Avatar, Badge, Muted } from "./ui";
import { api } from "@/lib/api";
import { rs } from "@/lib/format";
import { C } from "@/lib/theme";
import { closeOverlay, useOverlay } from "@/lib/moreSheet";
import { rememberNames } from "@/lib/names";
import { haptic } from "@/lib/haptics";

interface Emp { id: string; name: string; code: string; phone: string | null; site: string; active: boolean; face: boolean; inHouse?: boolean; wage: number; wageType: "MONTHLY" | "DAILY" }

const PAGES: { label: string; href: Href; words: string }[] = [
  { label: "Approvals", href: "/approvals", words: "approve approval waiting otp" },
  { label: "Advances", href: "/advances", words: "advance loan money given" },
  { label: "Leave", href: "/leaves", words: "leave holiday vacation off" },
  { label: "Monthly register", href: "/register", words: "register month grid attendance" },
  { label: "Settings", href: "/settings", words: "settings hours holiday pf esic site branch" },
  { label: "Add employee", href: "/employee/new", words: "add new employee staff hire" },
];

/**
 * One search for the whole app, opened from the round button next to the navigation bar.
 * The search box sits at the BOTTOM of the sheet (thumb zone, right above the keyboard), results
 * fill upwards. Finds people by name, code or mobile, and jumps to pages.
 */
export function SearchSheet() {
  const overlay = useOverlay();
  const path = usePathname();
  const visible = overlay === "search";
  const [q, setQ] = useState("");
  const [emps, setEmps] = useState<Emp[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    api.get<{ employees: Emp[] }>("/api/m/employees").then(
      (r) => { setEmps(r.employees); rememberNames(r.employees); setError(null); },
      (e: Error) => setError(e.message),
    );
  }, [visible]);

  const s = q.trim().toLowerCase();
  const people = useMemo(() => {
    const list = (emps ?? []).filter((e) => !s || e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s) || (e.phone ?? "").includes(s));
    // Working staff first.
    return list.sort((a, b) => Number(b.active) - Number(a.active)).slice(0, s ? 30 : 8);
  }, [emps, s]);
  const pages = s ? PAGES.filter((p) => p.label.toLowerCase().includes(s) || p.words.includes(s)) : [];
  const onSalary = path.startsWith("/salary");

  const openEmp = (e: Emp) => {
    haptic.tap();
    setQ("");
    closeOverlay();
    router.push({ pathname: "/employee/[id]", params: { id: e.id, name: e.name, ...(onSalary ? { tab: "ledger" } : {}) } });
  };

  return (
    <Sheet
      visible={visible}
      onClose={() => { setQ(""); closeOverlay(); }}
      title={onSalary ? "Find someone to pay" : "Search"}
      footer={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderColor: C.brand, borderRadius: 999, backgroundColor: C.card, paddingHorizontal: 16 }}>
          <Search size={20} color={C.brandInk} />
          <TextInput
            value={q}
            onChangeText={setQ}
            autoFocus
            placeholder="Name, code or mobile…"
            placeholderTextColor={C.placeholder}
            returnKeyType="search"
            style={{ flex: 1, minHeight: 52, fontSize: 16, color: C.text }}
            accessibilityLabel="Search"
          />
          {q ? (
            <Pressable onPress={() => setQ("")} hitSlop={10} accessibilityLabel="Clear search">
              <X size={18} color={C.muted} />
            </Pressable>
          ) : null}
        </View>
      }
    >
      {error ? <Muted>{error}</Muted> : null}
      {pages.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {pages.map((p) => (
            <Pressable key={p.label} onPress={() => { closeOverlay(); router.push(p.href); }} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: C.brandSoft }}>
              <Text style={{ color: C.brandInk, fontWeight: "600", fontSize: 14 }}>{p.label}</Text>
              <ArrowUpRight size={16} color={C.brandInk} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.6, color: C.muted, textTransform: "uppercase" }}>{s ? `People · ${people.length}` : "People"}</Text>
      <View style={{ gap: 2, minHeight: 120 }}>
        {emps && people.length === 0 ? <Muted>No one matches “{q}”.</Muted> : null}
        {people.map((e) => (
          <Pressable key={e.id} onPress={() => openEmp(e)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14, backgroundColor: pressed ? C.soft : "transparent" })}>
            <Avatar name={e.name} size={40} muted={!e.active} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }} numberOfLines={1}>{e.name} <Text style={{ color: C.muted, fontWeight: "400" }}>{e.code}</Text></Text>
              <Text style={{ fontSize: 13, color: C.muted }} numberOfLines={1}>{e.site} · <Text style={{ color: C.ink.violet }}>{rs(e.wage)}</Text> {e.wageType === "MONTHLY" ? "/ month" : "/ day"}</Text>
            </View>
            {!e.active ? <Badge label="Archived" /> : null}
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
