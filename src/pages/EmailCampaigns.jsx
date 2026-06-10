import React, { useState, useEffect } from "react";
import { db, auth } from "../services/firebase";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/Table";
import { Dialog } from "../components/ui/Dialog";
import { Mail, Play, AlertCircle, RefreshCw, Send, CheckCircle, Flame } from "lucide-react";

export const EmailCampaigns = () => {
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal / Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isSendingOpen, setIsSendingOpen] = useState(false);
  
  // Campaign creator states
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [targetType, setTargetType] = useState("all"); // all | failed | selected
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState([]);
  
  // Active Campaign Progression states
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0, batchNum: 0, totalBatches: 0 });
  const [campaignLogs, setCampaignLogs] = useState([]);

  // Load Firestore data
  useEffect(() => {
    // 1. Campaigns
    const unsubCamp = onSnapshot(collection(db, "emailCampaigns"), (snap) => {
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setCampaigns(list.sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds));
    });

    // 2. Templates
    const unsubTemp = onSnapshot(collection(db, "emailTemplates"), (snap) => {
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setTemplates(list);
    });

    // 3. Participants
    const unsubParts = onSnapshot(collection(db, "participants"), (snap) => {
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setParticipants(list);
      setLoading(false);
    });

    return () => {
      unsubCamp();
      unsubTemp();
      unsubParts();
    };
  }, []);

  // Filter recipient list based on selection logic
  const getRecipients = () => {
    if (targetType === "all") {
      return participants;
    }
    if (targetType === "failed") {
      return participants.filter(p => !p.emailSent);
    }
    if (targetType === "selected") {
      return participants.filter(p => selectedAttendeeIds.includes(p.id));
    }
    return [];
  };

  const recipients = getRecipients();

  // Toggle recipient ID selection in checklist
  const handleToggleSelectAttendee = (id) => {
    setSelectedAttendeeIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Launch Campaign batch loops
  const handleLaunchCampaign = async () => {
    if (!selectedTemplateId) {
      showToast("Please select an email template", "warning");
      return;
    }
    if (recipients.length === 0) {
      showToast("No target recipients selected", "warning");
      return;
    }

    setIsWizardOpen(false);
    setIsSendingOpen(true);
    setCampaignLogs(["Initializing bulk campaign..."]);
    
    const recipientIds = recipients.map(r => r.id);
    const totalCount = recipientIds.length;
    const batchSize = 100;
    
    // Chunk array into batches of 100
    const chunks = [];
    for (let i = 0; i < recipientIds.length; i += batchSize) {
      chunks.push(recipientIds.slice(i, i + batchSize));
    }

    const totalBatches = chunks.length;
    setSendingProgress({ current: 0, total: totalCount, batchNum: 0, totalBatches });

    try {
      // 1. Create emailCampaign document in Firestore
      const campaignRef = await addDoc(collection(db, "emailCampaigns"), {
        templateId: selectedTemplateId,
        status: "pending",
        totalRecipients: totalCount,
        sentCount: 0,
        failedCount: 0,
        results: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const campaignId = campaignRef.id;
      setCampaignLogs(prev => [...prev, `Campaign doc created ID: ${campaignId}`, `Starting batch dispatch...`]);

      // 2. Loop through chunks sequentially
      let totalSuccess = 0;
      let totalFailed = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const batchNum = i + 1;
        setSendingProgress(prev => ({ ...prev, batchNum }));
        setCampaignLogs(prev => [...prev, `Sending batch ${batchNum} of ${totalBatches} (${chunk.length} emails)...`]);

        const idToken = await auth.currentUser?.getIdToken();
        const response = await fetch("/api/sendCampaignBatch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({
            campaignId,
            participantIds: chunk
          })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Batch dispatch failed");
        }

        const { successCount, failureCount } = result;
        totalSuccess += successCount;
        totalFailed += failureCount;

        setSendingProgress(prev => ({ 
          ...prev, 
          current: prev.current + chunk.length 
        }));
        
        setCampaignLogs(prev => [
          ...prev, 
          `Batch ${batchNum} complete: ${successCount} sent, ${failureCount} failed.`
        ]);
      }

      setCampaignLogs(prev => [
        ...prev, 
        `Campaign finished processing!`,
        `Grand Total Succeeded: ${totalSuccess}`,
        `Grand Total Failed: ${totalFailed}`
      ]);
      showToast(`Campaign dispatch finished: ${totalSuccess} sent, ${totalFailed} failed`, "success");
    } catch (err) {
      console.error(err);
      setCampaignLogs(prev => [...prev, `CRITICAL ERROR: ${err.message}`]);
      showToast(`Campaign failed: ${err.message}`, "error");
    }
  };

  // Retry failed emails in an old campaign
  const handleRetryFailedCampaign = async (campaign) => {
    // Collect attendee IDs from the results map where status was 'failed'
    const failedIds = [];
    const results = campaign.results || {};
    Object.keys(results).forEach(id => {
      if (results[id].status === "failed") {
        failedIds.push(id);
      }
    });

    if (failedIds.length === 0) {
      showToast("No failed records found to retry.", "info");
      return;
    }

    setIsSendingOpen(true);
    setCampaignLogs([`Retrying ${failedIds.length} failed sends for campaign ${campaign.id}...`]);

    const batchSize = 100;
    const chunks = [];
    for (let i = 0; i < failedIds.length; i += batchSize) {
      chunks.push(failedIds.slice(i, i + batchSize));
    }

    const totalBatches = chunks.length;
    setSendingProgress({ current: 0, total: failedIds.length, batchNum: 0, totalBatches });

    try {
      // Set status back to sending
      await updateDoc(doc(db, "emailCampaigns", campaign.id), {
        status: "sending",
        updatedAt: serverTimestamp()
      });

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const batchNum = i + 1;
        setSendingProgress(prev => ({ ...prev, batchNum }));
        
        const idToken = await auth.currentUser?.getIdToken();
        const response = await fetch("/api/sendCampaignBatch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({
            campaignId: campaign.id,
            participantIds: chunk
          })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Batch retry dispatch failed");
        }

        const { successCount, failureCount } = result;
        setSendingProgress(prev => ({ ...prev, current: prev.current + chunk.length }));
        setCampaignLogs(prev => [...prev, `Batch ${batchNum} complete: ${successCount} sent, ${failureCount} failed.`]);
      }

      setCampaignLogs(prev => [...prev, `Retry process complete!`]);
      showToast("Retry campaign completed.", "success");
    } catch (err) {
      console.error(err);
      setCampaignLogs(prev => [...prev, `ERROR during retry: ${err.message}`]);
      showToast(`Retry failed: ${err.message}`, "error");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 px-6 py-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold">Email Campaigns Engine</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Broadcast QR Codes and event invites in safe chunked batches</p>
        </div>
        <Button onClick={() => { setIsWizardOpen(true); setSelectedAttendeeIds([]); }} className="flex items-center gap-1.5 text-xs font-bold">
          <Send className="h-4.5 w-4.5" /> Start New Broadcast
        </Button>
      </div>

      {/* Campaigns History */}
      <Card>
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-semibold">Loading campaign history...</div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center text-slate-450 dark:text-slate-500 flex flex-col items-center">
            <Mail className="h-12 w-12 text-slate-300 mb-3" />
            No broadcast campaigns launched yet. Click 'Start New Broadcast' to begin.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign ID</TableHead>
                <TableHead>Template Used</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((camp) => {
                const templateName = templates.find(t => t.id === camp.templateId)?.name || "Unknown Template";
                const total = camp.totalRecipients || 0;
                const sent = camp.sentCount || 0;
                const failed = camp.failedCount || 0;
                const deliveryRate = total ? Math.round((sent / total) * 100) : 0;
                
                return (
                  <TableRow key={camp.id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-500">{camp.id}</TableCell>
                    <TableCell className="font-bold text-slate-800 dark:text-slate-100">{templateName}</TableCell>
                    <TableCell className="font-bold">{total}</TableCell>
                    <TableCell className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {sent} ({deliveryRate}%)
                    </TableCell>
                    <TableCell className={failed > 0 ? "text-red-500 font-bold" : "text-slate-400"}>
                      {failed}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          camp.status === "completed" 
                            ? "success" 
                            : camp.status === "sending" 
                            ? "info" 
                            : "danger"
                        }
                      >
                        {camp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {failed > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetryFailedCampaign(camp)}
                          className="flex items-center gap-1.5 text-xs text-amber-600 border-amber-200 dark:border-amber-900 bg-amber-50/20"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Retry Failed
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* 1. Modal: Wizard Form */}
      <Dialog
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title="Email Broadcast Wizard"
        size="lg"
      >
        <div className="space-y-5 p-1">
          {/* Step 1: Select Template */}
          <Select
            label="1. Choose Email Template"
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            placeholder="Select Template..."
            options={templates.map(t => ({ value: t.id, label: t.name }))}
            required
          />

          {/* Step 2: Choose Target Selection */}
          <Select
            label="2. Choose Targets Criteria"
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value);
              setSelectedAttendeeIds([]);
            }}
            placeholder=""
            options={[
              { value: "all", label: "Send to All Registered Attendees" },
              { value: "failed", label: "Send to Failed / Unsent Only" },
              { value: "selected", label: "Send to Custom Selected Attendees" }
            ]}
          />

          {/* Target List Checklist */}
          {targetType === "selected" && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg max-h-[160px] overflow-y-auto p-3 bg-slate-50 dark:bg-slate-950 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Attendee List Checklist</span>
              {participants.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-350 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAttendeeIds.includes(p.id)}
                    onChange={() => handleToggleSelectAttendee(p.id)}
                    className="rounded border-slate-300 dark:border-slate-800 text-primary-850"
                  />
                  {p.teamName ? `${p.teamName} [Leader: ${p.fullName}]` : p.fullName} ({p.email})
                </label>
              ))}
            </div>
          )}

          {/* Statistics summary */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 text-xs font-semibold space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Target Count:</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">{recipients.length} Attendees</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Dispatch Batches:</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">
                {Math.ceil(recipients.length / 100)} Batches (100 emails/batch limit)
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsWizardOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLaunchCampaign}
              disabled={!selectedTemplateId || recipients.length === 0}
              className="flex items-center gap-1.5"
            >
              <Flame className="h-4.5 w-4.5" /> Launch Campaign
            </Button>
          </div>
        </div>
      </Dialog>

      {/* 2. Modal: Sending Progress Terminal */}
      <Dialog
        isOpen={isSendingOpen}
        onClose={() => {
          // Allow closing only if sending finished
          if (sendingProgress.current >= sendingProgress.total) {
            setIsSendingOpen(false);
          } else {
            showToast("Please wait for campaign batch loops to complete.", "warning");
          }
        }}
        title="Campaign Batch Dispatches"
        size="md"
      >
        <div className="space-y-5 p-1">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-extrabold text-slate-500 uppercase">
              <span>Sending Emails...</span>
              <span>{sendingProgress.current} / {sendingProgress.total}</span>
            </div>
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-primary-850 to-secondary-500 transition-all duration-300" 
                style={{ width: `${sendingProgress.total ? (sendingProgress.current / sendingProgress.total) * 100 : 0}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-right">
              Batch {sendingProgress.batchNum} of {sendingProgress.totalBatches}
            </div>
          </div>

          {/* Console logger display */}
          <div className="h-44 rounded-lg bg-slate-950 text-emerald-400 p-4 font-mono text-xs overflow-y-auto space-y-1.5 shadow-inner border border-slate-850">
            {campaignLogs.map((log, idx) => (
              <div key={idx} className="leading-relaxed">
                <span className="text-slate-600 font-bold mr-1">&gt;</span> {log}
              </div>
            ))}
          </div>

          {sendingProgress.current >= sendingProgress.total && (
            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <Button variant="outline" onClick={() => setIsSendingOpen(false)} className="flex items-center gap-1.5">
                <CheckCircle className="h-4.5 w-4.5 text-emerald-500" /> Done
              </Button>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};
