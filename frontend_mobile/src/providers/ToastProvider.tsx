import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { palette } from "@/ui/theme";

type ToastTone = "info" | "success" | "error";

type ToastContextValue = {
  show(message: string, tone?: ToastTone): void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [text, setText] = useState("");
  const [tone, setTone] = useState<ToastTone>("info");
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, nextTone: ToastTone = "info") => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
    setText(message);
    setTone(nextTone);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    hideTimer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }, 2600);
  }, [opacity]);

  const value = useMemo<ToastContextValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          tone === "success" ? styles.success : tone === "error" ? styles.error : styles.info,
          { opacity },
        ]}
      >
        <Text style={styles.toastText}>{text}</Text>
      </Animated.View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 22,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: palette.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  info: {
    backgroundColor: palette.surfaceStrong,
  },
  success: {
    backgroundColor: palette.primary,
  },
  error: {
    backgroundColor: palette.danger,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
