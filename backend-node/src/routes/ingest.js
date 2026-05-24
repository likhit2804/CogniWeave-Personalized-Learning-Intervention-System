import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import settings from "../config.js";
import { parseText, parsePdf } from "../ingestion/textbookParser.js";
import { extractTopicPack } from "../ingestion/topicExtractor.js";
import { buildAndWrite } from "../ingestion/packBuilder.js";

const router = Router();
const upload = multer({ dest: "uploads/" });

router.post("/ingest/text", async (req, res, next) => {
  try {
    const { topic_id, title = "", content, chapter_index = 0, overwrite = false } = req.body;

    if (!content) {
      return res.status(400).json({ detail: "Content is required." });
    }

    const parsed = parseText(content, title || "api_input");
    if (!parsed.chapters || parsed.chapters.length === 0) {
      return res.status(400).json({ detail: "No content could be parsed from the input." });
    }

    const chapterIdx = Math.min(chapter_index, parsed.chapters.length - 1);
    const chapter = parsed.chapters[chapterIdx];

    const pack = await extractTopicPack(
      chapter.content,
      title || chapter.chapterTitle,
      topic_id
    );

    const result = buildAndWrite(pack, null, overwrite);

    if (result.success) {
      res.json({
        success: true,
        topic_id,
        message: `Topic pack '${topic_id}' generated successfully.`,
        directory: result.directory || "",
        stats: {
          concepts: result.conceptCount || 0,
          misconceptions: result.misconceptionCount || 0,
          interventions: result.interventionCount || 0,
          problems: result.problemCount || 0,
          evaluation_rules: result.evaluationRuleCount || 0,
        },
        validation: result.validation || {},
        generated_data: {
          manifest: pack.manifest,
          concept_graph: pack.conceptGraph,
          misconceptions: pack.misconceptions,
          interventions: pack.interventions,
          problems: pack.problems,
          evaluation_rules: pack.evaluationRules,
        },
      });
    } else {
      res.json({
        success: false,
        topic_id,
        message: "Validation failed. Topic pack was not written.",
        validation: result.validation || {},
      });
    }
  } catch (err) {
    console.error("Ingestion failed:", err);
    res.status(500).json({ detail: err.message });
  }
});

router.post("/ingest/pdf", upload.single("file"), async (req, res, next) => {
  try {
    const { topic_id, title = "", chapter_index = 0, overwrite = false } = req.body;
    const file = req.file;

    if (!file || !file.originalname.toLowerCase().endsWith(".pdf")) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ detail: "Only PDF files are supported." });
    }

    const parsed = await parsePdf(file.path);

    if (!parsed.chapters || parsed.chapters.length === 0) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ detail: `No chapters could be extracted.` });
    }

    const chapterIdx = Math.min(Number(chapter_index), parsed.chapters.length - 1);
    const chapter = parsed.chapters[chapterIdx];

    const pack = await extractTopicPack(
      chapter.content,
      title || chapter.chapterTitle,
      topic_id
    );

    const result = buildAndWrite(pack, null, String(overwrite) === "true");

    fs.unlinkSync(file.path);

    if (result.success) {
      res.json({
        success: true,
        topic_id,
        message: `Topic pack '${topic_id}' generated from PDF chapter '${chapter.chapterTitle}'.`,
        directory: result.directory || "",
        stats: {
          concepts: result.conceptCount || 0,
          misconceptions: result.misconceptionCount || 0,
          interventions: result.interventionCount || 0,
          problems: result.problemCount || 0,
          evaluation_rules: result.evaluationRuleCount || 0,
        },
        validation: result.validation || {},
        generated_data: {
          manifest: pack.manifest,
          concept_graph: pack.conceptGraph,
        },
      });
    } else {
      res.json({
        success: false,
        topic_id,
        message: "Validation failed. Topic pack was not written.",
        validation: result.validation || {},
      });
    }
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error("PDF Ingestion failed:", err);
    res.status(500).json({ detail: err.message });
  }
});

router.get("/ingest/topics", (req, res, next) => {
  try {
    const topicsDir = path.join(settings.knowledgeBaseDir, "topics");
    if (!fs.existsSync(topicsDir)) {
      return res.json([]);
    }

    const results = [];
    const entries = fs.readdirSync(topicsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(topicsDir, entry.name, "manifest.json");
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
          results.push({
            topic_id: manifest.topic_id || entry.name,
            title: manifest.title || entry.name,
            difficulty: manifest.difficulty || "unknown",
            description: manifest.description || "",
          });
        }
      }
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
