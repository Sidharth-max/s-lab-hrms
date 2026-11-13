import { usePreventRemove } from "expo-router";
import { useState } from "react";
import { useDialog } from "@/components/dialog";

/**
 * Asks "Discard changes?" when the user leaves a screen (back button, back gesture or header
 * back) while `dirty` is true. Call `allowLeave()` right before navigating away after a save.
 */
export function useUnsavedGuard(dirty: boolean) {
  const dialog = useDialog();
  const [leaving, setLeaving] = useState(false);
  const disable = usePreventRemove(dirty && !leaving, ({ repeat }) => {
    void dialog
      .confirm({ title: "Discard changes?", message: "You have changes that are not saved yet. If you leave now they are lost.", confirmText: "Discard", cancelText: "Keep editing", danger: true })
      .then((ok) => {
        if (!ok) return;
        setLeaving(true);
        repeat();
      });
  });
  return {
    /** Lets the next navigation through (after a successful save). */
    allowLeave: () => {
      setLeaving(true);
      disable();
    },
  };
}
