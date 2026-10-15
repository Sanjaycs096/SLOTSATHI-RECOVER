# SlotSathi Recover 📚⚡

> **Mobile-First Appointment Recovery Platform for Independent Tutors & Small Tutoring Businesses**  
> *Production-Ready Hackathon MVP | Next.js App Router • TypeScript • Tailwind CSS • shadcn/ui • Google Material Symbols • Supabase/PostgreSQL • Playwright E2E • WhatsApp Deep Links*

---

## 🎯 Product Objective & Vision

When a student cancels an individual tutoring session, tutors face an immediate loss of potential booking value (typically **₹800 – ₹2,500 INR** per hour). Manually texting multiple students to refill the slot is frantic, awkward, and often futile on short notice.

**SlotSathi Recover** solves this with a purpose-built recovery platform:
1. **Deterministic, Explainable Matching Engine**: Immediately evaluates waitlisted candidates based on hard filters (subject, duration, availability) and explainable soft ranking points (Service Match +30, Duration Fit +20, Time Window +20, Day +15, Waitlist Tenure +10, Urgency +5).
2. **Tutor-Reviewed WhatsApp Deep Links**: Generates pre-filled, one-click WhatsApp messages (`wa.me`) with cryptographically secure, server-expiring offer links—requiring **zero paid WhatsApp Business API fees** or recurring template approval fees.
3. **Atomic Replacement Creation**: Enforces transaction safety, preventing phantom bookings or duplicate claims. Original cancelled appointments are strictly preserved in the database for historical audit, while replacements are inserted as distinct records (`is_replacement = true`, `recovered_from_appointment_id = ...`).
4. **Accurate Financial Metrics in INR**: Real-time dashboard showing recovery rate (%), recovered tutoring revenue in INR, and average time-to-refill derived dynamically from persisted records.

---

## 🛡️ Security & Privacy Engineering

- **No Student PII Leakage**: Public offer endpoints (`/api/offers/[token]`) use strict DTO allowlists returning only necessary tutor and session details. Original customer names, emails, phones, and cancellation reasons are never exposed to replacement students.
- **Provider Authorization Guard**: Private provider endpoints (`/api/dashboard`, `/api/offers/generate`, `/api/seed/reset`) require authenticated provider credentials and enforce IDOR protection.
- **Cryptographically Secure Tokens**: Cancellation and offer links use crypto-secure tokens (`crypto.randomBytes`) with server-side validation and expiration timestamps.
- **Server-Side Rate Limiting**: Public endpoints (`/api/bookings`, `/api/waitlist`, `/api/cancellations/[token]`, `/api/offers/[token]/accept`) are protected against brute-force and scraping using token-bucket rate limiters.
- **Input Validation & Sanitization**: Strict email, WhatsApp phone, timestamp, and string length validation guards on all incoming payloads.

---

## 🗄️ Database Integrity & Transaction Safety

The PostgreSQL schema (`supabase/schema.sql`) enforces critical invariants at the database level:
- **GiST Exclusion Constraint (`btree_gist`)**: Enforces `EXCLUDE USING gist (provider_id WITH =, tstzrange(start_time, end_time) WITH &&) WHERE (status = 'confirmed')`, preventing overlapping active appointments at the storage layer.
- **Partial Unique Replacement Index**: Enforces `UNIQUE (recovered_from_appointment_id) WHERE (status = 'confirmed')`, ensuring exactly one replacement appointment can ever be created from a single cancellation.
- **Atomic Stored Procedure (`accept_recovery_offer_atomic`)**: Runs all 9 acceptance steps in a single atomic database transaction with strict row locking (`FOR UPDATE`).
- **Row Level Security (RLS)**: Enforces least-privilege access across all tables (`providers`, `services`, `appointments`, `waitlist_entries`, `recovery_offers`).

---

## 🎨 Locked UI Component System

- **Primary UI System**: **shadcn/ui** primitives located in `src/components/ui/` (`Button`, `Card`, `Badge`, `Alert`, `Input`, `Label`, `Table`).
- **Icons**: **Google Material Symbols exclusively** (`material-symbols-outlined`), loaded via Google Fonts with zero prohibited third-party icon libraries (`lucide-react` removed).
- **Responsive Aesthetics**: Tailored dark glassmorphism theme (`#090D16`), fluid typography, and distinct badges distinguishing illustrative seed records from live user outcomes.

---

## 🧪 Testing Suites

### 1. Real Playwright Browser & Security End-to-End Suite
Automated end-to-end browser and security tests in `tests/recovery.spec.ts` execute real user journeys and attack vectors using Chromium:
- **Flow 1**: Public tutor booking page loads and displays verified profile, services, and slots.
- **Flow 2**: Student can book an available future session and receive a secure cancellation link.
- **Flow 3**: Conflicting overlapping booking is rejected with HTTP 409.
- **Flow 4**: Student cancels a booking; original record is strictly preserved as cancelled.
- **Flow 5**: Public offer page loads and NEVER leaks original student PII.
- **Flow 6**: Offer acceptance creates exactly one replacement appointment and rejects double-acceptance.
- **Flow 7**: Unauthorized request to private dashboard endpoint is rejected with HTTP 401.
- **Flow 8**: Dashboard displays explicit demo-seed badges and derived metrics.
- **Flow 9**: Genuine concurrency test (`Promise.all`) submitting simultaneous conflicting booking requests — exactly one is confirmed, others return HTTP 409.
- **Flow 10**: Genuine concurrency test (`Promise.all`) submitting simultaneous offer acceptance requests — exactly one replacement created, duplicate returns HTTP 409.
- **Flow 11**: Strict privacy audit inspecting complete response bodies for prohibited fields (`customer_name`, `customer_email`, `customer_phone`, `cancellation_reason`).
- **Flow 12**: Authentication & IDOR negative matrix (missing credentials, forged bearer tokens, cross-provider access attempts).
- **Flow 13**: Token isolation check — cancellation tokens and offer tokens cannot be used interchangeably.
- **Flow 14**: Expired recovery offers return HTTP 410 Gone with zero appointment details.
- **Flow 15**: Input validation & malformed payload rejection (malformed JSON, invalid email, reversed timestamps, oversized payloads).

Run the Playwright test suite:
```bash
npm run test:e2e
```

### 2. In-Process API & Contract Verification Suite
Built-in 10-point contract verification runner located in `src/components/TestRunnerView.tsx` and executable via:
```bash
curl -X POST http://localhost:3000/api/test-runner
```
Validates booking conflict rejection, cancellation preservation, waitlist matching, token validity, and financial invariance.

---

## 🚀 Running Locally

### 1. Prerequisites
- Node.js 18+ (tested on Node v20/v24)
- npm 9+

### 2. Installation
```bash
npm install
```

### 3. Install Playwright Browsers
```bash
npx playwright install chromium
```

### 4. Run Development Server
```bash
npm run dev
```
Visit **`http://localhost:3000`** in your browser.

### 5. Quality & Test Commands
```bash
# Code Quality: Zero ESLint errors
npm run lint

# Strict TypeScript type check
npx tsc --noEmit

# Production Build
npm run build

# Playwright Browser E2E Tests
npm run test:e2e
```

---

## 🌐 Key Application Routes

| Route | Purpose | Access |
|---|---|---|
| `/` | Tutor Recovery Dashboard & Analytics | Protected / Tutor |
| `/book/aditi-sharma` | Public Student Booking Portal | Public |
| `/cancel/[token]` | Student Self-Cancellation Portal | Public (Token Required) |
| `/offer/[token]` | Replacement Offer Acceptance Screen | Public (Token Required) |
| `/api/bookings` | Public Booking & Schedule Endpoint | Public |
| `/api/cancellations/[token]` | Cancellation Endpoint | Public (Token Required) |
| `/api/offers/[token]` | Privacy-Safe Offer DTO Endpoint | Public (Token Required) |
| `/api/offers/[token]/accept`| Atomic Offer Acceptance Endpoint | Public (Token Required) |
| `/api/dashboard` | Tutor Private Dashboard Data | Protected |
| `/api/offers/generate` | Generate Offer & WhatsApp Link | Protected |
| `/api/seed/reset` | Reset DB to Seed State | Protected / Demo |

---

## 🗄️ Database Migrations & Supabase RLS Matrix

The application's PostgreSQL schema is maintained in `supabase/schema.sql`.

### Access Control Matrix
| Table | Anonymous / Public | Authenticated Tutor / Provider | Service Role |
|---|---|---|---|
| `providers` | `SELECT` public profile & slug only | `SELECT`, `UPDATE` own profile | Full Access |
| `services` | `SELECT` active services for booking | `ALL` for own services | Full Access |
| `appointments` | `INSERT` only via validated booking endpoint; no direct `SELECT` | `ALL` for own provider ID | Full Access |
| `waitlist_entries` | `INSERT` for waitlist registration | `ALL` for own provider ID | Full Access |
| `recovery_offers` | No direct access (queries routed via `accept_recovery_offer_atomic` and token-hash RPC) | `ALL` for own provider ID | Full Access |

### Migration Steps for Production / Staging
1. In your Supabase Dashboard or psql CLI, execute `supabase/schema.sql`.
2. Ensure the `btree_gist` extension is enabled:
   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ```
3. Test the exclusion constraint with adjacent appointments to verify `[)` half-open range semantics.
4. Set environment variables `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (kept strictly on the server).

---

## ⚙️ Environment Configuration & Deployment Limitations

Copy `.env.example` to `.env.local` to configure optional Supabase PostgreSQL credentials:
```bash
cp .env.example .env.local
```

### Deployment Limitations & Readiness Notes
- **Local Development**: In local testing, SlotSathi uses its built-in transactional memory store with `AsyncMutex` serialization, matching Supabase transaction semantics.
- **Rate Limiting**: The current sliding-window rate limiter runs in-process with a bounded 5,000-entry map and TTL sweep. For multi-instance horizontal scaling (e.g., Kubernetes or multi-region serverless), replace the in-memory map with an Upstash Redis or AWS ElastiCache cluster.
- **Production Staging**: Requires connecting to an external Supabase instance and executing `supabase/schema.sql` before running production traffic.

---

## 💼 Proposed Freemium Business Model

- **Free Starter (₹0/mo)**: Basic booking calendar, public booking page, and 1 recovered cancellation per month.
- **Solo Tutor (₹199/mo - Recommended Hypothesis)**: Unlimited automated recovery workflow, transparent matching engine, WhatsApp deep-link generation, and INR analytics.  
  * *ROI Justification*: Recovering just **one** ₹1,200 session pays for **6 months** of software fees!
- **Tutoring Studio (₹499/mo - Hypothesis)**: Multi-tutor management, pooled waitlist distribution, and custom branded recovery links.

---

## ⚖️ Hackathon Disclaimer
SlotSathi Recover uses tutor-initiated WhatsApp deep links (`wa.me`). It does not claim automated background messaging without user action. Seed records are clearly labeled as illustrative, and metrics are derived from persisted database records.
