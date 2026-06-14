import React, { useState, useEffect, useRef } from "react";
import { db } from "../services/firebase";
import { doc, getDoc, updateDoc, addDoc, serverTimestamp, query, where, collection, getDocs } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Select } from "../components/ui/Select";
import { Html5Qrcode } from "html5-qrcode";
import { 
  ScanLine, 
  Camera, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Gift, 
  Utensils, 
  Coffee, 
  User, 
  CalendarClock,
  HelpCircle
} from "lucide-react";
import { InstructionBanner } from "../components/ui/InstructionBanner";

export const Scanner = () => {
  const { userProfile, role, isAdmin, isSuperAdmin, isRegDesk, isBreakfastDesk, isLunchDesk } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState("camera"); // camera | manual
  const [manualId, setManualId] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // Desk Selection: locked to role or selectable for admin
  const getInitialDesk = () => {
    if (role === "registration_desk") return "registration";
    if (role === "breakfast_desk") return "breakfast";
    if (role === "lunch_desk") return "lunch";
    return "registration"; // Default for Admin/Super Admin
  };
  const [activeDesk, setActiveDesk] = useState(getInitialDesk());
  const activeDeskRef = useRef(activeDesk);

  useEffect(() => {
    activeDeskRef.current = activeDesk;
  }, [activeDesk]);

  // Result display states
  const [resultStatus, setResultStatus] = useState(null); // success | duplicate | invalid | idle
  const [scannedParticipant, setScannedParticipant] = useState(null);
  const [previousScanInfo, setPreviousScanInfo] = useState(null);
  const [updatingField, setUpdatingField] = useState(false);

  const qrScannerRef = useRef(null);
  const qrRegionId = "qr-reader-region";

  // Watch role to update active desk if role loads late
  useEffect(() => {
    setActiveDesk(getInitialDesk());
  }, [role]);

  const lastScanRef = useRef({ text: "", time: 0 });

  const startScanner = async () => {
    setResultStatus("idle");
    setScannedParticipant(null);
    setCameraError(null);
    setScanning(true);

    // Short timeout to let the DOM render the region ID
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode(qrRegionId);
        qrScannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText) => {
            // Success callback
            handleDecodedText(decodedText);
          },
          (errorMessage) => {
            // Verbose error callbacks from parser, ignore to prevent clutter
          }
        );
      } catch (err) {
        console.error("Failed to start camera scanner:", err);
        setCameraError("Unable to access camera. Please check permissions.");
        setScanning(false);
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (qrScannerRef.current && qrScannerRef.current.isScanning) {
      try {
        await qrScannerRef.current.stop();
        qrScannerRef.current = null;
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    setScanning(false);
  };

  // Auto-start scanner when the Camera Scan tab is active, stop it otherwise
  useEffect(() => {
    if (activeTab === "camera") {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [activeTab]);

  // Decode scanned text (supports JSON structure or raw ID)
  const handleDecodedText = async (text) => {
    const now = Date.now();
    if (text === lastScanRef.current.text && now - lastScanRef.current.time < 3000) {
      // Throttle: ignore scans of the exact same QR code within 3 seconds to prevent loops
      return;
    }
    lastScanRef.current = { text, time: now };

    // Sound indicator
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch (_) {}

    // We do NOT stop the scanner. The camera remains active all the time!
    let pId = "";
    let sToken = "";

    try {
      const parsed = JSON.parse(text);
      pId = parsed.participantId;
      sToken = parsed.secureToken;
    } catch (_) {
      // Raw string fallback
      pId = text.trim();
    }

    if (!pId) {
      setResultStatus("invalid");
      showToast("Invalid QR content", "error");
      return;
    }

    processParticipantCheckIn(pId, sToken);
  };

  // Process the verification based on active desk settings
  const processParticipantCheckIn = async (participantId, token = "") => {
    setUpdatingField(true);
    try {
      let pData = null;
      let actualDocId = participantId;
      let activeCollection = "participants";
      let docRef = null;

      const collectionsToSearch = ["participants", "volunteers", "ambassadors"];
      
      for (const coll of collectionsToSearch) {
        const tempRef = doc(db, coll, participantId);
        const snap = await getDoc(tempRef);
        if (snap.exists()) {
          pData = snap.data();
          docRef = tempRef;
          activeCollection = coll;
          break;
        }
        
        const fieldName = coll === "participants" ? "participantId" : coll === "volunteers" ? "volunteerId" : "ambassadorId";
        const q = query(collection(db, coll), where(fieldName, "==", participantId));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const matchedDoc = qSnap.docs[0];
          docRef = matchedDoc.ref;
          pData = matchedDoc.data();
          actualDocId = matchedDoc.id;
          activeCollection = coll;
          break;
        }
      }

      if (!pData) {
        setResultStatus("invalid");
        setScannedParticipant(null);
        showToast("Record not found in system.", "error");
        setUpdatingField(false);
        return;
      }

      const p = { id: actualDocId, activeCollection, docRefPath: docRef.path, ...pData };
      setScannedParticipant(p);

      // Verify secure token if present
      const expectedToken = p.uniqueToken || p.volunteerId || p.ambassadorId;
      if (token && expectedToken && expectedToken !== token) {
        setResultStatus("invalid");
        showToast("Security Token Mismatch! Possible QR tampering.", "error");
        setUpdatingField(false);
        return;
      }

      // Check desk role restriction
      const currentUserId = userProfile?.uid || "unknown";
      const currentUserEmail = userProfile?.email || "unknown";
      const currentUserRole = role || "volunteer";

      // 1. REGISTRATION WORKFLOW
      if (activeDeskRef.current === "registration") {
        if (p.registrationScanned) {
          setResultStatus("duplicate");
          setPreviousScanInfo({
            deskName: "Registration Desk",
            scanTime: p.registrationScannedAt
          });
          showToast("Already checked in!", "warning");
        } else {
          // Success scan: Mark registration scanned
          const updateData = {
            registrationScanned: true,
            registrationScannedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          await updateDoc(docRef, updateData);
          setScannedParticipant(prev => ({ ...prev, ...updateData, registrationScanned: true }));
          setResultStatus("success");
          showToast("Registration check-in successful!", "success");

          // Audit log
          await addDoc(collection(db, "auditLogs"), {
            userId: currentUserId,
            userEmail: currentUserEmail,
            userRole: currentUserRole,
            action: "Participant Checked In",
            details: `${p.teamName || p.fullName} checked in at Registration Desk`,
            timestamp: serverTimestamp()
          });
        }
      }

      // 2. BREAKFAST WORKFLOW
      else if (activeDeskRef.current === "breakfast") {
        if (p.breakfastCollected) {
          setResultStatus("duplicate");
          setPreviousScanInfo({
            deskName: "Breakfast Desk",
            scanTime: p.breakfastCollectedAt
          });
          showToast("Breakfast already collected!", "warning");
        } else {
          const updateData = {
            breakfastCollected: true,
            breakfastCollectedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          await updateDoc(docRef, updateData);
          setScannedParticipant(prev => ({ ...prev, ...updateData, breakfastCollected: true }));
          setResultStatus("success");
          showToast("Breakfast distributed!", "success");

          // Audit log
          await addDoc(collection(db, "auditLogs"), {
            userId: currentUserId,
            userEmail: currentUserEmail,
            userRole: currentUserRole,
            action: "Breakfast Distributed",
            details: `${p.teamName || p.fullName} received breakfast`,
            timestamp: serverTimestamp()
          });
        }
      }

      // 3. LUNCH WORKFLOW
      else if (activeDeskRef.current === "lunch") {
        if (p.lunchCollected) {
          setResultStatus("duplicate");
          setPreviousScanInfo({
            deskName: "Lunch Desk",
            scanTime: p.lunchCollectedAt
          });
          showToast("Lunch already collected!", "warning");
        } else {
          const updateData = {
            lunchCollected: true,
            lunchCollectedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          await updateDoc(docRef, updateData);
          setScannedParticipant(prev => ({ ...prev, ...updateData, lunchCollected: true }));
          setResultStatus("success");
          showToast("Lunch distributed!", "success");

          // Audit log
          await addDoc(collection(db, "auditLogs"), {
            userId: currentUserId,
            userEmail: currentUserEmail,
            userRole: currentUserRole,
            action: "Lunch Distributed",
            details: `${p.teamName || p.fullName} received lunch`,
            timestamp: serverTimestamp()
          });
        }
      }
    } catch (err) {
      console.error("Scan processing error:", err);
      showToast(`Verification failed: ${err.message}`, "error");
    } finally {
      setUpdatingField(false);
    }
  };

  // Issue kit operation (Registration desk step 2)
  const handleIssueKit = async () => {
    if (!scannedParticipant) return;
    setUpdatingField(true);
    try {
      const docRef = doc(db, scannedParticipant.activeCollection, scannedParticipant.id);
      const updateData = {
        kitCollected: true,
        kitCollectedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await updateDoc(docRef, updateData);
      
      setScannedParticipant(prev => ({ ...prev, ...updateData, kitCollected: true }));
      showToast("Registration kit successfully issued!", "success");

      // Audit log
      await addDoc(collection(db, "auditLogs"), {
        userId: userProfile?.uid || "unknown",
        userEmail: userProfile?.email || "unknown",
        userRole: role || "volunteer",
        action: "Registration Kit Issued",
        details: `Issued Registration Kit to ${scannedParticipant.teamName || scannedParticipant.fullName}`,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      showToast("Failed to issue kit", "error");
    } finally {
      setUpdatingField(false);
    }
  };

  // Manual search submit
  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!manualId.trim()) return;
    processParticipantCheckIn(manualId.trim().toUpperCase());
  };

  return (
    <div className="flex flex-col gap-6">
      <InstructionBanner title="Scanner Usage" icon={HelpCircle} color="emerald">
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Select Mode:</strong> Choose between "Registration Check-in", "Kits", "Breakfast", or "Lunch" mode before scanning.</li>
          <li><strong>Camera Setup:</strong> Grant camera permissions. Scan the attendee's QR code (received via email).</li>
          <li><strong>Signals:</strong> Green means successful check-in. Red means they already claimed it or the code is invalid. Listen for the beep sounds!</li>
        </ul>
      </InstructionBanner>

      {/* Settings bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 px-6 py-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold">QR Check-in Station</h1>
          <p className="text-xs text-slate-500 mt-0.5">Scan delegate QR code to log attendance and claims</p>
        </div>
        
        {/* Desk Selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase">Active Desk:</span>
          {(isAdmin || isSuperAdmin) ? (
            <Select
              value={activeDesk}
              onChange={(e) => {
                setActiveDesk(e.target.value);
                setResultStatus(null);
                setScannedParticipant(null);
              }}
              placeholder=""
              className="py-1 px-3 text-xs w-48 font-bold border-slate-200 dark:border-slate-800"
              options={[
                { value: "registration", label: "Registration Desk" },
                { value: "breakfast", label: "Breakfast Desk" },
                { value: "lunch", label: "Lunch Desk" }
              ]}
            />
          ) : (
            <Badge variant="primary" className="text-xs py-1.5 px-3 uppercase tracking-wider">
              {activeDesk} Desk Only
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Scanner Controller panel (cols-5) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <Card className="overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-row justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
              <div className="flex gap-2">
                <Button
                  variant={activeTab === "camera" ? "primary" : "ghost"}
                  size="sm"
                  className="text-xs font-bold"
                  onClick={() => setActiveTab("camera")}
                >
                  Camera Scan
                </Button>
                <Button
                  variant={activeTab === "manual" ? "primary" : "ghost"}
                  size="sm"
                  className="text-xs font-bold"
                  onClick={() => setActiveTab("manual")}
                >
                  Manual ID
                </Button>
              </div>

              {activeTab === "camera" && scanning && (
                <Badge variant="success" className="animate-pulse">Camera Active</Badge>
              )}
            </CardHeader>

            <CardContent className="p-6">
              {activeTab === "camera" ? (
                <div className="flex flex-col items-center gap-4">
                  {/* Scanner Feed Node */}
                  <div className="relative w-full aspect-square max-w-full sm:max-w-[320px] bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl overflow-hidden flex items-center justify-center shadow-inner">
                    {scanning ? (
                      <div id={qrRegionId} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-6 flex flex-col items-center">
                        <Camera className="h-10 w-10 text-slate-350 dark:text-slate-500 mb-2.5" />
                        <p className="text-xs text-slate-450 dark:text-slate-500 leading-relaxed max-w-[180px]">
                          Click 'Start Camera' below to open camera interface
                        </p>
                      </div>
                    )}

                    {/* Modern Corner Guides for camera */}
                    {scanning && (
                      <div className="absolute inset-4 sm:inset-6 pointer-events-none">
                        {/* 4 Corners */}
                        <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-primary-500 rounded-tl-xl" />
                        <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-primary-500 rounded-tr-xl" />
                        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-primary-500 rounded-bl-xl" />
                        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-primary-500 rounded-br-xl" />
                        
                        {/* Scanning Laser */}
                        <div className="absolute left-0 right-0 h-1 bg-primary-500 shadow-[0_0_12px_rgba(59,130,246,0.8)] animate-scan-line rounded-full" />
                      </div>
                    )}
                  </div>

                  {cameraError && (
                    <p className="text-xs text-red-500 font-semibold text-center">{cameraError}</p>
                  )}

                  {!scanning ? (
                    <Button onClick={startScanner} className="w-full flex items-center justify-center gap-2">
                      <ScanLine className="h-4 w-4" /> Start Camera
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={stopScanner} className="w-full">
                      Stop Scanner
                    </Button>
                  )}
                </div>
              ) : (
                /* Manual Search Tab */
                <form onSubmit={handleManualSearch} className="space-y-4">
                  <Input
                    label="Enter Team ID"
                    placeholder="e.g. ICADHI-A7B8C9D"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    icon={<Search className="h-4 w-4" />}
                    required
                  />
                  <Button type="submit" variant="primary" className="w-full flex items-center justify-center gap-1.5">
                    <Search className="h-4 w-4" /> Verify Team
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Display Status Panel (cols-7) */}
        <div className="lg:col-span-7">
          {resultStatus === null ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-850 rounded-2xl h-80 text-slate-400 p-8">
              <ScanLine className="h-12 w-12 text-slate-300 mb-3 animate-pulse" />
              <h3 className="font-extrabold text-sm text-slate-500">Awaiting QR scan</h3>
              <p className="text-xs text-center max-w-xs mt-1 text-slate-400">
                Scan a team's QR code or search manually to view verified credentials and claim status.
              </p>
            </div>
          ) : (
            <Card className="overflow-hidden">
              {/* Dynamic Status Banner */}
              {resultStatus === "success" && (
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-5 flex items-center gap-4 shadow-md">
                  <CheckCircle2 className="h-12 w-12 flex-shrink-0 animate-scale-in" />
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-wider">Verification Successful</h2>
                    <p className="text-xs font-semibold text-emerald-100">Participant verified. Attendance marked.</p>
                  </div>
                </div>
              )}

              {resultStatus === "duplicate" && (
                <div className="bg-gradient-to-r from-amber-500 to-orange-550 text-white p-5 flex items-center gap-4 shadow-md">
                  <AlertTriangle className="h-12 w-12 flex-shrink-0 animate-bounce" />
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-wider">Already Claimed</h2>
                    <p className="text-xs font-semibold text-amber-100">
                      Warning: Item already collected for this participant.
                    </p>
                  </div>
                </div>
              )}

              {resultStatus === "invalid" && (
                <div className="bg-gradient-to-r from-rose-500 to-red-600 text-white p-5 flex items-center gap-4 shadow-md">
                  <XCircle className="h-12 w-12 flex-shrink-0" />
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-wider">Invalid Ticket</h2>
                    <p className="text-xs font-semibold text-rose-100">Failed authentication. Record does not match.</p>
                  </div>
                </div>
              )}

              <CardContent className="p-6 space-y-6">
                {scannedParticipant ? (
                  <>
                    {/* Participant summary details */}
                    <div className="flex items-start gap-4">
                      {/* Photo Placeholder */}
                      <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 flex-shrink-0">
                        <User className="h-8 w-8" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                          {scannedParticipant.activeCollection === "participants" ? "Team ID: " : scannedParticipant.activeCollection === "volunteers" ? "Organizer ID: " : "Ambassador ID: "} 
                          {scannedParticipant.participantId || scannedParticipant.volunteerId || scannedParticipant.ambassadorId}
                        </span>
                        {scannedParticipant.teamName ? (
                          <>
                            <h3 className="text-xl font-black text-primary-850 dark:text-primary-400 truncate">{scannedParticipant.teamName}</h3>
                            <p className="text-sm font-bold text-slate-600 dark:text-slate-300 truncate mt-0.5">Leader: {scannedParticipant.fullName}</p>
                          </>
                        ) : (
                          <h3 className="text-xl font-bold text-slate-850 dark:text-white truncate">{scannedParticipant.fullName}</h3>
                        )}
                        <p className="text-xs font-semibold text-slate-400 truncate mt-0.5">
                          {scannedParticipant.institution || scannedParticipant.deptUniversity || scannedParticipant.universityName || scannedParticipant.designation}
                        </p>
                        {scannedParticipant.ambassadorId && scannedParticipant.activeCollection === "participants" && (
                          <p className="text-[11px] font-bold text-amber-600 mt-1">
                            Ambassador: {scannedParticipant.ambassadorId}
                          </p>
                        )}
                        <div className="mt-2 flex gap-2 flex-wrap items-center">
                           <Badge variant={scannedParticipant.activeCollection === "participants" ? "primary" : scannedParticipant.activeCollection === "volunteers" ? "purple" : "pink"} className="uppercase tracking-wider">
                             {scannedParticipant.activeCollection === "participants" ? "Participant" : scannedParticipant.activeCollection === "volunteers" ? "Organizer" : "Ambassador"}
                           </Badge>
                           {scannedParticipant.tableNumber && (
                             <Badge variant="warning" className="uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-300 dark:border-amber-700">
                               Table {scannedParticipant.tableNumber}
                             </Badge>
                           )}
                        </div>
                      </div>
                    </div>
 
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-sm">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Registration Type</span>
                        <p className="font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">{scannedParticipant.registrationType}</p>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Payment Status</span>
                        <p className="mt-0.5">
                          <Badge variant={scannedParticipant.paymentStatus?.toLowerCase() === "paid" ? "success" : "warning"}>
                            {scannedParticipant.paymentStatus}
                          </Badge>
                        </p>
                      </div>
                      {scannedParticipant.teamMembers && (
                        <div className="col-span-2">
                          <span className="text-xs font-bold text-slate-400 uppercase">Team Members</span>
                          <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 text-xs">{scannedParticipant.teamMembers}</p>
                        </div>
                      )}
                      {scannedParticipant.tShirtSize && (
                        <div className="col-span-2">
                          <span className="text-xs font-bold text-slate-400 uppercase">T-Shirt Sizes</span>
                          <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 text-xs">{scannedParticipant.tShirtSize}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Email Address</span>
                        <p className="font-bold text-slate-600 dark:text-slate-400 mt-0.5 truncate">{scannedParticipant.email}</p>
                      </div>
                      {scannedParticipant.transactionId && (
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase">Transaction ID</span>
                          <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">{scannedParticipant.transactionId}</p>
                        </div>
                      )}
                      {scannedParticipant.bkashNumber && (
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase">bKash Number</span>
                          <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">{scannedParticipant.bkashNumber}</p>
                        </div>
                      )}
                    </div>

                    {/* Desk scan logging outputs */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl space-y-3">
                      <h4 className="text-xs font-black uppercase text-slate-450 dark:text-slate-500 tracking-wider">Claims Checklist</h4>
                      
                      <div className="grid grid-cols-1 gap-2.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <CheckCircle2 className={`h-4.5 w-4.5 ${scannedParticipant.registrationScanned ? "text-emerald-500" : "text-slate-300 dark:text-slate-700"}`} />
                            Registration Gate Check-in
                          </span>
                          <span>
                            {scannedParticipant.registrationScanned ? (
                              <Badge variant="success">Attended</Badge>
                            ) : (
                              <Badge variant="neutral">Not Scanned</Badge>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Gift className={`h-4.5 w-4.5 ${scannedParticipant.kitCollected ? "text-emerald-500" : "text-slate-300 dark:text-slate-700"}`} />
                            Registration Kit Given
                          </span>
                          <span>
                            {scannedParticipant.kitCollected ? (
                              <Badge variant="success">Distributed</Badge>
                            ) : (
                              <Badge variant="neutral">Pending Collection</Badge>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Coffee className={`h-4.5 w-4.5 ${scannedParticipant.breakfastCollected ? "text-emerald-500" : "text-slate-300 dark:text-slate-700"}`} />
                            Breakfast Collection
                          </span>
                          <span>
                            {scannedParticipant.breakfastCollected ? (
                              <Badge variant="success">Claimed</Badge>
                            ) : (
                              <Badge variant="neutral">Pending</Badge>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Utensils className={`h-4.5 w-4.5 ${scannedParticipant.lunchCollected ? "text-emerald-500" : "text-slate-300 dark:text-slate-700"}`} />
                            Lunch Collection
                          </span>
                          <span>
                            {scannedParticipant.lunchCollected ? (
                              <Badge variant="success">Claimed</Badge>
                            ) : (
                              <Badge variant="neutral">Pending</Badge>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Duplicate details */}
                    {resultStatus === "duplicate" && previousScanInfo && (
                      <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-xl flex items-start gap-2 text-xs font-semibold text-amber-900 dark:text-amber-400">
                        <CalendarClock className="h-4.5 w-4.5 flex-shrink-0 mt-0.5 text-amber-500" />
                        <div>
                          Already collected at **{previousScanInfo.deskName}**.
                          <span className="block text-[10px] text-slate-400 mt-1">
                            Claim Timestamp: {previousScanInfo.scanTime?.toDate ? previousScanInfo.scanTime.toDate().toLocaleString() : new Date(previousScanInfo.scanTime).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Step 2 Actions for Registration Desk (Issue Kit) */}
                    {activeDesk === "registration" && scannedParticipant.registrationScanned && !scannedParticipant.kitCollected && (
                      <Button
                        variant="accent"
                        className="w-full flex items-center justify-center gap-2 py-3 mt-4"
                        onClick={handleIssueKit}
                        loading={updatingField}
                      >
                        <Gift className="h-5 w-5" /> Issue Registration Kit
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="p-6 text-center text-red-500 font-semibold">
                    Participant credentials missing.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
