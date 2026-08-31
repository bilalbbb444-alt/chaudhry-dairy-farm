import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const GREEN = [31, 77, 44];
const GOLD = [199, 154, 46];
const GRAY = [107, 115, 96];
const DANGER = [199, 75, 63];
const WARN = [219, 138, 44];

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
  const cashSalesTotal = sales.filter((s) => s.paymentStatus === "Paid").reduce((s, x) => s + x.total, 0);
  const totalReceived = cashSalesTotal + payments.reduce((s, p) => s + p.amount, 0);
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

  // build combined, running-balance ledger. Cash/bank/etc. sales are paid at the
  // moment of sale, so they carry an offsetting credit and never inflate the
  // running balance — only unpaid Credit sales do that.
  const entries = [
    ...sales.map((s) => ({
      date: s.date, type: "sale",
      desc: `Milk sale — ${fmtLiters(s.quantity)} @ ${fmtMoney(s.pricePerLiter)}/L (${s.paymentMethod})`,
      debit: s.total, credit: s.paymentStatus === "Paid" ? s.total : 0,
    })),
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
export async function buildProfitLossPdf(farmSettings, { mode, date, from, to, totals, supplierPayments, customerPayments }) {
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

  let y = doc.lastAutoTable.finalY + 10;

  if (customerPayments && customerPayments.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...GREEN);
    doc.text("Payments Received — By Customer", 12, y);
    autoTable(doc, {
      startY: y + 3,
      head: [["Customer", "Amount Received"]],
      body: customerPayments.map((c) => [c.name, fmtMoney(c.amount)]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [246, 241, 226] },
      columnStyles: { 1: { halign: "right" } },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  if (supplierPayments && supplierPayments.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...GREEN);
    doc.text("Payments Made — By Supplier", 12, y);
    autoTable(doc, {
      startY: y + 3,
      head: [["Supplier", "Amount Paid"]],
      body: supplierPayments.map((s) => [s.name, fmtMoney(s.amount)]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [246, 241, 226] },
      columnStyles: { 1: { halign: "right" } },
    });
  }

  drawFooter(doc);
  return doc;
}

/* ---------------- Milk Production Report PDF ---------------- */
export async function buildMilkReportPdf(farmSettings, { from, to, totalMilk, byAnimal }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogoDataUrl();
  drawHeader(doc, farmSettings, "Milk Production Report", logo);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(20, 30, 20);
  doc.text(`Period: ${fmtDate(from)} to ${fmtDate(to)}`, 12, 53);

  doc.setFillColor(...GREEN);
  doc.roundedRect(12, 58, 60, 20, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("TOTAL MILK PRODUCED", 16, 65);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(fmtLiters(totalMilk), 16, 73);

  autoTable(doc, {
    startY: 86,
    head: [["Animal", "Code", "Total Produced", "Avg / Day"]],
    body: byAnimal.map((a) => [a.name, a.code, fmtLiters(a.total), fmtLiters(a.avg)]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 241, 226] },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
  });

  drawFooter(doc);
  return doc;
}

/* ---------------- Supplier Statement PDF ---------------- */
export async function buildSupplierStatementPdf(farmSettings, supplierName, purchases) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogoDataUrl();
  drawHeader(doc, farmSettings, "Supplier Statement", logo);

  const totalPurchased = purchases.reduce((s, p) => s + p.total, 0);
  const totalPaid = purchases.reduce((s, p) => s + p.paid, 0);
  const totalCredit = purchases.reduce((s, p) => s + p.credit, 0);

  doc.setTextColor(20, 30, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(supplierName, 12, 54);

  const boxes = [
    { label: "Total Purchased", value: fmtMoney(totalPurchased) },
    { label: "Total Paid", value: fmtMoney(totalPaid) },
    { label: "Credit Remaining", value: fmtMoney(totalCredit), danger: totalCredit > 0 },
  ];
  const boxW = 58, boxH = 18, startX = 12, y = 62;
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

  autoTable(doc, {
    startY: 86,
    head: [["Date", "Product", "Qty", "Total", "Paid", "Credit"]],
    body: purchases.length
      ? purchases.map((p) => [fmtDate(p.date), p.product, `${p.quantity} ${p.unit}`, fmtMoney(p.total), fmtMoney(p.paid), fmtMoney(p.credit)])
      : [["—", "No purchases in this period", "—", "—", "—", "—"]],
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 241, 226] },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });

  drawFooter(doc);
  return doc;
}

/* ---------------- Monthly Bill PDF (concise, classic format) ---------------- */
export async function buildMonthlyBillPdf(farmSettings, customer, { monthLabel, milkDelivered, avgPrice, totalBill, paidAmount }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogoDataUrl();
  drawHeader(doc, farmSettings, "Monthly Milk Bill", logo);

  doc.setTextColor(20, 30, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(customer.name, 12, 55);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`${customer.phone || ""}    Billing Month: ${monthLabel}`, 12, 61);

  const remaining = totalBill - paidAmount;
  const rows = [
    ["Milk Delivered", fmtLiters(milkDelivered)],
    ["Average Price per Liter", fmtMoney(avgPrice)],
    ["Total Bill", fmtMoney(totalBill)],
    ["Paid Amount", fmtMoney(paidAmount)],
    ["Remaining", fmtMoney(remaining)],
  ];

  autoTable(doc, {
    startY: 70,
    body: rows,
    styles: { fontSize: 11, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: "normal", textColor: GRAY }, 1: { halign: "right", fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.row.index === rows.length - 1) {
        data.cell.styles.fillColor = remaining > 0 ? [251, 235, 214] : [231, 239, 229];
        data.cell.styles.textColor = remaining > 0 ? WARN : GREEN;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 12;
      }
      if (data.row.index === 2) {
        data.cell.styles.fillColor = [246, 241, 226];
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
