import nodemailer from "nodemailer";
import { logger } from "./logger";
import { filterLineItems } from "./pdf";
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
  includedSections: string[];
  emailSubject?: string | null;
  emailGreeting?: string | null;
  emailBodyText?: string | null;
  emailClosing?: string | null;
}): { subject: string; body: string } {
  const {
    businessName,
    customerName,
    estimate,
    includedSections,
    emailSubject,
    emailGreeting,
    emailBodyText,
    emailClosing,
  } = opts;
  const vars = {
    business_name: businessName,
    customer_name: customerName,
  };
  const subject = replacePlaceholders(
    emailSubject || "Your estimate from {business_name}",
    vars,
  );
  const items = filterLineItems(estimate.invoiceLineItems, includedSections);
  const subtotal = items.reduce((s, li) => s + li.total, 0);
  const taxes = includedSections.includes("taxes_fees") ? estimate.taxes : 0;
  const total = subtotal + taxes;
  const lines = [
    replacePlaceholders(emailGreeting || "Hi {customer_name},", vars),
    "",
    replacePlaceholders(emailBodyText || "", vars),
    "",
    "Quote summary:",
    ...items.map((li) => `- ${li.description}: $${li.total.toFixed(2)}`),
  ];
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
