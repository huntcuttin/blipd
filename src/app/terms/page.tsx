export default function TermsPage() {
  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">Terms of Service</h1>
      <div className="space-y-4 text-[#999999] text-sm leading-relaxed">
        <p>Last updated: March 2026</p>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Service</h2>
          <p>
            Blippd is a Nintendo eShop price tracking and alert service. We monitor
            prices and notify you when games you follow go on sale or drop in price.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Accuracy</h2>
          <p>
            We do our best to provide accurate pricing data, but prices are sourced from
            third-party APIs and may occasionally be delayed or incorrect. Always verify
            the final price on the Nintendo eShop before purchasing.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Pricing</h2>
          <p>
            Blippd is free forever. Unlimited game follows, email alerts, push notifications,
            and all features — no paywall, no premium tier.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Not affiliated with Nintendo</h2>
          <p>
            Blippd is not affiliated with, endorsed by, or sponsored by Nintendo.
            Nintendo Switch is a trademark of Nintendo Co., Ltd.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">Contact</h2>
          <p>
            Questions? Email{" "}
            <a href="mailto:alerts@blippd.app" className="text-[#00ff88] hover:underline">
              alerts@blippd.app
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
