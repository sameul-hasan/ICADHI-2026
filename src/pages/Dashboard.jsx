import React, { useState, useEffect } from "react";
import { db } from "../services/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { 
  Users, 
  Mail, 
  CheckCircle, 
  Coffee, 
  Utensils, 
  Gift, 
  Clock, 
  UserPlus, 
  Activity 
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";

export const Dashboard = () => {
  const [participants, setParticipants] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Listen to Participants Collection in real-time
  useEffect(() => {
    const q = query(collection(db, "participants"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setParticipants(list);
      setLoading(false);
    }, (err) => {
      console.error("Error listening to participants:", err);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // 2. Listen to Audit Logs in real-time
  useEffect(() => {
    const q = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(6));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setRecentLogs(list);
    }, (err) => {
      console.error("Error listening to audit logs:", err);
    });

    return unsubscribe;
  }, []);

  // Compute Metrics
  const totalParticipants = participants.length;
  const emailsSent = participants.filter(p => p.emailSent).length;
  const checkedIn = participants.filter(p => p.registrationScanned).length;
  const kitsCollected = participants.filter(p => p.kitCollected).length;
  const breakfastCollected = participants.filter(p => p.breakfastCollected).length;
  const lunchCollected = participants.filter(p => p.lunchCollected).length;

  // Breakdown of Registration Types
  const regTypeCounts = participants.reduce((acc, p) => {
    const type = p.registrationType || "Unknown";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const pieChartData = Object.keys(regTypeCounts).map(key => ({
    name: key,
    value: regTypeCounts[key]
  }));

  const COLORS = ["#1E40AF", "#0EA5E9", "#F59E0B", "#10B981", "#8B5CF6", "#EC4899"];

  // Daily Check-ins progression (grouped by scan date)
  // Let's group scans by day and hour for an interactive Area chart
  const scanTimelineData = (() => {
    const hours = {};
    participants.forEach(p => {
      if (p.registrationScanned && p.registrationScannedAt) {
        // Convert Firestore timestamp to Date
        const date = p.registrationScannedAt.toDate ? p.registrationScannedAt.toDate() : new Date(p.registrationScannedAt);
        // Format to hourly: e.g. "June 10, 14:00"
        const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const timeKey = formattedTime.substring(0, 3) + "00"; // Round to hour
        hours[timeKey] = (hours[timeKey] || 0) + 1;
      }
    });

    // Sort timeline keys
    return Object.keys(hours).sort().map(key => ({
      time: key,
      scans: hours[key]
    }));
  })();

  // Bar chart data for Distribution Desks comparison
  const distributionData = [
    { name: "Kits", Distributed: kitsCollected, Remaining: totalParticipants - kitsCollected },
    { name: "Breakfast", Distributed: breakfastCollected, Remaining: totalParticipants - breakfastCollected },
    { name: "Lunch", Distributed: lunchCollected, Remaining: totalParticipants - lunchCollected }
  ];

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Title block with live status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-primary-850 to-primary-950 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-secondary-500/20 rounded-full blur-2xl pointer-events-none" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">ICADHI 2026 Dashboard</h1>
          <p className="text-sm text-primary-100 font-medium mt-1">
            Real-time Registration and Attendance Management Portal
          </p>
        </div>
        <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl text-xs font-bold self-start sm:self-center">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          Live Connection Active
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Total Participants */}
        <Card variant="glass" className="hover:-translate-y-1">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Reg</span>
              <div className="p-1.5 rounded-lg bg-primary-100 dark:bg-primary-950 text-primary-800 dark:text-primary-300"><Users className="h-4.5 w-4.5" /></div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{totalParticipants}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Uploaded list</span>
            </div>
          </CardContent>
        </Card>

        {/* Emails Sent */}
        <Card variant="glass" className="hover:-translate-y-1">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Emails Sent</span>
              <div className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-850 dark:text-sky-300"><Mail className="h-4.5 w-4.5" /></div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{emailsSent}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">
                {totalParticipants ? Math.round((emailsSent / totalParticipants) * 100) : 0}% delivery rate
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Checked In */}
        <Card variant="glass" className="hover:-translate-y-1">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Checked In</span>
              <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"><CheckCircle className="h-4.5 w-4.5" /></div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{checkedIn}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">
                {totalParticipants ? Math.round((checkedIn / totalParticipants) * 100) : 0}% checked in
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Kits Given */}
        <Card variant="glass" className="hover:-translate-y-1">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kits Issued</span>
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"><Gift className="h-4.5 w-4.5" /></div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{kitsCollected}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">
                {checkedIn ? Math.round((kitsCollected / checkedIn) * 100) : 0}% of checked-in
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Breakfast Served */}
        <Card variant="glass" className="hover:-translate-y-1">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Breakfast</span>
              <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-850 dark:text-indigo-300"><Coffee className="h-4.5 w-4.5" /></div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{breakfastCollected}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">
                {totalParticipants ? Math.round((breakfastCollected / totalParticipants) * 100) : 0}% of total
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Lunch Served */}
        <Card variant="glass" className="hover:-translate-y-1">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lunch Served</span>
              <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300"><Utensils className="h-4.5 w-4.5" /></div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{lunchCollected}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">
                {totalParticipants ? Math.round((lunchCollected / totalParticipants) * 100) : 0}% of total
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area timeline chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary-800" /> Hourly Check-in Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {scanTimelineData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-450 dark:text-slate-500 text-sm">
                <Activity className="h-10 w-10 text-slate-300 mb-2 animate-bounce" />
                Waiting for check-in scans...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={scanTimelineData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} fontWeight={600} />
                  <YAxis stroke="#94a3b8" fontSize={11} fontWeight={600} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="scans" stroke="#1E40AF" fillOpacity={0.15} fill="url(#colorScans)" strokeWidth={2.5} />
                  <defs>
                    <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1E40AF" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#1E40AF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart of Registration Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-secondary-500" /> Registration Types</CardTitle>
          </CardHeader>
          <CardContent className="h-80 flex flex-col justify-center relative">
            {pieChartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-455 text-sm">
                No participant data uploaded.
              </div>
            ) : (
              <>
                <div className="flex-1 h-3/4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} Participants`, 'Count']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-xs font-semibold px-4">
                  {pieChartData.map((entry, index) => (
                    <span key={entry.name} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      {entry.name}
                    </span>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Desk Distribution Bars */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-accent-500" /> Distribution Desk Stats</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={distributionData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontWeight={600} />
                <YAxis stroke="#94a3b8" fontSize={11} fontWeight={600} />
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingTop: '10px' }} />
                <Bar dataKey="Distributed" stackId="a" fill="#1E40AF" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Remaining" stackId="a" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Live Activity Feed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-red-500" /> Live Activity Feed</CardTitle>
            <span className="px-2 py-0.5 text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded uppercase tracking-wider">Live</span>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto max-h-[300px]">
            {recentLogs.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                No recent activity logged.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {recentLogs.map((log) => {
                  // Format time
                  const time = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  
                  return (
                    <div key={log.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors flex gap-3.5 items-start">
                      <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-400 flex-shrink-0 mt-0.5">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-center gap-2">
                          <p className="text-xs font-bold text-slate-750 dark:text-slate-205 truncate">
                            {log.userEmail || log.userId}
                          </p>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold shrink-0">{timeStr}</span>
                        </div>
                        <p className="text-xs font-black text-primary-850 dark:text-primary-400 mt-0.5">{log.action}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed truncate">{log.details}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
