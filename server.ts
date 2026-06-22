// server.ts — custom Next.js server entry point
// Wraps the Next.js App Router in a plain HTTP server and registers the daily
// node-cron job for overdue-scan notifications (NOTF-01, NOTF-02).
//
// WHY: instrumentation.ts is silently excluded from output: "standalone" builds
// (Next.js issue #89377). A custom server.ts is the only reliable way to mount
// node-cron in a persistent Docker process.
//
// USAGE:
//   Development: npm run start:dev   →  tsx server.ts
//   Production:  npm start           →  node dist/server.js  (bundled by build step)
//
// Source: https://nextjs.org/docs/pages/guides/custom-server [CITED]

import { createServer } from "http";
import next from "next";
import cron from "node-cron";
import { scanAndNotify } from "./src/jobs/overdue-scan";

const port = parseInt(process.env.PORT ?? "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Schedule daily overdue scan at 06:00 UTC (NOTF-01, NOTF-02)
  cron.schedule(
    "0 6 * * *",
    async () => {
      console.log("[cron] Running daily overdue scan...");
      await scanAndNotify();
    },
    { timezone: "UTC" }
  );

  createServer((req, res) => {
    handle(req, res);
  }).listen(port, () => {
    console.log(`> Server listening on port ${port}`);
  });
});
