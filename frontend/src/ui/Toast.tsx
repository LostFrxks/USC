import type { ToastTone } from "../hooks/useToast";

export function Toast({
  text,
  tone,
  visible,
  onClose,
}: {
  text: string;
  tone: ToastTone;
  visible: boolean;
  onClose: () => void;
}) {
  const icon = tone === "success" ? "✓" : tone === "error" ? "!" : "i";

  return (
    <div className={`toast ${visible ? "show" : ""} toast-${tone}`} id="toast" style={{ display: visible ? "grid" : "none" }}>
      <div className="toast-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="toast-text">{text}</div>
      <button className="toast-close" type="button" onClick={onClose} aria-label="Закрыть">
        ×
      </button>
    </div>
  );
}
