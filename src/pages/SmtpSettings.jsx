import React, { useState, useEffect } from "react";
import { db, auth } from "../services/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { ShieldAlert, Server, TestTube, CheckCircle2, AlertOctagon } from "lucide-react";

export const SmtpSettings = () => {
  const { isSuperAdmin } = useAuth();
  const { showToast } = useToast();

  const [settings, setSettings] = useState({
    host: "",
    port: 465,
    username: "",
    password: "",
    fromName: "",
    fromEmail: ""
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // success | error | null

  // Fetch settings on mount
  useEffect(() => {
    const fetchSmtp = async () => {
      try {
        const docRef = doc(db, "smtpSettings", "default");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setSettings({
            host: data.host || "",
            port: data.port || 465,
            username: data.username || "",
            password: "********", // Mask password initially
            fromName: data.fromName || "",
            fromEmail: data.fromEmail || ""
          });
        }
      } catch (err) {
        console.error("Failed to load SMTP settings:", err);
        showToast("Error reading SMTP configurations", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchSmtp();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      showToast("Access denied: Super Admin permissions required.", "error");
      return;
    }

    setSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/saveSmtpSettings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify(settings)
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to save SMTP settings");
      }
      
      showToast("SMTP settings saved and encrypted successfully!", "success");
      // Set password to mask again
      setSettings(prev => ({ ...prev, password: "********" }));
    } catch (err) {
      console.error(err);
      showToast(`Save failed: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/testSmtpConnection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        }
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to execute SMTP test");
      }
      
      if (result.success) {
        setTestResult({ status: "success", message: result.message });
        showToast("SMTP server connection test passed!", "success");
      } else {
        setTestResult({ status: "error", message: result.error || "Unable to establish connection." });
        showToast("SMTP connection test failed.", "error");
      }
    } catch (err) {
      console.error(err);
      setTestResult({ status: "error", message: err.message });
      showToast(`Test failed: ${err.message}`, "error");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 font-semibold">Loading SMTP Settings...</div>;
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md mx-auto mt-12 shadow">
        <ShieldAlert className="h-12 w-12 text-red-500 mb-3" />
        <h3 className="text-base font-extrabold text-slate-850 dark:text-slate-100">Access Denied</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs leading-relaxed">
          SMTP credentials are cryptographically protected. Only the **Super Admin** can view or edit SMTP configurations.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 px-6 py-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold">SMTP Mailer Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Configure server credentials for sending confirmation emails</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Editor Form (cols-8) */}
        <form onSubmit={handleSave} className="md:col-span-7 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Server className="h-5 w-5 text-primary-800" />
              <CardTitle className="text-base">Mail Server Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Input
                    label="SMTP Server Host"
                    placeholder="smtp.mailtrap.io"
                    value={settings.host}
                    onChange={(e) => setSettings(prev => ({ ...prev, host: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Input
                    label="SMTP Port"
                    placeholder="465"
                    type="number"
                    value={settings.port}
                    onChange={(e) => setSettings(prev => ({ ...prev, port: Number(e.target.value) }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="SMTP Username"
                  placeholder="user@smtp.com"
                  value={settings.username}
                  onChange={(e) => setSettings(prev => ({ ...prev, username: e.target.value }))}
                  required
                />
                <Input
                  label="SMTP Password"
                  placeholder="••••••••"
                  type="password"
                  value={settings.password}
                  onChange={(e) => setSettings(prev => ({ ...prev, password: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Input
                  label="From Display Name"
                  placeholder="ICADHI 2026 Office"
                  value={settings.fromName}
                  onChange={(e) => setSettings(prev => ({ ...prev, fromName: e.target.value }))}
                />
                <Input
                  label="From Email Address"
                  placeholder="noreply@icadhi.org"
                  type="email"
                  value={settings.fromEmail}
                  onChange={(e) => setSettings(prev => ({ ...prev, fromEmail: e.target.value }))}
                  required
                />
              </div>
            </CardContent>
            
            <CardContent className="bg-slate-50 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-850 px-6 py-4 flex justify-between gap-3 rounded-b-xl">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || saving}
                loading={testing}
                className="flex items-center gap-1.5"
              >
                <TestTube className="h-4 w-4" /> Test Connection
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={saving || testing}
                loading={saving}
              >
                Encrypt & Save Configuration
              </Button>
            </CardContent>
          </Card>
        </form>

        {/* Sidebar Info/Status (cols-5) */}
        <div className="md:col-span-5 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Testing Console</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {testResult === null ? (
                <div className="text-xs text-slate-450 dark:text-slate-500 font-semibold p-4 text-center border border-dashed rounded-xl bg-slate-50/50 dark:bg-transparent">
                  Perform a SMTP connection verification to verify host path and auth details.
                </div>
              ) : testResult.status === "success" ? (
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/60 rounded-xl flex items-start gap-2 text-xs text-emerald-900 dark:text-emerald-350">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold block mb-0.5">Connection Successful!</span>
                    {testResult.message}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-red-50/50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/40 rounded-xl flex items-start gap-2 text-xs text-red-900 dark:text-red-350">
                  <AlertOctagon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold block mb-0.5">Connection Failed</span>
                    <p className="font-mono mt-1 text-[11px] leading-relaxed break-all bg-red-100/40 dark:bg-red-950/40 p-2 rounded border border-red-200/40">
                      {testResult.message}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Google Gmail SMTP Guide */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-primary-850">
                <ShieldAlert className="h-4 w-4" /> Google Gmail SMTP Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-3 leading-relaxed">
              <p className="text-slate-600 font-semibold">
                To use a personal **Gmail account** for sending registration emails, configure as follows:
              </p>
              <div className="bg-slate-50 dark:bg-slate-950/20 p-2.5 rounded-lg border border-slate-150 font-mono text-[11px] text-slate-700 dark:text-slate-350 space-y-1">
                <div><span className="text-slate-400">SMTP Host:</span> smtp.gmail.com</div>
                <div><span className="text-slate-400">SMTP Port:</span> 587 (TLS) or 465 (SSL)</div>
                <div><span className="text-slate-400">Username:</span> yourgmail@gmail.com</div>
                <div><span className="text-slate-400">Password:</span> 16-character App Password</div>
              </div>
              <div className="space-y-1.5 text-slate-550 dark:text-slate-400">
                <span className="font-extrabold text-slate-700 dark:text-slate-200 block">Generate a Gmail App Password:</span>
                <ol className="list-decimal list-inside space-y-1 font-medium">
                  <li>Enable **2-Step Verification** on your Google Account settings.</li>
                  <li>Go to Google’s <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary-800 hover:text-primary-950 hover:underline font-bold">App Passwords</a> page.</li>
                  <li>Create a new app credential (e.g. "ICADHI Portal").</li>
                  <li>Copy and paste the generated 16-character code as your **SMTP Password** (do not use your regular Gmail login password).</li>
                </ol>
              </div>
              <div className="p-2.5 bg-amber-50 border border-amber-150 text-amber-800 rounded-lg text-[11px] font-semibold leading-normal">
                <strong className="block mb-0.5">⚠️ Delivery Restriction Tip:</strong>
                Ensure the **From Email Address** matches your **SMTP Username** to prevent Google from rewriting the sender or flags from spam engines.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
