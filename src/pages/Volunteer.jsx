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

export const Volunteer = () => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedVol, setSelectedVol] = useState(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    id: "", fullName: "", email: "", phone: "", designation: "", tShirtSize: "", deptUniversity: ""
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "volunteers"), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setVolunteers(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const openFormModal = (vol = null) => {
    if (vol) {
      setFormData({
        id: vol.id,
        fullName: vol.fullName || "",
        email: vol.email || "",
        phone: vol.phone || "",
        designation: vol.designation || "",
        tShirtSize: vol.tShirtSize || "",
        deptUniversity: vol.deptUniversity || ""
      });
    } else {
      setFormData({ id: "", fullName: "", email: "", phone: "", designation: "", tShirtSize: "", deptUniversity: "" });
    }
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email) {
      showToast("Name and Email are required", "warning");
      return;
    }
    setLoading(true);
    try {
      if (formData.id) {
        await updateDoc(doc(db, "volunteers", formData.id), {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          designation: formData.designation,
          tShirtSize: formData.tShirtSize,
          deptUniversity: formData.deptUniversity
        });
        showToast("Organizer updated", "success");
      } else {
        const vId = `VOL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        await setDoc(doc(db, "volunteers", vId), {
          volunteerId: vId,
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          designation: formData.designation,
          tShirtSize: formData.tShirtSize,
          deptUniversity: formData.deptUniversity,
          createdAt: serverTimestamp()
        });
        showToast("Organizer created", "success");
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
    if (!selectedVol) return;
    try {
      await deleteDoc(doc(db, "volunteers", selectedVol.id));
      showToast("Organizer deleted", "success");
      setIsDeleteOpen(false);
      setSelectedVol(null);
    } catch (err) {
      console.error(err);
      showToast("Failed to delete", "error");
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
      name: findHeaderIndex(["name", "full name"]),
      email: findHeaderIndex(["email", "email address"]),
      phone: findHeaderIndex(["phone", "contact"]),
      designation: findHeaderIndex(["designation"]),
      tShirtSize: findHeaderIndex(["t-shirt size", "tshirt size", "size"]),
      deptUniversity: findHeaderIndex(["dept, university", "department", "university"])
    };

    if (hMap.name === -1 || hMap.email === -1) {
      showToast("Missing required columns: Name and Email", "error");
      return;
    }

    const validRows = [];
    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0 || !row[hMap.name] || !row[hMap.email]) continue;
      validRows.push({
        fullName: String(row[hMap.name]).trim(),
        email: String(row[hMap.email]).trim().toLowerCase(),
        phone: hMap.phone !== -1 && row[hMap.phone] ? String(row[hMap.phone]).trim() : "",
        designation: hMap.designation !== -1 && row[hMap.designation] ? String(row[hMap.designation]).trim() : "",
        tShirtSize: hMap.tShirtSize !== -1 && row[hMap.tShirtSize] ? String(row[hMap.tShirtSize]).trim() : "",
        deptUniversity: hMap.deptUniversity !== -1 && row[hMap.deptUniversity] ? String(row[hMap.deptUniversity]).trim() : ""
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
          const vId = `VOL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
          const ref = doc(db, "volunteers", vId);
          batch.set(ref, {
            volunteerId: vId,
            fullName: row.fullName,
            email: row.email,
            phone: row.phone,
            designation: row.designation,
            tShirtSize: row.tShirtSize,
            deptUniversity: row.deptUniversity,
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
        committed += chunk.length;
      }
      showToast(`Successfully imported ${committed} organizers.`, "success");
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
      <InstructionBanner title="Organizers Management" icon={Info} color="purple">
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Supported Columns:</strong> Upload an Excel file with columns for Full Name, Email, Contact, Designation, T-shirt Size, and Dept/University.</li>
          <li><strong>Usage:</strong> Organizers added here can be selected as the target audience in the Email Campaigns engine to send out mass updates.</li>
        </ul>
      </InstructionBanner>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-900 px-6 py-4 rounded-xl border border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <h1 className="text-xl font-bold">Organizers Database</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage and import organizer data</p>
        </div>
        {isAdmin && (
          <Button variant="primary" onClick={() => openFormModal()} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Organizer
          </Button>
        )}
      </div>

      {isAdmin && (
        <Card>
          <CardContent className="p-8">
            <form
              onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive ? "border-primary-800 bg-primary-50/20" : "border-slate-300 hover:border-slate-400"
              }`}
              onClick={() => document.getElementById("vol-file-input").click()}
            >
              <input id="vol-file-input" type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
                <Upload className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                {importing ? "Importing Data..." : "Drag and Drop Excel File here"}
              </h3>
              <p className="text-xs text-slate-450 dark:text-slate-500 mt-1.5">
                Supported columns: Full Name, Email, Contact, Designation, T-shirt Size, Dept, University
              </p>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Organizers List</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organizer ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Dept/Univ</TableHead>
                <TableHead>T-Shirt</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {volunteers.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs font-bold text-slate-500">{v.volunteerId}</TableCell>
                  <TableCell className="font-bold">{v.fullName}</TableCell>
                  <TableCell>{v.email}</TableCell>
                  <TableCell>{v.phone || "N/A"}</TableCell>
                  <TableCell>{v.designation || "N/A"}</TableCell>
                  <TableCell>{v.deptUniversity || "N/A"}</TableCell>
                  <TableCell>{v.tShirtSize || "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant={v.registrationScanned ? "success" : "neutral"} className="flex gap-1 items-center w-fit">
                      <UserCheck className="h-3 w-3" /> {v.registrationScanned ? "In" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="sm" className="p-1.5" onClick={() => { setSelectedVol(v); setIsDetailsOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="sm" className="p-1.5 text-blue-600 hover:text-blue-800" onClick={() => openFormModal(v)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="p-1.5 text-red-600 hover:text-red-800" onClick={() => { setSelectedVol(v); setIsDeleteOpen(true); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {volunteers.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">No organizers found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen} title="Organizer Details" size="3xl">
        {selectedVol && (
          <div className="flex flex-col md:flex-row gap-8 p-6">
            <div className="flex-1 space-y-6">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">{selectedVol.fullName}</h3>
                <p className="text-sm font-semibold text-primary-600 dark:text-primary-400 mt-1">{selectedVol.volunteerId}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-xs text-slate-500 font-bold block mb-1">Email</span><span className="text-sm font-medium break-all">{selectedVol.email}</span></div>
                <div><span className="text-xs text-slate-500 font-bold block mb-1">Phone</span><span className="text-sm font-medium">{selectedVol.phone || "N/A"}</span></div>
                <div><span className="text-xs text-slate-500 font-bold block mb-1">Designation</span><span className="text-sm font-medium">{selectedVol.designation || "N/A"}</span></div>
                <div><span className="text-xs text-slate-500 font-bold block mb-1">Dept/Univ</span><span className="text-sm font-medium">{selectedVol.deptUniversity || "N/A"}</span></div>
                <div><span className="text-xs text-slate-500 font-bold block mb-1">T-Shirt Size</span><span className="text-sm font-medium">{selectedVol.tShirtSize || "N/A"}</span></div>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <Badge variant={selectedVol.registrationScanned ? "success" : "neutral"}>
                  Reg: {selectedVol.registrationScanned ? "Scanned" : "Pending"}
                </Badge>
                <Badge variant={selectedVol.kitCollected ? "success" : "neutral"}>
                  Kit: {selectedVol.kitCollected ? "Collected" : "Pending"}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center border-l border-slate-100 dark:border-slate-800 pl-6">
              <span className="text-xs font-bold text-slate-500 uppercase mb-4">Organizer QR Code</span>
              {(() => {
                const qrUrl = selectedVol.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(JSON.stringify({ participantId: selectedVol.id, secureToken: selectedVol.volunteerId }))}`;
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
          </div>
        )}
      </Dialog>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen} title={formData.id ? "Edit Organizer" : "Add Organizer"} size="xl">
        <form onSubmit={handleFormSubmit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Full Name *</label>
              <Input required value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Email *</label>
              <Input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Phone</label>
              <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+880..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Designation</label>
              <Input value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} placeholder="Logistics Head" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Dept/University</label>
              <Input value={formData.deptUniversity} onChange={e => setFormData({ ...formData, deptUniversity: e.target.value })} placeholder="CSE, BUET" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">T-Shirt Size</label>
              <Input value={formData.tShirtSize} onChange={e => setFormData({ ...formData, tShirtSize: e.target.value })} placeholder="L" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" type="button" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? "Saving..." : formData.id ? "Save Changes" : "Create Organizer"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen} title="Delete Organizer" size="sm">
        <div className="p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to delete <strong>{selectedVol?.fullName}</strong>? This action cannot be undone.
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
