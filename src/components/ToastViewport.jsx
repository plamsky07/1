import { useToast } from "../context/ToastState";
import "../styles/Toast.css";

export default function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <article key={toast.id} className={`toast-card toast-card--${toast.type}`}>
          <div className="toast-card__body">
            <strong>{toast.title}</strong>
            <p>{toast.message}</p>
          </div>

          {toast.dismissible && (
            <button type="button" className="toast-card__close" onClick={() => dismissToast(toast.id)}>
              Премахни
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
