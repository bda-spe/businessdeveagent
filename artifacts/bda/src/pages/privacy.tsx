import LegalPageLayout from "@/components/legal-page-layout";

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="August 13, 2026">
      <section>
        <h2>1. Who we are</h2>
        <p>
          Business Development Agent (&quot;BDA,&quot; &quot;we,&quot; &quot;us&quot;) is operated by Sean
          Pelillo Enterprises. This Privacy Policy explains what information we collect through our
          website and dashboard and our embeddable customer widget (together, the &quot;Service&quot;),
          why we collect it, and how you can control it.
        </p>
      </section>

      <section>
        <h2>2. Information we collect</h2>
        <ul>
          <li>
            <strong>Account information:</strong> your name, email address, and password when you
            create an account. Passwords are stored as a salted hash — we never store or can see your
            plaintext password.
          </li>
          <li>
            <strong>Business profile data:</strong> your business name, industry, service area, services,
            pricing rules, uploaded logo, and other operational details you provide to configure your
            AI agent.
          </li>
          <li>
            <strong>Customer/lead data:</strong> when a visitor interacts with your embedded widget, we
            collect what they submit — project descriptions, answers to qualifying questions, contact
            details, and the resulting estimate — so it can be delivered to you and stored in your
            dashboard.
          </li>
          <li>
            <strong>Payment metadata:</strong> if you subscribe to a paid plan, our payment processor,
            Stripe, collects and stores your card details directly. We receive and store only
            non-sensitive billing metadata (subscription status, plan, renewal dates) — we never see or
            store your full card number.
          </li>
          <li>
            <strong>Usage data:</strong> standard server logs (request method, path, timestamp, IP
            address) used for security and debugging.
          </li>
          <li>
            <strong>Cookies:</strong> a single strictly-necessary session cookie that keeps you signed
            in. We do not use advertising, tracking, or analytics cookies.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Why we collect it and how we use it</h2>
        <ul>
          <li>To provide and operate your account and AI agent</li>
          <li>To generate estimates and route leads from your widget to you</li>
          <li>To process payments and manage your subscription</li>
          <li>
            To send transactional emails (password resets, trial-ending reminders, lead notifications)
          </li>
          <li>To secure the Service (rate limiting, abuse prevention, debugging)</li>
        </ul>
      </section>

      <section>
        <h2>4. AI usage disclosure</h2>
        <p>
          We use AI/large language models provided by <strong>OpenAI</strong> to power core features of
          the Service, including generating clarifying questions and price estimates in the
          customer-facing widget, drafting AI agent operating standards from your feedback, and other
          AI-assisted business-configuration tools inside your dashboard. Information submitted to
          these features — by you or by your website visitors — is processed by OpenAI according to
          OpenAI&apos;s own data handling and API terms. We do not use your data, or your customers&apos;
          data, to train AI models outside of powering your own agent.
        </p>
      </section>

      <section>
        <h2>5. Third parties we share data with</h2>
        <p>We share data only as necessary to operate the Service, with the following processors:</p>
        <ul>
          <li><strong>OpenAI</strong> — processes conversation and business data to power AI features.</li>
          <li><strong>Stripe</strong> — processes payments and stores your payment method.</li>
          <li><strong>Supabase</strong> — provides our database and file storage infrastructure.</li>
          <li><strong>Render</strong> — hosts our backend API.</li>
          <li><strong>GitHub Pages</strong> — hosts our frontend.</li>
          <li><strong>Google (Gmail SMTP)</strong> — delivers transactional emails on our behalf.</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </section>

      <section>
        <h2>6. Data retention &amp; deletion</h2>
        <p>
          We retain your account and business data for as long as your account is active. If you
          delete your account (Account Settings → Delete Account), we permanently delete your account,
          business profile, leads, uploaded files, and all associated data from our database and
          storage. This action is immediate and cannot be undone — we do not retain a recoverable copy.
        </p>
      </section>

      <section>
        <h2>7. Cookies &amp; tracking</h2>
        <p>
          We use one strictly-necessary session cookie to keep you signed in. It is not used for
          tracking or advertising. Because we don&apos;t use non-essential cookies or third-party
          trackers, we don&apos;t display a cookie consent banner.
        </p>
      </section>

      <section>
        <h2>8. Your rights</h2>
        <p>
          You can access, update, export, or delete your data at any time from Account Settings, or by
          emailing <a className="underline" href="mailto:support@businessdevelopmentagent.com">support@businessdevelopmentagent.com</a>.
          This includes the right to request a copy of your data, correct inaccurate data, and
          permanently delete your account and all associated data as described above.
        </p>
      </section>

      <section>
        <h2>9. Children&apos;s privacy</h2>
        <p>
          The Service is intended for business owners and is not directed to, and should not be used
          by, anyone under 18. We do not knowingly collect personal information from children.
        </p>
      </section>

      <section>
        <h2>10. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. If we make material changes, we&apos;ll
          notify you by email or with a notice in the app. The &quot;Last updated&quot; date above
          reflects the most recent revision.
        </p>
      </section>

      <section>
        <h2>11. Contact us</h2>
        <p>
          Questions about this policy or your data? Email{" "}
          <a className="underline" href="mailto:support@businessdevelopmentagent.com">
            support@businessdevelopmentagent.com
          </a>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
