import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { 
  LayoutDashboard, 
  ScanLine, 
  Database, 
  UploadCloud, 
  Mail, 
  FileCode, 
  Settings2, 
  Users, 
  History, 
  BarChart3, 
  LogOut, 
  Menu, 
  X, 
  Sun, 
  Moon,
  HeartHandshake,
  Award
} from "lucide-react";
import clsx from "clsx";

export const DashboardLayout = ({ children }) => {
  const { userProfile, logout, isSuperAdmin, isAdmin, isRegDesk, isBreakfastDesk, isLunchDesk } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Locked to Light Theme
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.body.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Failed to log out", err);
    }
  };

  // Define sidebar navigation items based on roles
  const menuItems = [
    { 
      name: "Dashboard", 
      path: "/", 
      icon: <LayoutDashboard className="h-5 w-5" />, 
      show: true 
    },
    { 
      name: "QR Scanner", 
      path: "/scanner", 
      icon: <ScanLine className="h-5 w-5" />, 
      show: isRegDesk || isBreakfastDesk || isLunchDesk 
    },
    { 
      name: "Participants", 
      path: "/database", 
      icon: <Database className="h-5 w-5" />, 
      show: true 
    },
    { 
      name: "Organizers", 
      path: "/volunteers", 
      icon: <HeartHandshake className="h-5 w-5" />, 
      show: isAdmin || isRegDesk 
    },
    { 
      name: "Ambassadors", 
      path: "/ambassadors", 
      icon: <Award className="h-5 w-5" />, 
      show: isAdmin || isRegDesk 
    },
    { 
      name: "Excel Upload", 
      path: "/upload", 
      icon: <UploadCloud className="h-5 w-5" />, 
      show: isAdmin 
    },
    { 
      name: "Email Campaigns", 
      path: "/campaigns", 
      icon: <Mail className="h-5 w-5" />, 
      show: isAdmin 
    },
    { 
      name: "Templates Builder", 
      path: "/templates", 
      icon: <FileCode className="h-5 w-5" />, 
      show: isAdmin 
    },
    { 
      name: "SMTP Config", 
      path: "/smtp", 
      icon: <Settings2 className="h-5 w-5" />, 
      show: isAdmin 
    },
    { 
      name: "User Management", 
      path: "/users", 
      icon: <Users className="h-5 w-5" />, 
      show: isSuperAdmin 
    },
    { 
      name: "Audit Logs", 
      path: "/logs", 
      icon: <History className="h-5 w-5" />, 
      show: isAdmin 
    },
    { 
      name: "Reports & Analytics", 
      path: "/reports", 
      icon: <BarChart3 className="h-5 w-5" />, 
      show: isAdmin 
    }
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sm fixed h-screen z-20">
        {/* Branding */}
        <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800 gap-2.5">
          <img src="/logo.png" alt="ICADHI 2026 Logo" className="h-9 object-contain" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {menuItems.filter(item => item.show).map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={clsx(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all group",
                  isActive 
                    ? "bg-primary-50 dark:bg-primary-950/40 text-primary-800 dark:text-primary-300 border-l-4 border-primary-800" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
                )}
              >
                <span className={clsx(
                  "transition-colors", 
                  isActive ? "text-primary-800 dark:text-primary-300" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                )}>
                  {item.icon}
                </span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer User Info */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold uppercase">
              {userProfile?.fullName?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-150 truncate leading-none mb-0.5">
                {userProfile?.fullName}
              </p>
              <span className="inline-block px-2 py-0.25 text-[9px] font-extrabold tracking-wider bg-primary-100 text-primary-900 dark:bg-primary-950/60 dark:text-primary-300 rounded uppercase">
                {userProfile?.role?.replace("_", " ")}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 border border-transparent hover:border-red-100 dark:hover:border-red-900/30 transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout System
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top Navbar */}
        <header className="h-16 flex items-center justify-between px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg lg:hidden hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
          >
            <Menu className="h-6 w-6" />
          </button>

          <h2 className="hidden sm:block text-lg font-bold text-slate-800 dark:text-slate-100">
            {menuItems.find(item => item.path === location.pathname)?.name || "Dashboard"}
          </h2>

          <div className="flex items-center gap-4">
            {/* Mobile Logo */}
            <img src="/logo.png" alt="ICADHI 2026 Logo" className="h-8 object-contain lg:hidden" />

            {/* Quick User Card */}
            <div className="flex items-center gap-3">
              <span className="hidden md:block text-xs font-bold text-slate-500 dark:text-slate-400">
                ICADHI 2026 Panel
              </span>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-ring"></div>
            </div>
          </div>
        </header>

        {/* Page Children Container */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile Drawer Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />

          {/* Sidebar drawer content */}
          <aside className="relative flex flex-col w-64 bg-white dark:bg-slate-900 h-full border-r border-slate-200 dark:border-slate-800 shadow-xl transition-transform animate-scale-in">
            {/* Close button */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <img src="/logo.png" alt="ICADHI 2026 Logo" className="h-8 object-contain" />
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto" onClick={() => setIsSidebarOpen(false)}>
              {menuItems.filter(item => item.show).map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={clsx(
                      "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
                      isActive 
                        ? "bg-primary-50 dark:bg-primary-950/40 text-primary-850 dark:text-primary-300 border-l-4 border-primary-850" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/50 hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                  >
                    <span>{item.icon}</span>
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Footer user profile */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-850 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold uppercase">
                  {userProfile?.fullName?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate mb-0.5 leading-none">
                    {userProfile?.fullName}
                  </p>
                  <span className="inline-block px-2 py-0.25 text-[9px] font-extrabold bg-primary-100 text-primary-900 dark:bg-primary-950/60 dark:text-primary-300 rounded uppercase">
                    {userProfile?.role?.replace("_", " ")}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 border border-transparent hover:border-red-100 dark:hover:border-red-900/30 transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
