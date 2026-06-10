import React from "react";
import clsx from "clsx";

export const Input = React.forwardRef(({
  className,
  type = "text",
  label,
  error,
  icon,
  ...props
}, ref) => {
  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </label>
      )}
      <div className="relative rounded-lg shadow-sm">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={clsx(
            "block w-full border border-slate-355 rounded-lg px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-primary-800 focus:border-primary-800",
            icon && "pl-10",
            error && "border-red-500 focus:ring-red-500 focus:border-red-500",
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <span className="text-xs text-red-500 mt-1 font-medium">{error}</span>
      )}
    </div>
  );
});

Input.displayName = "Input";
export default Input;
