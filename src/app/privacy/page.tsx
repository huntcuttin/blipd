export default function PrivacyPage() {
  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">Privacy Policy</h1>
      <div className="space-y-4 text-[#999999] text-sm leading-relaxed">
        <p>Last updated: March 2026</p>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">What we collect</h2>
          <p>
            Blippd collects your email address when you sign in via magic link. We use
            this to send you price alerts and notifications for games you follow.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">How we use your data</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Send price drop and release alerts for games you follow</li>
            <li>Remember your followed games and notification preferences</li>
            <li>Improve the service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">What we don&apos;t do</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>We don&apos;t sell your data to third parties</li>
            <li>We don&apos;t track you across the web</li>
            <li>We don&apos;t show targeted ads</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Data storage</h2>
          <p>
            Your data is stored securely on Supabase (hosted on AWS). Email delivery is
            handled by Resend.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Contact</h2>
          <p>
            Questions about your data? Email us at{" "}
            <a href="mailto:alerts@blippd.app" className="text-[#00ff88] hover:underline">
              alerts@blippd.app
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
