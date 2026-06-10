import React, { useState, useEffect } from "react";
import { db } from "../services/firebase";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/Table";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { History, Search, ShieldCheck } from "lucide-react";

export const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Load audit logs in real-time (last 200 logs)
  useEffect(() => {
    const q = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(200));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setLogs(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Filter logs locally
  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      (log.userEmail || "").toLowerCase().includes(term) ||
      (log.userRole || "").toLowerCase().includes(term) ||
      (log.action || "").toLowerCase().includes(term) ||
      (log.details || "").toLowerCase().includes(term) ||
      (log.ipAddress || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 px-6 py-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold">System Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Cryptographic logging of administrator actions and scan claims</p>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Search logs by email, action, details, IP address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </CardContent>
      </Card>

      {/* Main Grid Logs */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-semibold">Loading system audit trail...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-450 dark:text-slate-500 flex flex-col items-center">
            <History className="h-12 w-12 text-slate-300 mb-3" />
            No audit logs found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User / Operator</TableHead>
                  <TableHead>System Action</TableHead>
                  <TableHead>Description Details</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Log Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => {
                  const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                  
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div>
                          <span className="font-extrabold text-slate-800 dark:text-slate-100">{log.userEmail || "System Trigger"}</span>
                          <span className="block mt-0.5">
                            <Badge variant="primary" className="text-[9px] font-black uppercase tracking-wider py-0 px-2">{log.userRole?.replace("_", " ")}</Badge>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-black text-slate-850 dark:text-slate-100 flex items-center gap-1.5 mt-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        {log.action}
                      </TableCell>
                      <TableCell className="text-slate-550 dark:text-slate-400 font-medium max-w-[300px] whitespace-normal leading-relaxed break-words">
                        {log.details}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-slate-455">{log.ipAddress || "N/A"}</TableCell>
                      <TableCell className="font-bold text-xs text-slate-450">
                        {date.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
};
