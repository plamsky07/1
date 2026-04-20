import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToastContext } from "./ToastState";

const TOAST_STORAGE_KEY = "medlink.active.toasts";

function createId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeToast(input) {
  return {
    id: input.id || createId(),
    type: input.type || "info",
    title: input.title || "",
    message: input.message || "",
    duration: Number(input.duration) > 0 ? Number(input.duration) : 5000,
    dismissible: input.dismissible !== false,
    persistent: Boolean(input.persistent),
    persistentKey: input.persistentKey || "",
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

function readStoredToasts() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(TOAST_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeToast).filter((item) => item.persistent) : [];
  } catch {
    return [];
  }
}

function persistToasts(items) {
  if (typeof window === "undefined") return;

  const persistentItems = items.filter((item) => item.persistent);
  window.localStorage.setItem(TOAST_STORAGE_KEY, JSON.stringify(persistentItems));
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState(() => readStoredToasts());
  const timersRef = useRef(new Map());

  useEffect(() => {
    persistToasts(toasts);
  }, [toasts]);

  useEffect(
    () => () => {
      timersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timersRef.current.clear();
    },
    []
  );

  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((item) => item.id !== toastId));

    const timeoutId = timersRef.current.get(toastId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timersRef.current.delete(toastId);
    }
  }, []);

  const pushToast = useCallback(
    (input) => {
      const nextToast = normalizeToast(input);

      setToasts((prev) => {
        if (
          nextToast.persistent &&
          nextToast.persistentKey &&
          prev.some((item) => item.persistentKey === nextToast.persistentKey)
        ) {
          return prev;
        }

        return [nextToast, ...prev];
      });

      if (!nextToast.persistent) {
        const timeoutId = window.setTimeout(() => {
          dismissToast(nextToast.id);
        }, nextToast.duration);
        timersRef.current.set(nextToast.id, timeoutId);
      }

      return nextToast.id;
    },
    [dismissToast]
  );

  const value = useMemo(
    () => ({
      toasts,
      dismissToast,
      pushToast,
      showSuccess(message, options = {}) {
        return pushToast({
          ...options,
          type: "success",
          title: options.title || "Успешно",
          message,
        });
      },
      showError(message, options = {}) {
        return pushToast({
          ...options,
          type: "error",
          title: options.title || "Възникна проблем",
          message,
        });
      },
      showInfo(message, options = {}) {
        return pushToast({
          ...options,
          type: "info",
          title: options.title || "Информация",
          message,
        });
      },
      showWarning(message, options = {}) {
        return pushToast({
          ...options,
          type: "warning",
          title: options.title || "Внимание",
          message,
        });
      },
    }),
    [dismissToast, pushToast, toasts]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
