import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import clsx from "clsx";

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "success", duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Render Node */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const icons = {
            success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
            error: <AlertCircle className="h-5 w-5 text-rose-500" />,
            warning: <AlertCircle className="h-5 w-5 text-amber-500" />,
            info: <Info className="h-5 w-5 text-sky-500" />
          };

          const borders = {
            success: "border-emerald-100 dark:border-emerald-950 bg-emerald-50/90 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300",
            error: "border-rose-100 dark:border-rose-950 bg-rose-50/90 dark:bg-rose-950/20 text-rose-900 dark:text-rose-300",
            warning: "border-amber-100 dark:border-amber-950 bg-amber-50/90 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300",
            info: "border-sky-100 dark:border-sky-950 bg-sky-50/90 dark:bg-sky-950/20 text-sky-900 dark:text-sky-300"
          };

          return (
            <div
              key={toast.id}
              className={clsx(
                "flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-lg pointer-events-auto transition-all duration-300 animate-scale-in",
                borders[toast.type]
              )}
            >
              <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
              <div className="flex-1 text-sm font-medium leading-5">{toast.message}</div>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 p-0.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
