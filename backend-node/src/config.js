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
  llmModel: process.env.LLM_MODEL || "gemini-2.0-flash",
};

export default settings;
