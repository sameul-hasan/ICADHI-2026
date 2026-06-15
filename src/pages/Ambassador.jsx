import React, { useState, useEffect, useCallback } from "react";
import { db } from "../services/firebase";
import { collection, onSnapshot, writeBatch, doc, serverTimestamp, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/Table";
import { InstructionBanner } from "../components/ui/InstructionBanner";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Dialog } from "../components/ui/Dialog";
import { Upload, FileSpreadsheet, Info, Plus, Eye, Edit, Trash2, UserCheck } from "lucide-react";
import * as XLSX from "xlsx";

export const Ambassador = () => {
  const { isAdmin, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  
  const [ambassadors, setAmbassadors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedAmb, setSelectedAmb] = useState(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    id: "", fullName: "", universityName: "", universityEmail: "", personalEmail: "", mobileNumber: "", tableNumber: ""
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ambassadors"), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setAmbassadors(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const openFormModal = (amb = null) => {
    if (amb) {
      setFormData({
        id: amb.id,
        fullName: amb.fullName || "",
        universityName: amb.universityName || "",
        universityEmail: amb.universityEmail || "",
        personalEmail: amb.personalEmail || "",
        mobileNumber: amb.mobileNumber || "",
        tableNumber: amb.tableNumber || "",
      });
    } else {
      let nextTableNum = 1;
      ambassadors.forEach(p => {
        if (p.tableNumber) {
          const numStr = String(p.tableNumber).replace(/\D/g, '');
          if (numStr) {
            const numPart = parseInt(numStr, 10);
            if (!isNaN(numPart) && numPart >= nextTableNum) {
              nextTableNum = numPart + 1;
            }
          }
        }
      });
      const autoTableNumber = nextTableNum.toString();

      setFormData({ 
        id: "", 
        fullName: "", 
        universityName: "", 
        universityEmail: "", 
        personalEmail: "", 
        mobileNumber: "",
        tableNumber: autoTableNumber 
      });
    }
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName || (!formData.universityEmail && !formData.personalEmail)) {
      showToast("Name and at least one email are required", "warning");
      return;
    }
    setLoading(true);
    try {
      if (formData.id) {
        await updateDoc(doc(db, "ambassadors", formData.id), {
          fullName: formData.fullName,
          universityName: formData.universityName,
          universityEmail: formData.universityEmail.toLowerCase(),
          personalEmail: formData.personalEmail.toLowerCase(),
          email: formData.personalEmail.toLowerCase() || formData.universityEmail.toLowerCase(),
          phone: formData.mobileNumber,
          mobileNumber: formData.mobileNumber,
          tableNumber: formData.tableNumber,
        });
        showToast("Ambassador updated", "success");
      } else {
        const aId = `AMB-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        await setDoc(doc(db, "ambassadors", aId), {
          ambassadorId: aId,
          fullName: formData.fullName,
          universityName: formData.universityName,
          universityEmail: formData.universityEmail.toLowerCase(),
          personalEmail: formData.personalEmail.toLowerCase(),
          email: formData.personalEmail.toLowerCase() || formData.universityEmail.toLowerCase(),
          phone: formData.mobileNumber,
          mobileNumber: formData.mobileNumber,
          tableNumber: formData.tableNumber,
          createdAt: serverTimestamp()
        });
        showToast("Ambassador created", "success");
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Operation failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAmb) return;
    try {
      await deleteDoc(doc(db, "ambassadors", selectedAmb.id));
      showToast("Ambassador deleted", "success");
      setIsDeleteOpen(false);
      setSelectedAmb(null);
    } catch (err) {
      console.error(err);
      showToast("Failed to delete", "error");
    }
  };

  const autoAssignTableNumbers = async () => {
    if (!window.confirm("This will assign SL-XX table numbers to all ambassadors who do not have one yet. Continue?")) return;
    
    let nextTableNum = 1;
    ambassadors.forEach(p => {
      if (p.tableNumber) {
        const numStr = String(p.tableNumber).replace(/\D/g, '');
        if (numStr) {
          const numPart = parseInt(numStr, 10);
          if (!isNaN(numPart) && numPart >= nextTableNum) {
            nextTableNum = numPart + 1;
          }
        }
      }
    });

    const unassigned = ambassadors.filter(p => !p.tableNumber || p.tableNumber.trim() === "");
    if (unassigned.length === 0) {
      showToast("All ambassadors already have table numbers!", "success");
      return;
    }

    setLoading(true);
    let count = 0;
    try {
      for (const p of unassigned) {
        const tNum = nextTableNum.toString();
        await updateDoc(doc(db, "ambassadors", p.id), {
          tableNumber: tNum,
        });
        nextTableNum++;
        count++;
      }
      showToast(`Assigned table numbers to ${count} ambassadors!`, "success");
    } catch (err) {
      console.error(err);
      showToast("Error assigning table numbers", "error");
    } finally {
      setLoading(false);
    }
  };

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
      let nextTableNum = 1;
      ambassadors.forEach(p => {
        if (p.tableNumber && String(p.tableNumber).toUpperCase().startsWith("SL-")) {
          const numPart = parseInt(String(p.tableNumber).substring(3), 10);
          if (!isNaN(numPart) && numPart >= nextTableNum) {
            nextTableNum = numPart + 1;
          }
        }
      });

      const batchSize = 450;
      let committed = 0;
      for (let i = 0; i < validRows.length; i += batchSize) {
        const chunk = validRows.slice(i, i + batchSize);
        const batch = writeBatch(db);
        chunk.forEach(row => {
          const autoTableNumber = nextTableNum.toString();
          nextTableNum++;
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
            tableNumber: autoTableNumber,
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
          <li><strong>Manual Entry:</strong> Add ambassadors manually using the "Add Ambassador" button.</li>
          <li><strong>Usage:</strong> Ambassadors added here can be selected as the target audience in the Email Campaigns engine to send out mass updates.</li>
        </ul>
      </InstructionBanner>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-900 px-6 py-4 rounded-xl border border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <h1 className="text-xl font-bold">Ambassadors Database</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage and import ambassador data</p>
        </div>
        {isAdmin && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={autoAssignTableNumbers} variant="outline" className="flex items-center gap-1.5 self-start sm:self-center border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20">
              Auto-Assign Missing Tables
            </Button>
            <Button variant="primary" onClick={() => openFormModal()} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Ambassador
            </Button>
          </div>
        )}
      </div>



      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Ambassadors List</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table</TableHead>
                <TableHead>Ambassador ID</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>University Name</TableHead>
                <TableHead>University Email</TableHead>
                <TableHead>Personal Email</TableHead>
                <TableHead>Mobile Number</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ambassadors.map((a, index) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs font-medium text-slate-500">{a.tableNumber || "N/A"}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-slate-500">{a.ambassadorId}</TableCell>
                  <TableCell className="font-bold">{a.fullName}</TableCell>
                  <TableCell>{a.universityName || "N/A"}</TableCell>
                  <TableCell>{a.universityEmail || "N/A"}</TableCell>
                  <TableCell>{a.personalEmail || "N/A"}</TableCell>
                  <TableCell>{a.mobileNumber || "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant={a.registrationScanned ? "success" : "neutral"} className="flex gap-1 items-center w-fit">
                      <UserCheck className="h-3 w-3" /> {a.registrationScanned ? "In" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="sm" className="p-1.5" onClick={() => { setSelectedAmb(a); setIsDetailsOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="sm" className="p-1.5 text-blue-600 hover:text-blue-800" onClick={() => openFormModal(a)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="p-1.5 text-red-600 hover:text-red-800" onClick={() => { setSelectedAmb(a); setIsDeleteOpen(true); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {ambassadors.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-500">No ambassadors found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} title="Ambassador Details" size="xl">
        {selectedAmb && (
          <div className="flex flex-col md:flex-row gap-8 p-6">
            <div className="flex-1 space-y-6">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">{selectedAmb.fullName}</h3>
                <p className="text-sm font-semibold text-primary-600 dark:text-primary-400 mt-1">{selectedAmb.ambassadorId}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-xs text-slate-500 font-bold block mb-1">University Name</span><span className="text-sm font-medium">{selectedAmb.universityName || "N/A"}</span></div>
                <div><span className="text-xs text-slate-500 font-bold block mb-1">Mobile</span><span className="text-sm font-medium">{selectedAmb.mobileNumber || "N/A"}</span></div>
                <div><span className="text-xs text-slate-500 font-bold block mb-1">University Email</span><span className="text-sm font-medium break-all">{selectedAmb.universityEmail || "N/A"}</span></div>
                <div><span className="text-xs text-slate-500 font-bold block mb-1">Personal Email</span><span className="text-sm font-medium break-all">{selectedAmb.personalEmail || "N/A"}</span></div>
              </div>
              {selectedAmb.tableNumber && (
                <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-4 rounded-xl border border-blue-700 shadow-md">
                  <span className="text-xs font-bold text-blue-200 uppercase tracking-wider block mb-1">Assigned Table</span>
                  <p className="text-xl font-black text-white leading-none">Table {selectedAmb.tableNumber}</p>
                </div>
              )}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                <Badge variant={selectedAmb.registrationScanned ? "success" : "neutral"}>
                  Reg: {selectedAmb.registrationScanned ? "Scanned" : "Pending"}
                </Badge>
                <Badge variant={selectedAmb.kitCollected ? "success" : "neutral"}>
                  Kit: {selectedAmb.kitCollected ? "Collected" : "Pending"}
                </Badge>
                <Badge variant={selectedAmb.breakfastCollected ? "success" : "neutral"}>
                  Breakfast: {selectedAmb.breakfastCollected ? "Collected" : "Pending"}
                </Badge>
                <Badge variant={selectedAmb.lunchCollected ? "success" : "neutral"}>
                  Lunch: {selectedAmb.lunchCollected ? "Collected" : "Pending"}
                </Badge>
              </div>
            </div>
            {(isAdmin || isSuperAdmin) && (
              <div className="flex flex-col items-center justify-center border-l border-slate-100 dark:border-slate-800 pl-6">
                <span className="text-xs font-bold text-slate-500 uppercase mb-4">Ambassador QR Code</span>
                {(() => {
                  const qrUrl = selectedAmb.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(JSON.stringify({ participantId: selectedAmb.id, secureToken: selectedAmb.ambassadorId }))}`;
                  return (
                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-inner flex flex-col items-center">
                      <img src={qrUrl} alt="QR Code" className="h-44 w-44 object-contain" />
                      <a href={qrUrl} target="_blank" rel="noreferrer" className="text-xs text-primary-600 font-bold mt-3 underline">
                        Download Full Size
                      </a>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </Dialog>

      <Dialog isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={formData.id ? "Edit Ambassador" : "Add Ambassador"} size="xl">
        <form onSubmit={handleFormSubmit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Full Name *</label>
              <Input required value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">University Name</label>
              <Input value={formData.universityName} onChange={e => setFormData({ ...formData, universityName: e.target.value })} placeholder="Dhaka University" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">University Email</label>
              <Input type="email" value={formData.universityEmail} onChange={e => setFormData({ ...formData, universityEmail: e.target.value })} placeholder="student@du.ac.bd" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Personal Email</label>
              <Input type="email" value={formData.personalEmail} onChange={e => setFormData({ ...formData, personalEmail: e.target.value })} placeholder="john@gmail.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Mobile Number</label>
              <Input value={formData.mobileNumber} onChange={e => setFormData({ ...formData, mobileNumber: e.target.value })} placeholder="+880..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Table Number</label>
              <Input value={formData.tableNumber} onChange={e => setFormData({ ...formData, tableNumber: e.target.value })} placeholder="1" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" type="button" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? "Saving..." : formData.id ? "Save Changes" : "Create Ambassador"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Delete Ambassador" size="sm">
        <div className="p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to delete <strong>{selectedAmb?.fullName}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
