import React from "react";
import clsx from "clsx";

export const Button = ({
  children,
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  type = "button",
  onClick,
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 btn-transition";

  const variants = {
    primary: "bg-gradient-to-tr from-primary-600 to-primary-500 text-white hover:from-primary-500 hover:to-primary-400 focus:ring-primary-500 shadow-md hover:shadow-xl hover:-translate-y-0.5 dark:from-primary-500 dark:to-primary-600",
    secondary: "bg-gradient-to-tr from-secondary-600 to-secondary-500 text-white hover:from-secondary-500 hover:to-secondary-400 focus:ring-secondary-400 shadow-md hover:shadow-xl hover:-translate-y-0.5",
    accent: "bg-gradient-to-tr from-accent-600 to-accent-500 text-white hover:from-accent-500 hover:to-accent-400 focus:ring-accent-400 shadow-md hover:shadow-xl hover:-translate-y-0.5",
    outline: "border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 focus:ring-slate-400 shadow-sm hover:shadow-md hover:-translate-y-0.5",
    ghost: "bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-slate-400 hover:-translate-y-0.5",
    danger: "bg-gradient-to-tr from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400 focus:ring-rose-400 shadow-md hover:shadow-xl hover:-translate-y-0.5"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs font-semibold",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={clsx(
        baseStyles,
        variants[variant],
        sizes[size],
        loading && "relative text-transparent select-none",
        className
      )}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <svg className="animate-spin h-5 w-5 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </span>
      )}
      {children}
    </button>
  );
};

export default Button;
