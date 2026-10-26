# SaySo Privacy Policy

**Effective date: 26 October 2026**

SaySo is a Chrome extension that helps users manage conversations and prepare reply drafts in WhatsApp Web. This policy explains what SaySo reads, sends, and stores when you use it.

## Information SaySo processes

- **WhatsApp chat content:** When a chat is open, SaySo reads message text and uses recent conversation context to prepare reply suggestions or group summaries. Opening a chat with a new incoming message can trigger draft generation automatically. SaySo does not automatically send a reply.
- **Chat-list metadata:** To identify conversations awaiting a reply, SaySo reads visible chat names, message direction and time labels, unread counts, and whether a chat is a group. Candidate metadata, including contact names/references and reply status, is synchronized to SaySo's backend.
- **Account and settings:** Supabase processes account authentication. The extension keeps the access token, refresh token, and basic account details in Chrome local storage. SaySo stores account identifiers, preferences, contact-specific profiles, candidate metadata, and learned style signals in its database.
- **Learning data:** If you edit a suggested draft and confirm it, SaySo may extract and store style signals such as greeting or phrase preferences. SaySo stores the resulting signals, not the original conversation transcript or the complete draft text.
- **Diagnostics:** If Sentry is enabled for the backend, it receives performance spans and error diagnostics. SaySo removes request data, URLs, user identity, breadcrumbs, and exception messages before sending telemetry; only allowlisted span names, timing/status attributes, and error stack/type information are retained.

## How information is used and shared

SaySo uses this information only to authenticate users, identify conversations awaiting a reply, generate drafts, personalize them, maintain preferences, and operate and secure the service.

When generating a draft or summary, recent message context is sent over HTTPS to the SaySo backend and then to OpenRouter for inference with the configured model. OpenRouter may route a request to a model provider. OpenRouter and the selected provider have their own data handling and retention practices; review [OpenRouter's privacy policy](https://openrouter.ai/privacy/) and the applicable provider's terms. SaySo does not control those independent practices.

SaySo also relies on Supabase for authentication, Render for backend hosting, MongoDB for persistent application data, and Sentry for diagnostics when configured. SaySo does not sell personal information or use message content for advertising.

## Storage and retention

SaySo's backend does not persist raw WhatsApp message transcripts or generated reply text in its application database. Account/profile information, preferences, candidate metadata, and learned style signals are stored to provide the service and remain until deleted. Authentication tokens remain in Chrome local storage until sign-out, token refresh/expiry, or removal of the extension. Third-party providers may retain request data under their own policies.

SaySo currently has no in-product control for deleting all account and server-side data. To request deletion, email [rebeccaayodele08@gmail.com](mailto:rebeccaayodele08@gmail.com) from the account email and identify the SaySo account. The developer will verify the request and delete associated SaySo account data, subject to legal or security retention requirements. Signing out only removes the local session; it does not delete server-side data.

## Security and choices

SaySo uses HTTPS for its remote API connections and stores extension session data in Chrome local storage. You can stop using SaySo by signing out or removing the extension. Signing out does not itself remove data already stored by SaySo or its service providers; use the deletion contact above for a deletion request.

## Chrome Web Store User Data Policy

SaySo's use and transfer of information received from Chrome APIs and WhatsApp Web is limited to providing the extension's disclosed user-facing functionality and complies with the Chrome Web Store User Data Policy, including its Limited Use requirements. SaySo does not sell this information, use it for personalized advertising, or allow routine human review of message content.

## Changes and contact

This policy may be updated as SaySo changes. Material changes will be reflected here with a revised effective date. For privacy questions or data requests, contact [rebeccaayodele08@gmail.com](mailto:rebeccaayodele08@gmail.com).
