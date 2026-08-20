import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const GREEN = [31, 77, 44];
const GOLD = [199, 154, 46];
const GRAY = [107, 115, 96];
const DANGER = [199, 75, 63];

function fmtMoney(n) {
  return "Rs. " + Math.round(n || 0).toLocaleString("en-US");
}
function fmtLiters(n) {
  return (Math.round((n || 0) * 10) / 10) + " L";
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

async function loadLogoDataUrl() {
  try {
    const res = await fetch("/logo.jpg");
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

function drawHeader(doc, farmSettings, title, logoDataUrl) {
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, 210, 32, "F");
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "JPEG", 12, 6, 20, 20, undefined, "FAST"); } catch (e) {}
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(farmSettings.farmName || "Chaudhry Dairy Farm", 38, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Dairy Farm Management System", 38, 21);
  const contact = [farmSettings.address, farmSettings.phone].filter(Boolean).join("  ·  ");
  if (contact) doc.text(contact, 38, 26.5);

  doc.setTextColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, 12, 42);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(12, 45, 198, 45);
}

function drawFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, 12, 290);
    doc.text(`Page ${i} of ${pageCount}`, 198, 290, { align: "right" });
  }
}

/* ---------------- Customer Statement PDF ---------------- */
export async function buildCustomerStatementPdf(farmSettings, customer, sales, payments) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogoDataUrl();
  drawHeader(doc, farmSettings, "Customer Statement", logo);

  const totalMilk = sales.reduce((s, x) => s + x.quantity, 0);
  const totalBilled = sales.reduce((s, x) => s + x.total, 0);
  const totalReceived = payments.reduce((s, p) => s + p.amount, 0);
  const balance = customer.balance;

  doc.setTextColor(20, 30, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(customer.name, 12, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`${customer.phone || ""}    ${customer.address || ""}`, 12, 59);
  doc.text(`Daily Quantity: ${fmtLiters(customer.dailyQuantity)}    Price/L: ${fmtMoney(customer.defaultPrice)}`, 12, 64);

  // summary boxes
  const boxes = [
    { label: "Total Milk Purchased", value: fmtLiters(totalMilk) },
    { label: "Total Billed", value: fmtMoney(totalBilled) },
    { label: "Total Received", value: fmtMoney(totalReceived) },
    { label: "Credit Remaining", value: fmtMoney(balance), danger: balance > 0 },
  ];
  const boxW = 44, boxH = 18, startX = 12, y = 70;
  boxes.forEach((b, i) => {
    const x = startX + i * (boxW + 2);
    doc.setFillColor(b.danger ? 251 : 231, b.danger ? 235 : 239, b.danger ? 214 : 229);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(b.label, x + 3, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(b.danger ? DANGER[0] : GREEN[0], b.danger ? DANGER[1] : GREEN[1], b.danger ? DANGER[2] : GREEN[2]);
    doc.text(b.value, x + 3, y + 13);
    doc.setFont("helvetica", "normal");
  });

  // build combined, running-balance ledger
  const entries = [
    ...sales.map((s) => ({ date: s.date, type: "sale", desc: `Milk sale — ${fmtLiters(s.quantity)} @ ${fmtMoney(s.pricePerLiter)}/L (${s.paymentMethod})`, debit: s.total, credit: 0 })),
    ...payments.map((p) => ({ date: p.date, type: "payment", desc: `Payment received (${p.method})`, debit: 0, credit: p.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let running = 0;
  const rows = entries.map((e) => {
    running += e.debit - e.credit;
    return [fmtDate(e.date), e.desc, e.debit ? fmtMoney(e.debit) : "—", e.credit ? fmtMoney(e.credit) : "—", fmtMoney(running)];
  });

  autoTable(doc, {
    startY: 94,
    head: [["Date", "Description", "Billed", "Received", "Balance"]],
    body: rows.length ? rows : [["—", "No transactions yet", "—", "—", "—"]],
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 241, 226] },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  drawFooter(doc);
  return doc;
}

/* ---------------- Farm Profit & Loss PDF ---------------- */
export async function buildProfitLossPdf(farmSettings, { mode, date, from, to, totals }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogoDataUrl();
  drawHeader(doc, farmSettings, "Farm Profit & Loss Report", logo);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(20, 30, 20);
  const periodLabel = mode === "day" ? `Date: ${fmtDate(date)}` : `Period: ${fmtDate(from)} to ${fmtDate(to)}`;
  doc.text(periodLabel, 12, 53);

  const rows = [
    ["Milk Produced", fmtLiters(totals.milkProduced)],
    ["Milk Sold", fmtLiters(totals.milkSold)],
    ["Milk Revenue (from customers)", fmtMoney(totals.salesTotal)],
    ["Payments Received from Customers", fmtMoney(totals.paymentsReceived)],
    ["Payments Made to Suppliers", fmtMoney(totals.paymentsMade)],
    ["Total Expenses", fmtMoney(totals.dayExpenses)],
    ["Net Profit / Loss", fmtMoney(totals.profit)],
  ];

  autoTable(doc, {
    startY: 60,
    head: [["Metric", "Value"]],
    body: rows,
    styles: { fontSize: 10, cellPadding: 3.5 },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 241, 226] },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.row.index === rows.length - 1 && data.section === "body") {
        data.cell.styles.fillColor = totals.profit >= 0 ? [231, 239, 229] : [246, 222, 219];
        data.cell.styles.textColor = totals.profit >= 0 ? GREEN : DANGER;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  drawFooter(doc);
  return doc;
}

export function downloadPdf(doc, filename) {
  doc.save(filename);
}
