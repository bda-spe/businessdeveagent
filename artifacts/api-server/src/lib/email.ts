import nodemailer from "nodemailer";
import { logger } from "./logger";

export function isEmailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export function replacePlaceholders(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
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
