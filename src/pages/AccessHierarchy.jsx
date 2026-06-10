import React from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { ShieldCheck, LogOut, KeyRound, Award, Users, ScanLine, Clock } from "lucide-react";

export const AccessHierarchy = () => {
  const { userProfile, logout } = useAuth();

  const rolesList = [
    {
      roleName: "Super Admin",
      color: "bg-red-50 text-red-700 border-red-200",
      description: "Full control: configures secure SMTP credentials, overrides database templates, deletes records, and approves system user promotions.",
      icon: <ShieldCheck className="h-5 w-5 text-red-600" />
    },
    {
      roleName: "Admin",
      color: "bg-blue-50 text-blue-700 border-blue-200",
      description: "Manages events, coordinates mass emailing queues, imports attendee Excel registries, checks audit trails, and generates analytics reports.",
      icon: <Award className="h-5 w-5 text-blue-600" />
    },
    {
      roleName: "Scan Desks (Registration/Catering)",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: "Operates QR scanner workstations to verify credentials, checks entry access, issues registration kits, and claims breakfast/lunch items.",
      icon: <ScanLine className="h-5 w-5 text-emerald-600" />
    },
    {
      roleName: "Volunteer",
      color: "bg-indigo-50 text-indigo-700 border-indigo-200",
      description: "Provides basic lookup on database records without import/export, template creation, or SMTP management access.",
      icon: <Users className="h-5 w-5 text-indigo-600" />
    },
    {
      roleName: "Registered User (You)",
      color: "bg-amber-50 text-amber-700 border-amber-200 animate-pulse",
      description: "Initial signup status. Securely locks access to all participant records, campaigns, and configurations until promoted by an admin.",
      icon: <KeyRound className="h-5 w-5 text-amber-600" />
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl bg-white border border-slate-200 shadow-xl rounded-2xl p-6 sm:p-10 flex flex-col gap-8">
        
        {/* Branding header */}
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/logo.png" alt="ICADHI 2026 Logo" className="h-16 object-contain" />
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Access Control Center</h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-amber-800">
            <Clock className="h-3.5 w-3.5 animate-spin" /> Pending Admin Authorization
          </div>
        </div>

        {/* Message */}
        <div className="text-center space-y-2 max-w-lg mx-auto">
          <p className="text-sm font-semibold text-slate-700 leading-relaxed">
            Welcome, <span className="font-extrabold text-primary-850">{userProfile?.fullName || "User"}</span>! Your account is registered under a restricted status with no database permissions.
          </p>
          <p className="text-xs text-slate-500 leading-normal">
            To guard attendee security and maintain operational integrity, a Super Admin must promote your account to a desk operator or administrator role.
          </p>
        </div>

        {/* Hierarchy tree list */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-450 border-b border-slate-100 pb-2">
            System Access Hierarchy
          </h3>
          
          <div className="divide-y divide-slate-100 border border-slate-150 rounded-xl overflow-hidden bg-slate-50/20">
            {rolesList.map((item, idx) => (
              <div key={idx} className="p-4 flex gap-4 items-start hover:bg-slate-50/40 transition-all">
                <div className={`p-2.5 rounded-xl border flex-shrink-0 ${item.color.split(" ")[0]} ${item.color.split(" ")[2]}`}>
                  {item.icon}
                </div>
                <div className="space-y-0.5">
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase rounded tracking-wider border ${item.color}`}>
                    {item.roleName}
                  </span>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logout action */}
        <div className="flex justify-center border-t border-slate-100 pt-6">
          <Button
            variant="outline"
            onClick={logout}
            className="flex items-center gap-2 text-xs font-bold text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50/50"
          >
            <LogOut className="h-4 w-4" /> Sign Out from Portal
          </Button>
        </div>

      </div>
    </div>
  );
};

export default AccessHierarchy;
