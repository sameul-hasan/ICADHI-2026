import React, { useState, useEffect } from "react";
import { db } from "../services/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useToast } from "../context/ToastContext";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/Table";
import { 
  FileSpreadsheet, 
  FileText, 
  FileJson, 
  BarChart3, 
  SlidersHorizontal,
  Activity,
  CheckCircle,
  CalendarCheck,
  Award
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

export const Reports = () => {
  const { showToast } = useToast();

  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [regType, setRegType] = useState("");
  const [country, setCountry] = useState("");
  const [institution, setInstitution] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Load participants
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "participants"), (snap) => {
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setParticipants(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      showToast("Error loading participants list", "error");
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Filter helper
  const getFilteredData = () => {
    return participants.filter(p => {
      const matchReg = regType ? p.registrationType === regType : true;
      const matchCountry = country ? p.country === country : true;
      const matchInst = institution ? (p.institution || "").toLowerCase().includes(institution.toLowerCase()) : true;
      return matchReg && matchCountry && matchInst;
    });
  };

  const filteredData = getFilteredData();
  const countries = Array.from(new Set(participants.map(p => p.country).filter(Boolean)));

  // 1. Export to CSV
  const handleExportCSV = (reportType) => {
    const data = getReportData(reportType);
    if (data.length === 0) {
      showToast("No data to export", "warning");
      return;
    }

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => 
      Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")
    );
    const csvContent = [headers, ...rows].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ICADHI_2026_${reportType}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV report downloaded successfully!", "success");
  };

  // 2. Export to Excel (SheetJS)
  const handleExportExcel = (reportType) => {
    const data = getReportData(reportType);
    if (data.length === 0) {
      showToast("No data to export", "warning");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `ICADHI_2026_${reportType}_Report.xlsx`);
    showToast("Excel spreadsheet downloaded successfully!", "success");
  };

  // 3. Export to PDF (jsPDF + AutoTable)
  const handleExportPDF = (reportType) => {
    const data = getReportData(reportType);
    if (data.length === 0) {
      showToast("No data to export", "warning");
      return;
    }

    const docPDF = new jsPDF();
    
    // Theme Styling
    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(20);
    docPDF.setTextColor(30, 64, 175); // Primary #1E40AF
    docPDF.text("ICADHI 2026 Reports Console", 14, 22);

    docPDF.setFontSize(10);
    docPDF.setFont("helvetica", "normal");
    docPDF.setTextColor(100, 116, 139);
    docPDF.text(`Report Type: ${reportType.replace("_", " ").toUpperCase()}`, 14, 29);
    docPDF.text(`Generated on: ${new Date().toLocaleString()}`, 14, 34);
    docPDF.text(`Total Records: ${data.length}`, 14, 39);

    const headers = Object.keys(data[0]);
    const bodyRows = data.map(item => Object.values(item));

    docPDF.autoTable({
      head: [headers],
      body: bodyRows,
      startY: 45,
      theme: "striped",
      headStyles: { fillStyle: "F", fillColor: [30, 64, 175], textColor: [255, 255, 255] },
      styles: { fontSize: 8, font: "helvetica" }
    });

    docPDF.save(`ICADHI_2026_${reportType}_Report.pdf`);
    showToast("PDF document downloaded successfully!", "success");
  };

  // Format dataset dynamically depending on the report selection type
  const getReportData = (type) => {
    return filteredData.map(p => {
      const formatDate = (ts) => {
        if (!ts) return "N/A";
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleString();
      };

      const baseInfo = {
        "Team ID": p.participantId || "",
        "Full Name": p.fullName || "",
        "Email": p.email || "",
        "Phone": p.phone || "",
        "Institution": p.institution || "",
        "Country": p.country || "",
        "Registration Type": p.registrationType || "",
        "Team Name": p.teamName || "",
        "Team Members": p.teamMembers || "",
        "IEEE Membership Link": p.ieeeMembershipLink || "",
        "bKash Sender Number": p.bkashNumber || "",
        "Transaction ID": p.transactionId || "",
        "Ambassador ID": p.ambassadorId || "",
        "Payment Details": p.paymentDetails || "",
        "Payment 2": p.payment2 || "",
        "Excel Timestamp": p.timestamp || ""
      };

      if (type === "attendance") {
        return {
          ...baseInfo,
          "Check-in Status": p.registrationScanned ? "Checked In" : "Pending",
          "Check-in Timestamp": formatDate(p.registrationScannedAt)
        };
      }
      if (type === "kit") {
        return {
          ...baseInfo,
          "Kit Collected": p.kitCollected ? "Yes" : "No",
          "Collected Timestamp": formatDate(p.kitCollectedAt)
        };
      }
      if (type === "breakfast") {
        return {
          ...baseInfo,
          "Breakfast Collected": p.breakfastCollected ? "Yes" : "No",
          "Collected Timestamp": formatDate(p.breakfastCollectedAt)
        };
      }
      if (type === "lunch") {
        return {
          ...baseInfo,
          "Lunch Collected": p.lunchCollected ? "Yes" : "No",
          "Collected Timestamp": formatDate(p.lunchCollectedAt)
        };
      }
      if (type === "email") {
        return {
          ...baseInfo,
          "Email Sent": p.emailSent ? "Delivered" : "Pending/Failed",
          "Sent Timestamp": formatDate(p.emailSentAt)
        };
      }
      return baseInfo;
    });
  };

  // Report cards configurations
  const reportsList = [
    {
      type: "attendance",
      title: "Attendance & Entry Report",
      description: "Logs delegate check-in entries and timestamp records.",
      icon: <Activity className="h-6 w-6 text-primary-800" />,
      stats: `${participants.filter(p => p.registrationScanned).length} / ${participants.length} Scanned`
    },
    {
      type: "kit",
      title: "Registration Kit Claims",
      description: "Tracks folders and distribution checklist issues.",
      icon: <Award className="h-6 w-6 text-secondary-500" />,
      stats: `${participants.filter(p => p.kitCollected).length} / ${participants.filter(p => p.registrationScanned).length} Issued`
    },
    {
      type: "breakfast",
      title: "Breakfast Catering Log",
      description: "Catering logs claiming morning tea logs.",
      icon: <CalendarCheck className="h-6 w-6 text-indigo-500" />,
      stats: `${participants.filter(p => p.breakfastCollected).length} / ${participants.length} Claimed`
    },
    {
      type: "lunch",
      title: "Lunch Catering Log",
      description: "Catering logs claiming hot lunches.",
      icon: <CheckCircle className="h-6 w-6 text-rose-500" />,
      stats: `${participants.filter(p => p.lunchCollected).length} / ${participants.length} Claimed`
    },
    {
      type: "email",
      title: "Email Dispatch Report",
      description: "Checks bulk queue dispatches and success ratios.",
      icon: <FileText className="h-6 w-6 text-amber-500" />,
      stats: `${participants.filter(p => p.emailSent).length} / ${participants.length} Sent`
    }
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Title Header */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 px-6 py-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold">Reports & Exporters</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Export check-in statistics to spreadsheets and paginated PDF files</p>
        </div>
      </div>

      {/* Advanced Filters Toolbar */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <SlidersHorizontal className="h-4.5 w-4.5" /> Set Filter Constraints
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="text-xs font-bold"
            >
              {showFilters ? "Hide Panel" : "Show Panel"}
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Select
                label="Registration Type"
                placeholder="All Types"
                value={regType}
                onChange={(e) => setRegType(e.target.value)}
                options={[
                  { value: "Regular", label: "Regular Delegate" },
                  { value: "Student", label: "Student" },
                  { value: "Invited Speaker", label: "Invited Speaker" },
                  { value: "Sponsor", label: "Sponsor" },
                  { value: "Committee", label: "Committee Member" }
                ]}
              />
              <Select
                label="Country"
                placeholder="All Countries"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                options={countries.map(c => ({ value: c, label: c }))}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Institution Search</label>
                <input
                  type="text"
                  placeholder="e.g. Oxford University"
                  className="block w-full border border-slate-300 dark:border-slate-800 rounded-lg px-4 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-800"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="text-xs font-bold text-slate-400">
            Current Filter Matches: <span className="text-primary-850 dark:text-primary-400">{filteredData.length} records</span> of {participants.length} total.
          </div>
        </CardContent>
      </Card>

      {/* Reports Grid Cards */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-semibold">Loading data...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reportsList.map((rep) => (
            <Card key={rep.type}>
              <CardContent className="p-6 flex flex-col justify-between h-full gap-6">
                <div className="flex gap-4 items-start">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800/80 rounded-xl flex-shrink-0 mt-0.5">
                    {rep.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-extrabold text-slate-850 dark:text-white leading-snug">{rep.title}</h3>
                    <p className="text-xs text-slate-450 dark:text-slate-500 leading-normal mt-1">{rep.description}</p>
                    <span className="inline-block mt-3 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-500 rounded">
                      Stats: {rep.stats}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-850">
                  <Button
                    variant="outline"
                    className="flex items-center justify-center gap-1 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600"
                    onClick={() => handleExportCSV(rep.type)}
                  >
                    <FileJson className="h-3.5 w-3.5" /> CSV
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center justify-center gap-1 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600"
                    onClick={() => handleExportExcel(rep.type)}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center justify-center gap-1 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600"
                    onClick={() => handleExportPDF(rep.type)}
                  >
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
