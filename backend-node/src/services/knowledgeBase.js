/**
 * Knowledge base service — loads a topic pack used by the agents.
 *
 * Equivalent of backend/app/services/knowledge_base.py
 */

import fs from "fs";
import path from "path";
import settings from "../config.js";

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

export class KnowledgeBase {
  /**
   * @param {string} topicId  - The snake_case topic identifier
   * @param {string} [baseDir] - Override for the knowledge_base directory
   */
  constructor(topicId, baseDir = null) {
    this.topicId = topicId;
    const root = baseDir || settings.knowledgeBaseDir;
    this.baseDir = path.join(root, "topics", topicId);

    if (!fs.existsSync(this.baseDir)) {
      throw Object.assign(
        new Error(`Topic pack not found: ${this.baseDir}`),
        { status: 404 }
      );
    }

    this.manifest = readJson(path.join(this.baseDir, "manifest.json"));
    this.concepts = readJson(path.join(this.baseDir, "concept_graph.json"));
    this.misconceptions = readJson(path.join(this.baseDir, "misconceptions.json"));
    this.interventions = readJson(path.join(this.baseDir, "interventions.json"));
    this.problems = readJson(path.join(this.baseDir, "problems.json"));
    this.evaluationRules = readJson(path.join(this.baseDir, "evaluation_rules.json"));
  }

  /**
   * Find a misconception entry matching a concept and error tag.
   */
  findMisconception(concept, errorTag) {
    for (const item of this.misconceptions.items || []) {
      if (
        item.concept_id === concept &&
        (item.error_tags || []).includes(errorTag)
      ) {
        return item;
      }
    }
    return null;
  }

  /**
   * Find all intervention rules matching a concept and error tag.
   */
  findInterventions(concept, errorTag) {
    const matches = [];
    for (const rule of this.interventions.rules || []) {
      if (rule.concept_id !== concept) continue;
      const misconception = this.findMisconception(concept, errorTag);
      if (misconception && rule.misconception_id === misconception.id) {
        matches.push(rule);
      }
    }
    return matches;
  }
}
