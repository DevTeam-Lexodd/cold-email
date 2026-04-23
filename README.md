# Cold Email Outreach Backend

Production-ready backend for a cold email outreach platform using Node.js (ES modules), Express, MongoDB (Mongoose), BullMQ (Redis), and OpenAI.

## Quick start

1. Install dependencies

```bash
cd cold-email-backend
npm install
```

2. Create env file

```bash
copy .env.example .env
```

3. Run API

```bash
npm run dev
```

4. Run queue worker (separate terminal)

```bash
npm run worker
```

### Running API + worker separately (recommended)

Open **two terminals** in `cold-email-backend/`.

Terminal 1 (API):

```bash
npm run dev
```

Terminal 2 (worker):

```bash
npm run worker:run
```

## API

- `POST /api/prospects` create a prospect (also queues generation)
- `GET /api/prospects` list prospects
- `POST /api/prospects/generate` queue generation for prospects
- `GET /api/prospects/export` export CSV for Instantly.ai
- `POST /api/webhooks/reply` capture replies

## Notes

- Queue name: `emailQueue`
- Worker concurrency: `2`
- Job attempts: `3`
# cold-email-backend
