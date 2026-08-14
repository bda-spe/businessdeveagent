import LegalPageLayout from "@/components/legal-page-layout";

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="August 13, 2026">
      <section>
        <h2>1. About the Service</h2>
        <p>
          Business Development Agent (&quot;BDA,&quot; &quot;we,&quot; &quot;us,&quot; &quot;our&quot;)
          provides a platform that lets service businesses configure an AI-powered agent to qualify
          leads and generate estimates through an embeddable website widget (the &quot;Service&quot;).
          These Terms govern your use of the Service. By creating an account, you agree to these Terms
          and our{" "}
          <a className="underline" href="/privacy">
            Privacy Policy
          </a>
          .
        </p>
      </section>

      <section>
        <h2>2. Eligibility</h2>
        <p>
          You must be at least 18 years old and able to form a binding contract to use the Service. By
          signing up, you represent that you meet these requirements and that the information you
          provide is accurate.
        </p>
      </section>

      <section>
        <h2>3. Your account</h2>
        <p>
          You&apos;re responsible for maintaining the confidentiality of your password and for all
          activity under your account. Notify us immediately if you suspect unauthorized access.
        </p>
      </section>

      <section>
        <h2>4. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose or to violate any applicable law</li>
          <li>Upload content you don&apos;t have the rights to, or that infringes someone else&apos;s intellectual property</li>
          <li>Interfere with, disrupt, or attempt to gain unauthorized access to the Service, its infrastructure, or other users&apos; accounts or data</li>
          <li>Use the Service to send spam or malware, or attempt to prompt-inject or otherwise manipulate the underlying AI systems to behave outside their intended purpose</li>
          <li>Misrepresent your identity or business, or impersonate any person or entity</li>
          <li>Resell or white-label the Service without our written permission</li>
        </ul>
      </section>

      <section>
        <h2>5. Your content</h2>
        <p>
          You retain ownership of the business information, branding, and content you upload to the
          Service (&quot;Customer Content&quot;). You grant us a limited license to host, process, and
          display your Customer Content solely as needed to operate the Service on your behalf (e.g.,
          displaying your logo on estimates, using your pricing rules to generate quotes). We claim no
          ownership over your Customer Content.
        </p>
      </section>

      <section>
        <h2>6. Free trial, subscriptions &amp; payment</h2>
        <p>
          New accounts include a 30-day free trial with full access to the Service. If you don&apos;t
          subscribe to a paid plan before the trial ends, your account and business settings remain
          accessible, but your customer-facing widget is disabled until you activate a plan — no data
          is lost.
        </p>
        <p>
          Paid plans are billed on a recurring basis (monthly or annual, as selected at checkout)
          through our payment processor, Stripe. Pricing is shown at checkout before you&apos;re
          charged. Your subscription automatically renews at the end of each billing period unless
          canceled beforehand; we&apos;ll email you a reminder before your trial converts or your
          subscription renews.
        </p>
        <p>
          Refunds, if any, are handled on a case-by-case basis — contact us at{" "}
          <a className="underline" href="mailto:support@businessdevelopmentagent.com">
            support@businessdevelopmentagent.com
          </a>
          .
        </p>
      </section>

      <section>
        <h2>7. Cancellation</h2>
        <p>
          You can cancel your subscription at any time, self-serve, from Billing → Cancel Subscription
          — no phone call or support request required. Cancellation takes effect at the end of your
          current billing period; you&apos;ll keep access to your paid features until then, after which
          your widget is disabled while your account and data remain intact. You&apos;ll receive an
          email and on-screen confirmation when you cancel.
        </p>
      </section>

      <section>
        <h2>8. Account &amp; data deletion</h2>
        <p>
          You can permanently delete your account and all associated data at any time from Account
          Settings. Deletion is immediate, irreversible, and removes your account, business profile,
          leads, uploaded files, and any related data from our systems. We cannot recover deleted
          accounts or data once this action is taken.
        </p>
      </section>

      <section>
        <h2>9. AI features &amp; disclaimer</h2>
        <p>
          The Service uses AI (via OpenAI) to generate conversational responses and price estimates. AI
          generated estimates are a starting point, not a final quote — you&apos;re responsible for
          reviewing and confirming pricing, scope, and accuracy before treating it as binding with your
          customers. AI outputs may occasionally be inaccurate or incomplete and should not be relied
          upon without your review, and must never be treated as medical, legal, or financial advice.
        </p>
      </section>

      <section>
        <h2>10. Disclaimer of warranties</h2>
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available,&quot; without warranties of
          any kind, express or implied, including merchantability, fitness for a particular purpose,
          and non-infringement. We don&apos;t guarantee the Service will be uninterrupted, error-free,
          or that AI-generated content will always be accurate.
        </p>
      </section>

      <section>
        <h2>11. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, we are not liable for any indirect, incidental,
          special, consequential, or punitive damages, or any loss of profits, revenue, data, or
          business opportunities, arising from your use of the Service. Our total liability for any
          claim relating to the Service is limited to the amount you paid us in the 12 months preceding
          the claim.
        </p>
      </section>

      <section>
        <h2>12. Termination</h2>
        <p>
          We may suspend or terminate your account if you violate these Terms, engage in abusive or
          unlawful use, or if required by law. You may terminate your account at any time as described
          in Section 8. Sections that by their nature should survive termination (e.g., limitation of
          liability, disclaimers) will survive.
        </p>
      </section>

      <section>
        <h2>13. Governing law</h2>
        <p>
          These Terms are governed by the laws of the state in which we operate, without regard to
          conflict-of-law principles. Any disputes will be resolved in the applicable courts of that
          jurisdiction.
        </p>
      </section>

      <section>
        <h2>14. Changes to these terms</h2>
        <p>
          We may update these Terms from time to time. Material changes will be communicated by email
          or an in-app notice. Continuing to use the Service after changes take effect constitutes
          acceptance of the updated Terms.
        </p>
      </section>

      <section>
        <h2>15. Contact us</h2>
        <p>
          Questions about these Terms? Email{" "}
          <a className="underline" href="mailto:support@businessdevelopmentagent.com">
            support@businessdevelopmentagent.com
          </a>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
