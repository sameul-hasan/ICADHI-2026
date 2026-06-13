import React from 'react';
import { Info } from 'lucide-react';

export const InstructionBanner = ({ title, children, icon: Icon = Info, color = 'blue' }) => {
  const colorVariants = {
    blue: {
      container: 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/60',
      iconBg: 'bg-blue-100 dark:bg-blue-900/50',
      iconText: 'text-blue-600 dark:text-blue-400',
      title: 'text-blue-800 dark:text-blue-300',
      body: 'text-blue-700/80 dark:text-blue-400/80'
    },
    amber: {
      container: 'bg-amber-50/50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/60',
      iconBg: 'bg-amber-100 dark:bg-amber-900/50',
      iconText: 'text-amber-600 dark:text-amber-400',
      title: 'text-amber-800 dark:text-amber-300',
      body: 'text-amber-700/80 dark:text-amber-400/80'
    },
    emerald: {
      container: 'bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/60',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
      iconText: 'text-emerald-600 dark:text-emerald-400',
      title: 'text-emerald-800 dark:text-emerald-300',
      body: 'text-emerald-700/80 dark:text-emerald-400/80'
    },
    purple: {
      container: 'bg-purple-50/50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/60',
      iconBg: 'bg-purple-100 dark:bg-purple-900/50',
      iconText: 'text-purple-600 dark:text-purple-400',
      title: 'text-purple-800 dark:text-purple-300',
      body: 'text-purple-700/80 dark:text-purple-400/80'
    }
  };

  const theme = colorVariants[color] || colorVariants.blue;

  return (
    <div className={`border rounded-xl p-4 flex gap-3.5 ${theme.container}`}>
      <div className={`p-2 rounded-lg h-fit shrink-0 ${theme.iconBg}`}>
        <Icon className={`h-5 w-5 ${theme.iconText}`} />
      </div>
      <div>
        <h3 className={`text-sm font-bold ${theme.title}`}>{title}</h3>
        <div className={`text-xs mt-1.5 leading-relaxed space-y-1 font-medium ${theme.body}`}>
          {children}
        </div>
      </div>
    </div>
  );
};
