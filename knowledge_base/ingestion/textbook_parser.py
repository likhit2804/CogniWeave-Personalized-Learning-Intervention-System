"""Textbook parser — extracts and chunks text from PDF files or raw text."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ChapterChunk:
    """A single chunk of textbook content ready for LLM processing."""
    chapter_title: str
    section_title: str
    content: str
    page_range: str = ""
    word_count: int = 0

    def __post_init__(self):
        self.word_count = len(self.content.split())


@dataclass
class ParsedTextbook:
    """Result of parsing a textbook — a list of chapter chunks."""
    source_file: str
    chapters: list[ChapterChunk] = field(default_factory=list)
    total_pages: int = 0
    total_words: int = 0

    def summary(self) -> str:
        return (
            f"Source: {self.source_file}\n"
            f"Pages: {self.total_pages}\n"
            f"Chapters/Sections: {len(self.chapters)}\n"
            f"Total words: {self.total_words}"
        )


def parse_pdf(pdf_path: str | Path) -> ParsedTextbook:
    """
    Parse a PDF textbook into chapter-level chunks.

    Uses pdfplumber to extract text page-by-page, then groups pages
    into chapters based on detected headings.
    """
    import pdfplumber

    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    pages_text: list[tuple[int, str]] = []

    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            # Clean up common PDF artifacts
            text = _clean_page_text(text)
            if text.strip():
                pages_text.append((i + 1, text))

    # Group pages into chapters
    chapters = _group_into_chapters(pages_text)

    total_words = sum(ch.word_count for ch in chapters)
    return ParsedTextbook(
        source_file=str(pdf_path),
        chapters=chapters,
        total_pages=total_pages,
        total_words=total_words,
    )


def parse_text(raw_text: str, source_name: str = "raw_input") -> ParsedTextbook:
    """
    Parse raw text content into chapter-level chunks.

    Splits on markdown-style headings (# or ##) or numbered chapter patterns.
    """
    if not raw_text.strip():
        raise ValueError("Empty text content provided.")

    chapters = _split_text_into_chapters(raw_text)

    total_words = sum(ch.word_count for ch in chapters)
    return ParsedTextbook(
        source_file=source_name,
        chapters=chapters,
        total_pages=0,
        total_words=total_words,
    )


# --------------- Internal helpers ---------------


def _clean_page_text(text: str) -> str:
    """Remove common PDF noise: page numbers, excessive whitespace, headers/footers."""
    # Remove standalone page numbers
    text = re.sub(r"^\s*\d+\s*$", "", text, flags=re.MULTILINE)
    # Collapse multiple blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Strip leading/trailing whitespace per line
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(lines)


# Common heading patterns in textbooks
_CHAPTER_PATTERN = re.compile(
    r"^(?:"
    r"(?:Chapter|CHAPTER)\s+\d+"            # Chapter 1, CHAPTER 3
    r"|(?:\d+\.)\s+[A-Z]"                   # 1. Introduction
    r"|#{1,2}\s+"                            # Markdown headings
    r"|(?:Unit|UNIT|Part|PART)\s+\d+"        # Unit 1, Part II
    r")",
    re.MULTILINE,
)


def _group_into_chapters(pages: list[tuple[int, str]]) -> list[ChapterChunk]:
    """Group PDF pages into chapters by detecting heading patterns."""
    if not pages:
        return []

    chapters: list[ChapterChunk] = []
    current_title = "Introduction"
    current_lines: list[str] = []
    start_page = pages[0][0]

    for page_num, text in pages:
        lines = text.splitlines()
        for line in lines:
            if _CHAPTER_PATTERN.match(line.strip()) and current_lines:
                # Save the previous chapter
                content = "\n".join(current_lines).strip()
                if content:
                    chapters.append(ChapterChunk(
                        chapter_title=current_title,
                        section_title=current_title,
                        content=content,
                        page_range=f"p{start_page}-p{page_num}",
                    ))
                current_title = line.strip()
                current_lines = []
                start_page = page_num
            else:
                current_lines.append(line)

    # Don't forget the last chapter
    if current_lines:
        content = "\n".join(current_lines).strip()
        if content:
            chapters.append(ChapterChunk(
                chapter_title=current_title,
                section_title=current_title,
                content=content,
                page_range=f"p{start_page}-p{pages[-1][0]}",
            ))

    return chapters


def _split_text_into_chapters(raw_text: str) -> list[ChapterChunk]:
    """Split raw text into chapters using heading patterns."""
    # Try splitting by markdown headings first
    parts = re.split(r"(?=^#{1,2}\s+.+)", raw_text, flags=re.MULTILINE)

    # If no headings found, try chapter/section patterns
    if len(parts) <= 1:
        parts = re.split(
            r"(?=^(?:Chapter|CHAPTER)\s+\d+)",
            raw_text,
            flags=re.MULTILINE,
        )

    chapters: list[ChapterChunk] = []
    for i, part in enumerate(parts):
        part = part.strip()
        if not part:
            continue

        # Extract title from the first line
        first_line = part.splitlines()[0].strip().lstrip("#").strip()
        title = first_line if first_line else f"Section {i + 1}"

        chapters.append(ChapterChunk(
            chapter_title=title,
            section_title=title,
            content=part,
        ))

    # If we still have just one giant block, create a single chapter
    if not chapters:
        chapters.append(ChapterChunk(
            chapter_title="Full Content",
            section_title="Full Content",
            content=raw_text.strip(),
        ))

    return chapters
