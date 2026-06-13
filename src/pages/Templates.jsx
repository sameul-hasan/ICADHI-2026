import React, { useState, useEffect } from "react";
import { db } from "../services/firebase";
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/Table";
import { Dialog } from "../components/ui/Dialog";
import { Badge } from "../components/ui/Badge";
import { FileCode, Plus, Eye, Edit, Trash2, Copy, Sparkles, Lightbulb } from "lucide-react";
import { InstructionBanner } from "../components/ui/InstructionBanner";

export const Templates = () => {
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Form states
  const [templateForm, setTemplateForm] = useState({
    id: "",
    name: "",
    subject: "",
    htmlContent: ""
  });

  // Load templates
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "emailTemplates"), (snap) => {
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setTemplates(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      showToast("Failed to load email templates", "error");
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Pre-seed a gorgeous default template if none exist
  const handleSeedDefault = async () => {
    const defaultHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background-color: #1E40AF; padding: 32px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px; }
    .header p { margin: 8px 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #38bdf8; letter-spacing: 2px; }
    .content { padding: 40px 32px; color: #334155; line-height: 1.6; }
    .greeting { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0; }
    .table-info { width: 100%; border-collapse: collapse; margin: 24px 0; }
    .table-info td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .table-info td.label { font-weight: 700; color: #64748b; width: 35%; }
    .table-info td.value { color: #0f172a; font-weight: 500; }
    .qr-box { margin: 32px 0; padding: 24px; background-color: #f0f5ff; border: 1px dashed #1E40AF; border-radius: 12px; text-align: center; }
    .qr-text { font-size: 12px; font-weight: 700; color: #1E40AF; margin-top: 12px; text-transform: uppercase; }
    .footer { background-color: #f1f5f9; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ICADHI 2026</h1>
      <p>International Conference on Digital Health Innovations</p>
    </div>
    <div class="content">
      <p class="greeting">Dear {{fullName}},</p>
      <p>Thank you for registering for the **ICADHI 2026** conference. Your registration is confirmed. Please find your personal entry QR Code below. You will need this QR Code for registration check-in, kit collection, and catering claims throughout the event.</p>
      
      <table class="table-info">
        <tr>
          <td class="label">Attendee Name</td>
          <td class="value">{{fullName}}</td>
        </tr>
        <tr>
          <td class="label">Email Address</td>
          <td class="value">{{email}}</td>
        </tr>
        <tr>
          <td class="label">Institution</td>
          <td class="value">{{institution}}</td>
        </tr>
        <tr>
          <td class="label">Registration Type</td>
          <td class="value">{{registrationType}}</td>
        </tr>
      </table>

      <div class="qr-box">
        {{qrCode}}
        <div class="qr-text">Scan for Admission & Meal Claims</div>
      </div>

      <p>If you have any questions, feel free to reply to this email.</p>
      <p>Best Regards,<br/><strong>ICADHI 2026 Organizing Committee</strong></p>
    </div>
    <div class="footer">
      &copy; 2026 ICADHI. All rights reserved.<br/>
      You received this because you registered for ICADHI 2026.
    </div>
  </div>
</body>
</html>`;

    try {
      await addDoc(collection(db, "emailTemplates"), {
        name: "ICADHI 2026 Default QR Invite",
        subject: "Your ICADHI 2026 Registration QR Code",
        htmlContent: defaultHtml,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      showToast("Default template seeded successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to seed template", "error");
    }
  };

  // Open editor for add or edit
  const openEditor = (temp = null) => {
    if (temp) {
      setTemplateForm({
        id: temp.id,
        name: temp.name || "",
        subject: temp.subject || "",
        htmlContent: temp.htmlContent || ""
      });
    } else {
      setTemplateForm({
        id: "",
        name: "",
        subject: "",
        htmlContent: ""
      });
    }
    setIsEditorOpen(true);
  };

  // Save template
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!templateForm.name || !templateForm.subject || !templateForm.htmlContent) {
      showToast("All fields are required", "warning");
      return;
    }

    try {
      if (templateForm.id) {
        // Update
        const ref = doc(db, "emailTemplates", templateForm.id);
        await setDoc(ref, {
          name: templateForm.name,
          subject: templateForm.subject,
          htmlContent: templateForm.htmlContent,
          updatedAt: serverTimestamp()
        }, { merge: true });
        showToast("Template updated successfully", "success");
      } else {
        // Create
        await addDoc(collection(db, "emailTemplates"), {
          name: templateForm.name,
          subject: templateForm.subject,
          htmlContent: templateForm.htmlContent,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        showToast("Template created successfully", "success");
      }
      setIsEditorOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Failed to save template", "error");
    }
  };

  // Duplicate template
  const handleDuplicate = async (temp) => {
    try {
      await addDoc(collection(db, "emailTemplates"), {
        name: `${temp.name} (Copy)`,
        subject: temp.subject,
        htmlContent: temp.htmlContent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      showToast("Template duplicated", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to duplicate template", "error");
    }
  };

  // Delete template
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      await deleteDoc(doc(db, "emailTemplates", id));
      showToast("Template deleted", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to delete template", "error");
    }
  };

  // Helper to replace placeholders for mock preview rendering
  const getMockHtmlPreview = (html) => {
    if (!html) return "";
    let mock = html;
    mock = mock.replace(/\{\{fullName\}\}/g, "Dr. Alice Vance");
    mock = mock.replace(/\{\{teamName\}\}/g, "Team Alpha");
    mock = mock.replace(/\{\{designation\}\}/g, "Senior Organizer");
    mock = mock.replace(/\{\{email\}\}/g, "alice.vance@mit.edu");
    mock = mock.replace(/\{\{institution\}\}/g, "Massachusetts Institute of Technology");
    mock = mock.replace(/\{\{registrationType\}\}/g, "Invited Speaker");
    mock = mock.replace(/\{\{qrCode\}\}/g, `<div style="padding:20px; background:#e2e8f0; display:inline-block; border-radius:8px; font-weight:bold; font-family:monospace; color:#334155;">[ MOCK QR CODE IMAGE ]</div>`);
    mock = mock.replace(/\{\{eventName\}\}/g, "ICADHI 2026");
    return mock;
  };

  return (
    <div className="flex flex-col gap-6">
      <InstructionBanner title="Email Templates" icon={Lightbulb} color="blue">
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Smart Tags:</strong> Use variables like <code>{`{{fullName}}`}</code>, <code>{`{{email}}`}</code>, <code>{`{{teamName}}`}</code>, and <code>{`{{designation}}`}</code>. They will be auto-replaced for each recipient!</li>
          <li><strong>QR Code:</strong> Include the <code>{`{{qrCode}}`}</code> tag to automatically embed their unique, secure registration QR code in the email.</li>
          <li><strong>HTML Allowed:</strong> You can write full HTML for custom branding, colors, and layouts.</li>
        </ul>
      </InstructionBanner>

      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 px-6 py-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold">Email Template Manager</h1>
          <p className="text-xs text-slate-500 mt-0.5">Customize registration confirmation emails using HTML variables</p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button variant="outline" size="sm" onClick={handleSeedDefault} className="flex items-center gap-1.5 font-semibold text-xs text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-4 w-4" /> Seed ICADHI Template
            </Button>
          )}
          <Button onClick={() => openEditor()} className="flex items-center gap-1.5 text-xs font-bold">
            <Plus className="h-4.5 w-4.5" /> Create Template
          </Button>
        </div>
      </div>

      {/* Templates List Grid */}
      <Card>
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-semibold">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="p-12 text-center text-slate-450 dark:text-slate-500 flex flex-col items-center">
            <FileCode className="h-12 w-12 text-slate-300 mb-3" />
            No email templates created yet. Click 'Seed ICADHI Template' to create a pre-styled option.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template Name</TableHead>
                <TableHead>Subject Header</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((temp) => (
                <TableRow key={temp.id}>
                  <TableCell className="font-extrabold text-slate-800 dark:text-slate-100">{temp.name}</TableCell>
                  <TableCell className="text-slate-550 dark:text-slate-400 font-semibold max-w-[250px] truncate">{temp.subject}</TableCell>
                  <TableCell className="text-slate-450 text-xs font-bold">
                    {temp.updatedAt?.toDate ? temp.updatedAt.toDate().toLocaleDateString() : new Date().toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1.5"
                        onClick={() => { setSelectedTemplate(temp); setIsPreviewOpen(true); }}
                        title="Live Preview"
                      >
                        <Eye className="h-4.5 w-4.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1.5 text-blue-600"
                        onClick={() => openEditor(temp)}
                        title="Edit HTML"
                      >
                        <Edit className="h-4.5 w-4.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1.5 text-emerald-600"
                        onClick={() => handleDuplicate(temp)}
                        title="Duplicate"
                      >
                        <Copy className="h-4.5 w-4.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1.5 text-red-600"
                        onClick={() => handleDelete(temp.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Editor Modal */}
      <Dialog
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={templateForm.id ? "Edit Email Template" : "New Email Template"}
        size="xl"
      >
        <form onSubmit={handleSaveTemplate} className="space-y-4 p-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Template Name"
              placeholder="e.g. Conference Check-in Confirmation"
              value={templateForm.name}
              onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <Input
              label="Email Subject Title"
              placeholder="e.g. Your ICADHI 2026 QR Code Check-in Invite"
              value={templateForm.subject}
              onChange={(e) => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[400px]">
            {/* Editor Area */}
            <div className="md:col-span-7 flex flex-col gap-1.5 h-full">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                HTML Code Editor
              </label>
              <textarea
                className="w-full flex-1 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-xs font-mono bg-slate-900 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-800 resize-none overflow-y-auto"
                placeholder="<html><body><h1>Welcome {{fullName}}</h1></body></html>"
                value={templateForm.htmlContent}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, htmlContent: e.target.value }))}
                required
              />
            </div>

            {/* Variable Cheat Sheet & Preview */}
            <div className="md:col-span-5 flex flex-col gap-4 h-full overflow-y-auto border-l border-slate-100 dark:border-slate-800 pl-4">
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Supported Variables</h4>
                <div className="flex flex-wrap gap-1.5">
                  {["{{fullName}}", "{{teamName}}", "{{email}}", "{{institution}}", "{{registrationType}}", "{{qrCode}}", "{{eventName}}"].map(v => (
                    <code
                      key={v}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded text-[10px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 transition-colors"
                      onClick={() => setTemplateForm(prev => ({ ...prev, htmlContent: prev.htmlContent + v }))}
                      title="Click to insert"
                    >
                      {v}
                    </code>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-[150px]">
                <span className="text-xs font-bold text-slate-500 uppercase mb-2">Live Preview (Mock Attendee)</span>
                <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-lg bg-white overflow-hidden shadow-inner">
                  <iframe
                    title="Template Live Preview"
                    className="w-full h-full border-none bg-white"
                    srcDoc={getMockHtmlPreview(templateForm.htmlContent)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Template
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Preview Modal */}
      <Dialog
        isOpen={isPreviewOpen}
        onClose={() => { setIsPreviewOpen(false); setSelectedTemplate(null); }}
        title={selectedTemplate ? `Preview: ${selectedTemplate.name}` : "Template Preview"}
        size="lg"
      >
        {selectedTemplate && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-150 rounded-xl text-xs space-y-1">
              <div><span className="font-bold text-slate-400">Subject:</span> <span className="font-black text-slate-700 dark:text-slate-200">{selectedTemplate.subject}</span></div>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl h-[450px] overflow-hidden bg-white shadow-inner">
              <iframe
                title="Participant Template Preview"
                className="w-full h-full border-none bg-white"
                srcDoc={getMockHtmlPreview(selectedTemplate.htmlContent)}
              />
            </div>
            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <Button variant="outline" onClick={() => { setIsPreviewOpen(false); setSelectedTemplate(null); }}>
                Close Preview
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
