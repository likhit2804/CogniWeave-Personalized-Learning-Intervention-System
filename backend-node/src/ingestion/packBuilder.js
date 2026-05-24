import fs from "fs";
import path from "path";
import settings from "../config.js";

export function validatePack(pack) {
  const report = { valid: true, warnings: [], errors: [] };
  const topicId = pack.topicId;

  const conceptIds = new Set();
  for (const c of pack.conceptGraph.concepts || []) {
    if (c.id) conceptIds.add(c.id);
  }

  if (conceptIds.size === 0) {
    report.errors.push("No concepts found in conceptGraph.");
    report.valid = false;
    return report;
  }

  const misconceptionIds = new Set();
  for (const m of pack.misconceptions.items || []) {
    if (m.id) misconceptionIds.add(m.id);
    if (!conceptIds.has(m.concept_id)) {
      report.warnings.push(`Misconception '${m.id}' references unknown concept_id '${m.concept_id}'.`);
    }
  }

  for (const rule of pack.interventions.rules || []) {
    if (!conceptIds.has(rule.concept_id)) {
      report.warnings.push(`Intervention '${rule.id}' references unknown concept_id '${rule.concept_id}'.`);
    }
    if (!misconceptionIds.has(rule.misconception_id)) {
      report.warnings.push(`Intervention '${rule.id}' references unknown misconception_id '${rule.misconception_id}'.`);
    }
  }

  for (const prob of pack.problems.items || []) {
    for (const cid of prob.concept_ids || []) {
      if (!conceptIds.has(cid)) {
        report.warnings.push(`Problem '${prob.id}' references unknown concept_id '${cid}'.`);
      }
    }
  }

  for (const rule of pack.evaluationRules.rules || []) {
    if (!conceptIds.has(rule.concept_id)) {
      report.warnings.push(`Evaluation rule references unknown concept_id '${rule.concept_id}'.`);
    }
  }

  // Check consistency and fix
  const files = [
    pack.manifest,
    pack.conceptGraph,
    pack.misconceptions,
    pack.interventions,
    pack.problems,
    pack.evaluationRules,
  ];
  for (const data of files) {
    if (data.topic_id !== topicId) {
      report.warnings.push(`topic_id is '${data.topic_id}', expected '${topicId}'. Fixed on write.`);
      data.topic_id = topicId;
    }
  }

  return report;
}

export function writePack(pack, baseDir = null, overwrite = false) {
  const root = baseDir || settings.knowledgeBaseDir;
  const topicDir = path.join(root, "topics", pack.topicId);

  if (fs.existsSync(topicDir) && !overwrite) {
    throw new Error(`Topic pack '${pack.topicId}' already exists at ${topicDir}. Set overwrite=true to replace.`);
  }

  fs.mkdirSync(topicDir, { recursive: true });

  const filesMap = {
    "manifest.json": pack.manifest,
    "concept_graph.json": pack.conceptGraph,
    "misconceptions.json": pack.misconceptions,
    "interventions.json": pack.interventions,
    "problems.json": pack.problems,
    "evaluation_rules.json": pack.evaluationRules,
  };

  const writtenFiles = [];
  for (const [filename, data] of Object.entries(filesMap)) {
    const filepath = path.join(topicDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
    writtenFiles.push(filepath);
  }

  return {
    topic_id: pack.topicId,
    directory: topicDir,
    files: writtenFiles,
    conceptCount: (pack.conceptGraph.concepts || []).length,
    misconceptionCount: (pack.misconceptions.items || []).length,
    interventionCount: (pack.interventions.rules || []).length,
    problemCount: (pack.problems.items || []).length,
    evaluationRuleCount: (pack.evaluationRules.rules || []).length,
  };
}

export function buildAndWrite(pack, baseDir = null, overwrite = false) {
  const report = validatePack(pack);

  if (!report.valid) {
    return {
      success: false,
      validation: report,
    };
  }

  const summary = writePack(pack, baseDir, overwrite);
  return {
    success: true,
    validation: report,
    ...summary,
  };
}
