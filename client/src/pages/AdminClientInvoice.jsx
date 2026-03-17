import React, { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

import {
  BuildingOfficeIcon,
  CalculatorIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  EyeIcon,
  EyeSlashIcon
} from "@heroicons/react/24/outline";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800";

/* ================= Helpers ================= */

const getOrdinalDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "short" });
  const year = date.getFullYear();
  const getOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  return `${getOrdinal(day)} ${month} ${year}`;
};

const numberToWords = (num) => {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const convertGroup = (n) => {
    if (n === 0) return "";
    if (n < 20) return a[n] + " ";
    if (n < 100) return b[Math.floor(n / 10)] + " " + a[n % 10] + " ";
    return a[Math.floor(n / 100)] + " Hundred " + convertGroup(n % 100);
  };

  if (num === 0) return "Zero";
  let output = "";
  let n = Math.floor(num);
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;

  if (crore > 0) output += convertGroup(crore) + "Crore ";
  if (lakh > 0) output += convertGroup(lakh) + "Lakh ";
  if (thousand > 0) output += convertGroup(thousand) + "Thousand ";
  if (n > 0) output += convertGroup(n);

  return output.trim() + " Rupees Only";
};

/* ================= Main Component ================= */

const SectionCard = ({ title, icon: Icon, children }) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-6 mb-6">
    <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
      <Icon className="h-5 w-5 text-blue-600" />
      {title}
    </h3>
    {children}
  </div>
);

const defaultAccountDetails = {
  accountNumber: "-000805022576",
  name: "Vagarious Solutions Pvt Ltd.",
  bank: "ICICI Bank",
  branch: "Begumpet Branch",
  ifsc: "ICICI0000183",
  pan: "AAHCV0176E",
  gst: "36AAHCV0176E1ZE"
};

const AdminClientInvoice = () => {
  const { toast } = useToast();
  const { authHeaders } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState({
    invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
    invoiceDate: new Date().toISOString().split("T")[0],
    clientId: "",
    candidateName: "",
    joiningDate: "",
    role: "",
    actualSalary: "",
    percentage: "",
    payment: 0,
    accountType: "default",
    accountDetails: defaultAccountDetails,
    selectedCandidates: [],
  });

  const [showPreview, setShowPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [showCandidateList, setShowCandidateList] = useState(false);

  const getAuthHeader = async () => ({
    "Content-Type": "application/json",
    ...(await authHeaders()),
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = await getAuthHeader();
        const [resClients, resCandidates] = await Promise.all([
          fetch(`${API_URL}/clients`, { headers }),
          fetch(`${API_URL}/candidates`, { headers }),
        ]);
        if (resClients.ok) setClients((await resClients.json()).map((c) => ({ ...c, id: c._id })));
        if (resCandidates.ok) setCandidates((await resCandidates.json()).map((c) => ({ ...c, id: c._id })));
      } catch {
        toast({ title: "Error fetching data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAddCandidate = (candidate) => {
    const ctc = parseFloat(candidate.ctc ? candidate.ctc.replace(/[^0-9.]/g, "") : "0") * 100000 || 0;
    setForm(p => ({
      ...p,
      candidateName: candidate.name || "",
      role: candidate.position || "",
      joiningDate: candidate.joiningDate ? candidate.joiningDate.split('T')[0] : new Date().toISOString().split("T")[0],
      actualSalary: ctc,
      percentage: p.percentage || 8.33,
    }));
    toast({ title: `Auto-filled details for ${candidate.name}` });
  };

  const addCandidateToList = () => {
    if (!form.candidateName) {
      toast({ title: "Please select or enter a candidate name", variant: "destructive" });
      return;
    }
    const newCandidate = {
      id: Date.now(),
      name: form.candidateName,
      role: form.role,
      joiningDate: form.joiningDate,
      actualSalary: form.actualSalary,
      percentage: form.percentage,
      payment: form.payment
    };
    setForm(prev => ({
      ...prev,
      selectedCandidates: [...prev.selectedCandidates, newCandidate],
      candidateName: "",
      joiningDate: "",
      role: "",
      actualSalary: "",
      percentage: "",
      payment: 0
    }));
    setShowCandidateList(true);
    toast({ title: "Candidate added to list" });
  };

  const removeCandidateFromList = (id) => {
    setForm(prev => ({
      ...prev,
      selectedCandidates: prev.selectedCandidates.filter(c => c.id !== id)
    }));
  };

  const selectedClient = useMemo(() => clients.find((c) => c.id === form.clientId), [clients, form.clientId]);

  // Handle Payment Calculation
  useEffect(() => {
    const salary = parseFloat(form.actualSalary) || 0;
    const perc = parseFloat(form.percentage) || 0;
    const payment = Math.round((salary * perc) / 100);
    setForm(prev => ({ ...prev, payment }));
  }, [form.actualSalary, form.percentage]);

  /* PDF Generation Logic Using Exact Provided PDF as Background Template */
  const generateFilledPdf = async () => {
    setIsGenerating(true);
    try {
      // 1. Fetch the exact empty PDF provided
      const response = await fetch('/Empty_invoice.pdf');
      const existingPdfBytes = await response.arrayBuffer();

      // 2. Load the PDF into pdf-lib
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      const { width, height } = firstPage.getSize();
      // Assume A4 size, commonly standard height is ~841.89 points
      // pdf-lib's origin (0,0) is bottom-left.

      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const drawText = (text, x, y, size = 9.5, isBold = false) => {
        if (!text || text === "undefined") return;
        firstPage.drawText(String(text).trim(), {
          x,
          y: height - y - (size / 3), 
          size,
          color: rgb(0, 0, 0),
          font: isBold ? helveticaBold : helvetica,
        });
      };

      const drawTextCentered = (text, centerX, y, maxW, isBold = false, size = 9.5) => {
        if (!text || text === "undefined") return;
        const font = isBold ? helveticaBold : helvetica;
        let sz = size;
        let t = String(text).trim();
        let w = font.widthOfTextAtSize(t, sz);
        while (w > maxW && sz > 5) {
          sz -= 0.5;
          w = font.widthOfTextAtSize(t, sz);
        }
        const x = centerX - (w / 2);
        firstPage.drawText(t, {
          x,
          y: height - y - (sz / 3),
          size: sz,
          color: rgb(0, 0, 0),
          font,
        });
      };

      // == 3. MAP ALL THE DATA ONTO THE TEMPLATE COORDINATES ==
      // Note: Coordinates are estimated from standard layout and easily adjustable

      // -- Client details (Below 'To,') --
      drawText(selectedClient?.companyName || "", 68, 155, 11, true);

      // Smart address formatting:
      // - Parts with digits or building keywords → joined on Line 1 (house/office/building)
      // - Pure area/street names (no digits, no keywords) → each on its own line
      // - Second-to-last → City
      // - Last → State + Pincode
      const rawParts = (selectedClient?.address || "").split(",").map(p => p.trim()).filter(Boolean);
      let addressLines = [];
      if (rawParts.length <= 2) {
        addressLines = rawParts;
      } else {
        const city = rawParts[rawParts.length - 2];
        const state = rawParts[rawParts.length - 1];
        const middleParts = rawParts.slice(0, rawParts.length - 2);

        // Detect building parts: contain digits OR building-related keywords
        const buildingPattern = /\d|floor|f\.no|no\.|h\.no|plot|flat|door|d\.no|beside|above|below|near|opp|block|wing|phase|sector|tower|unit|suite|rd\s|street|building|complex|nagar/i;
        const buildingParts = middleParts.filter(p => buildingPattern.test(p));
        const areaParts = middleParts.filter(p => !buildingPattern.test(p));

        const lines = [];
        if (buildingParts.length > 0) lines.push(buildingParts.join(", "));
        areaParts.forEach(a => lines.push(a)); // each area on its own line
        lines.push(city, state);
        addressLines = lines;
      }

      if (selectedClient?.contactPerson) {
        drawText(selectedClient.contactPerson, 68, 170, 10);
        addressLines.forEach((line, i) => drawText(line, 68, 185 + i * 13, 10));
        const gstY = 185 + addressLines.length * 13;
        if (selectedClient?.gstNumber) drawText(`GST : ${selectedClient.gstNumber}`, 68, gstY, 10);
      } else {
        addressLines.forEach((line, i) => drawText(line, 68, 170 + i * 13, 10));
        const gstY = 170 + addressLines.length * 13;
        if (selectedClient?.gstNumber) drawText(`GST : ${selectedClient.gstNumber}`, 68, gstY, 10);
      }

      // -- Erase background "Date:" from template: RIGHT SIDE ONLY (X=370+) --
      // TAX INVOICE is centered (~X 220-365), Date: label is on right (~X 370-415)
      // Y band: top 278-315 covers where Date: sits, above where TAX INVOICE header is
      firstPage.drawRectangle({
        x: 370,
        y: height - 315,
        width: 230,
        height: 40,
        color: rgb(1, 1, 1),
        opacity: 1,
      });

      // -- Date: Aligned with template --
      drawText(getOrdinalDate(form.invoiceDate), 468, 118, 10);

      // -- Deep Clean of Template Table Layer --
      // Using a slightly wider and taller mask to catch all border artifacts
      firstPage.drawRectangle({
        x: 45,
        y: height - 760,
        width: 520,
        height: 500, 
        color: rgb(1, 1, 1),
      });

      // -- Redraw No: and SUB: after cleaning (Aligned with table at X=68) --
      drawText(`No: ${form.invoiceNumber}`, 68, 280, 10, true);
      drawText("SUB: Final Invoice", 68, 298, 10, true);

      // -- TAX INVOICE Title --
      drawTextCentered("TAX INVOICE", width / 2, 320, 200, true, 14);

      const cands = form.selectedCandidates.length > 0 ? form.selectedCandidates : (form.candidateName ? [{name: form.candidateName, role: form.role, joiningDate: form.joiningDate, actualSalary: form.actualSalary, percentage: form.percentage, payment: form.payment}] : []);
      
      // -- Dynamic Layout Tuning for Large Lists --
      const candidateCount = cands.length;
      const isLargeList = candidateCount > 5;
      
      let rowHR = 22; 
      let rowDR = isLargeList ? 21 : 26; 
      let currentY = isLargeList ? 342 : 345;
      const headerFs = 10;
      const dataFs = isLargeList ? 8.5 : 9.5;
      const accFs = isLargeList ? 8.5 : 10;
      const accSpacing = isLargeList ? 13 : 16;

      const colStarts = [68, 96, 201, 281, 356, 426, 476];
      const colWidths = [28, 105, 80, 75, 70, 50, 70];
      const colCenters = colStarts.map((s, i) => s + colWidths[i] / 2);
      const headers = ["S.No", "Candidate Name", "Role", "Joining Date", "Actual Salary", "Percentage", "Payment"];

      const drawCell = (text, x, w, y, h, align = 'center', isBold = false, fs = dataFs) => {
        firstPage.drawRectangle({
          x, y: height - (y + h/2), width: w, height: h,
          borderColor: rgb(0,0,0), borderWidth: 0.7, color: rgb(1,1,1)
        });
        if (text) {
          if (align === 'center') drawTextCentered(text, x + w/2, y, w-4, isBold, fs);
          else if (align === 'left') drawText(text, x + 4, y, fs, isBold);
          else drawTextCentered(text, x + w/2, y, w-4, isBold, fs);
        }
      };

      headers.forEach((h, i) => {
        drawCell(h, colStarts[i], colWidths[i], currentY, rowHR, 'center', true, headerFs);
      });
      currentY += (rowHR/2 + rowDR/2);

      let totalPay = 0;
      cands.forEach((c, i) => {
        totalPay += (parseFloat(c.payment) || 0);
        drawCell(String(i+1), colStarts[0], colWidths[0], currentY, rowDR);
        
        const nameText = String(c.name || "");
        firstPage.drawRectangle({
          x: colStarts[1], y: height - (currentY + rowDR/2), width: colWidths[1], height: rowDR,
          borderColor: rgb(0,0,0), borderWidth: 0.7, color: rgb(1,1,1)
        });

        if (nameText.length > 18) {
           const splitIdx = nameText.lastIndexOf(" ", 18) || 18;
           const line1 = nameText.substring(0, splitIdx).trim();
           const line2 = nameText.substring(splitIdx).trim();
           drawTextCentered(line1, colCenters[1], currentY - 4, colWidths[1]-4, false, dataFs - 1);
           drawTextCentered(line2, colCenters[1], currentY + 4, colWidths[1]-4, false, dataFs - 1);
        } else {
           drawTextCentered(nameText, colCenters[1], currentY, colWidths[1]-4, false, dataFs);
        }

        drawCell(c.role || "", colStarts[2], colWidths[2], currentY, rowDR);
        drawCell(c.joiningDate ? getOrdinalDate(c.joiningDate) : "", colStarts[3], colWidths[3], currentY, rowDR);
        drawCell(Number(c.actualSalary || 0).toLocaleString("en-IN"), colStarts[4], colWidths[4], currentY, rowDR);
        drawCell(`${c.percentage || 0}%`, colStarts[5], colWidths[5], currentY, rowDR);
        drawCell(Number(c.payment || 0).toLocaleString("en-IN"), colStarts[6], colWidths[6], currentY, rowDR);
        currentY += rowDR;
      });

      const tH = isLargeList ? 24 : 30;
      firstPage.drawRectangle({
        x: colStarts[0], y: height - (currentY + tH/2), width: colStarts[6] + colWidths[6] - colStarts[0], height: tH,
        borderColor: rgb(0,0,0), borderWidth: 0.7, color: rgb(1,1,1)
      });
      drawText("Total", colStarts[6] - 45, currentY, 10, true);
      drawTextCentered(totalPay.toLocaleString("en-IN"), colCenters[6], currentY, colWidths[6]-4, true, 10);

      const footerY = currentY + (isLargeList ? 25 : 40);
      drawText("In Words : ", 68, footerY, 10, true);
      drawText(numberToWords(totalPay).toUpperCase(), 125, footerY, isLargeList ? 8.5 : 9.5);

      const accY = footerY + (isLargeList ? 35 : 50);
      if (form.accountType !== "no") {
        drawText("Account Details: -", 68, accY - (isLargeList ? 14 : 18), isLargeList ? 10 : 11, true);
        const details = [
          `Account No. : ${form.accountDetails.accountNumber}`,
          `Name : ${form.accountDetails.name}`,
          `Bank : ${form.accountDetails.bank}`,
          `Branch : ${form.accountDetails.branch}`,
          `IFSC Code : ${form.accountDetails.ifsc}`,
          `PAN No. : ${form.accountDetails.pan}`,
          `GST : ${form.accountDetails.gst}`
        ];
        details.forEach((line, idx) => {
          drawText(line, 68, accY + (idx * accSpacing), accFs, true);
        });
      }

      // -- Signature Block (Left Aligned) --
      const sigOffset = form.accountType !== "no" ? (accSpacing * 8) + 15 : 20;
      const sigY = accY + sigOffset;
      drawText("Navya S", 68, sigY, 11, true);
      drawText("Vagarious Solutions Pvt Ltd", 68, sigY + 16, 11, true);

      // 4. Save and return blob
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      return blob;

    } catch (error) {
      console.error("PDF Generation error:", error);
      toast({ title: "Failed to load/generate PDF template.", variant: "destructive" });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = async () => {
    if (showPreview) {
      setShowPreview(false);
      return;
    }
    const blob = await generateFilledPdf();
    if (blob) {
      setPdfPreviewUrl(URL.createObjectURL(blob));
      setShowPreview(true);
    }
  };

  const handleDownload = async () => {
    const blob = await generateFilledPdf();
    if (blob) {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Invoice_${form.invoiceNumber}.pdf`;
      link.click();
    }
  };

  return (
    <div className="flex-1 p-8 h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Invoice Generator</h1>
        <button
          onClick={handlePreview}
          disabled={isGenerating}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
        >
          {showPreview ? "Back to Edit Details" : (isGenerating ? "Processing..." : "Preview Exact PDF")}
        </button>
      </div>

      {!showPreview ? (
        <div className="max-w-5xl">
          {/* Invoice & Client Details */}
          <SectionCard title="Client Info" icon={BuildingOfficeIcon}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Number</label>
                <input
                  value={form.invoiceNumber}
                  onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Date</label>
                <input
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Client *</label>
                <select
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  className={inputCls}
                >
                  <option value="">-- Choose a Client --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>
            </div>
            {selectedClient && (
              <div className="mt-4 p-4 bg-gray-50 border rounded-lg text-sm text-gray-700">
                <p><strong>Company:</strong> {selectedClient.companyName}</p>
                <p><strong>Contact Person:</strong> {selectedClient.contactPerson || "N/A"}</p>
                <p><strong>Address:</strong> {selectedClient.address || "N/A"}</p>
                <p><strong>GST:</strong> {selectedClient.gstNumber || "N/A"}</p>
              </div>
            )}
          </SectionCard>

          {/* Invoice Financial Fields */}
          <SectionCard title="Invoice Financial Fields" icon={CalculatorIcon}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Candidate Name (Optional)</label>
                <input
                  type="text"
                  value={form.candidateName}
                  onChange={(e) => setForm({ ...form, candidateName: e.target.value })}
                  className={inputCls}
                  placeholder="E.g. John Doe"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Joining Date (Optional)</label>
                <input
                  type="date"
                  value={form.joiningDate}
                  onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Role</label>
                <input
                  type="text"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className={inputCls}
                  placeholder="E.g. Software Engineer"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Actual Salary (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={form.actualSalary}
                  onChange={(e) => setForm({ ...form, actualSalary: e.target.value })}
                  className={inputCls}
                  placeholder="E.g. 500000"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Percentage (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.percentage}
                  onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                  className={inputCls}
                  placeholder="E.g. 8.33"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Calculated Payment (₹)</label>
                <input
                  type="text"
                  readOnly
                  value={form.payment.toLocaleString('en-IN')}
                  className={`${inputCls} bg-gray-100 font-bold text-green-700 cursor-not-allowed`}
                />
              </div>

              <div className="col-span-1 md:col-span-2 lg:col-span-3 flex justify-end items-center gap-3 pt-2">
                {form.selectedCandidates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCandidateList(!showCandidateList)}
                    className="mr-auto px-4 py-2 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 mb-3 flex items-center gap-2 shadow-sm transition-all"
                  >
                    {showCandidateList ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    {showCandidateList ? "Hide Added List" : `View Added List (${form.selectedCandidates.length})`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, candidateName: "", role: "", joiningDate: "", actualSalary: "", percentage: "", payment: 0 }))}
                  className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 mb-3"
                >
                  Clear Fields
                </button>
                <button
                  type="button"
                  onClick={addCandidateToList}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition flex items-center gap-2 mb-3"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add to Invoice List {form.selectedCandidates.length > 0 && `(${form.selectedCandidates.length} added)`}
                </button>
              </div>

              {/* --- Selected Candidates Table (UI View) --- */}
              {form.selectedCandidates.length > 0 && showCandidateList && (
                <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-4 overflow-hidden border border-blue-100 rounded-xl bg-blue-50/30 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="bg-blue-600 px-4 py-2 flex justify-between items-center text-white">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                       Candidate List ({form.selectedCandidates.length} Selected)
                    </h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setForm(prev => ({...prev, selectedCandidates: []}))}
                        className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition"
                      >
                        Clear All
                      </button>
                      <button 
                        onClick={() => setShowCandidateList(false)}
                        className="text-white hover:text-blue-100 p-1"
                        title="Close List"
                      >
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="6 18L18 6M6 6l12 12" />
                         </svg>
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-blue-100/50 text-blue-800 font-semibold">
                        <tr>
                          <th className="px-4 py-2 border-b">#</th>
                          <th className="px-4 py-2 border-b">Name</th>
                          <th className="px-4 py-2 border-b">Role</th>
                          <th className="px-4 py-2 border-b text-right">Payment</th>
                          <th className="px-4 py-2 border-b text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-100 bg-white">
                        {form.selectedCandidates.map((c, idx) => (
                          <tr key={c.id} className="hover:bg-blue-50/50 transition-colors">
                            <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                            <td className="px-4 py-2 font-medium text-gray-900">{c.name}</td>
                            <td className="px-4 py-2 text-gray-600">{c.role}</td>
                            <td className="px-4 py-2 text-right font-bold text-blue-700">₹{c.payment.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-2 text-center">
                              <button 
                                onClick={() => removeCandidateFromList(c.id)}
                                className="text-red-500 hover:text-red-700 text-xs font-medium underline px-2 py-1"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="col-span-1 md:col-span-2 lg:col-span-3 space-y-4 border-t pt-4 mt-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Account Details</label>
                  <select
                    value={form.accountType}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "default") {
                        setForm({ ...form, accountType: val, accountDetails: defaultAccountDetails });
                      } else {
                        setForm({ ...form, accountType: val, accountDetails: { accountNumber: "", name: "", bank: "", branch: "", ifsc: "", pan: "", gst: "" } });
                      }
                    }}
                    className={inputCls}
                  >
                    <option value="default">Default (Vagarious Solutions Pvt Ltd.)</option>
                    <option value="manual">Enter Manually</option>
                    <option value="no">NO</option>
                  </select>
                </div>

                {form.accountType === "manual" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <input placeholder="Account No." value={form.accountDetails.accountNumber} onChange={(e) => setForm(prevForm => ({ ...prevForm, accountDetails: { ...prevForm.accountDetails, accountNumber: e.target.value } }))} className={inputCls} />
                    <input placeholder="Name" value={form.accountDetails.name} onChange={(e) => setForm(prevForm => ({ ...prevForm, accountDetails: { ...prevForm.accountDetails, name: e.target.value } }))} className={inputCls} />
                    <input placeholder="Bank" value={form.accountDetails.bank} onChange={(e) => setForm(prevForm => ({ ...prevForm, accountDetails: { ...prevForm.accountDetails, bank: e.target.value } }))} className={inputCls} />
                    <input placeholder="Branch" value={form.accountDetails.branch} onChange={(e) => setForm(prevForm => ({ ...prevForm, accountDetails: { ...prevForm.accountDetails, branch: e.target.value } }))} className={inputCls} />
                    <input placeholder="IFSC Code" value={form.accountDetails.ifsc} onChange={(e) => setForm(prevForm => ({ ...prevForm, accountDetails: { ...prevForm.accountDetails, ifsc: e.target.value } }))} className={inputCls} />
                    <input placeholder="PAN No." value={form.accountDetails.pan} onChange={(e) => setForm(prevForm => ({ ...prevForm, accountDetails: { ...prevForm.accountDetails, pan: e.target.value } }))} className={inputCls} />
                    <input placeholder="GST" value={form.accountDetails.gst} onChange={(e) => setForm(prevForm => ({ ...prevForm, accountDetails: { ...prevForm.accountDetails, gst: e.target.value } }))} className={inputCls} />
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Add Candidates Section */}
          <SectionCard title="Add Candidates" icon={MagnifyingGlassIcon}>
            <input
              placeholder="Search candidate by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${inputCls} mb-3`}
            />
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
              {candidates
                .filter((c) => c.name?.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((c) => {
                  const alreadyAdded = form.candidateName === c.name;
                  return (
                    <div
                      key={c.id}
                      className={`flex justify-between items-center px-4 py-3 ${alreadyAdded ? "bg-gray-50 text-gray-400" : "hover:bg-blue-50 cursor-pointer transition-colors"}`}
                      onClick={() => !alreadyAdded && handleAddCandidate(c)}
                    >
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{c.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{c.position || "No Role"} — {c.client || "No Client Assigned"}</p>
                      </div>
                      {alreadyAdded ? (
                        <Badge variant="secondary" className="bg-gray-200 text-gray-600">Added</Badge>
                      ) : (
                        <button className="flex items-center gap-1 text-blue-600 text-xs font-semibold hover:text-blue-800">
                          <PlusIcon className="h-4 w-4" />
                          Add
                        </button>
                      )}
                    </div>
                  );
                })}
              {candidates.filter((c) => c.name?.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">No candidates found in database.</p>
              )}
            </div>
          </SectionCard>

          <div className="flex justify-end">
            <button
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition shadow-md text-lg disabled:opacity-50"
              onClick={handleDownload}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating..." : "Download Final PDF"}
            </button>
          </div>

        </div>
      ) : (
        <div className="h-[80vh] bg-gray-200 rounded-xl overflow-hidden flex flex-col justify-between border border-gray-300">
          {/* THE EXACT PDF EMBED PREVIEW */}
          {pdfPreviewUrl ? (
            <iframe
              src={pdfPreviewUrl}
              title="Invoice Exact PDF Preview"
              className="w-full h-full shadow-inner"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 font-medium font-sans">
              Generating precise PDF view...
            </div>
          )}
          <div className="p-4 bg-white border-t flex justify-end">
            <button
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition"
              onClick={handleDownload}
              disabled={isGenerating}
            >
              Download This Invoice
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClientInvoice;
