import re
from typing import List


def format_as_human_readable_sentences(text: str) -> str:
    """
    Transforms raw OCR text that follows visual line breaks and fragmentation
    into natural, flowing, human-readable sentences and paragraphs.
    
    Features:
    - Joins words broken across lines by hyphens (e.g. "expe-\\ndition" -> "expedition").
    - Merges wrapped lines and visual double-line gaps that belong to the same sentence.
    - Preserves headings, bullet points, numbered items, and metadata key-value lines.
    - Fixes OCR punctuation spacing glitches (e.g., spaces before commas/periods).
    - Ensures proper sentence capitalization.
    - Preserves numbers, monetary values (e.g. $650.00), and dates.
    """
    if not text or not text.strip():
        return ""

    # Split multi-page markers if present (e.g. "--- Page 1 ---")
    page_marker_pattern = r"(--- Page \d+ ---)"
    parts = re.split(page_marker_pattern, text)
    if len(parts) > 1:
        processed_parts = []
        for p in parts:
            if re.match(page_marker_pattern, p.strip()):
                processed_parts.append(p.strip())
            else:
                formatted = _format_single_document_text(p)
                if formatted:
                    processed_parts.append(formatted)
        return "\n\n".join(processed_parts)
    else:
        return _format_single_document_text(text)


def _should_merge_blocks(prev_block: str, next_block: str) -> bool:
    """Determines whether two consecutive blocks are fragments of the same continuous sentence."""
    prev = prev_block.strip()
    next_b = next_block.strip()
    if not prev or not next_b:
        return False

    # Never merge page or section dividers
    if prev.startswith("---") or next_b.startswith("---"):
        return False

    # Never merge list items (e.g. "1. ", "- ", "* ")
    if re.match(r"^(\d+[\.\)]|[-*•–—])\s+", next_b):
        return False

    # Never merge key-value fields (e.g. "Date: 2026-10-13", "Signed: John")
    if re.match(r"^[A-Z][a-zA-Z\s]{1,20}:\s*.+", next_b):
        return False

    # If previous block is a title or heading, keep separate
    if len(prev) < 55 and (prev.isupper() or prev.endswith(":") or prev.startswith("#")):
        return False

    # If next block starts with a lowercase letter, it is definitely part of the current sentence!
    if next_b[0].islower():
        return True

    # If previous block does NOT end with sentence-ending punctuation (. ! ? :), check if next block is a heading
    ends_with_sentence_punct = bool(re.search(r"[\.!\?:]\s*$", prev))
    if not ends_with_sentence_punct:
        # If next block is not a standalone heading or title, merge
        is_next_heading = len(next_b) < 45 and (
            next_b.isupper() or next_b.endswith(":") or next_b.startswith("#")
        )
        if not is_next_heading:
            return True

    return False


def _format_single_document_text(text: str) -> str:
    """Formats text of a single page or document into natural sentences."""
    if not text:
        return ""

    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Rejoin hyphenated words split at line ends (e.g. "docu-\nment" -> "document")
    text = re.sub(r"([a-zA-Z]{2,})-\s*\n\s*([a-zA-Z]{2,})", r"\1\2", text)

    # First, split lines and handle immediate newline unwrapping
    raw_blocks = re.split(r"\n\s*\n+", text)
    cleaned_blocks: List[str] = []

    for block in raw_blocks:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue

        accumulated_sentence_lines: List[str] = []

        def flush_sentence():
            if accumulated_sentence_lines:
                merged = " ".join(accumulated_sentence_lines)
                clean_s = _clean_punctuation(merged)
                if clean_s:
                    cleaned_blocks.append(clean_s)
                accumulated_sentence_lines.clear()

        for line in lines:
            is_list_item = bool(re.match(r"^(\d+[\.\)]|[-*•–—])\s+", line))
            is_key_value = bool(re.match(r"^[A-Z][a-zA-Z\s]{1,20}:\s*.+", line))
            is_heading = bool(
                len(line) < 55 and (
                    line.isupper() or
                    line.endswith(":") or
                    line.startswith("#") or
                    re.match(r"^(Section|Chapter|Article|Note)\s+\d+", line, re.IGNORECASE)
                )
            )

            if is_list_item or is_key_value or is_heading:
                flush_sentence()
                cleaned_blocks.append(_clean_punctuation(line))
                continue

            # Standard prose line
            if accumulated_sentence_lines:
                prev = accumulated_sentence_lines[-1]
                if re.search(r"[\.!\?]\s*$", prev) and re.match(r"^[A-Z0-9]", line):
                    flush_sentence()
                    accumulated_sentence_lines.append(line)
                else:
                    accumulated_sentence_lines.append(line)
            else:
                accumulated_sentence_lines.append(line)

        flush_sentence()

    # Second pass: check if consecutive blocks were split only due to wide image line spacing
    merged_blocks: List[str] = []
    for b in cleaned_blocks:
        if merged_blocks and _should_merge_blocks(merged_blocks[-1], b):
            merged_blocks[-1] = merged_blocks[-1] + " " + b
        else:
            merged_blocks.append(b)

    # Final pass: Capitalize first letters of sentences and clean punctuation
    final_paragraphs = [_clean_and_capitalize_sentence(b) for b in merged_blocks if b.strip()]
    return "\n\n".join(final_paragraphs)


def _clean_punctuation(text: str) -> str:
    """Fix common OCR punctuation spacing glitches."""
    # Remove unwanted spaces before punctuation: "word , another" -> "word, another"
    text = re.sub(r"([a-zA-Z0-9])\s+([,.:;?!])", r"\1\2", text)

    # Ensure space after punctuation (excluding decimal numbers like 3.14 or times like 10:30)
    text = re.sub(r"([,;?!])([a-zA-Z])", r"\1 \2", text)
    text = re.sub(r"(\.)([A-Z])", r"\1 \2", text)

    # Clean spaces around quotes and parentheses
    text = re.sub(r"\(\s+", "(", text)
    text = re.sub(r"\s+\)", ")", text)
    text = re.sub(r"\[\s+", "[", text)
    text = re.sub(r"\s+\]", "]", text)

    # Clean multiple spaces
    text = re.sub(r"[ \t]+", " ", text).strip()
    return text


def _clean_and_capitalize_sentence(text: str) -> str:
    """Cleans punctuation and capitalizes first letters of sentences."""
    cleaned = _clean_punctuation(text)
    if not cleaned:
        return ""

    # Capitalize first letter if lowercase (unless list bullet or code)
    if len(cleaned) > 0 and cleaned[0].islower() and not re.match(r"^[-*•–—]", cleaned):
        cleaned = cleaned[0].upper() + cleaned[1:]

    # Capitalize letters following sentence terminators (. ! ?)
    def capitalize_match(match):
        punct = match.group(1)
        space = match.group(2)
        char = match.group(3)
        return f"{punct}{space}{char.upper()}"

    cleaned = re.sub(r"([\.!\?])(\s+)([a-z])", capitalize_match, cleaned)
    return cleaned
