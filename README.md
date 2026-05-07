# Cold Email Platform

AI-powered cold email outreach platform with a React frontend and Express backend. Upload a CSV of prospects, attach them to an Instantly.ai campaign, and the system:

- Generates personalized multi-step email sequences via OpenAI (`gpt-4.1-mini`)
- Auto-configures Instantly campaign templates with `{{stepN_*}}` variables
- Pushes leads to Instantly with `custom_variables` so emails render correctly
- Runs everything asynchronously through a BullMQ (Redis) worker
- Provides a modern React dashboard to manage campaigns and track prospects

---

## Project Structure

```
cold-email-backend/
├── backend/                # Express API + worker
│   ├── src/
│   │   ├── server.js       # Entry point
│   │   ├── app.js          # Express app factory
│   │   ├── config/         # env, db, redis
│   │   ├── models/         # Campaign, Prospect, User (Mongoose)
│   │   ├── controllers/    # campaign, prospect, webhook, auth
│   │   ├── routes/         # Express routes
│   │   ├── services/       # Instantly, OpenAI, email
│   │   ├── queue/          # BullMQ queue
│   │   ├── workers/        # Queue worker
│   │   └── utils/          # Logger, errors, upload, asyncHandler
│   ├── scripts/            # Utility scripts (html-to-pdf)
│   ├── seedUser.js         # Database seed script
│   ├── test_prospects.csv  # Sample CSV for testing
│   ├── .env.example        # Environment template
│   └── package.json
├── frontend/               # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/          # Dashboard, Campaigns, CampaignDetail, Prospects, Upload, Login
│   │   ├── components/     # Layout, ProtectedRoute
│   │   ├── contexts/       # Auth context
│   │   ├── lib/            # API client, utilities
│   │   └── main.tsx        # React entry point
│   ├── public/             # Static assets (favicon, icons)
│   └── package.json
├── docs/                   # Documentation
│   └── cold-email-user-guide.html
├── .gitignore
└── README.md
```

---

## Architecture

```
┌──────────┐     ┌────────────────┐     ┌───────────┐
│  Express │────▶│  BullMQ Queue  │────▶│  Worker   │
│   API    │     │   (Redis)      │     │ (separate │
│  :3000   │     └────────────────┘     │  process) │
└────┬─────┘                            └─────┬─────┘
     │                                        │
     ▼                                        ▼
┌──────────┐   ┌──────────┐   ┌─────────────────────┐
│ MongoDB  │   │ OpenAI   │   │  Instantly.ai API   │
│ campaigns│   │ gpt-4.1- │   │  /campaigns, /leads │
│ prospects│   │ mini     │   └─────────────────────┘
└──────────┘   └──────────┘
```

| Component | Role |
|-----------|------|
| **Express API** (`backend/src/server.js`) | Accepts campaign creation + CSV uploads, validates with Zod, enqueues jobs |
| **BullMQ + Redis** (`backend/src/queue/`) | Persistent job queue with retry (3 attempts, exponential backoff) |
| **Worker** (`backend/src/workers/emailWorker.js`) | Picks up jobs, calls OpenAI, saves sequences, pushes leads to Instantly |
| **MongoDB** | Stores campaigns (`prompt`, `instantlyCampaignId`) and prospects (`email`, `sequence`, `status`) |
| **OpenAI** (`gpt-4.1-mini`) | Generates personalized subject + body for each step |
| **Instantly.ai** | Hosts the campaign, sends emails on schedule using `custom_variables` |
| **React Frontend** (`frontend/`) | Dashboard, campaign management, prospect tracking, CSV upload |

---

## Quick Start

### 1. Prerequisites

- **Node.js** ≥ 18
- **MongoDB** (local or Atlas)
- **Redis** (local or cloud)
- **Instantly.ai** account with API key
- **OpenAI** API key

### 2. Clone & Install

```bash
git clone <repo-url>
cd cold-email-backend

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Environment Variables

```bash
# From the backend directory:
cp .env.example .env
```

Fill in `backend/.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `REDIS_HOST` | ✅ | Redis host |
| `REDIS_PORT` | ✅ | Redis port (default 6379) |
| `OPENAI_API_KEY` | ✅ | OpenAI API key |
| `INSTANTLY_API_KEY` | ✅ | Instantly API key |
| `INSTANTLY_CAMPAIGN_ID` | — | Fallback campaign ID |
| `INSTANTLY_DEFAULT_CAMPAIGN_ID` | — | Secondary fallback |
| `OWNER_EMAIL` | — | For reply forwarding (optional) |
| `GRAPH_TENANT_ID` | — | Microsoft Graph tenant |
| `GRAPH_CLIENT_ID` | — | Microsoft Graph client ID |
| `GRAPH_CLIENT_SECRET` | — | Microsoft Graph client secret |
| `GRAPH_USER_ID` | — | Microsoft Graph user ID |

### 4. Run

**Terminal 1 — Backend API server:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Backend Worker:**
```bash
cd backend
npm run worker
```

**Terminal 3 — Frontend dev server:**
```bash
cd frontend
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API requests to the backend at `http://localhost:3000`.

---

## API Reference

### `POST /api/campaigns` — Create a Campaign

Creates a campaign in Instantly, auto-configures sequence templates with `{{stepN_subject}}` / `{{stepN_body}}` variables, and saves the AI prompt locally.

**Request:**
```json
{
  "name": "SaaS Founders Q2",
  "stepCount": 4,
  "prompt": "You are a friendly SDR targeting SaaS founders. Keep it casual, mention their recent funding.",
  "timezone": "Asia/Kolkata",
  "scheduleName": "Business Hours",
  "timingFrom": "09:00",
  "timingTo": "17:00",
  "days": [1, 2, 3, 4, 5],
  "delayBetweenSteps": 1,
  "delayUnit": "days"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | *required* | Campaign name |
| `stepCount` | number | `3` | Number of emails in the sequence (1–10) |
| `prompt` | string | `""` | AI style/strategy instructions injected into every OpenAI call |
| `timezone` | string | `"Asia/Kolkata"` | Timezone for scheduling |
| `scheduleName` | string | `"Business Hours"` | Schedule label |
| `timingFrom` | string | `"09:00"` | Earliest send time (HH:MM) |
| `timingTo` | string | `"17:00"` | Latest send time (HH:MM) |
| `days` | number[] | `[1,2,3,4,5]` | Days to send (1=Mon … 7=Sun) |
| `delayBetweenSteps` | number | `1` | Gap between steps |
| `delayUnit` | string | `"days"` | `"minutes"`, `"hours"`, or `"days"` |

**Response (201):**
```json
{
  "data": {
    "id": "341e6a10-2bc1-4c4f-bb11-abc123def456",
    "name": "SaaS Founders Q2",
    "stepCount": 4,
    "prompt": "You are a friendly SDR targeting SaaS founders..."
  }
}
```

---

### `POST /api/prospects/upload` — Upload Prospects (CSV/Excel)

Upload a CSV or Excel file. Each row becomes a prospect, gets saved to MongoDB with `status: "pending"`, and is enqueued for AI generation.

**Request:** `multipart/form-data` with file field `"file"`

**CSV Format:**
```csv
email,name,company,role,pain points,notes,campaign_id
firoz@example.com,Firoz Ansari,Lexodd,CTO,"scaling,automation","Platform modernization",341e6a10-2bc1-4c4f-bb11-abc123def456
jane@example.com,Jane Smith,Acme Corp,CEO,"hiring,growth","Series A",341e6a10-2bc1-4c4f-bb11-abc123def456
```

| Column | Required | Aliases |
|--------|----------|---------|
| `email` | ✅ | `email`, `email address` |
| `name` | — | `name`, `first name`, `full name` |
| `company` | — | `company`, `company name` |
| `role` | — | `role`, `job title`, `title` |
| `pain points` | — | `painpoints`, `pain points` (comma/semicolon-separated) |
| `notes` | — | `notes` |
| `campaign_id` | — | `campaign_id`, `campaign id` |

**Response (201):**
```json
{
  "data": {
    "total": 16,
    "created": 15,
    "skipped": 1,
    "errors": [
      { "email": "dupe@example.com", "reason": "Duplicate email (already exists)" }
    ]
  }
}
```

### `POST /api/webhooks/reply` — Instantly Reply Webhook

Receives reply notifications from Instantly.ai when a prospect replies to an email.

**Request (sent by Instantly):**
```json
{
  "email": "firoz@example.com",
  "reply_text": "Hey, this sounds interesting. Let's chat.",
  "campaign_id": "341e6a10-2bc1-4c4f-bb11-abc123def456",
  "lead_id": "lead_abc123",
  "timestamp": "2026-04-28T14:30:00Z"
}
```

| Field | Description |
|-------|-------------|
| `email` | Prospect's email address |
| `reply_text` | Reply content (v2 API). Also accepts `reply` (v1) |
| `campaign_id` | Instantly campaign UUID |
| `lead_id` | Instantly lead ID (used for precise matching) |
| `timestamp` | ISO 8601 reply timestamp |

**Matching logic:**
1. Match by `lead_id` → `instantlyLeadId` (most precise)
2. Fallback: match by `email` (for older v1 integrations)

**Response (200):**
```json
{ "ok": true }
```

---

## How It Works — End to End

### Flow 1: Campaign Creation

```
User POST /api/campaigns
  → Zod validates input (CreateCampaignSchema)
  → Instantly createCampaign() — POST /api/v2/campaigns
  → Instantly returns campaign UUID
  → ensureCampaignSteps() — PATCH /api/v2/campaigns with {{stepN_*}} templates
  → MongoDB Campaign.findOneAndUpdate() — saves { instantlyCampaignId, name, prompt, stepCount }
  → Returns 201 with campaign data
```

### Flow 2: Prospect Upload

```
User POST /api/prospects/upload (CSV)
  → Multer parses file in memory
  → XLSX reads buffer → sheet_to_json()
  → For each row:
      → Normalize column names (case-insensitive)
      → Zod validates email/name/company/role/painPoints/notes
      → MongoDB Prospect.create({ status: "pending", campaignId })
      → BullMQ emailQueue.add({ prospectId })
  → Returns 201 with summary
```

### Flow 3: Worker (Async)

```
Worker picks up job from Redis
  → Prospect.findById()
  → (skip if already status="generated")
  → Instantly getCampaignStepCount(campaignId) — GET /api/v2/campaigns/:id
  → MongoDB Campaign.findOne({ instantlyCampaignId }) → gets prompt
  → OpenAI generateColdEmailSequence({ ..., prompt, stepCount })
      → buildPrompt() constructs system prompt with campaign prompt injected
      → gpt-4.1-mini + response_format: json_object
      → safeJsonParse() strips markdown fences, extracts JSON
      → Returns { step1_subject, step1_body, step2_subject, ... }
  → Saves to prospect.sequence (Mongoose Map) + status = "generated"
  → Instantly addLeadToCampaign({ email, custom_variables })
      → POST /api/v2/leads with custom_variables
  → Saves prospect.instantlyLeadId
  → Job complete
```

### Flow 4: Webhook — Reply Handling

```
Instantly sends POST /api/webhooks/reply
  → Match prospect by lead_id → instantlyLeadId
  → (fallback: match by email for v1)
  → If not found → 200 (no-op, don't tell Instantly it failed)
  → Save prospect.replyText, prospect.repliedAt
  → Set status = "replied"
  → Fire-and-forget (async, don't block response):
      → Forward reply content to OWNER_EMAIL via emailService
      → Auto thank-you email back to lead
  → Return 200 immediately
```

---

## Key Design Decisions

| Decision | Why |
|----------|-----|
| **`prompt` lives on Campaign, not Prospect** | One AI strategy per campaign; all prospects share it |
| **`stepCount` derived from Instantly, not CSV** | Prevents mismatches — worker always queries the campaign |
| **`custom_variables` (not `custom_fields` or `payload`)** | Correct Instantly API key for lead-level variable substitution |
| **Campaign templates auto-configured** | `ensureCampaignSteps()` runs once per process, idempotent |
| **Dedicated worker process** | Keeps API fast; retry logic handles transient failures |
| **BullMQ (Redis) for queue** | Persistent, supports retry + backoff + concurrency |
| **Monorepo: `backend/` + `frontend/`** | Clear separation of concerns; independent dependency management |

---

## Scripts

### Backend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API with nodemon (auto-reload) |
| `npm run start` | Start API (production) |
| `npm run worker` | Start queue worker |
| `npm run lint` | Run ESLint |

### Frontend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |