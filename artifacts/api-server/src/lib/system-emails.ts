import nodemailer from "nodemailer";
import { logger } from "./logger";

function appBaseUrl(): string {
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) return `https://${domain}/bda`;
  return process.env.APP_BASE_URL ?? "https://yourdomain.com";
}

function isEmailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

async function sendHtmlEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(
      `[email] Gmail not configured; would have sent "${opts.subject}" to ${opts.to}`,
    );
    return;
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
      from: `"Business Development Agent" <${process.env.GMAIL_USER}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    console.log(`[email] Sent "${opts.subject}" to ${opts.to}`);
  } catch (err) {
    logger.error({ err }, `Failed to send system email "${opts.subject}" to ${opts.to}`);
  }
}

const NAVY = "#1e3a5f";
const LIGHT_NAVY = "#2d5087";

function emailWrapper(heading: string, body: string, cta?: { label: string; url: string }): string {
  const base = appBaseUrl();
  const billingUrl = `${base}/billing`;
  const supportEmail = process.env.GMAIL_USER ?? "support@yourdomain.com";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:600px;margin:0 auto;">

          <!-- Header -->
          <tr>
            <td style="background:${NAVY};border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <p style="margin:0;color:#93c5fd;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Business Development Agent</p>
              <h1 style="margin:12px 0 0;color:#ffffff;font-size:24px;font-weight:700;line-height:1.3;">${heading}</h1>
            </td>
          </tr>

          <!-- Body card -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              ${body}
              ${cta ? `
              <div style="text-align:center;margin-top:32px;">
                <a href="${cta.url}" style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;">${cta.label}</a>
              </div>` : ""}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;">Business Development Agent &mdash; Powered by BDA</p>
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                <a href="${billingUrl}" style="color:${LIGHT_NAVY};text-decoration:none;">Manage Billing</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:${supportEmail}" style="color:${LIGHT_NAVY};text-decoration:none;">Contact Support</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${text}</p>`;
}

function formatDate(isoOrDbString: string | null | undefined): string {
  if (!isoOrDbString) return "—";
  const iso = isoOrDbString.includes("T")
    ? isoOrDbString
    : isoOrDbString.replace(" ", "T");
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
  const d = new Date(hasZone ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return isoOrDbString;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export async function sendWelcomeEmail(opts: {
  to: string;
  ownerName: string;
  businessName: string;
  trialEndsAt: string | null | undefined;
}): Promise<void> {
  const base = appBaseUrl();
  const trialDate = formatDate(opts.trialEndsAt);
  const body =
    p(`Hi ${opts.ownerName},`) +
    p(`Welcome to <strong>Business Development Agent</strong>! Your account for <strong>${opts.businessName}</strong> is active and your free trial runs until <strong>${trialDate}</strong>.`) +
    p("During your trial, you have full access to build your business profile, configure your quoting agent, and deploy your website widget. Your leads, settings, and widget are all preserved when you subscribe.") +
    p("Use the button below to continue your setup &mdash; it only takes a few minutes.");

  await sendHtmlEmail({
    to: opts.to,
    subject: "Welcome to Business Development Agent",
    html: emailWrapper("Welcome to BDA", body, {
      label: "Continue Setup →",
      url: `${base}/business`,
    }),
  });
}

export async function sendSubscriptionActivatedEmail(opts: {
  to: string;
  ownerName: string;
  businessName: string;
  planName: string;
}): Promise<void> {
  const base = appBaseUrl();
  const body =
    p(`Hi ${opts.ownerName},`) +
    p(`Great news &mdash; your <strong>${opts.planName}</strong> subscription for <strong>${opts.businessName}</strong> is now active.`) +
    p("Your Business Development Agent is live. Leads collected through your website widget will appear in your inbox, and your agent will continue qualifying and estimating on your behalf.") +
    p("Head to your dashboard to see your activity and review incoming leads.");

  await sendHtmlEmail({
    to: opts.to,
    subject: "Subscription Activated — Your BDA is Live",
    html: emailWrapper("Subscription Activated", body, {
      label: "Go to Dashboard →",
      url: `${base}/dashboard`,
    }),
  });
}

export async function sendSubscriptionCanceledEmail(opts: {
  to: string;
  ownerName: string;
  businessName: string;
}): Promise<void> {
  const base = appBaseUrl();
  const body =
    p(`Hi ${opts.ownerName},`) +
    p(`We've confirmed the cancellation of your <strong>Business Development Agent</strong> subscription for <strong>${opts.businessName}</strong>.`) +
    p("Your Business Development Agent is now inactive and the website widget has been disabled. <strong>All of your data has been preserved</strong> &mdash; your business profile, services, pricing, estimate templates, agent preferences, and widget configuration are all saved.") +
    p("If you'd like to reactivate at any time, simply visit your billing page and select a plan. Your widget will be restored instantly using your existing embed code.");

  await sendHtmlEmail({
    to: opts.to,
    subject: "Subscription Cancelled — Your Data Is Preserved",
    html: emailWrapper("Subscription Cancelled", body, {
      label: "Reactivate Subscription →",
      url: `${base}/billing`,
    }),
  });
}

export async function sendSubscriptionReactivatedEmail(opts: {
  to: string;
  ownerName: string;
  businessName: string;
  planName: string;
}): Promise<void> {
  const base = appBaseUrl();
  const body =
    p(`Hi ${opts.ownerName},`) +
    p(`Welcome back! Your <strong>${opts.planName}</strong> subscription for <strong>${opts.businessName}</strong> has been reactivated.`) +
    p("Your Business Development Agent is live again and your website widget is active. All of your previous settings, leads, and configurations are exactly as you left them.") +
    p("Head to your dashboard to pick up where you left off.");

  await sendHtmlEmail({
    to: opts.to,
    subject: "Welcome Back — Your BDA is Active Again",
    html: emailWrapper("Welcome Back", body, {
      label: "Go to Dashboard →",
      url: `${base}/dashboard`,
    }),
  });
}

export async function sendPaymentFailedEmail(opts: {
  to: string;
  ownerName: string;
  businessName: string;
}): Promise<void> {
  const base = appBaseUrl();
  const body =
    p(`Hi ${opts.ownerName},`) +
    p(`We weren't able to process your recent payment for <strong>Business Development Agent</strong> (${opts.businessName}).`) +
    p("To avoid any interruption to your service, please update your payment method as soon as possible. Your Business Development Agent will remain accessible during any grace period provided by your billing cycle.") +
    p("Click below to visit your billing page and update your payment information.");

  await sendHtmlEmail({
    to: opts.to,
    subject: "Action Required: Update Your Payment Method",
    html: emailWrapper("Payment Could Not Be Processed", body, {
      label: "Update Payment Method →",
      url: `${base}/billing`,
    }),
  });
}

export async function sendTrialEndingEmail(opts: {
  to: string;
  ownerName: string;
  businessName: string;
  trialEndsAt: string | null | undefined;
}): Promise<void> {
  const base = appBaseUrl();
  const trialDate = formatDate(opts.trialEndsAt);
  const body =
    p(`Hi ${opts.ownerName},`) +
    p(`Your free trial for <strong>${opts.businessName}</strong> ends tomorrow on <strong>${trialDate}</strong>.`) +
    p("After your trial ends, your <strong>Business Development Agent will become inactive</strong> until a subscription is selected. Your business setup and agent configuration are fully preserved &mdash; you won't lose any data or settings.") +
    p("Select a plan now to keep your agent running without any interruption.");

  await sendHtmlEmail({
    to: opts.to,
    subject: "Your Free Trial Ends Tomorrow",
    html: emailWrapper("Your Free Trial Ends Tomorrow", body, {
      label: "Select a Plan →",
      url: `${base}/billing`,
    }),
  });
}
