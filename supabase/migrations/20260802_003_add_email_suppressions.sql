-- Bounce/complaint visibility (audit #20 follow-up, launch-critical per
-- Bible Addendum 2 — email is the hero channel for MVP). Tracks suppressed
-- addresses so a stale/bad email doesn't silently keep failing forever, and
-- so Resend's account-health thresholds (bounce <4%, complaint <0.08%)
-- don't get breached by repeatedly emailing addresses that will never
-- deliver.
CREATE TABLE IF NOT EXISTS email_suppressions (
  email text PRIMARY KEY,
  reason text NOT NULL, -- 'hard_bounce' | 'soft_bounce_limit' | 'complaint'
  bounce_count int NOT NULL DEFAULT 1,
  suppressed boolean NOT NULL DEFAULT false,
  last_event_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_suppressions_suppressed
  ON email_suppressions (email) WHERE suppressed = true;
