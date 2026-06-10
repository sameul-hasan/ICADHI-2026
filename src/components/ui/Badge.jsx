import React from "react";
import clsx from "clsx";

export const Badge = ({ children, className, variant = "neutral", ...props }) => {
  const baseStyles = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold leading-4 tracking-wide";

  const variants = {
    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 shadow-sm",
    warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 shadow-sm",
    danger: "bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 shadow-sm",
    info: "bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50 shadow-sm",
    primary: "bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 border border-primary-200 dark:border-primary-800/50 shadow-sm",
    neutral: "bg-slate-50 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 shadow-sm"
  };

  return (
    <span
      className={clsx(baseStyles, variants[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
