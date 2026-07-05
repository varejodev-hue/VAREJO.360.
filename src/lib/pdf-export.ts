import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function downloadPDF(
  filename: string,
  rows: Record<string, unknown>[],
  options?: { title?: string; headers?: string[]; subtitle?: string },
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const title = options?.title ?? filename;
  const subtitle = options?.subtitle;

  doc.setFontSize(14);
  doc.text(title, 40, 40);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(subtitle, 40, 58);
    doc.setTextColor(0);
  }

  const cols = options?.headers ?? (rows[0] ? Object.keys(rows[0]) : []);
  const body = rows.map((r) =>
    cols.map((c) => {
      const v = r[c];
      if (v === null || v === undefined) return "";
      return typeof v === "string" ? v : String(v);
    }),
  );

  autoTable(doc, {
    head: [cols],
    body,
    startY: subtitle ? 72 : 56,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 30, right: 30 },
  });

  const safe = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  doc.save(safe);
}
