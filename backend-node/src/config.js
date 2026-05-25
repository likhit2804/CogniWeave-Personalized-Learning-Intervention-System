import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is two levels up from backend-node/src/
const baseDir = path.resolve(__dirname, "..", "..");

// Load .env from project root
config({ path: path.join(baseDir, ".env") });

const settings = {
  appName: "CogniWeave",
  port: parseInt(process.env.PORT || "8000", 10),
  baseDir,
  knowledgeBaseDir: path.join(baseDir, "knowledge_base"),
  dbPath: path.join(baseDir, "db", "cogniweave.db"),
  schemaPath: path.join(baseDir, "db", "schema.sql"),

  // LLM Settings
  geminiApiKey: process.env.GEMINI_API_KEY || null,
  openaiApiKey: process.env.OPENAI_API_KEY || null,
  // Your current quota screenshot shows Gemini 2 Flash / 2 Flash Lite at 0/0,
  // while Gemini 2.5 Flash Lite still has available request capacity.
  llmModel: process.env.LLM_MODEL || "gemini-2.5-flash-lite",
  agentModel: process.env.AGENT_MODEL || process.env.LLM_MODEL || "gemini-2.5-flash-lite",
  llmFallbackModels: (process.env.LLM_FALLBACK_MODELS || "gemini-2.5-flash-lite,gemini-2.5-flash")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  llm503Retries: parseInt(process.env.LLM_503_RETRIES || "1", 10),
  llmRetryBaseMs: parseInt(process.env.LLM_RETRY_BASE_MS || "1500", 10),
  llmMaxConcurrency: parseInt(process.env.LLM_MAX_CONCURRENCY || "4", 10),
  llmCacheTtlSeconds: parseInt(process.env.LLM_CACHE_TTL_SECONDS || "900", 10),

  // Graph + User Stores (incremental migration from SQLite)
  neo4jUri: process.env.NEO4J_URI || null,
  neo4jUser: process.env.NEO4J_USER || null,
  neo4jPassword: process.env.NEO4J_PASSWORD || null,
  neo4jDatabase: process.env.NEO4J_DATABASE || "neo4j",
  mongoUri: process.env.MONGO_URI || null,
  mongoDbName: process.env.MONGO_DB_NAME || "cogniweave",
};

export default settings;
