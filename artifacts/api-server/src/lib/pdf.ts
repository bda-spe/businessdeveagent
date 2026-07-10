import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import {
  PRELIMINARY_ESTIMATE_DISCLAIMER,
  SHORT_POLICY_AGREEMENT_LINE,
} from "./defaults";
import type { Estimate } from "./aiService";
import { ObjectStorageService } from "./objectStorage";

const DEFAULT_NAVY = "#1e3a5f";
const INK = "#0f172a";
const SLATE = "#475569";
const LIGHT = "#94a3b8";
const HAIRLINE = "#e2e8f0";

export interface InvoicePdfSettings {
  selectedTemplate: string;
  showPolicies: boolean;
  showLogo?: boolean;
  brandColor?: string | null;
  cancellationPolicy?: string | null;
  paymentTerms?: string | null;
  estimateDisclaimer?: string | null;
  termsConditions?: string | null;
  acceptanceLanguage?: string | null;
  depositRequirements?: string | null;
  footerNote?: string | null;
}

const TEMPLATE_TITLES: Record<string, string> = {
  simple_summary: "Estimate Summary",
  modern_estimate_card: "Service Estimate",
  detailed_agreement: "Detailed Service Estimate & Agreement",
  professional_proposal: "Professional Service Proposal",
};

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

// ── Color helpers ──────────────────────────────────────────────────────────
// The estimate uses only the single brand color the business picked. We derive
// light tints from it (for table rows / highlighted cards) and pick a readable
// text color for the header band so the design stays legible on any brand color.
function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const int = parseInt(h, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function tint(hex: string, amount: number): string {
  const rgb = parseHex(hex) ?? parseHex(DEFAULT_NAVY)!;
  const [r, g, b] = rgb.map((v) => Math.round(v + (255 - v) * amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function readableOn(hex: string): string {
  const rgb = parseHex(hex) ?? parseHex(DEFAULT_NAVY)!;
  const [r, g, b] = rgb.map((v) => v / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.62 ? INK : "#ffffff";
}

// ── Logo fetching ──────────────────────────────────────────────────────────
type LogoAsset =
  | { kind: "raster"; bytes: Buffer }
  | { kind: "svg"; text: string };

function looksLikeSvg(buf: Buffer): boolean {
  const head = buf.subarray(0, 256).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<svg") || head.startsWith("<?xml");
}

/**
 * Fetch a business logo from object storage for embedding. PNG/JPEG are drawn
 * as raster images; SVG is drawn as vector via svg-to-pdfkit. Returns null when
 * there is no logo, the object is missing, or the format is unsupported — the
 * caller then omits the logo cleanly without affecting layout.
 */
async function fetchLogo(logoUrl?: string | null): Promise<LogoAsset | null> {
  if (!logoUrl) return null;
  try {
    const service = new ObjectStorageService();
    const file = await service.getObjectEntityFile(logoUrl);
    const [metadata] = await file.getMetadata();
    const contentType = (metadata.contentType || "").toLowerCase();
    const [buffer] = await file.download();
    if (/svg/.test(contentType) || (!contentType && looksLikeSvg(buffer))) {
      return { kind: "svg", text: buffer.toString("utf8") };
    }
    if (/image\/(png|jpe?g)/.test(contentType) || !contentType) {
      return { kind: "raster", bytes: buffer };
    }
    return null;
  } catch {
    return null;
  }
}

export async function buildInvoicePdf(opts: {
  businessName: string;
  businessPhone?: string | null;
  businessEmail?: string | null;
  businessWebsite?: string | null;
  logoUrl?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  serviceAddress?: string | null;
  projectDescription?: string | null;
  date: string;
  estimate: Estimate;
  settings: InvoicePdfSettings;
}): Promise<Buffer> {
  const {
    businessName,
    businessPhone,
    businessEmail,
    businessWebsite,
    logoUrl,
    customerName,
    customerEmail,
    customerPhone,
    serviceAddress,
    projectDescription,
    date,
    estimate,
    settings,
  } = opts;

  const brandRaw = settings.brandColor || DEFAULT_NAVY;
  const brand = parseHex(brandRaw) ? brandRaw : DEFAULT_NAVY;
  const brandSoft = tint(brand, 0.9);
  const brandRow = tint(brand, 0.955);
  const brandBorder = tint(brand, 0.65);
  const logo =
    settings.showLogo === false ? null : await fetchLogo(logoUrl);

  return new Promise((resolve, reject) => {
    const margin = 50;
    const radius = 8;
    const PAD = 14;
    const footerH = 44;
    const doc = new PDFDocument({ size: "LETTER", margin, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const contentW = pageW - margin * 2;
    const rightX = pageW - margin;
    const bottomLimit = () => pageH - margin - footerH;

    const ensureSpace = (needed: number) => {
      if (doc.y + needed > bottomLimit()) {
        doc.addPage();
        doc.y = margin;
      }
    };

    // ── Header band (company info left, logo right) ──────────────────────────
    const bandH = 122;
    doc.rect(0, 0, pageW, bandH).fill(brand);
    const bandText = readableOn(brand);

    let nameRightBound = rightX;
    if (logo) {
      const cardW = 138;
      const cardH = 66;
      const cardX = rightX - cardW;
      const cardY = (bandH - cardH) / 2;
      doc.save();
      doc.roundedRect(cardX, cardY, cardW, cardH, radius).fill("#ffffff");
      try {
        if (logo.kind === "raster") {
          doc.image(logo.bytes, cardX + 12, cardY + 10, {
            fit: [cardW - 24, cardH - 20],
            align: "center",
            valign: "center",
          });
        } else {
          SVGtoPDF(doc, logo.text, cardX + 12, cardY + 10, {
            width: cardW - 24,
            height: cardH - 20,
            preserveAspectRatio: "xMidYMid meet",
            assumePt: true,
          });
        }
        nameRightBound = cardX - 18;
      } catch {
        // Unsupported / corrupt logo — leave the white card empty-free by
        // continuing; layout is unaffected.
        nameRightBound = cardX - 18;
      }
      doc.restore();
    }

    doc
      .fillColor(bandText)
      .font("Helvetica-Bold")
      .fontSize(22)
      .text(businessName, margin, 28, {
        width: Math.max(140, nameRightBound - margin),
        lineBreak: false,
        ellipsis: true,
      });

    const contactLines = [businessPhone, businessEmail, businessWebsite].filter(
      (v): v is string => !!v && v.trim().length > 0,
    );
    let cy = 60;
    doc.font("Helvetica").fontSize(9.5).fillColor(bandText).fillOpacity(0.85);
    for (const line of contactLines) {
      doc.text(line, margin, cy, {
        width: Math.max(140, nameRightBound - margin),
        lineBreak: false,
        ellipsis: true,
      });
      cy += 13;
    }
    doc.fillOpacity(1);

    // ── Document title ───────────────────────────────────────────────────────
    doc.y = bandH + 22;
    doc
      .font("Helvetica-Bold")
      .fontSize(17)
      .fillColor(brand)
      .text(TEMPLATE_TITLES[settings.selectedTemplate] ?? "Service Estimate", margin, doc.y);
    doc.moveDown(0.5);

    // ── Section heading helper ───────────────────────────────────────────────
    const heading = (label: string) => {
      ensureSpace(28);
      const hy = doc.y;
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(brand)
        .text(label, margin, hy);
      doc
        .moveTo(margin, doc.y + 2)
        .lineTo(margin + 32, doc.y + 2)
        .lineWidth(2)
        .strokeColor(brand)
        .stroke();
      doc.moveDown(0.5);
      doc.x = margin;
    };

    // Generic rounded card with a title, an optional body paragraph, and/or
    // bullet lines. Measures its own height so the border wraps the content.
    const drawCard = (o: {
      title?: string;
      body?: string;
      bullets?: string[];
      fill?: string;
      border?: string;
      accent?: string;
    }) => {
      const innerW = contentW - PAD * 2;
      let h = PAD;
      if (o.title) {
        doc.font("Helvetica-Bold").fontSize(10.5);
        h += doc.heightOfString(o.title, { width: innerW }) + 6;
      }
      if (o.body) {
        doc.font("Helvetica").fontSize(9.5);
        h += doc.heightOfString(o.body, { width: innerW });
      }
      if (o.bullets) {
        doc.font("Helvetica").fontSize(9.5);
        for (const b of o.bullets)
          h += doc.heightOfString(`•   ${b}`, { width: innerW - 2 }) + 4;
      }
      h += PAD;

      if (h <= bottomLimit() - margin) ensureSpace(h + 10);
      const y0 = doc.y;
      doc
        .roundedRect(margin, y0, contentW, h, radius)
        .fillAndStroke(o.fill || "#ffffff", o.border || HAIRLINE);

      const tx = margin + PAD;
      let ty = y0 + PAD;
      if (o.title) {
        doc
          .font("Helvetica-Bold")
          .fontSize(10.5)
          .fillColor(o.accent || brand)
          .text(o.title, tx, ty, { width: innerW });
        ty = doc.y + 6;
      }
      if (o.body) {
        doc
          .font("Helvetica")
          .fontSize(9.5)
          .fillColor(SLATE)
          .text(o.body, tx, ty, { width: innerW });
        ty = doc.y;
      }
      if (o.bullets) {
        doc.font("Helvetica").fontSize(9.5).fillColor(SLATE);
        for (const b of o.bullets) {
          doc.text(`•   ${b}`, tx, ty, { width: innerW - 2 });
          ty = doc.y + 4;
        }
      }
      doc.y = y0 + h + 12;
    };

    // ── Details block (two columns) ──────────────────────────────────────────
    const innerW = contentW - PAD * 2;
    const colGap = 22;
    const colW = (innerW - colGap) / 2;
    const leftFields: [string, string][] = [["Date", date]];
    if (serviceAddress) leftFields.push(["Service Address", serviceAddress]);
    const rightFields: [string, string][] = [];
    if (customerName) rightFields.push(["Prepared For", customerName]);
    if (customerEmail) rightFields.push(["Customer Email", customerEmail]);
    if (customerPhone) rightFields.push(["Customer Phone", customerPhone]);

    const measureField = (value: string): number => {
      doc.font("Helvetica").fontSize(10);
      return 11 + doc.heightOfString(value, { width: colW }) + 10;
    };
    const colHeight = (fields: [string, string][]) =>
      fields.reduce((s, f) => s + measureField(f[1]), 0);
    const detailsH = PAD * 2 + Math.max(colHeight(leftFields), colHeight(rightFields));

    ensureSpace(detailsH + 10);
    const dy0 = doc.y;
    doc
      .roundedRect(margin, dy0, contentW, detailsH, radius)
      .fillAndStroke("#ffffff", HAIRLINE);

    const renderField = (
      x: number,
      label: string,
      value: string,
      yy: number,
    ): number => {
      doc
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .fillColor(LIGHT)
        .text(label.toUpperCase(), x, yy, { width: colW, characterSpacing: 0.4 });
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(INK)
        .text(value, x, yy + 11, { width: colW });
      return doc.y + 10;
    };
    const leftX = margin + PAD;
    const rightColX = margin + PAD + colW + colGap;
    let ly = dy0 + PAD;
    let ry = dy0 + PAD;
    for (const [l, v] of leftFields) ly = renderField(leftX, l, v, ly);
    for (const [l, v] of rightFields) ry = renderField(rightColX, l, v, ry);
    doc.y = dy0 + detailsH + 14;

    // ── Project Summary (bordered card) ──────────────────────────────────────
    const summaryTitle = projectDescription?.trim()
      ? projectDescription.trim().slice(0, 160)
      : undefined;
    const summaryBody = estimate.customerSummary?.trim() || undefined;
    if (summaryTitle || summaryBody) {
      heading("Project Summary");
      drawCard({ title: summaryTitle, body: summaryBody });
    }

    // ── Services & Pricing table ─────────────────────────────────────────────
    heading("Services & Pricing");
    const priceColW = 110;
    const priceX = rightX - priceColW;
    const descX = margin + 12;
    const descW = priceX - descX - 12;
    const headText = readableOn(brand);

    const drawTableHeader = () => {
      const hy = doc.y;
      doc.rect(margin, hy, contentW, 24).fill(brand);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(headText);
      doc.text("SERVICE", descX, hy + 8, { width: descW });
      doc.text("PRICE", priceX, hy + 8, {
        width: priceColW - 12,
        align: "right",
      });
      doc.y = hy + 24;
    };

    ensureSpace(24 + 30);
    const tableTop = doc.y;
    drawTableHeader();

    const items = estimate.invoiceLineItems;
    items.forEach((li, idx) => {
      doc.font("Helvetica").fontSize(9.5).fillColor(INK);
      const rowH =
        Math.max(
          doc.heightOfString(li.description, { width: descW }),
          doc.heightOfString(money(li.total), { width: priceColW - 12 }),
        ) + 14;
      if (doc.y + rowH > bottomLimit()) {
        doc.addPage();
        doc.y = margin;
        drawTableHeader();
      }
      const rowY = doc.y;
      if (idx % 2 === 1) {
        doc.rect(margin, rowY, contentW, rowH).fill(brandRow);
      }
      doc.fillColor(INK).font("Helvetica").fontSize(9.5);
      doc.text(li.description, descX, rowY + 7, { width: descW });
      doc.text(money(li.total), priceX, rowY + 7, {
        width: priceColW - 12,
        align: "right",
      });
      doc
        .moveTo(margin, rowY + rowH)
        .lineTo(rightX, rowY + rowH)
        .lineWidth(0.5)
        .strokeColor(HAIRLINE)
        .stroke();
      doc.y = rowY + rowH;
    });
    // Outer border around the table for a crisp, contained look.
    doc
      .roundedRect(margin, tableTop, contentW, doc.y - tableTop, 4)
      .lineWidth(0.75)
      .strokeColor(HAIRLINE)
      .stroke();
    doc.y += 14;

    // ── Totals card (right aligned) ──────────────────────────────────────────
    const subtotal = items.reduce((s, li) => s + li.total, 0);
    const total = subtotal + estimate.taxes;
    const panelW = 250;
    const panelX = rightX - panelW;
    const panelH = 92;
    ensureSpace(panelH + 12);
    const panelTop = doc.y;
    doc
      .roundedRect(panelX, panelTop, panelW, panelH, radius)
      .fillAndStroke("#ffffff", HAIRLINE);

    const totalsRow = (
      label: string,
      value: string,
      yy: number,
      opt?: { big?: boolean },
    ) => {
      if (opt?.big) {
        doc.font("Helvetica-Bold").fontSize(11).fillColor(INK);
        doc.text(label, panelX + 16, yy + 3, { width: panelW - 150 });
        doc.font("Helvetica-Bold").fontSize(16).fillColor(brand);
        doc.text(value, panelX + panelW - 146, yy, {
          width: 130,
          align: "right",
        });
      } else {
        doc.font("Helvetica").fontSize(9.5).fillColor(SLATE);
        doc.text(label, panelX + 16, yy, { width: panelW - 130 });
        doc.font("Helvetica").fontSize(9.5).fillColor(INK);
        doc.text(value, panelX + panelW - 126, yy, {
          width: 110,
          align: "right",
        });
      }
    };
    totalsRow("Subtotal", money(subtotal), panelTop + 14);
    totalsRow("Taxes & Fees", money(estimate.taxes), panelTop + 32);
    doc
      .moveTo(panelX + 16, panelTop + 52)
      .lineTo(panelX + panelW - 16, panelTop + 52)
      .lineWidth(0.5)
      .strokeColor(HAIRLINE)
      .stroke();
    totalsRow("Estimated Total", money(total), panelTop + 60, { big: true });
    doc.y = panelTop + panelH + 12;

    // ── Estimated Range (highlighted card below totals) ──────────────────────
    if (
      estimate.recommendedPriceLow != null &&
      estimate.recommendedPriceHigh != null
    ) {
      const rangeH = 46;
      ensureSpace(rangeH + 10);
      const rTop = doc.y;
      const rX = rightX - panelW;
      doc
        .roundedRect(rX, rTop, panelW, rangeH, radius)
        .fillAndStroke(brandSoft, brandBorder);
      doc
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .fillColor(brand)
        .text("ESTIMATED RANGE", rX + 16, rTop + 10, { characterSpacing: 0.4 });
      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(INK)
        .text(
          `${money(estimate.recommendedPriceLow)} – ${money(estimate.recommendedPriceHigh)}`,
          rX + 16,
          rTop + 22,
          { width: panelW - 32 },
        );
      doc.y = rTop + rangeH + 14;
    }

    // ── Estimated Duration / Assumptions / Open Questions ────────────────────
    const durationLines = estimate.assumptions.filter((a) =>
      /^\s*estimated duration/i.test(a),
    );
    const otherAssumptions = estimate.assumptions.filter(
      (a) => !/^\s*estimated duration/i.test(a),
    );
    const durationValue =
      estimate.estimatedDuration?.trim() ||
      durationLines[0]?.replace(/^\s*estimated duration:\s*/i, "").trim();
    if (durationValue) {
      heading("Estimated Duration");
      drawCard({ body: durationValue, fill: brandSoft, border: brandBorder });
    }

    if (otherAssumptions.length > 0) {
      heading("Assumptions");
      drawCard({ bullets: otherAssumptions });
    }

    if (estimate.followUpQuestions.length > 0) {
      heading("Open Questions");
      drawCard({ bullets: estimate.followUpQuestions });
    }

    // ── Policies / legal ─────────────────────────────────────────────────────
    // All policy/legal blocks are gated together by the single "Show policies on
    // estimate" toggle. When hidden, a short agreement line is still surfaced.
    const policyBlocks: { label: string; body?: string | null }[] = [
      { label: "Payment Terms", body: settings.paymentTerms },
      { label: "Cancellation Policy", body: settings.cancellationPolicy },
      { label: "Terms and Conditions", body: settings.termsConditions },
      { label: "Estimate Disclaimer", body: settings.estimateDisclaimer },
      { label: "Customer Acceptance", body: settings.acceptanceLanguage },
    ];
    if (settings.showPolicies) {
      for (const block of policyBlocks) {
        if (!block.body) continue;
        heading(block.label);
        drawCard({ body: block.body });
      }
    } else {
      ensureSpace(30);
      doc.moveDown(0.4);
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(SLATE)
        .text(SHORT_POLICY_AGREEMENT_LINE, margin, doc.y, { width: contentW });
      doc.moveDown(0.4);
    }

    // ── Preliminary Estimate Notice (distinct, soft box) ─────────────────────
    heading("Preliminary Estimate Notice");
    drawCard({
      body: PRELIMINARY_ESTIMATE_DISCLAIMER,
      fill: tint(brand, 0.94),
      border: brandBorder,
    });

    if (settings.footerNote) {
      ensureSpace(24);
      doc.moveDown(0.4);
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(LIGHT)
        .text(settings.footerNote, margin, doc.y, {
          width: contentW,
          align: "center",
        });
    }

    // ── Footer on every page (thank you + contact + page numbers) ────────────
    const footerContact = [businessPhone, businessEmail, businessWebsite]
      .filter((v) => !!v && v.trim().length > 0)
      .join("    •    ");
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const fy = pageH - margin - footerH + 6;
      doc
        .moveTo(margin, fy)
        .lineTo(rightX, fy)
        .lineWidth(0.5)
        .strokeColor(HAIRLINE)
        .stroke();
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(brand)
        .text("Thank you for your business.", margin, fy + 8, {
          width: contentW,
          align: "center",
        });
      if (footerContact) {
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(LIGHT)
          .text(footerContact, margin, fy + 21, {
            width: contentW,
            align: "center",
          });
      }
      if (range.count > 1) {
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(LIGHT)
          .text(`Page ${i + 1} of ${range.count}`, margin, fy + 21, {
            width: contentW,
            align: "right",
          });
      }
    }

    doc.end();
  });
}
