import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider, useToast } from "./context/ToastContext";
import { DashboardLayout } from "./layouts/DashboardLayout";

// Page Imports
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { Scanner } from "./pages/Scanner";
import { DatabasePage } from "./pages/Database";
import { UploadPage } from "./pages/Upload";
import { EmailCampaigns } from "./pages/EmailCampaigns";
import { Templates } from "./pages/Templates";
import { SmtpSettings } from "./pages/SmtpSettings";
import { UsersPage } from "./pages/Users";
import { AuditLogs } from "./pages/AuditLogs";
import { Reports } from "./pages/Reports";
import { AccessHierarchy } from "./pages/AccessHierarchy";
import { Volunteer } from "./pages/Volunteer";
import { Ambassador } from "./pages/Ambassador";

const queryClient = new QueryClient();

// Route Guard: Enforce Logged In Status
const ProtectedRoute = ({ children }) => {
  const { currentUser, role, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <svg className="animate-spin h-8 w-8 text-primary-800" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }
  
  if (!currentUser) return <Navigate to="/login" replace />;
  
  if (role === "user") {
    return <AccessHierarchy />;
  }
  
  return children;
};

// Route Guard: Enforce Role Permissions
const RoleRoute = ({ children, allowedRoles }) => {
  const { role, loading } = useAuth();
  const { showToast } = useToast();

  if (loading) return null;

  const hasAccess = allowedRoles.includes(role);
  
  if (!hasAccess) {
    // Show warnings on navigation failure
    setTimeout(() => {
      showToast("Access Denied: Insufficient Role Permissions", "error");
    }, 100);
    return <Navigate to="/" replace />;
  }

  return children;
};

export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Public Authentications */}
              <Route path="/login" element={<Auth />} />

              {/* Console Dashboard Protected Modules */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <Routes>
                        {/* Universal Dashboard */}
                        <Route path="/" element={<Dashboard />} />
                        
                        {/* Scanning Station Desk */}
                        <Route 
                          path="/scanner" 
                          element={
                            <RoleRoute allowedRoles={["super_admin", "admin", "registration_desk", "breakfast_desk", "lunch_desk"]}>
                              <Scanner />
                            </RoleRoute>
                          } 
                        />
                        
                        {/* Attendee Database (All Logged In can view) */}
                        <Route path="/database" element={<DatabasePage />} />
                        
                        <Route path="/volunteers" element={<Volunteer />} />
                        <Route path="/ambassadors" element={<Ambassador />} />
                        
                        {/* Excel Upload (Admins & Super Admin) */}
                        <Route 
                          path="/upload" 
                          element={
                            <RoleRoute allowedRoles={["super_admin", "admin"]}>
                              <UploadPage />
                            </RoleRoute>
                          } 
                        />
                        
                        {/* Email Campaigns Engine */}
                        <Route 
                          path="/campaigns" 
                          element={
                            <RoleRoute allowedRoles={["super_admin", "admin"]}>
                              <EmailCampaigns />
                            </RoleRoute>
                          } 
                        />
                        
                        {/* Email Templates Builder */}
                        <Route 
                          path="/templates" 
                          element={
                            <RoleRoute allowedRoles={["super_admin", "admin"]}>
                              <Templates />
                            </RoleRoute>
                          } 
                        />
                        
                        {/* SMTP Config (Admin & Super Admin) */}
                        <Route 
                          path="/smtp" 
                          element={
                            <RoleRoute allowedRoles={["super_admin", "admin"]}>
                              <SmtpSettings />
                            </RoleRoute>
                          } 
                        />
                        
                        {/* User Role Management (Super Admin only) */}
                        <Route 
                          path="/users" 
                          element={
                            <RoleRoute allowedRoles={["super_admin"]}>
                              <UsersPage />
                            </RoleRoute>
                          } 
                        />
                        
                        {/* System Audit Trails */}
                        <Route 
                          path="/logs" 
                          element={
                            <RoleRoute allowedRoles={["super_admin", "admin"]}>
                              <AuditLogs />
                            </RoleRoute>
                          } 
                        />
                        
                        {/* Reports Console */}
                        <Route 
                          path="/reports" 
                          element={
                            <RoleRoute allowedRoles={["super_admin", "admin"]}>
                              <Reports />
                            </RoleRoute>
                          } 
                        />

                        {/* Page Fallbacks */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Router>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default App;
