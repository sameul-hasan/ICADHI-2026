import React from "react";
import clsx from "clsx";

export const Table = ({ children, className, ...props }) => (
  <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
    <table className={clsx("w-full text-left border-collapse text-sm text-slate-600 dark:text-slate-300", className)} {...props}>
      {children}
    </table>
  </div>
);

export const TableHeader = ({ children, className, ...props }) => (
  <thead className={clsx("bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400", className)} {...props}>
    {children}
  </thead>
);

export const TableBody = ({ children, className, ...props }) => (
  <tbody className={clsx("divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-950", className)} {...props}>
    {children}
  </tbody>
);

export const TableRow = ({ children, className, ...props }) => (
  <tr className={clsx("hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors", className)} {...props}>
    {children}
  </tr>
);

export const TableHead = ({ children, className, ...props }) => (
  <th className={clsx("px-6 py-4 font-semibold text-slate-700 dark:text-slate-300 select-none", className)} {...props}>
    {children}
  </th>
);

export const TableCell = ({ children, className, ...props }) => (
  <td className={clsx("px-6 py-4 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium", className)} {...props}>
    {children}
  </td>
);
