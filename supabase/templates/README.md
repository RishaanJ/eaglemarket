# EagleMarket auth email templates

## Confirm signup

In Supabase, open **Authentication → Emails → Templates → Confirm signup**.

- Subject: `Confirm your EagleMarket account`
- Body: paste the complete contents of `confirm-signup.html`

The template intentionally sends users through EagleMarket's `/auth/confirm` route. Keep this URL in **Authentication → URL Configuration → Redirect URLs**:

`https://www.eaglemarket.bet/auth/confirm`

For local testing, also allow:

`http://localhost:3000/auth/confirm`

The `token_hash` link is deliberate: it lets the app verify the email, establish the session, and send the user directly to `/markets` instead of asking them to log in again.

Do not add a user's name or other profile metadata to authentication emails. These values may be user-controlled.
