# Contributing to SaySo

Thank you for your interest in contributing to **SaySo**! We welcome contributions from the community to help make messaging smoother, more personalized, and privacy-conscious.

---

## Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone. Please be respectful, constructive, and empathetic in all interactions across issues, pull requests, and discussions.

---

## Development Setup

### Prerequisites
- **Node.js**: `v20.x` or higher
- **pnpm**: `v9.x` or higher
- **Chrome / Chromium Browser**: For loading the Manifest V3 extension
- **MongoDB Atlas** account (or local MongoDB)
- **Supabase** project for Auth
- **OpenRouter API Key** for Gemma open-weight inference

### Monorepo Structure

```text
Say-So/
├── packages/shared/     # Shared TypeScript models, contracts & Zod validation schemas
├── server/              # Express backend API & services
└── extension/           # Chrome Manifest V3 extension (React + Tailwind + Vite)
```

### Initial Installation

```bash
# Clone the repository
git clone https://github.com/RebeccaAyodele/Say-So.git
cd Say-So

# Install all workspace dependencies
pnpm install

# Copy and configure environment variables
cp .env.example .env

# Build shared types package (must be built first)
pnpm --filter @sayso/shared build
```

---

## Running Locally

### 1. Start Backend API
```bash
pnpm dev:server
# Server starts on http://localhost:3000
# Health check available at http://localhost:3000/v1/health
```

### 2. Build the Extension
```bash
pnpm dev:extension
# Or produce a production bundle:
pnpm build
```

### 3. Load Extension in Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in top right).
3. Click **Load unpacked**.
4. Select the `extension/dist` folder from your repository.
5. Open [WhatsApp Web](https://web.whatsapp.com) and click the SaySo action icon to open the side panel.

---

## Testing & Quality Assurance

Before submitting a Pull Request, please ensure all checks pass:

```bash
# Run all unit, integration, and E2E tests
pnpm test

# Type-check all packages
pnpm typecheck

# Build all packages
pnpm build
```

---

## Pull Request Guidelines

1. **Branch Naming**: Use descriptive prefixes:
   - `feat/add-new-style-trait`
   - `fix/whatsapp-dom-selector`
   - `docs/update-readme`
2. **Commit Messages**: Write clear, imperative commit messages (e.g. `feat(learning): add emoji density extraction`).
3. **Privacy Integrity**:
   - Never transmit raw WhatsApp conversation bodies in background tasks.
   - Ensure all Sentry spans redact PII (zero message bodies, names, or phone numbers in telemetry).
   - Ensure all queries remain strictly user-scoped with Supabase JWT tenancy.
4. **Documentation**: Update relevant markdown files in `.docs/` or `README.md` if your PR modifies configuration, endpoints, or contracts.

---

## License

By contributing to SaySo, you agree that your contributions will be licensed under the [Apache-2.0 License](LICENSE).
