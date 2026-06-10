import React from "react";
import clsx from "clsx";

export const Badge = ({ children, className, variant = "neutral", ...props }) => {
  const baseStyles = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold leading-4 tracking-wide";

  const variants = {
    success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-900/30",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/30",
    danger: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/50 dark:border-rose-900/30",
    info: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/50 dark:border-sky-900/30",
    primary: "bg-primary-100 text-primary-800 dark:bg-primary-950/60 dark:text-primary-300 border border-primary-200/50 dark:border-primary-900/30",
    neutral: "bg-slate-100 text-slate-800 dark:bg-slate-800/80 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/30"
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
