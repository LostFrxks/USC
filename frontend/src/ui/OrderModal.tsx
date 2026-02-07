import type { ReactNode } from "react";

export default function OrderModal({
  open,
  loading,
  title,
  text,
  children,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  title: string;
  text?: string;
  children?: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  const canClose = !loading;

  return (
    <div
      className="modal-overlay show"
      id="order-modal"
      onClick={(e) => {
        if (!canClose) return;
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="modal">
        <div className="modal-title" id="order-modal-title">
          {title}
        </div>

        <div
          className="modal-spinner"
          id="order-modal-spinner"
          style={{ display: loading ? "block" : "none" }}
        />

        <div className="modal-text" id="order-modal-text">
          {children ?? text ?? ""}
        </div>

        <button
          className={`primary-button modal-close ${loading ? "hidden" : ""}`}
          type="button"
          id="order-modal-close"
          onClick={onClose}
          disabled={!canClose}
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
