import React, { useState, useEffect, useCallback } from "react";
import { db } from "../services/firebase";
import { collection, onSnapshot, writeBatch, doc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/Table";
import { InstructionBanner } from "../components/ui/InstructionBanner";
import { Dialog } from "../components/ui/Dialog";
import { Upload, FileSpreadsheet, Info } from "lucide-react";
import * as XLSX from "xlsx";

export const Ambassador = () => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  
  const [ambassadors, setAmbassadors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedAmb, setSelectedAmb] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ambassadors"), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setAmbassadors(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const processExcelData = async (data) => {
    const rawRows = XLSX.utils.sheet_to_json(data, { header: 1 });
    if (rawRows.length <= 1) {
      showToast("Excel sheet is empty", "error");
      return;
    }
    const headers = rawRows[0].map(h => String(h).trim().toLowerCase());
    const findHeaderIndex = (aliases) => {
      for (const alias of aliases) {
        const idx = headers.indexOf(alias.toLowerCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };
    
    const hMap = {
      fullName: findHeaderIndex(["full name", "name"]),
      universityName: findHeaderIndex(["university name", "university"]),
      universityEmail: findHeaderIndex(["university email"]),
      personalEmail: findHeaderIndex(["personal email", "email"]),
      mobileNumber: findHeaderIndex(["mobile number", "mobile", "phone", "contact"])
    };

    if (hMap.fullName === -1 || (hMap.universityEmail === -1 && hMap.personalEmail === -1)) {
      showToast("Missing required columns: Full Name and at least one Email", "error");
      return;
    }

    const validRows = [];
    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0 || !row[hMap.fullName] || (!row[hMap.universityEmail] && !row[hMap.personalEmail])) continue;
      validRows.push({
        fullName: String(row[hMap.fullName]).trim(),
        universityName: hMap.universityName !== -1 && row[hMap.universityName] ? String(row[hMap.universityName]).trim() : "",
        universityEmail: hMap.universityEmail !== -1 && row[hMap.universityEmail] ? String(row[hMap.universityEmail]).trim().toLowerCase() : "",
        personalEmail: hMap.personalEmail !== -1 && row[hMap.personalEmail] ? String(row[hMap.personalEmail]).trim().toLowerCase() : "",
        mobileNumber: hMap.mobileNumber !== -1 && row[hMap.mobileNumber] ? String(row[hMap.mobileNumber]).trim() : "",
      });
    }

    if (validRows.length === 0) {
      showToast("No valid rows found", "warning");
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
          const aId = `AMB-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
          const ref = doc(db, "ambassadors", aId);
          batch.set(ref, {
            ambassadorId: aId,
            fullName: row.fullName,
            universityName: row.universityName,
            universityEmail: row.universityEmail,
            personalEmail: row.personalEmail,
            email: row.personalEmail || row.universityEmail,
            phone: row.mobileNumber,
            mobileNumber: row.mobileNumber,
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
        committed += chunk.length;
      }
      showToast(`Successfully imported ${committed} ambassadors.`, "success");
    } catch (err) {
      console.error(err);
      showToast(`Import failed: ${err.message}`, "error");
    } finally {
      setImporting(false);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        processExcelData(wb.Sheets[wb.SheetNames[0]]);
      };
      reader.readAsBinaryString(file);
    }
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        processExcelData(wb.Sheets[wb.SheetNames[0]]);
      };
      reader.readAsBinaryString(file);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <InstructionBanner title="Ambassador Management" icon={Info} color="purple">
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Supported Columns:</strong> Upload an Excel file with columns for Full Name, University Name, University Email, Personal Email, and Mobile Number.</li>
          <li><strong>Usage:</strong> Ambassadors added here can be selected as the target audience in the Email Campaigns engine to send out mass updates.</li>
        </ul>
      </InstructionBanner>

      <div className="flex justify-between items-center bg-white dark:bg-slate-900 px-6 py-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold">Ambassadors Database</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage and import ambassador data</p>
        </div>
      </div>

      {isAdmin && (
        <Card>
          <CardContent className="p-8">
            <form
              onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive ? "border-primary-800 bg-primary-50/20" : "border-slate-300 hover:border-slate-400"
              }`}
              onClick={() => document.getElementById("amb-file-input").click()}
            >
              <input id="amb-file-input" type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
                <Upload className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                {importing ? "Importing Data..." : "Drag and Drop Excel File here"}
              </h3>
              <p className="text-xs text-slate-450 dark:text-slate-500 mt-1.5">
                Supported columns: Full Name, University Name, University Email, Personal Email, Mobile Number
              </p>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Ambassadors List</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ambassador ID</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>University Name</TableHead>
                <TableHead>University Email</TableHead>
                <TableHead>Personal Email</TableHead>
                <TableHead>Mobile Number</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ambassadors.map(a => (
                <TableRow key={a.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setSelectedAmb(a)}>
                  <TableCell className="font-mono text-xs font-bold text-slate-500">{a.ambassadorId}</TableCell>
                  <TableCell className="font-bold">{a.fullName}</TableCell>
                  <TableCell>{a.universityName || "N/A"}</TableCell>
                  <TableCell>{a.universityEmail || "N/A"}</TableCell>
                  <TableCell>{a.personalEmail || "N/A"}</TableCell>
                  <TableCell>{a.mobileNumber || "N/A"}</TableCell>
                </TableRow>
              ))}
              {ambassadors.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">No ambassadors found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedAmb} onOpenChange={(open) => !open && setSelectedAmb(null)} title="Ambassador QR Code">
        {selectedAmb && (
          <div className="flex flex-col items-center justify-center p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">{selectedAmb.fullName}</h3>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {selectedAmb.universityName || selectedAmb.universityEmail}
            </p>
            {(() => {
              const qrUrl = selectedAmb.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(JSON.stringify({ participantId: selectedAmb.id, secureToken: selectedAmb.ambassadorId }))}`;
              return (
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-inner flex flex-col items-center mt-4">
                  <img src={qrUrl} alt="QR Code" className="h-44 w-44 object-contain" />
                  <a href={qrUrl} target="_blank" rel="noreferrer" className="text-xs text-primary-600 font-bold mt-3 underline">
                    Download / Open Full Size
                  </a>
                </div>
              );
            })()}
          </div>
        )}
      </Dialog>
    </div>
  );
};
