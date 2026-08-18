# Draft: add the sign-in code to the auth email (needs founder sign-off)

**Status: not applied.** The Bible requires a founder prompt before any session
edits user-facing email copy, and this is the email every single user sees at
signup, on both web and iOS.

## Why it is needed

The iOS app signs in with a code typed into the app rather than a tapped link.
That avoids the failure this project has already documented against itself: the
magic-link round trip has to survive leaving the app, an email client's in-app
browser, and a redirect back, which is exactly where the PKCE verifier gets
lost. Typing a code never leaves the app.

**Verified working 2026-08-17** against the live project with a throwaway
account: Supabase generated an 8-digit code and `verifyOtp` returned a real
session. The app side is built and shipped. The only missing piece is that the
current email template does not print the code, so a user cannot see it.

## Current template (live)

```html
<h2>Magic Link</h2>

<p>Follow this link to login:</p>
<p><a href="{{ .ConfirmationURL }}">Log In</a></p>
```

## Proposed template

Additive: the link keeps working exactly as it does today for web, and the code
is added for the app. No em dashes, per the copy rule.

```html
<h2>Sign in to Blippd</h2>

<p>Your sign in code:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px;">{{ .Token }}</p>
<p>Enter this in the app. The code expires in 1 hour.</p>

<p>Or, on this device, you can just follow this link:</p>
<p><a href="{{ .ConfirmationURL }}">Log In</a></p>
```

## Notes

- `mailer_otp_length` is currently **8**, and the app's `CODE_LENGTH` matches.
  Changing the project setting means changing that constant too.
- Codes expire in 1 hour (`mailer_otp_exp: 3600`), same as the link.
- One template serves web and mobile, which is why this needs a decision rather
  than a mobile-only change.

## To apply

Supabase dashboard: Authentication > Email Templates > Magic Link. Or say the
word and I will apply it via the Management API.
