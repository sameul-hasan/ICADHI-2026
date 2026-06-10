import React from "react";
import clsx from "clsx";

export const Card = ({ children, className, variant = "default", onClick, ...props }) => {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "rounded-xl transition-all duration-300",
        variant === "default" && "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md",
        variant === "glass" && "glass-panel shadow-lg",
        onClick && "cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className, ...props }) => (
  <div className={clsx("p-6 pb-4 border-b border-slate-100 dark:border-slate-800/60", className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className, ...props }) => (
  <h3 className={clsx("text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100", className)} {...props}>
    {children}
  </h3>
);

export const CardContent = ({ children, className, ...props }) => (
  <div className={clsx("p-6", className)} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className, ...props }) => (
  <div className={clsx("p-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end", className)} {...props}>
    {children}
  </div>
);
