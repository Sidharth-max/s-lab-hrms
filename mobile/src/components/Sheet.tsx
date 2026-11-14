import { useEffect, useRef, useState } from "react";
import { Modal, PanResponder, Pressable, View, useWindowDimensions } from "react-native";
import Animated, { Easing, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Text } from "./Text";
import { X } from "./icons";
import { C, shadow } from "@/lib/theme";

/**
 * Bottom sheet used for menus, forms and pickers. Opens from the bottom (thumb zone) and closes on:
 * the Back button / back gesture (Modal onRequestClose), tapping outside, the close button, or
 * dragging the handle down. It never navigates, so Back can never leave the screen or log out.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  maxWidth = 560,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: number;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  // Mount as soon as it should show ("adjust state while rendering"); unmount after the exit animation.
  if (visible && !mounted) setMounted(true);
  const y = useSharedValue(height);
  const fade = useSharedValue(0);
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (visible) {
      closing.current = false;
      y.set(withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
      fade.set(withTiming(1, { duration: 220, reduceMotion: ReduceMotion.System }));
      return;
    }
    const hide = () => setMounted(false);
    y.set(
      withTiming(height, { duration: 220, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.System }, (done) => {
        if (done) runOnJS(hide)();
      }),
    );
    fade.set(withTiming(0, { duration: 200, reduceMotion: ReduceMotion.System }));
  }, [visible, height, y, fade]);

  // The PanResponder is created once; its handlers only read the refs later, during a drag.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const close = () => {
      if (closing.current) return;
      closing.current = true;
      onCloseRef.current();
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        y.set(Math.max(0, g.dy));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 1.1) close();
        else y.set(withTiming(0, { duration: 180, reduceMotion: ReduceMotion.System }));
      },
    });
  });

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    onClose();
  };

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdrop = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(8,10,16,0.5)" }, backdrop]}>
        <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close" />
      </Animated.View>
      {/* paddingTop keeps the sheet below the status bar; with the keyboard open the sheet shrinks
          (flexShrink) and its content scrolls, instead of sliding up under the status bar. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: "flex-end", paddingTop: insets.top + 8 }} pointerEvents="box-none">
        <Animated.View
          style={[
            {
              backgroundColor: C.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingBottom: insets.bottom + 16,
              width: "100%",
              maxWidth,
              alignSelf: "center",
              maxHeight: height * 0.92,
              flexShrink: 1,
              ...shadow(3),
            },
            sheetStyle,
          ]}
        >
          <View {...pan.panHandlers} style={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: title ? 6 : 10 }}>
            <View style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: C.line, marginBottom: 10 }} />
            {title ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ fontSize: 19, fontWeight: "700", color: C.text, letterSpacing: -0.3, flex: 1 }} accessibilityRole="header">{title}</Text>
                <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.track, alignItems: "center", justifyContent: "center" }}>
                  <X size={18} color={C.text} />
                </Pressable>
              </View>
            ) : null}
          </View>
          <Animated.ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, gap: 12 }} style={{ flexGrow: 0, flexShrink: 1 }}>
            {children}
          </Animated.ScrollView>
          {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
