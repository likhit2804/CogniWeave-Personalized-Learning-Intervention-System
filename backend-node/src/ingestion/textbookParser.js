import pdfParse from "pdf-parse";
import fs from "fs";

export function parseText(rawText, sourceName = "raw_input") {
  if (!rawText.trim()) {
    throw new Error("Empty text content provided.");
  }
  const chapters = _splitTextIntoChapters(rawText);
  const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

  return {
    sourceFile: sourceName,
    chapters,
    totalPages: 0,
    totalWords,
    summary() {
      return `Source: ${this.sourceFile}\nPages: ${this.totalPages}\nChapters: ${this.chapters.length}\nWords: ${this.totalWords}`;
    },
  };
}

export async function parsePdf(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  
  // pdf-parse doesn't give us page-by-page out of the box easily without a custom pagerender
  // For simplicity, we'll extract the full text and run the same text chunker
  const data = await pdfParse(dataBuffer);
  let text = data.text;
  
  // Basic cleanup
  text = text.replace(/^\s*\d+\s*$/gm, ""); // page numbers
  text = text.replace(/\n{3,}/g, "\n\n");
  
  const chapters = _splitTextIntoChapters(text);
  const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

  return {
    sourceFile: pdfPath,
    chapters,
    totalPages: data.numpages,
    totalWords,
    summary() {
      return `Source: ${this.sourceFile}\nPages: ${this.totalPages}\nChapters: ${this.chapters.length}\nWords: ${this.totalWords}`;
    },
  };
}

// Common heading patterns
function _splitTextIntoChapters(rawText) {
  // Try splitting by markdown headings first
  let parts = rawText.split(/(?=^#{1,2}\s+.+)/m);
  
  if (parts.length <= 1) {
    // Try Chapter/Unit/Part headings
    parts = rawText.split(/(?=^(?:Chapter|CHAPTER)\s+\d+)/m);
  }

  const chapters = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    const firstLine = part.split("\n")[0].replace(/^#+/, "").trim();
    const title = firstLine || `Section ${i + 1}`;
    const wordCount = part.split(/\s+/).length;

    chapters.push({
      chapterTitle: title,
      sectionTitle: title,
      content: part,
      wordCount,
    });
  }

  if (chapters.length === 0) {
    chapters.push({
      chapterTitle: "Full Content",
      sectionTitle: "Full Content",
      content: rawText.trim(),
      wordCount: rawText.trim().split(/\s+/).length,
    });
  }

  return chapters;
}
