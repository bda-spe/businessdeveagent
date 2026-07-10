import PDFDocument from "pdfkit";
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
const PANEL = "#f8fafc";

export interface InvoicePdfSettings {
  selectedTemplate: string;
  showPolicies: boolean;
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

/**
 * Fetch a business logo from object storage as raw bytes for embedding.
 * Returns null when there is no logo, the object is missing, or the format is
 * not embeddable (PDFKit only rasterizes PNG/JPEG — SVGs are skipped cleanly).
 */
async function fetchLogoBytes(logoUrl?: string | null): Promise<Buffer | null> {
  if (!logoUrl) return null;
  try {
    const service = new ObjectStorageService();
    const file = await service.getObjectEntityFile(logoUrl);
    const [metadata] = await file.getMetadata();
    const contentType = (metadata.contentType || "").toLowerCase();
    if (contentType && !/image\/(png|jpe?g)/.test(contentType)) {
      return null;
    }
    const [buffer] = await file.download();
    return buffer;
  } catch {
    return null;
  }
}

export async function buildInvoicePdf(opts: {
  businessName: string;
  logoUrl?: string | null;
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
    logoUrl,
    customerEmail,
    customerPhone,
    serviceAddress,
    projectDescription,
    date,
    estimate,
    settings,
  } = opts;
  const brandColor = settings.brandColor || DEFAULT_NAVY;
  const logoBytes = await fetchLogoBytes(logoUrl);

  return new Promise((resolve, reject) => {
    const margin = 54;
    const doc = new PDFDocument({ size: "LETTER", margin });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const contentW = pageW - margin * 2;
    const rightX = pageW - margin;

    // ── Header band ──────────────────────────────────────────────────────────
    const bandH = 104;
    doc.rect(0, 0, pageW, bandH).fill(brandColor);

    // Logo sits in a white rounded card top-right so it reads on any brand
    // color. Omitted cleanly when there is no embeddable logo.
    let nameRightBound = rightX;
    if (logoBytes) {
      const cardW = 132;
      const cardH = 60;
      const cardX = rightX - cardW;
      const cardY = (bandH - cardH) / 2;
      try {
        doc.save();
        doc.roundedRect(cardX, cardY, cardW, cardH, 8).fill("#ffffff");
        doc.image(logoBytes, cardX + 10, cardY + 8, {
          fit: [cardW - 20, cardH - 16],
          align: "center",
          valign: "center",
        });
        doc.restore();
        nameRightBound = cardX - 16;
      } catch {
        // Non-embeddable image (e.g. corrupt or unsupported) — skip cleanly.
        doc.restore();
      }
    }

    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(21)
      .text(businessName, margin, 34, {
        width: Math.max(120, nameRightBound - margin),
        lineBreak: false,
        ellipsis: true,
      });
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#dbe4f0")
      .text(
        TEMPLATE_TITLES[settings.selectedTemplate] ?? "Service Estimate",
        margin,
        64,
      );

    // ── Meta block ───────────────────────────────────────────────────────────
    let y = bandH + 26;
    const metaLabel = (label: string, value: string, yy: number): number => {
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(LIGHT);
      doc.text(label.toUpperCase(), margin, yy);
      doc.font("Helvetica").fontSize(10).fillColor(INK);
      doc.text(value, margin, yy + 11, { width: contentW });
      return doc.y + 8;
    };

    y = metaLabel("Date", date, y);
    if (customerEmail) y = metaLabel("Prepared for", customerEmail, y);
    if (customerPhone) y = metaLabel("Phone", customerPhone, y);
    if (serviceAddress) y = metaLabel("Service address", serviceAddress, y);
    if (projectDescription)
      y = metaLabel("Project", projectDescription.slice(0, 240), y);

    doc.y = y;

    // ── Section heading helper ───────────────────────────────────────────────
    const writeHeading = (label: string) => {
      doc.moveDown(0.6);
      const hy = doc.y;
      doc.font("Helvetica-Bold").fontSize(11).fillColor(brandColor).text(label, margin, hy);
      doc
        .moveTo(margin, doc.y + 2)
        .lineTo(margin + 34, doc.y + 2)
        .lineWidth(2)
        .strokeColor(brandColor)
        .stroke();
      doc.moveDown(0.45);
      doc.font("Helvetica").fontSize(9.5).fillColor(SLATE);
      doc.x = margin;
    };

    if (estimate.customerSummary) {
      writeHeading("Project Summary");
      doc.text(estimate.customerSummary, margin, doc.y, { width: contentW });
    }

    // ── Services & pricing table ─────────────────────────────────────────────
    writeHeading("Services & Pricing");
    const priceColW = 96;
    const priceX = rightX - priceColW;
    const descX = margin + 10;
    const descW = priceX - descX - 10;

    const ensureSpace = (needed: number) => {
      if (doc.y + needed > doc.page.height - margin) {
        doc.addPage();
        doc.y = margin;
      }
    };

    // Table header row
    ensureSpace(24);
    const headRowY = doc.y;
    doc.rect(margin, headRowY, contentW, 22).fill(brandColor);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff");
    doc.text("DESCRIPTION", descX, headRowY + 7, { width: descW });
    doc.text("AMOUNT", priceX, headRowY + 7, {
      width: priceColW - 10,
      align: "right",
    });
    doc.y = headRowY + 22;

    const items = estimate.invoiceLineItems;
    doc.font("Helvetica").fontSize(9.5).fillColor(INK);
    for (const li of items) {
      const rowH =
        Math.max(
          doc.heightOfString(li.description, { width: descW }),
          doc.heightOfString(money(li.total), { width: priceColW - 10 }),
        ) + 12;
      ensureSpace(rowH);
      const rowY = doc.y;
      doc.fillColor(INK).text(li.description, descX, rowY + 6, { width: descW });
      doc.text(money(li.total), priceX, rowY + 6, {
        width: priceColW - 10,
        align: "right",
      });
      doc
        .moveTo(margin, rowY + rowH)
        .lineTo(rightX, rowY + rowH)
        .lineWidth(0.5)
        .strokeColor(HAIRLINE)
        .stroke();
      doc.y = rowY + rowH;
    }

    // ── Totals panel (right aligned) ─────────────────────────────────────────
    const subtotal = items.reduce((s, li) => s + li.total, 0);
    const total = subtotal + estimate.taxes;
    const panelW = 230;
    const panelX = rightX - panelW;
    const rowGap = 18;
    let panelH = rowGap * 2 + 30;
    ensureSpace(panelH + 12);
    let py = doc.y + 10;
    const panelTop = py;
    doc.roundedRect(panelX, panelTop, panelW, panelH, 6).fill(PANEL);

    const totalsRow = (
      label: string,
      value: string,
      bold: boolean,
      color: string,
    ) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9.5);
      doc.fillColor(bold ? color : SLATE);
      doc.text(label, panelX + 14, py, { width: panelW - 120 });
      doc.fillColor(bold ? color : INK);
      doc.text(value, panelX + panelW - 110, py, {
        width: 96,
        align: "right",
      });
      py += rowGap;
    };

    py = panelTop + 12;
    totalsRow("Subtotal", money(subtotal), false, INK);
    totalsRow("Taxes & Fees", money(estimate.taxes), false, INK);
    doc
      .moveTo(panelX + 14, py - 2)
      .lineTo(panelX + panelW - 14, py - 2)
      .lineWidth(0.5)
      .strokeColor(HAIRLINE)
      .stroke();
    py += 4;
    totalsRow("Estimated Total", money(total), true, brandColor);
    doc.y = panelTop + panelH + 6;

    if (
      estimate.recommendedPriceLow != null &&
      estimate.recommendedPriceHigh != null
    ) {
      doc.font("Helvetica").fontSize(9).fillColor(LIGHT);
      doc.text(
        `Expected range: ${money(estimate.recommendedPriceLow)} – ${money(estimate.recommendedPriceHigh)}`,
        margin,
        doc.y + 2,
        { width: contentW, align: "right" },
      );
    }

    // ── Duration / assumptions / questions ───────────────────────────────────
    const durationLines = estimate.assumptions.filter((a) =>
      /^\s*estimated duration/i.test(a),
    );
    const otherAssumptions = estimate.assumptions.filter(
      (a) => !/^\s*estimated duration/i.test(a),
    );
    if (durationLines.length > 0) {
      writeHeading("Estimated Duration");
      for (const a of durationLines) {
        doc.text(a.replace(/^\s*estimated duration:\s*/i, ""), margin, doc.y, {
          width: contentW,
        });
      }
    }
    if (otherAssumptions.length > 0) {
      writeHeading("Assumptions");
      for (const a of otherAssumptions) {
        doc.text(`•  ${a}`, margin, doc.y, { width: contentW });
      }
    }

    if (estimate.followUpQuestions.length > 0) {
      writeHeading("Open Questions");
      for (const q of estimate.followUpQuestions) {
        doc.text(`•  ${q}`, margin, doc.y, { width: contentW });
      }
    }

    // ── Policies / legal ─────────────────────────────────────────────────────
    // All five policy/legal text blocks are gated together by the single
    // "Show policies on estimate" toggle — there is no per-block control.
    const policyBlocks: { key: string; label: string; body?: string | null }[] = [
      { key: "payment_terms", label: "Payment Terms", body: settings.paymentTerms },
      {
        key: "cancellation_policy",
        label: "Cancellation Policy",
        body: settings.cancellationPolicy,
      },
      {
        key: "terms_conditions",
        label: "Terms and Conditions",
        body: settings.termsConditions,
      },
      {
        key: "estimate_disclaimer",
        label: "Estimate Disclaimer",
        body: settings.estimateDisclaimer,
      },
      {
        key: "acceptance_language",
        label: "Customer Acceptance",
        body: settings.acceptanceLanguage,
      },
    ];
    if (settings.showPolicies) {
      for (const block of policyBlocks) {
        if (!block.body) continue;
        writeHeading(block.label);
        doc.text(block.body, margin, doc.y, { width: contentW });
      }
    } else {
      // With policies hidden, still surface a short one-line agreement
      // statement so the customer knows policies apply even though the full
      // text isn't shown on this estimate.
      doc.moveDown(0.8);
      doc.font("Helvetica").fontSize(9.5).fillColor(SLATE);
      doc.text(SHORT_POLICY_AGREEMENT_LINE, margin, doc.y, { width: contentW });
    }

    // Every estimate PDF carries the preliminary-estimate disclaimer, regardless
    // of which optional sections the business has enabled.
    writeHeading("Preliminary Estimate Notice");
    doc.text(PRELIMINARY_ESTIMATE_DISCLAIMER, margin, doc.y, { width: contentW });

    if (settings.footerNote) {
      doc.moveDown(1.2);
      doc.fontSize(8.5).fillColor(LIGHT).text(settings.footerNote, margin, doc.y, {
        width: contentW,
        align: "center",
      });
    }

    doc.end();
  });
}
