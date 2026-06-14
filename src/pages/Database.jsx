import React, { useState, useEffect } from "react";
import { db } from "../services/firebase";
import { 
  collection, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  updateDoc, 
  addDoc, 
  setDoc,
  serverTimestamp 
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { InstructionBanner } from "../components/ui/InstructionBanner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { Dialog } from "../components/ui/Dialog";
import { 
  Search, 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Mail, 
  SlidersHorizontal, 
  Download, 
  Calendar, 
  UserRoundCheck,
  UserCheck,
  Upload,
  Info
} from "lucide-react";

export const DatabasePage = () => {
  const { userProfile, isAdmin, isSuperAdmin } = useAuth();
  const { showToast } = useToast();

  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [regFilter, setRegFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset pagination to page 1 on filter/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, regFilter, paymentFilter, statusFilter, countryFilter]);

  // Modals state
  const [selectedPart, setSelectedPart] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  // Participant form data state
  const [formData, setFormData] = useState({
    id: "",
    fullName: "",
    email: "",
    phone: "",
    institution: "",
    department: "",
    designation: "",
    country: "",
    registrationType: "Regular",
    paymentStatus: "Pending",
    teamName: "",
    teamMembers: "",
    tableNumber: "",
    tShirtSize: "",
    ieeeMembershipLink: "",
    bkashNumber: "",
    transactionId: "",
    ambassadorId: "",
    paymentDetails: "",
    payment2: "",
    timestamp: ""
  });

  // Load participants
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "participants"), (snap) => {
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setParticipants(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      showToast("Failed to fetch participants", "error");
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Filter participants
  const filteredParticipants = participants.filter(p => {
    // Search match
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (p.fullName || "").toLowerCase().includes(searchLower) ||
      (p.email || "").toLowerCase().includes(searchLower) ||
      (p.phone || "").toLowerCase().includes(searchLower) ||
      (p.institution || "").toLowerCase().includes(searchLower) ||
      (p.teamName || "").toLowerCase().includes(searchLower) ||
      (p.transactionId || "").toLowerCase().includes(searchLower) ||
      (p.participantId || "").toLowerCase().includes(searchLower);

    // Dropdown matches
    const matchesReg = regFilter ? p.registrationType === regFilter : true;
    const matchesPayment = paymentFilter ? p.paymentStatus === paymentFilter : true;
    const matchesCountry = countryFilter ? p.country === countryFilter : true;

    let matchesStatus = true;
    if (statusFilter === "checked_in") matchesStatus = p.registrationScanned;
    else if (statusFilter === "pending_check_in") matchesStatus = !p.registrationScanned;
    else if (statusFilter === "email_sent") matchesStatus = p.emailSent;
    else if (statusFilter === "email_failed") matchesStatus = !p.emailSent && p.emailSentAt !== null;

    return matchesSearch && matchesReg && matchesPayment && matchesCountry && matchesStatus;
  });

  // List unique countries, registration types, and payment statuses for filter dropdowns
  const countries = Array.from(new Set(participants.map(p => p.country).filter(Boolean))).sort();
  const registrationTypes = Array.from(new Set(participants.map(p => p.registrationType).filter(Boolean))).sort();
  const paymentStatuses = Array.from(new Set(participants.map(p => p.paymentStatus).filter(Boolean))).sort();

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredParticipants.length / ITEMS_PER_PAGE));
  const paginatedParticipants = filteredParticipants.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Open Add/Edit Modal
  const openFormModal = (part = null) => {
    if (part) {
      setFormData({
        id: part.id,
        fullName: part.fullName || "",
        email: part.email || "",
        phone: part.phone || "",
        institution: part.institution || "",
        department: part.department || "",
        designation: part.designation || "",
        country: part.country || "",
        registrationType: part.registrationType || "Regular",
        paymentStatus: part.paymentStatus || "Pending",
        teamName: part.teamName || "",
        teamMembers: part.teamMembers || "",
        tableNumber: part.tableNumber || "",
        tShirtSize: part.tShirtSize || "",
        ieeeMembershipLink: part.ieeeMembershipLink || "",
        bkashNumber: part.bkashNumber || "",
        transactionId: part.transactionId || "",
        ambassadorId: part.ambassadorId || "",
        paymentDetails: part.paymentDetails || "",
        payment2: part.payment2 || "",
        timestamp: part.timestamp || ""
      });
    } else {
      let nextTableNum = 1;
      participants.forEach(p => {
        if (p.tableNumber && String(p.tableNumber).toUpperCase().startsWith("SL-")) {
          const numPart = parseInt(String(p.tableNumber).substring(3), 10);
          if (!isNaN(numPart) && numPart >= nextTableNum) {
            nextTableNum = numPart + 1;
          }
        }
      });
      const autoTableNumber = `SL-${nextTableNum.toString().padStart(2, '0')}`;

      setFormData({
        id: "",
        fullName: "",
        email: "",
        phone: "",
        institution: "",
        department: "",
        designation: "",
        country: "",
        registrationType: "Regular",
        paymentStatus: "Pending",
        teamName: "",
        teamMembers: "",
        tableNumber: autoTableNumber,
        ieeeMembershipLink: "",
        bkashNumber: "",
        transactionId: "",
        ambassadorId: "",
        paymentDetails: "",
        payment2: "",
        timestamp: ""
      });
    }
    setIsFormOpen(true);
  };

  // Submit Add/Edit form
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email) {
      showToast("Name and Email are required", "warning");
      return;
    }

    try {
      if (formData.id) {
        // Edit record
        const ref = doc(db, "participants", formData.id);
        await updateDoc(ref, {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          institution: formData.institution,
          department: formData.department,
          designation: formData.designation,
          country: formData.country,
          registrationType: formData.registrationType,
          paymentStatus: formData.paymentStatus,
          teamName: formData.teamName,
          teamMembers: formData.teamMembers,
          tableNumber: formData.tableNumber,
          tShirtSize: formData.tShirtSize,
          ieeeMembershipLink: formData.ieeeMembershipLink,
          bkashNumber: formData.bkashNumber,
          transactionId: formData.transactionId,
          ambassadorId: formData.ambassadorId,
          paymentDetails: formData.paymentDetails,
          payment2: formData.payment2,
          timestamp: formData.timestamp,
          updatedAt: serverTimestamp()
        });

        // Audit log
        await addDoc(collection(db, "auditLogs"), {
          userId: userProfile?.uid || "unknown",
          userEmail: userProfile?.email || "unknown",
          userRole: userProfile?.role || "admin",
          action: "Participant Profile Updated",
          details: `Updated info for ${formData.teamName || formData.fullName} (${formData.email})`,
          timestamp: serverTimestamp()
        });

        showToast("Participant updated successfully", "success");
      } else {
        // Add new record
        const participantId = `ICADHI-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const secureToken = `ICADHI-2026-${Math.random().toString(36).substr(2, 9).toUpperCase()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(JSON.stringify({ participantId, secureToken }))}`;

        await setDoc(doc(db, "participants", participantId), {
          participantId,
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          institution: formData.institution,
          department: formData.department,
          designation: formData.designation,
          country: formData.country,
          registrationType: formData.registrationType,
          paymentStatus: formData.paymentStatus,
          teamName: formData.teamName,
          teamMembers: formData.teamMembers,
          tableNumber: formData.tableNumber,
          tShirtSize: formData.tShirtSize,
          ieeeMembershipLink: formData.ieeeMembershipLink,
          bkashNumber: formData.bkashNumber,
          transactionId: formData.transactionId,
          ambassadorId: formData.ambassadorId,
          paymentDetails: formData.paymentDetails,
          payment2: formData.payment2,
          timestamp: formData.timestamp,

          // Initial States
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

        // Audit log
        await addDoc(collection(db, "auditLogs"), {
          userId: userProfile?.uid || "unknown",
          userEmail: userProfile?.email || "unknown",
          userRole: userProfile?.role || "admin",
          action: "Participant Created",
          details: `Manually added participant: ${formData.teamName || formData.fullName} (${formData.email})`,
          timestamp: serverTimestamp()
        });

        showToast("Participant created successfully. QR is generating...", "success");
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Save operation failed", "error");
    }
  };

  // Delete participant
  const handleDelete = async () => {
    if (!selectedPart) return;
    try {
      await deleteDoc(doc(db, "participants", selectedPart.id));

      // Audit log
      await addDoc(collection(db, "auditLogs"), {
        userId: userProfile?.uid || "unknown",
        userEmail: userProfile?.email || "unknown",
        userRole: userProfile?.role || "super_admin",
        action: "Participant Deleted",
        details: `Deleted participant record: ${selectedPart.teamName || selectedPart.fullName} (${selectedPart.email})`,
        timestamp: serverTimestamp()
      });

      showToast("Participant deleted successfully", "success");
      setIsDeleteOpen(false);
      setSelectedPart(null);
    } catch (err) {
      console.error(err);
      showToast("Delete operation failed", "error");
    }
  };

  // Resend Verification Email Trigger
  const triggerEmailResend = async (p) => {
    try {
      // Queue participant email: update their status to trigger a send or make a call.
      // For this system, we can update emailSent = false and set custom trigger, 
      // or we can invoke the Cloud Function.
      // Let's create an emailCampaign to resend.
      // An easy, elegant way is to set `emailSent = false` to let them be selected in email engine list.
      await updateDoc(doc(db, "participants", p.id), {
        emailSent: false,
        updatedAt: serverTimestamp()
      });
      showToast("Status updated. Go to Email Campaigns to send/resend.", "info");
    } catch (err) {
      console.error(err);
      showToast("Failed to trigger resend", "error");
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full pb-10">
      <InstructionBanner title="Participants Database Guide" icon={Info} color="amber">
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Search & Filter:</strong> Use the search bar to find attendees quickly. Filter by Registration Type or Payment Status.</li>
          <li><strong>Actions:</strong> Click the <strong>View</strong> icon to open the participant profile, generate QR codes manually, or delete records.</li>
          <li><strong>Manual Registration:</strong> Click <strong>+ Add Participant</strong> to register someone at the desk directly.</li>
        </ul>
      </InstructionBanner>

      {/* Table Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 px-6 py-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold">Participants</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage all registered delegates and check-in logs</p>
        </div>
        {isAdmin && (
          <Button onClick={() => openFormModal()} className="flex items-center gap-1.5 self-start sm:self-center">
            <Plus className="h-4.5 w-4.5" /> Manual Registration
          </Button>
        )}
      </div>

      {/* Filters Toolbar */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="flex-1">
              <Input
                placeholder="Search by name, email, phone, institution..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={<Search className="h-4 w-4" />}
              />
            </div>
            
            {/* Actions button */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex items-center gap-1.5 text-xs font-bold"
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="h-4 w-4" /> Filter Options
              </Button>
            </div>
          </div>

          {/* Advanced Filter Selections */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Select
                label="Registration Type"
                placeholder="All Types"
                value={regFilter}
                onChange={(e) => setRegFilter(e.target.value)}
                options={registrationTypes.map(t => ({ value: t, label: t }))}
              />
              <Select
                label="Payment Status"
                placeholder="All Statuses"
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                options={paymentStatuses.map(s => ({ value: s, label: s }))}
              />
              <Select
                label="Attendance Status"
                placeholder="All Statuses"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: "checked_in", label: "Checked In" },
                  { value: "pending_check_in", label: "Pending Check-in" },
                  { value: "email_sent", label: "QR Email Sent" },
                  { value: "email_failed", label: "QR Email Failed" }
                ]}
              />
              <Select
                label="Country"
                placeholder="All Countries"
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                options={countries.map(c => ({ value: c, label: c }))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Table grid */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-semibold flex flex-col items-center justify-center">
            <svg className="animate-spin h-8 w-8 text-primary-800 mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading database...
          </div>
        ) : filteredParticipants.length === 0 ? (
          <div className="p-12 text-center text-slate-450 dark:text-slate-500 font-medium flex flex-col items-center">
            <UserRoundCheck className="h-12 w-12 text-slate-300 mb-3" />
            No participants found matching the filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team ID</TableHead>
                  <TableHead>Team / Leader</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Reg Type</TableHead>
                  <TableHead>T-Shirt</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedParticipants.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-500">{p.participantId}</TableCell>
                    <TableCell>
                      <div>
                        {p.teamName ? (
                          <>
                            <span className="font-extrabold text-sm text-slate-900 dark:text-slate-50">{p.teamName}</span>
                            <span className="block text-xs text-slate-500 font-bold mt-0.5">Leader: {p.fullName}</span>
                          </>
                        ) : (
                          <span className="font-extrabold text-sm text-slate-900 dark:text-slate-50">{p.fullName}</span>
                        )}
                        <span className="block text-[11px] text-slate-400 font-semibold mt-0.5">{p.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="truncate max-w-[150px]">{p.institution || <span className="text-slate-400 italic">None</span>}</TableCell>
                    <TableCell><Badge variant="neutral">{p.registrationType}</Badge></TableCell>
                    <TableCell className="truncate max-w-[120px] text-xs font-semibold text-slate-600" title={p.tShirtSize}>{p.tShirtSize || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={p.paymentStatus?.toLowerCase() === "paid" ? "success" : "warning"}>
                        {p.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.registrationScanned ? "success" : "neutral"} className="flex gap-1 items-center w-fit">
                        <UserCheck className="h-3 w-3" /> {p.registrationScanned ? "In" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1.5"
                          onClick={() => { setSelectedPart(p); setIsDetailsOpen(true); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1.5 text-blue-600 hover:text-blue-800"
                            onClick={() => openFormModal(p)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1.5 text-sky-600 hover:text-sky-800"
                            onClick={() => triggerEmailResend(p)}
                            title="Reset Email Status"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        {isSuperAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1.5 text-red-600 hover:text-red-800"
                            onClick={() => { setSelectedPart(p); setIsDeleteOpen(true); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* Pagination footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50">
              <div className="text-xs font-bold text-slate-500">
                Showing {Math.min(filteredParticipants.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}-
                {Math.min(filteredParticipants.length, currentPage * ITEMS_PER_PAGE)} of {filteredParticipants.length} teams
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="text-xs font-bold px-3 py-1.5"
                >
                  Previous
                </Button>
                <span className="text-xs font-bold text-slate-700 px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="text-xs font-bold px-3 py-1.5"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 1. Modal: View Details */}
      <Dialog
        isOpen={isDetailsOpen}
        onClose={() => { setIsDetailsOpen(false); setSelectedPart(null); }}
        title="Participant Details"
        size="lg"
      >
        {selectedPart && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Team ID / Token</span>
                <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">{selectedPart.participantId}</p>
                <p className="text-xs font-mono text-slate-400 mt-0.5 truncate">
                  {selectedPart.uniqueToken || `ICADHI-2026-${selectedPart.participantId}`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Team Name</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedPart.teamName || "Individual Participant"}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Team Leader Name</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedPart.fullName}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Email Address</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{selectedPart.email}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Phone Number</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedPart.phone || "N/A"}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Institution</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedPart.institution || "N/A"}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Department</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedPart.department || "N/A"}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Country</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedPart.country || "N/A"}</p>
                </div>
                {selectedPart.ambassadorId && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Ambassador ID</span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedPart.ambassadorId}</p>
                  </div>
                )}
                {selectedPart.bkashNumber && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">bKash Sender Number</span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedPart.bkashNumber}</p>
                  </div>
                )}
                {selectedPart.transactionId && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Transaction ID</span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedPart.transactionId}</p>
                  </div>
                )}
                {selectedPart.paymentDetails && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Payment Details</span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedPart.paymentDetails}</p>
                  </div>
                )}
                {selectedPart.payment2 && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Payment 2</span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedPart.payment2}</p>
                  </div>
                )}
              </div>
              {selectedPart.tableNumber && (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider block mb-1">Assigned Table</span>
                  <p className="text-lg font-black text-amber-800 dark:text-amber-400 leading-none">Table {selectedPart.tableNumber}</p>
                </div>
              )}
              {selectedPart.teamMembers && (
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Team Members</span>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-normal">{selectedPart.teamMembers}</p>
                </div>
              )}
              {selectedPart.tShirtSize && (
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">T-Shirt Sizes</span>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-normal">{selectedPart.tShirtSize}</p>
                </div>
              )}
              {selectedPart.ieeeMembershipLink && (
                <div className="pt-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">IEEE Membership Link</span>
                  {selectedPart.ieeeMembershipLink.startsWith("http") ? (
                    <a href={selectedPart.ieeeMembershipLink} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary-850 hover:underline block break-all">
                      {selectedPart.ieeeMembershipLink}
                    </a>
                  ) : (
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{selectedPart.ieeeMembershipLink}</p>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase">Check-in Logs</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60">
                    <span className="font-bold block text-slate-400">Registration Check-in</span>
                    <span className="font-black text-slate-700 dark:text-slate-300">
                      {selectedPart.registrationScanned ? "Verified" : "Pending"}
                    </span>
                    {selectedPart.registrationScannedAt && (
                      <span className="block text-[10px] text-slate-400 mt-1">
                        {selectedPart.registrationScannedAt.toDate ? selectedPart.registrationScannedAt.toDate().toLocaleString() : new Date(selectedPart.registrationScannedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60">
                    <span className="font-bold block text-slate-400">Kit Collection</span>
                    <span className="font-black text-slate-700 dark:text-slate-300">
                      {selectedPart.kitCollected ? "Collected" : "Pending"}
                    </span>
                    {selectedPart.kitCollectedAt && (
                      <span className="block text-[10px] text-slate-400 mt-1">
                        {selectedPart.kitCollectedAt.toDate ? selectedPart.kitCollectedAt.toDate().toLocaleString() : new Date(selectedPart.kitCollectedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60">
                    <span className="font-bold block text-slate-400">Breakfast Desk</span>
                    <span className="font-black text-slate-700 dark:text-slate-300">
                      {selectedPart.breakfastCollected ? "Distributed" : "Pending"}
                    </span>
                    {selectedPart.breakfastCollectedAt && (
                      <span className="block text-[10px] text-slate-400 mt-1">
                        {selectedPart.breakfastCollectedAt.toDate ? selectedPart.breakfastCollectedAt.toDate().toLocaleString() : new Date(selectedPart.breakfastCollectedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60">
                    <span className="font-bold block text-slate-400">Lunch Desk</span>
                    <span className="font-black text-slate-700 dark:text-slate-300">
                      {selectedPart.lunchCollected ? "Distributed" : "Pending"}
                    </span>
                    {selectedPart.lunchCollectedAt && (
                      <span className="block text-[10px] text-slate-400 mt-1">
                        {selectedPart.lunchCollectedAt.toDate ? selectedPart.lunchCollectedAt.toDate().toLocaleString() : new Date(selectedPart.lunchCollectedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* QR Display */}
            <div className="flex flex-col items-center justify-center border-l border-slate-100 dark:border-slate-800 pl-6 space-y-4">
              <span className="text-xs font-bold text-slate-500 uppercase">Participant QR Code</span>
              {(() => {
                const qrUrl = selectedPart.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(JSON.stringify({ participantId: selectedPart.participantId, secureToken: selectedPart.uniqueToken || `ICADHI-2026-${selectedPart.participantId}` }))}`;
                return (
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-inner flex flex-col items-center">
                    <img
                      src={qrUrl}
                      alt="Registration QR Code"
                      className="h-44 w-44 object-contain"
                    />
                    <a
                      href={qrUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 flex items-center gap-1.5 text-xs font-bold text-primary-850 hover:underline cursor-pointer"
                    >
                      <Download className="h-4 w-4" /> Open Full Image
                    </a>
                  </div>
                );
              })()}

              <div className="text-center text-xs mt-2">
                <span className="font-semibold text-slate-400 block">Email Delivery Status</span>
                {selectedPart.emailSent ? (
                  <Badge variant="success" className="mt-1">QR Email Delivered</Badge>
                ) : (
                  <Badge variant="warning" className="mt-1">Pending Delivery</Badge>
                )}
                {selectedPart.emailSentAt && (
                  <span className="block text-[10px] text-slate-400 mt-1">
                    {selectedPart.emailSentAt.toDate ? selectedPart.emailSentAt.toDate().toLocaleString() : new Date(selectedPart.emailSentAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* 2. Modal: Add/Edit Participant Form */}
      <Dialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={formData.id ? "Edit Participant" : "Add Participant"}
        size="md"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4 p-1">
          <Input
            label="Full Name *"
            placeholder="John Doe"
            value={formData.fullName}
            onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
            required
          />
          <Input
            label="Email Address *"
            type="email"
            placeholder="johndoe@gmail.com"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            required
          />
          <Input
            label="Phone Number"
            placeholder="+1234567890"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Institution"
              placeholder="Harvard University"
              value={formData.institution}
              onChange={(e) => setFormData(prev => ({ ...prev, institution: e.target.value }))}
            />
            <Input
              label="Department"
              placeholder="Computer Science"
              value={formData.department}
              onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Designation"
              placeholder="Professor"
              value={formData.designation}
              onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
            />
            <Input
              label="Country"
              placeholder="United States"
              value={formData.country}
              onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Registration Type"
              value={formData.registrationType}
              onChange={(e) => setFormData(prev => ({ ...prev, registrationType: e.target.value }))}
              placeholder=""
              options={[
                { value: "Regular", label: "Regular Delegate" },
                { value: "Student", label: "Student" },
                { value: "Invited Speaker", label: "Invited Speaker" },
                { value: "Sponsor", label: "Sponsor" },
                { value: "Committee", label: "Committee Member" }
              ]}
            />
            <Select
              label="Payment Status"
              value={formData.paymentStatus}
              onChange={(e) => setFormData(prev => ({ ...prev, paymentStatus: e.target.value }))}
              placeholder=""
              options={[
                { value: "Paid", label: "Paid" },
                { value: "Pending", label: "Pending" },
                { value: "Refunded", label: "Refunded" }
              ]}
            />
          </div>
          {/* Custom Hackathon / Team Registration Fields */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4 space-y-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Team & Payment Fields</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Team's Name"
                placeholder="Team Alpha"
                value={formData.teamName}
                onChange={(e) => setFormData(prev => ({ ...prev, teamName: e.target.value }))}
              />
              <Input
                label="Ambassador ID"
                placeholder="AMB-2026"
                value={formData.ambassadorId}
                onChange={(e) => setFormData(prev => ({ ...prev, ambassadorId: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Other Team Members" 
                placeholder="E.g., John Doe, Jane Smith"
                value={formData.teamMembers}
                onChange={(e) => setFormData(prev => ({ ...prev, teamMembers: e.target.value }))}
              />
              <Input 
                label="Table Number" 
                placeholder="E.g., 12"
                value={formData.tableNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, tableNumber: e.target.value }))}
              />
            </div>
            <Input 
              label="T-Shirt Sizes" 
              placeholder="E.g., L (Leader), M (Member 2)"
              value={formData.tShirtSize}
              onChange={(e) => setFormData(prev => ({ ...prev, tShirtSize: e.target.value }))}
            />
            <Input
              label="IEEE Membership Certificate Link"
              placeholder="https://drive.google.com/..."
              value={formData.ieeeMembershipLink}
              onChange={(e) => setFormData(prev => ({ ...prev, ieeeMembershipLink: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="bKash Sender Number"
                placeholder="017xxxxxxxx"
                value={formData.bkashNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, bkashNumber: e.target.value }))}
              />
              <Input
                label="Transaction ID"
                placeholder="TRX987654"
                value={formData.transactionId}
                onChange={(e) => setFormData(prev => ({ ...prev, transactionId: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Payment Details"
                placeholder="Details of 2nd/3rd member payment"
                value={formData.paymentDetails}
                onChange={(e) => setFormData(prev => ({ ...prev, paymentDetails: e.target.value }))}
              />
              <Input
                label="Payment 2"
                placeholder="Additional payment details"
                value={formData.payment2}
                onChange={(e) => setFormData(prev => ({ ...prev, payment2: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {formData.id ? "Save Changes" : "Register Participant"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* 3. Modal: Delete Confirmation */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => { setIsDeleteOpen(false); setSelectedPart(null); }}
        title="Confirm Deletion"
        size="sm"
      >
        {selectedPart && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you absolutely sure you want to delete the participant profile for{" "}
              <span className="font-extrabold text-slate-800 dark:text-slate-100">
                {selectedPart.fullName}
              </span>{" "}
              ({selectedPart.email})? This action is permanent and cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <Button variant="outline" onClick={() => { setIsDeleteOpen(false); setSelectedPart(null); }}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Delete Record
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
