import React, { useState, useCallback } from "react";
import { db } from "../services/firebase";
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, AlertCircle, Play, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";

export const UploadPage = () => {
  const { userProfile } = useAuth();
  const { showToast } = useToast();
  
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsedData, setParsedData] = useState([]);
  const [validationReport, setValidationReport] = useState([]);
  const [summary, setSummary] = useState({ total: 0, valid: 0, invalid: 0 });
  const [importing, setImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);

  // Email validation regex
  const validateEmail = (email) => {
    return String(email)
      .toLowerCase()
      .match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
  };

  // Process and validate Excel data
  const processExcelData = async (data) => {
    const rawRows = XLSX.utils.sheet_to_json(data, { header: 1 });
    if (rawRows.length <= 1) {
      showToast("Excel sheet is empty or contains header only", "error");
      return;
    }

    // Identify headers
    const headers = rawRows[0].map(h => String(h).trim().toLowerCase());
    
    // Helper function to find column index with support for multiple aliases
    const findHeaderIndex = (aliases) => {
      for (const alias of aliases) {
        const idx = headers.indexOf(alias.toLowerCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };

    // Column index maps
    const headerMapping = {
      fullName: findHeaderIndex(["Team Leader's Name", "Full Name"]),
      email: findHeaderIndex(["Team Leader's Email Address", "Email", "Email Address"]),
      phone: findHeaderIndex(["Team Leader's Contact Number", "Phone", "Contact Number"]),
      institution: findHeaderIndex(["Team Leader's University Name", "Institution", "University Name", "University"]),
      department: findHeaderIndex(["Department"]),
      designation: findHeaderIndex(["Designation"]),
      country: findHeaderIndex(["Country"]),
      registrationType: findHeaderIndex(["Type", "Registration Type"]),
      paymentStatus: findHeaderIndex(["Payment Status"]),
      
      // New columns for the hackathon/team registration
      teamName: findHeaderIndex(["Team's Name", "Team Name"]),
      teamMembers: findHeaderIndex(["Others Team Member Names", "Other Team Member Names", "Team Members"]),
      ieeeMembershipLink: findHeaderIndex([
        "Do any of the team members have an activ IEEE Membership Certificate Link",
        "Do any of the team members have an active IEEE Membership Certificate Link",
        "IEEE Membership Link"
      ]),
      bkashNumber: findHeaderIndex(["bKash Sender Number", "bKash Number", "bKash"]),
      transactionId: findHeaderIndex(["Transaction ID", "Txn ID", "Transaction"]),
      column11: findHeaderIndex(["Column 11"]),
      ambassadorId: findHeaderIndex(["Ambassador ID", "Ambassador"]),
      paymentDetails: findHeaderIndex(["Team Leade 2nd Team 3rd Team Me Payment", "Payment Details"]),
      payment2: findHeaderIndex(["Payment 2"]),
      timestamp: findHeaderIndex(["Timestamp"])
    };

    // Verify required headers
    if (headerMapping.fullName === -1 || headerMapping.email === -1) {
      showToast("Missing required columns: 'Team Leader\\'s Name' (Full Name) and 'Team Leader\\'s Email Address' (Email) are mandatory.", "error");
      return;
    }

    const rows = [];
    const localEmails = new Set();
    const localPhones = new Set();
    const errorsList = [];
    let validCount = 0;
    let invalidCount = 0;

    // Fetch existing participants from Firestore to verify global uniqueness of email/phone
    const participantsRef = collection(db, "participants");
    const existingSnap = await getDocs(participantsRef);
    const existingEmails = new Set();
    const existingPhones = new Set();
    
    existingSnap.forEach(doc => {
      const p = doc.data();
      if (p.email) existingEmails.add(p.email.toLowerCase().trim());
      if (p.phone) existingPhones.add(p.phone.toString().trim());
    });

    // Parse records (skipping header row 0)
    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (row.length === 0 || row.every(val => val === undefined || val === "")) continue;

      const pId = `part-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
      
      const fullName = headerMapping.fullName !== -1 && row[headerMapping.fullName] ? String(row[headerMapping.fullName]).trim() : "";
      const email = headerMapping.email !== -1 && row[headerMapping.email] ? String(row[headerMapping.email]).toLowerCase().trim() : "";
      const phone = headerMapping.phone !== -1 && row[headerMapping.phone] ? String(row[headerMapping.phone]).trim() : "";
      const institution = headerMapping.institution !== -1 && row[headerMapping.institution] ? String(row[headerMapping.institution]).trim() : "";
      const department = headerMapping.department !== -1 && row[headerMapping.department] ? String(row[headerMapping.department]).trim() : "";
      const designation = headerMapping.designation !== -1 && row[headerMapping.designation] ? String(row[headerMapping.designation]).trim() : "";
      const country = headerMapping.country !== -1 && row[headerMapping.country] ? String(row[headerMapping.country]).trim() : "Unknown";
      const registrationType = headerMapping.registrationType !== -1 && row[headerMapping.registrationType] ? String(row[headerMapping.registrationType]).trim() : "Regular";
      
      // Determine payment status dynamically: if explicit column is missing, infer from Transaction ID or bKash Sender Number
      let paymentStatus = "Pending";
      if (headerMapping.paymentStatus !== -1 && row[headerMapping.paymentStatus]) {
        paymentStatus = String(row[headerMapping.paymentStatus]).trim();
      } else {
        const txnId = headerMapping.transactionId !== -1 && row[headerMapping.transactionId] ? String(row[headerMapping.transactionId]).trim() : "";
        const bkashNum = headerMapping.bkashNumber !== -1 && row[headerMapping.bkashNumber] ? String(row[headerMapping.bkashNumber]).trim() : "";
        if (txnId || bkashNum) {
          paymentStatus = "Paid";
        }
      }

      // Read custom Hackathon team attributes
      const teamName = headerMapping.teamName !== -1 && row[headerMapping.teamName] ? String(row[headerMapping.teamName]).trim() : "";
      const teamMembers = headerMapping.teamMembers !== -1 && row[headerMapping.teamMembers] ? String(row[headerMapping.teamMembers]).trim() : "";
      const ieeeMembershipLink = headerMapping.ieeeMembershipLink !== -1 && row[headerMapping.ieeeMembershipLink] ? String(row[headerMapping.ieeeMembershipLink]).trim() : "";
      const bkashNumber = headerMapping.bkashNumber !== -1 && row[headerMapping.bkashNumber] ? String(row[headerMapping.bkashNumber]).trim() : "";
      const transactionId = headerMapping.transactionId !== -1 && row[headerMapping.transactionId] ? String(row[headerMapping.transactionId]).trim() : "";
      const column11 = headerMapping.column11 !== -1 && row[headerMapping.column11] ? String(row[headerMapping.column11]).trim() : "";
      const ambassadorId = headerMapping.ambassadorId !== -1 && row[headerMapping.ambassadorId] ? String(row[headerMapping.ambassadorId]).trim() : "";
      const paymentDetails = headerMapping.paymentDetails !== -1 && row[headerMapping.paymentDetails] ? String(row[headerMapping.paymentDetails]).trim() : "";
      const payment2 = headerMapping.payment2 !== -1 && row[headerMapping.payment2] ? String(row[headerMapping.payment2]).trim() : "";
      const timestamp = headerMapping.timestamp !== -1 && row[headerMapping.timestamp] ? String(row[headerMapping.timestamp]).trim() : "";

      const p = {
        rowNum: i + 1,
        fullName,
        email,
        phone,
        institution,
        department,
        designation,
        country,
        registrationType,
        paymentStatus,
        teamName,
        teamMembers,
        ieeeMembershipLink,
        bkashNumber,
        transactionId,
        column11,
        ambassadorId,
        paymentDetails,
        payment2,
        timestamp,
        errors: []
      };

      // 1. Validate empty fields
      if (!p.fullName) p.errors.push("Team Leader Name is empty.");
      if (!p.email) p.errors.push("Team Leader Email is empty.");

      // 2. Validate email format
      if (p.email && !validateEmail(p.email)) {
        p.errors.push(`Invalid email format: '${p.email}'`);
      }

      // 3. Validate duplicates inside sheet
      if (p.email && localEmails.has(p.email)) {
        p.errors.push(`Duplicate email within Excel sheet: '${p.email}'`);
      }
      if (p.phone && localPhones.has(p.phone)) {
        p.errors.push(`Duplicate phone within Excel sheet: '${p.phone}'`);
      }

      // 4. Validate duplicates against Firestore Database
      if (p.email && existingEmails.has(p.email)) {
        p.errors.push(`Email already exists in Database: '${p.email}'`);
      }
      if (p.phone && existingPhones.has(p.phone)) {
        p.errors.push(`Phone already exists in Database: '${p.phone}'`);
      }

      // Track sheet locals
      if (p.email) localEmails.add(p.email);
      if (p.phone) localPhones.add(p.phone);

      if (p.errors.length > 0) {
        invalidCount++;
        p.errors.forEach(err => errorsList.push({ row: p.rowNum, name: p.fullName, error: err }));
      } else {
        validCount++;
      }

      rows.push(p);
    }

    setParsedData(rows);
    setValidationReport(errorsList);
    setSummary({ total: rows.length, valid: validCount, invalid: invalidCount });
    showToast(`Validation finished. Found ${validCount} valid and ${invalidCount} invalid rows.`, "info");
  };

  // Drag handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setFileName(file.name);
      
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        processExcelData(ws);
      };
      reader.readAsBinaryString(file);
    }
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileName(file.name);
      
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        processExcelData(ws);
      };
      reader.readAsBinaryString(file);
    }
  };

  // Chunked batch uploads
  const handleImport = async () => {
    const validRows = parsedData.filter(p => p.errors.length === 0);
    if (validRows.length === 0) {
      showToast("No valid rows to import", "warning");
      return;
    }

    setImporting(true);
    try {
      const batchSize = 450;
      let committed = 0;

      for (let i = 0; i < validRows.length; i += batchSize) {
        const chunk = validRows.slice(i, i + batchSize);
        const batch = writeBatch(db);

        chunk.forEach(row => {
          const participantId = `ICADHI-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
          const secureToken = `ICADHI-2026-${Math.random().toString(36).substr(2, 9).toUpperCase()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
          const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(JSON.stringify({ participantId, secureToken }))}`;

          const ref = doc(db, "participants", participantId);
          batch.set(ref, {
            participantId,
            fullName: row.fullName,
            email: row.email,
            phone: row.phone,
            institution: row.institution,
            department: row.department,
            designation: row.designation,
            country: row.country,
            registrationType: row.registrationType,
            paymentStatus: row.paymentStatus,
            
            // Custom Hackathon details
            teamName: row.teamName || "",
            teamMembers: row.teamMembers || "",
            ieeeMembershipLink: row.ieeeMembershipLink || "",
            bkashNumber: row.bkashNumber || "",
            transactionId: row.transactionId || "",
            column11: row.column11 || "",
            ambassadorId: row.ambassadorId || "",
            paymentDetails: row.paymentDetails || "",
            payment2: row.payment2 || "",
            timestamp: row.timestamp || "",
            
            // Core States
            uniqueToken: secureToken,
            qrCodeUrl: qrCodeUrl,
            registrationScanned: false,
            registrationScannedAt: null,
            kitCollected: false,
            kitCollectedAt: null,
            breakfastCollected: false,
            breakfastCollectedAt: null,
            lunchCollected: false,
            lunchCollectedAt: null,
            emailSent: false,
            emailSentAt: null,
            
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        });

        await batch.commit();
        committed += chunk.length;
      }

      // Add audit log
      const logRef = doc(db, "auditLogs", `import-${Date.now()}`);
      const batchLog = writeBatch(db);
      batchLog.set(logRef, {
        userId: userProfile?.uid || "unknown",
        userEmail: userProfile?.email || "unknown",
        userRole: userProfile?.role || "admin",
        action: "Participant List Imported",
        details: `Successfully imported ${committed} participants from Excel file: '${fileName}'`,
        timestamp: serverTimestamp()
      });
      await batchLog.commit();

      showToast(`Successfully imported ${committed} participants.`, "success");
      setImportComplete(true);
    } catch (err) {
      console.error("Failed importing list:", err);
      showToast(`Import failed: ${err.message}`, "error");
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFileName("");
    setParsedData([]);
    setValidationReport([]);
    setSummary({ total: 0, valid: 0, invalid: 0 });
    setImportComplete(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 px-6 py-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold">Import Participants</h1>
          <p className="text-xs text-slate-500 mt-0.5">Upload conference registry (.xlsx, .xls) list</p>
        </div>
        {parsedData.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleReset} className="flex items-center gap-1.5">
            <RefreshCw className="h-4 w-4" /> Reset
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Container / Dropzone */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {parsedData.length === 0 ? (
            <Card>
              <CardContent className="p-8">
                <form
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    dragActive 
                      ? "border-primary-800 bg-primary-50/20 dark:bg-primary-950/10" 
                      : "border-slate-300 dark:border-slate-850 hover:border-slate-400 dark:hover:border-slate-700"
                  }`}
                  onClick={() => document.getElementById("file-input").click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    className="hidden"
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                  />
                  <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-450 dark:text-slate-400 mb-4 shadow-inner">
                    <Upload className="h-7 w-7" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">
                    Drag and Drop Excel File here
                  </h3>
                  <p className="text-xs text-slate-450 dark:text-slate-500 mt-1.5 max-w-xs leading-relaxed">
                    Supported columns: Team Leader's Name, Team Leader's Email, Team's Name, University, bKash Sender Number, Transaction ID, Ambassador ID, Type.
                  </p>
                  <Button variant="outline" size="sm" className="mt-5">
                    Browse Files
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            /* Preview Table */
            <Card className="flex-1 flex flex-col min-h-[400px]">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary-800" /> Excel List Preview</CardTitle>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Showing up to 10 rows</div>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Institution</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 10).map((row, idx) => (
                      <TableRow key={idx} className={row.errors.length > 0 ? "bg-red-50/30 dark:bg-red-950/10" : ""}>
                        <TableCell className="font-bold text-xs">{row.rowNum}</TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-850 dark:text-slate-100">{row.fullName}</div>
                          {row.teamName && (
                            <span className="text-[10px] text-primary-800 font-bold block mt-0.5">Team: {row.teamName}</span>
                          )}
                          {row.errors.length > 0 && (
                            <span className="text-[10px] text-red-500 font-bold block mt-0.5">{row.errors[0]}</span>
                          )}
                        </TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>{row.phone}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{row.institution}</TableCell>
                        <TableCell><Badge variant="neutral">{row.registrationType}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={row.paymentStatus.toLowerCase() === "paid" ? "success" : "warning"}>
                            {row.paymentStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Validation Summary Panel */}
        <div className="flex flex-col gap-6">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Import Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-850">
                <span className="text-sm text-slate-500 dark:text-slate-400 font-semibold">Total Records</span>
                <span className="text-base font-extrabold">{summary.total}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-850">
                <span className="text-sm text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-500" /> Ready to Import
                </span>
                <span className="text-base font-extrabold text-emerald-600">{summary.valid}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-red-500" /> Invalid (Will Skip)
                </span>
                <span className="text-base font-extrabold text-red-500">{summary.invalid}</span>
              </div>

              {parsedData.length > 0 && !importComplete && (
                <Button
                  onClick={handleImport}
                  disabled={summary.valid === 0 || importing}
                  loading={importing}
                  className="w-full mt-4 flex items-center justify-center gap-2"
                >
                  <Play className="h-4 w-4" /> Start Firestore Import
                </Button>
              )}

              {importComplete && (
                <div className="mt-4 p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl text-center flex flex-col items-center">
                  <CheckCircle className="h-10 w-10 text-emerald-500 mb-2" />
                  <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-300">Import Complete</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Participants added successfully. Firestore backend triggers will generate QR codes in background.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Validation Logs */}
          {validationReport.length > 0 && (
            <Card className="flex-1 max-h-[300px] flex flex-col">
              <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4.5 w-4.5 text-red-500" /> Validation Report</CardTitle>
                <Badge variant="danger">{validationReport.length} Errors</Badge>
              </CardHeader>
              <CardContent className="p-0 overflow-y-auto flex-1">
                <div className="divide-y divide-slate-100 dark:divide-slate-850">
                  {validationReport.map((err, idx) => (
                    <div key={idx} className="p-3 text-xs flex gap-2">
                      <div className="font-bold text-slate-400 flex-shrink-0">Row {err.row}</div>
                      <div className="flex-1">
                        <span className="font-bold block text-slate-700 dark:text-slate-350">{err.name || "Unknown"}</span>
                        <span className="text-red-500 leading-relaxed font-semibold">{err.error}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
