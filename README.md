# Say-So

> **SaySo**: AI-powered personal reply assistant and unreplied-message manager for WhatsApp Web.  
> Built for the **DEV / Hacktoberfest Week 3 Open-Source AI Challenge**.

---

## 🌟 Overview

**SaySo** helps you manage neglected conversations and draft personalized replies in your own voice. Rather than generating generic, robotic responses, SaySo combines:

1. **General Writing Style**: Your typical vocabulary, sentence length, slang/Pidgin usage, punctuation habits, and emoji conventions.
2. **Contact-Specific Dynamics**: Tailored formality levels, honorifics, custom greetings, and relationship-specific tone.
3. **Current Conversational Situation**: The immediate context of the chat (apologizing, making plans, joking, clarifying).

### Core Features
- **Three-Card Suggestion Contract**: Every generation returns exactly three validated alternatives (e.g., *brief*, *warm*, *direct*).
- **Interactive Draft Editor**: Select a suggestion, refine the draft, and confirm/copy or insert directly into WhatsApp Web.
- **Deterministic Personalization Engine**: Learns selectively and safely from confirmed draft edits, updating structured style signals without creating artificial feedback loops.
- **Unreplied-Message Management**: Metadata-first heuristic detection of conversations awaiting replies, with persistent 1-click dismissal synced via MongoDB Atlas.
- **Privacy & User Control**: **Zero auto-sending**. Messages are only sent by the user. Background detection never transmits conversation transcripts.

---

## 🏆 Hackathon Category Alignments

| Category | Implementation |
|---|---|
| **Best Use of Gemma** | Hosted open-weight Gemma inference (via OpenRouter) strictly producing validated 3-option structured drafts grounded in user profile and conversation context. |
| **Best Use of MongoDB Atlas** | Persistent storage for user style profiles, contact profiles, global preferences, reply candidate states, and idempotent learning events. |
| **Best Use of Render** | Production deployment of the Express backend API coordinating requests, context assembly, and Gemma inference. |
| **Sentry Agent Tracing** | Span-level pipeline observability (request validation -> context prep -> profile retrieval -> Gemma inference -> contract validation) with strict PII redaction. |

---

## 🏗️ Architecture & Tech Stack

```text
Say-So/
├── extension/          # Chrome Extension (Manifest V3)
│   ├── background/     # Service worker
│   ├── content/        # WhatsApp Web DOM observer & candidate detector
│   ├── sidepanel/      # Primary React + Tailwind UI
│   └── components/     # ReplyCard, DraftEditor, CandidateList, ContactProfile
├── server/             # Express API (Node.js & TypeScript)
│   ├── db/             # MongoDB Atlas connection & Mongoose schemas
│   ├── middleware/     # Supabase Auth JWT verification & error handling
│   ├── routes/         # /v1/health, /v1/contacts, /v1/preferences, /v1/inbox
│   └── services/       # Profile, Preference, Candidate, Gemma services
└── packages/shared/    # Shared TypeScript types & Zod validation contracts
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20+` (tested on `v24`)
- **pnpm**: `v10+`

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/RebeccaAyodele/Say-So.git
cd Say-So

# 2. Install dependencies
pnpm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your MongoDB Atlas URI, Supabase Auth keys, and OpenRouter API key

# 4. Build shared types
pnpm --filter @sayso/shared build

# 5. Start development server
pnpm dev:server
```

---

## 🔒 Privacy & Safety
- **No Background Data Upload**: Candidate detection runs locally on WhatsApp Web metadata and never sends message text to the server.
- **Explicit Triggers**: Conversation context is only sent when you explicitly click "Generate Replies".
- **Telemetry Redaction**: Sentry traces and server logs strictly exclude message bodies, drafts, and sensitive user data.

---

## 📄 License
This project is open-source software licensed under the [Apache-2.0 License](LICENSE).
