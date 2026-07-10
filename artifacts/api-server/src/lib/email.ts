import nodemailer from "nodemailer";
import { logger } from "./logger";
import {
  PRELIMINARY_ESTIMATE_DISCLAIMER,
  SHORT_POLICY_AGREEMENT_LINE,
} from "./defaults";
import type { Estimate } from "./aiService";

export function isEmailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export function replacePlaceholders(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}

export function composeEstimateEmail(opts: {
  businessName: string;
  customerName: string;
  estimate: Estimate;
  serviceAddress?: string | null;
  emailSubject?: string | null;
  emailGreeting?: string | null;
  emailBodyText?: string | null;
  emailClosing?: string | null;
  showPolicies?: boolean;
  cancellationPolicy?: string | null;
  paymentTerms?: string | null;
  termsConditions?: string | null;
  estimateDisclaimer?: string | null;
  acceptanceLanguage?: string | null;
}): { subject: string; body: string } {
  const {
    businessName,
    customerName,
    estimate,
    serviceAddress,
    emailSubject,
    emailGreeting,
    emailBodyText,
    emailClosing,
    showPolicies,
    cancellationPolicy,
    paymentTerms,
    termsConditions,
    estimateDisclaimer,
    acceptanceLanguage,
  } = opts;
  const vars = {
    business_name: businessName,
    customer_name: customerName,
  };
  const subject = replacePlaceholders(
    emailSubject || "Your estimate from {business_name}",
    vars,
  );
  // Every quote email always includes the full set of line items and taxes.
  const items = estimate.invoiceLineItems;
  const subtotal = items.reduce((s, li) => s + li.total, 0);
  const taxes = estimate.taxes;
  const total = subtotal + taxes;
  const lines = [
    replacePlaceholders(emailGreeting || "Hi {customer_name},", vars),
    "",
    replacePlaceholders(emailBodyText || "", vars),
    "",
  ];
  if (serviceAddress) {
    lines.push(`Service address: ${serviceAddress}`, "");
  }
  lines.push(
    "Estimate summary:",
    ...items.map((li) => `- ${li.description}: $${li.total.toFixed(2)}`),
  );
  if (taxes > 0) lines.push(`- Taxes & fees: $${taxes.toFixed(2)}`);
  lines.push(`Estimated total: $${total.toFixed(2)}`);
  if (
    estimate.recommendedPriceLow != null &&
    estimate.recommendedPriceHigh != null
  ) {
    lines.push(
      `Expected range: $${estimate.recommendedPriceLow.toFixed(2)} - $${estimate.recommendedPriceHigh.toFixed(2)}`,
    );
  }
  lines.push("", PRELIMINARY_ESTIMATE_DISCLAIMER);
  // The five policy/legal text blocks are shown or hidden together via the
  // single "Show policies on estimate" toggle; when off, still surface a
  // short one-line agreement statement.
  if (showPolicies) {
    const policyBlocks: { label: string; body?: string | null }[] = [
      { label: "Payment Terms", body: paymentTerms },
      { label: "Cancellation Policy", body: cancellationPolicy },
      { label: "Terms and Conditions", body: termsConditions },
      { label: "Estimate Disclaimer", body: estimateDisclaimer },
      { label: "Customer Acceptance", body: acceptanceLanguage },
    ];
    for (const block of policyBlocks) {
      if (!block.body) continue;
      lines.push("", `${block.label}:`, block.body);
    }
  } else {
    lines.push("", SHORT_POLICY_AGREEMENT_LINE);
  }
  lines.push(
    "",
    replacePlaceholders(
      emailClosing || `Best regards,\n{business_name}`,
      vars,
    ),
  );
  return { subject, body: lines.join("\n") };
}

export async function sendEstimateEmail(opts: {
  to: string;
  cc?: string | null;
  replyTo?: string | null;
  subject: string;
  text: string;
  attachment?: { filename: string; content: Buffer } | null;
}): Promise<{ sent: boolean; message: string }> {
  if (!isEmailConfigured()) {
    return {
      sent: false,
      message:
        "Email sending is disabled until Gmail settings are added. Add GMAIL_USER and GMAIL_APP_PASSWORD to enable test emails.",
    };
  }
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: opts.to,
      cc: opts.cc ?? undefined,
      replyTo: opts.replyTo ?? undefined,
      subject: opts.subject,
      text: opts.text,
      attachments: opts.attachment
        ? [{ filename: opts.attachment.filename, content: opts.attachment.content }]
        : undefined,
    });
    return { sent: true, message: `Test email sent to ${opts.to}.` };
  } catch (err) {
    logger.error({ err }, "Failed to send estimate email");
    return {
      sent: false,
      message: "Email sending failed. Check the Gmail credentials and try again.",
    };
  }
}
