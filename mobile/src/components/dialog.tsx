import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Text } from "@/components/Text";
import { CircleAlert, CircleCheck } from "lucide-react-native";
import { C } from "@/lib/theme";
import { Button } from "./ui";

// Our own confirm / message dialogs (instead of Android's system alert boxes).

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface NoticeOptions {
  title: string;
  message?: string;
  tone?: "neutral" | "green" | "red";
  okText?: string;
}

interface DialogApi {
  /** Resolves true when the user presses the confirm button. */
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  /** A message with one OK button. */
  notify: (o: NoticeOptions) => Promise<void>;
}

type State =
  | { kind: "confirm"; o: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "notify"; o: NoticeOptions; resolve: () => void }
  | null;

const Ctx = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(null);
  const current = useRef<State>(null);
  useEffect(() => {
    current.current = state;
  }, [state]);

  const close = useCallback((value: boolean) => {
    const s = current.current;
    setState(null);
    if (s?.kind === "confirm") s.resolve(value);
    if (s?.kind === "notify") s.resolve();
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (o) => new Promise<boolean>((resolve) => setState({ kind: "confirm", o, resolve })),
      notify: (o) => new Promise<void>((resolve) => setState({ kind: "notify", o, resolve })),
    }),
    [],
  );

  const danger = state?.kind === "confirm" && state.o.danger;
  const tone = state?.kind === "notify" ? state.o.tone ?? "neutral" : danger ? "red" : "neutral";

  return (
    <Ctx.Provider value={api}>
      {children}
      <Modal transparent visible={!!state} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => close(false)}>
        <Pressable onPress={() => close(false)} style={{ flex: 1, backgroundColor: "rgba(10,10,10,0.55)", justifyContent: "center", padding: 24 }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.white, borderRadius: 16, padding: 20, gap: 14, width: "100%", maxWidth: 420, alignSelf: "center" }}>
            {state ? (
              <>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tone === "red" ? C.redSoft : tone === "green" ? C.greenSoft : C.soft }}>
                    {tone === "green" ? <CircleCheck size={20} color={C.green} /> : <CircleAlert size={20} color={tone === "red" ? C.red : C.text} />}
                  </View>
                  <View style={{ flex: 1, gap: 4, paddingTop: 6 }}>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: C.text }}>{state.o.title}</Text>
                    {state.o.message ? <Text style={{ fontSize: 14, lineHeight: 20, color: C.muted }}>{state.o.message}</Text> : null}
                  </View>
                </View>
                {state.kind === "confirm" ? (
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}><Button title={state.o.cancelText ?? "Cancel"} variant="secondary" onPress={() => close(false)} /></View>
                    <View style={{ flex: 1 }}><Button title={state.o.confirmText ?? "OK"} variant={state.o.danger ? "danger" : "primary"} onPress={() => close(true)} /></View>
                  </View>
                ) : (
                  <Button title={state.o.okText ?? "OK"} onPress={() => close(true)} />
                )}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Ctx.Provider>
  );
}

export function useDialog() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDialog outside DialogProvider");
  return v;
}
