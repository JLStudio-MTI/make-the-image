import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";
type Toast = { id: string; type: ToastType; title?: string; description?: string; duration: number };

const ToastContext = createContext<{
  push: (t: Omit<Toast, "id">) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, any>>({});

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const toast: Toast = { id, ...t };
    setToasts((prev) => [...prev, toast]);
    timers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
      delete timers.current[id];
    }, toast.duration);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast stack (top-right on desktop, bottom-center on mobile) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[9999] flex justify-center sm:inset-auto sm:right-4 sm:top-4 sm:bottom-auto sm:justify-end">
        <div className="flex w-[92%] max-w-sm flex-col gap-2 sm:w-80">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-xl border p-3 shadow-lg backdrop-blur-sm ${
                t.type === "success"
                  ? "border-emerald-200 bg-emerald-50/90 text-emerald-800"
                  : t.type === "error"
                  ? "border-rose-200 bg-rose-50/90 text-rose-800"
                  : "border-blue-200 bg-blue-50/90 text-blue-800"
              }`}
              role="status"
              onClick={() => dismiss(t.id)}
            >
              {t.title && <div className="text-sm font-semibold">{t.title}</div>}
              {t.description && <div className="mt-0.5 text-xs opacity-90">{t.description}</div>}
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
