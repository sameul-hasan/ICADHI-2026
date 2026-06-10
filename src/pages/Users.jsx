import React, { useState, useEffect } from "react";
import { db } from "../services/firebase";
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/Table";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { Users, ShieldAlert, Sparkles } from "lucide-react";

export const UsersPage = () => {
  const { userProfile, isSuperAdmin } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load console users
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snap) => {
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setUsers(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Update operator role in Firestore
  const handleRoleChange = async (targetUser, newRole) => {
    if (!isSuperAdmin) {
      showToast("Super Admin privilege required.", "error");
      return;
    }

    if (targetUser.uid === userProfile.uid) {
      showToast("Downgrading your own Super Admin account is blocked.", "warning");
      return;
    }

    try {
      const ref = doc(db, "users", targetUser.uid);
      await updateDoc(ref, {
        role: newRole
      });

      // Audit log
      await addDoc(collection(db, "auditLogs"), {
        userId: userProfile.uid,
        userEmail: userProfile.email,
        userRole: "super_admin",
        action: "Operator Role Modified",
        details: `Assigned new role '${newRole}' to operator ${targetUser.fullName} (${targetUser.email})`,
        timestamp: serverTimestamp()
      });

      showToast(`Assigned '${newRole}' to ${targetUser.fullName}`, "success");
    } catch (err) {
      console.error(err);
      showToast("Role assignment failed", "error");
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md mx-auto mt-12 shadow">
        <ShieldAlert className="h-12 w-12 text-red-500 mb-3" />
        <h3 className="text-base font-extrabold text-slate-850 dark:text-slate-100">Access Denied</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs leading-relaxed">
          Access blocked. System User Administration is restricted to the **Super Admin** role.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Title Header */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 px-6 py-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold">User Role Management</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Configure console roles and desk access permissions for event operators</p>
        </div>
      </div>

      {/* Operator List Table */}
      <Card>
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-semibold">Loading operators list...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-450 dark:text-slate-500 flex flex-col items-center">
            <Users className="h-12 w-12 text-slate-300 mb-3" />
            No console accounts registered.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Name</TableHead>
                <TableHead>Email Address</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Modify Access Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    {u.uid === userProfile.uid && <Sparkles className="h-4 w-4 text-amber-500" />}
                    {u.fullName}
                  </TableCell>
                  <TableCell className="text-slate-550 dark:text-slate-400 font-semibold">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "super_admin" ? "success" : u.role === "admin" ? "info" : "neutral"} className="uppercase tracking-wider">
                      {u.role?.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.uid === userProfile.uid ? (
                      <span className="text-xs text-slate-400 font-bold italic">Active Account (Immutable)</span>
                    ) : (
                      <Select
                        value={u.role || "volunteer"}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        placeholder=""
                        className="py-1 px-3 text-xs w-48 font-bold border-slate-200 dark:border-slate-800"
                        options={[
                          { value: "super_admin", label: "Super Admin" },
                          { value: "admin", label: "Admin" },
                          { value: "registration_desk", label: "Registration Desk" },
                          { value: "breakfast_desk", label: "Breakfast Desk" },
                          { value: "lunch_desk", label: "Lunch Desk" },
                          { value: "volunteer", label: "Volunteer" }
                        ]}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};
