import express from "express";
import cors from "cors";
import settings from "./config.js";
import { initDb } from "./services/database.js";
import healthRouter from "./routes/health.js";
import orchestratorRouter from "./routes/orchestrator.js";
import evaluationRouter from "./routes/evaluation.js";
import ingestRouter from "./routes/ingest.js";

const app = express();

// --------------- Middleware ---------------
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// --------------- Routes ---------------
app.use(healthRouter);
app.use(orchestratorRouter);
app.use(evaluationRouter);
app.use(ingestRouter);

// --------------- Error handler ---------------
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({ detail: err.message || "Internal server error" });
});

// --------------- Start ---------------
initDb();
app.listen(settings.port, () => {
  console.log(`${settings.appName} backend running at http://localhost:${settings.port}`);
});

export default app;
