import { env } from "./config/env.js";
import { connectDb } from "./config/db.js";
import { buildApp } from "./app.js";
import { logger } from "./utils/logger.js";
import { migrateProspectIndexes } from "./models/Prospect.js";

async function main() {
  await connectDb();
  await migrateProspectIndexes();

  const app = buildApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "API listening");
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, "Shutting down");
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  logger.error({ err: e }, "Fatal startup error");
  process.exit(1);
});

