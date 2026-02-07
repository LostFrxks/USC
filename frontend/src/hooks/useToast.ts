import { useCallback, useState } from "react";

export type ToastTone = "info" | "success" | "error";

export function useToast() {
  const [text, setText] = useState<string>("");
  const [tone, setTone] = useState<ToastTone>("info");
  const [visible, setVisible] = useState(false);

  const show = useCallback((msg: string, nextTone: ToastTone = "info") => {
    setText(msg);
    setTone(nextTone);
    setVisible(true);
    window.setTimeout(() => setVisible(false), 1800);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  return { text, tone, visible, show, hide };
}
