import os
import shutil
import time
from typing import Dict, Any, List, Optional
import pytesseract
from pytesseract import Output
from PIL import Image

from utils.image_converter import (
    load_image_pages,
    apply_preprocessing,
    generate_thumbnail_base64,
    get_image_dimensions,
)
from utils.text_processor import format_as_human_readable_sentences

# Potential system paths for tesseract binary on macOS and Linux
COMMON_TESSERACT_PATHS = [
    "/opt/homebrew/bin/tesseract",
    "/usr/local/bin/tesseract",
    "/usr/bin/tesseract",
]


def setup_tesseract():
    """Detect and set up pytesseract executable path and tessdata directory."""
    # Check if bundled tessdata directory exists
    local_tessdata = os.path.join(os.path.dirname(__file__), "tessdata")
    if os.path.exists(local_tessdata) and os.path.isdir(local_tessdata):
        os.environ["TESSDATA_PREFIX"] = local_tessdata
    elif os.path.exists("/opt/homebrew/share/tessdata"):
        os.environ["TESSDATA_PREFIX"] = "/opt/homebrew/share/tessdata"

    # Check if already in PATH
    which_path = shutil.which("tesseract")
    if which_path:
        pytesseract.pytesseract.tesseract_cmd = which_path
        return which_path

    # Check common paths
    for p in COMMON_TESSERACT_PATHS:
        if os.path.exists(p) and os.access(p, os.X_OK):
            pytesseract.pytesseract.tesseract_cmd = p
            return p

    return "tesseract"


# Initialize tesseract path on module load
ACTIVE_TESSERACT_CMD = setup_tesseract()


def get_ocr_engine_info() -> Dict[str, Any]:
    """Retrieve Tesseract status, version, and installed languages."""
    setup_tesseract()
    try:
        ver = str(pytesseract.get_tesseract_version())
        try:
            langs = pytesseract.get_languages()
            if not langs:
                langs = ["eng"]
        except Exception:
            langs = ["eng"]

        return {
            "available": True,
            "version": ver,
            "executable": pytesseract.pytesseract.tesseract_cmd,
            "languages": sorted(langs),
            "error": None,
        }
    except Exception as e:
        return {
            "available": False,
            "version": None,
            "executable": pytesseract.pytesseract.tesseract_cmd,
            "languages": ["eng"],
            "error": str(e),
        }


def extract_text_from_image(
    image_bytes: bytes,
    filename: str,
    language: str = "eng",
    preprocess_mode: str = "auto",
    enhance_contrast: bool = True,
    auto_rotate: bool = False,
    psm: int = 3,
    output_format: str = "visual",
) -> Dict[str, Any]:
    """
    Decodes an image, applies requested preprocessing to each frame/page,
    and runs Tesseract OCR to extract digital text.
    output_format options:
      - 'visual': Preserves original image line breaks and layout
      - 'sentences': Formats into natural, human-readable flowing sentences
    """
    start_time = time.perf_counter()

    # 1. Parse and decode image frames (handles HEIC, multi-page TIFFs, etc.)
    pages = load_image_pages(image_bytes, filename)
    total_pages = len(pages)

    extracted_pages: List[Dict[str, Any]] = []
    full_text_parts: List[str] = []
    total_words = 0
    total_chars = 0
    confidences: List[float] = []

    # Prepare first page thumbnail for UI preview
    first_page_thumb = generate_thumbnail_base64(pages[0])
    first_page_dims = get_image_dimensions(pages[0])

    # Tesseract configuration string
    # PSM 3: Fully automatic page segmentation, but no OSD (default)
    # PSM 6: Assume a single uniform block of text
    # PSM 1: Automatic page segmentation with OSD
    custom_config = f"--psm {psm}"

    for idx, raw_page in enumerate(pages):
        # 2. Pre-process image frame
        processed_page = apply_preprocessing(
            raw_page,
            mode=preprocess_mode,
            enhance_contrast=enhance_contrast,
            auto_rotate=auto_rotate,
        )

        # 3. Perform OCR
        try:
            # Extract detailed data including confidence scores
            ocr_data = pytesseract.image_to_data(
                processed_page,
                lang=language,
                config=custom_config,
                output_type=Output.DICT,
            )

            # Collect recognized words and valid confidences
            page_words: List[str] = []
            for i, conf in enumerate(ocr_data.get("conf", [])):
                try:
                    c = float(conf)
                    # Filter out -1 (blank/non-word blocks)
                    if c >= 0:
                        confidences.append(c)
                        word = str(ocr_data["text"][i]).strip()
                        if word:
                            page_words.append(word)
                except (ValueError, TypeError):
                    pass

            # Also get raw formatted string
            page_text = pytesseract.image_to_string(
                processed_page,
                lang=language,
                config=custom_config,
            ).strip()

        except Exception as e:
            # Fallback to plain string extraction if detailed dict fails
            try:
                page_text = pytesseract.image_to_string(
                    processed_page,
                    lang=language,
                    config=custom_config,
                ).strip()
            except Exception as inner_e:
                raise RuntimeError(f"OCR execution failed on page {idx + 1}: {str(inner_e)}")

        page_char_count = len(page_text)
        page_word_count = len(page_text.split()) if page_text else 0

        total_chars += page_char_count
        total_words += page_word_count

        extracted_pages.append({
            "page_number": idx + 1,
            "text": page_text,
            "sentences_text": format_as_human_readable_sentences(page_text),
            "word_count": page_word_count,
            "char_count": page_char_count,
        })

        if total_pages > 1:
            full_text_parts.append(f"--- Page {idx + 1} ---\n{page_text}")
        else:
            full_text_parts.append(page_text)

    combined_text = "\n\n".join(full_text_parts)
    sentences_text = format_as_human_readable_sentences(combined_text)

    # Determine primary text based on output_format preference
    active_text = sentences_text if output_format == "sentences" else combined_text
    words_list = active_text.split() if active_text else []
    char_count = len(active_text)
    word_count = len(words_list)

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
    avg_confidence = round(float(sum(confidences) / len(confidences)), 1) if confidences else 0.0

    return {
        "text": active_text,
        "raw_text": combined_text,
        "sentences_text": sentences_text,
        "output_format": output_format,
        "word_count": word_count,
        "char_count": char_count,
        "pages_count": total_pages,
        "pages": extracted_pages,
        "confidence": avg_confidence,
        "duration_ms": duration_ms,
        "dimensions": first_page_dims,
        "thumbnail": first_page_thumb,
    }
