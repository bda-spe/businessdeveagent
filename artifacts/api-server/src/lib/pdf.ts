import PDFDocument from "pdfkit";
import type { Estimate, EstimateLineItem } from "./aiService";

const NAVY = "#1e3a5f";
const SLATE = "#475569";
const LIGHT = "#94a3b8";

export interface InvoicePdfSettings {
  selectedTemplate: string;
  includedSections: string[];
  cancellationPolicy?: string | null;
  paymentTerms?: string | null;
  estimateDisclaimer?: string | null;
  termsConditions?: string | null;
  acceptanceLanguage?: string | null;
  depositRequirements?: string | null;
  footerNote?: string | null;
}

export function filterLineItems(
  items: EstimateLineItem[],
  sections: string[],
): EstimateLineItem[] {
  return items.filter((li) => {
    const d = li.description.toLowerCase();
    if (!sections.includes("labor") && /labor/.test(d)) return false;
    if (!sections.includes("materials") && /material|supplies/.test(d)) return false;
    if (
      !sections.includes("travel_mobilization") &&
      /travel|mobiliz|trip charge/.test(d)
    )
      return false;
    if (
      !sections.includes("emergency_fees") &&
      /emergency|after.hours|after hours/.test(d)
    )
      return false;
    if (!sections.includes("discounts") && /discount/.test(d)) return false;
    return true;
  });
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

export function buildInvoicePdf(opts: {
  businessName: string;
  customerEmail?: string | null;
  projectDescription?: string | null;
  date: string;
  estimate: Estimate;
  settings: InvoicePdfSettings;
}): Promise<Buffer> {
  const { businessName, customerEmail, projectDescription, date, estimate, settings } =
    opts;
  const sections = settings.includedSections;
  const detailed =
    settings.selectedTemplate === "detailed_agreement" ||
    settings.selectedTemplate === "professional_proposal";

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 54 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header band
    doc.rect(0, 0, doc.page.width, 110).fill(NAVY);
    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(22)
      .text(businessName, 54, 34);
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#cbd5e1")
      .text(TEMPLATE_TITLES[settings.selectedTemplate] ?? "Service Estimate", 54, 64);

    doc.fillColor(SLATE).fontSize(10);
    let y = 132;
    doc.font("Helvetica").text(`Date: ${date}`, 54, y);
    y += 14;
    if (customerEmail) {
      doc.text(`Prepared for: ${customerEmail}`, 54, y);
      y += 14;
    }
    if (projectDescription) {
      doc.text(`Project: ${projectDescription.slice(0, 200)}`, 54, y, {
        width: doc.page.width - 108,
      });
      y = doc.y + 8;
    }

    const writeHeading = (label: string) => {
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text(label);
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(9.5).fillColor(SLATE);
    };

    doc.y = y + 6;
    if (estimate.customerSummary) {
      writeHeading("Project Summary");
      doc.text(estimate.customerSummary, { width: doc.page.width - 108 });
    }

    // Line items
    const items = filterLineItems(estimate.invoiceLineItems, sections);
    writeHeading("Services & Pricing");
    const tableX = 54;
    const priceX = doc.page.width - 54 - 80;
    for (const li of items) {
      const rowY = doc.y;
      doc.text(li.description, tableX, rowY, { width: priceX - tableX - 12 });
      const endY = doc.y;
      doc.text(money(li.total), priceX, rowY, { width: 80, align: "right" });
      doc.y = Math.max(endY, doc.y) + 2;
      doc.x = tableX;
    }
    doc
      .moveTo(tableX, doc.y + 2)
      .lineTo(doc.page.width - 54, doc.y + 2)
      .strokeColor("#e2e8f0")
      .stroke();
    doc.moveDown(0.4);

    const subtotal = items.reduce((s, li) => s + li.total, 0);
    doc.text("Subtotal", tableX, doc.y, { continued: false });
    doc.moveUp();
    doc.text(money(subtotal), priceX, doc.y, { width: 80, align: "right" });
    doc.x = tableX;
    if (sections.includes("taxes_fees")) {
      doc.text("Taxes & Fees", tableX, doc.y);
      doc.moveUp();
      doc.text(money(estimate.taxes), priceX, doc.y, { width: 80, align: "right" });
      doc.x = tableX;
    }
    const total = subtotal + (sections.includes("taxes_fees") ? estimate.taxes : 0);
    doc.font("Helvetica-Bold").fillColor(NAVY);
    doc.text("Estimated Total", tableX, doc.y + 4);
    doc.moveUp();
    doc.text(money(total), priceX, doc.y, { width: 80, align: "right" });
    doc.x = tableX;
    doc.font("Helvetica").fillColor(SLATE);
    if (
      estimate.recommendedPriceLow != null &&
      estimate.recommendedPriceHigh != null
    ) {
      doc.fontSize(9).fillColor(LIGHT);
      doc.text(
        `Expected range: ${money(estimate.recommendedPriceLow)} – ${money(estimate.recommendedPriceHigh)}`,
        tableX,
        doc.y + 2,
      );
      doc.fontSize(9.5).fillColor(SLATE);
    }

    const durationLines = estimate.assumptions.filter((a) =>
      /^\s*estimated duration/i.test(a),
    );
    const otherAssumptions = estimate.assumptions.filter(
      (a) => !/^\s*estimated duration/i.test(a),
    );
    if (sections.includes("estimated_duration") && durationLines.length > 0) {
      writeHeading("Estimated Duration");
      for (const a of durationLines) {
        doc.text(a.replace(/^\s*estimated duration:\s*/i, ""), {
          width: doc.page.width - 108,
        });
      }
    }
    if (sections.includes("assumptions") && otherAssumptions.length > 0) {
      writeHeading("Assumptions");
      for (const a of otherAssumptions) {
        doc.text(`•  ${a}`, { width: doc.page.width - 108 });
      }
    }

    if (
      sections.includes("follow_up_questions") &&
      estimate.followUpQuestions.length > 0
    ) {
      writeHeading("Open Questions");
      for (const q of estimate.followUpQuestions) {
        doc.text(`•  ${q}`, { width: doc.page.width - 108 });
      }
    }

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
    for (const block of policyBlocks) {
      if (!sections.includes(block.key) || !block.body) continue;
      if (!detailed && block.key === "terms_conditions") continue;
      writeHeading(block.label);
      doc.text(block.body, { width: doc.page.width - 108 });
    }

    if (settings.footerNote) {
      doc.moveDown(1.2);
      doc.fontSize(8.5).fillColor(LIGHT).text(settings.footerNote, {
        width: doc.page.width - 108,
        align: "center",
      });
    }

    doc.end();
  });
}
