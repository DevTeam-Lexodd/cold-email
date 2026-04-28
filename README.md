# Cold Email Backend

AI-powered cold email outreach platform.  Upload a CSV of prospects, attach them to an Instantly.ai campaign, and the system:

- Generates personalized multi-step email sequences via OpenAI (`gpt-4.1-mini`)
- Auto-configures Instantly campaign templates with `{{stepN_*}}` variables
- Pushes leads to Instantly with `custom_variables` so emails render correctly
- Runs everything asynchronously through a BullMQ (Redis) worker

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
| **Express API** (`src/server.js`) | Accepts campaign creation + CSV uploads, validates with Zod, enqueues jobs |
| **BullMQ + Redis** (`src/queue/`) | Persistent job queue with retry (3 attempts, exponential backoff) |
| **Worker** (`src/workers/emailWorker.js`) | Picks up jobs, calls OpenAI, saves sequences, pushes leads to Instantly |
| **MongoDB** | Stores campaigns (`prompt`, `instantlyCampaignId`) and prospects (`email`, `sequence`, `status`) |
| **OpenAI** (`gpt-4.1-mini`) | Generates personalized subject + body for each step |
| **Instantly.ai** | Hosts the campaign, sends emails on schedule using `custom_variables` |

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
npm install
```

### 3. Environment Variables

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `REDIS_HOST` | ✅ | Redis host |
| `REDIS_PORT` | ✅ | Redis port (default 6379) |
| `OPENAI_API_KEY` | ✅ | OpenAI API key |
| `INSTANTLY_API_KEY` | ✅ | Instantly API key |
| `INSTANTLY_CAMPAIGN_ID` | — | Fallback campaign ID if none provided in CSV |
| `INSTANTLY_DEFAULT_CAMPAIGN_ID` | — | Secondary fallback |
| `OWNER_EMAIL` | — | For Microsoft Graph (Outlook) integration (optional) |
| `GRAPH_TENANT_ID` | — | Microsoft Graph tenant |
| `GRAPH_CLIENT_ID` | — | Microsoft Graph client ID |
| `GRAPH_CLIENT_SECRET` | — | Microsoft Graph client secret |
| `GRAPH_USER_ID` | — | Microsoft Graph user ID |

### 4. Run

**Terminal 1 — API server:**
```bash
npm run dev
```

**Terminal 2 — Worker:**
```bash
npm run worker
```

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
| `prompt` | string | `""` | AI style/strategy instructions injected into every OpenAI call for this campaign |
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

### How Instantly Uses the Data

1. The campaign sequence was pre-configured with templates like `{{step1_subject}}` / `{{step1_body}}`
2. When a lead is pushed with `custom_variables`, Instantly substitutes `{{step1_subject}}` with the actual AI-generated subject
3. Emails are sent on schedule (e.g., Business Hours, 1-day delay between steps)

---

## Project Structure

```
src/
├── server.js               # Entry point — connects DB, starts Express
├── app.js                  # Express app factory (middleware, routes)
├── config/
│   ├── env.js              # Zod-validated environment variables
│   ├── db.js               # Mongoose connection
│   └── redis.js            # Redis connection for BullMQ
├── models/
│   ├── Campaign.js         # Campaign schema (instantlyCampaignId, prompt, stepCount)
│   └── Prospect.js         # Prospect schema (email, sequence Map, status, campaignId)
├── controllers/
│   ├── campaignController.js  # POST /api/campaigns
│   ├── prospectController.js  # POST /api/prospects/upload
│   └── webhookController.js   # Instantly webhook handler
├── routes/
│   ├── campaignRoutes.js
│   ├── prospectRoutes.js
│   └── webhookRoutes.js
├── services/
│   ├── instantlyService.js    # All Instantly API calls (createCampaign, addLeadToCampaign, ensureCampaignSteps)
│   ├── openaiEmailService.js  # OpenAI prompt builder + API call (gpt-4.1-mini)
│   └── emailService.js        # Direct email sending (non-Instantly)
├── queue/
│   └── emailQueue.js          # BullMQ queue (enqueueProspectGeneration)
├── workers/
│   └── emailWorker.js         # BullMQ worker — orchestrates generation + Instantly push
└── utils/
    ├── asyncHandler.js        # Async error wrapper for Express
    ├── errors.js              # HttpError, notFound, errorHandler (Zod support)
    ├── logger.js              # Pino logger
    └── upload.js              # Multer config (memory storage, .xlsx/.csv filter)
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

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API with nodemon (auto-reload) |
| `npm run start` | Start API (production) |
| `npm run worker` | Start queue worker |
| `npm run lint` | Run ESLint |