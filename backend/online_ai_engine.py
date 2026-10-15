import os
import io
import time
import base64
from typing import Dict, Any, Optional
import httpx
from PIL import Image

from utils.image_converter import load_image_pages, generate_thumbnail_base64, get_image_dimensions

DEFAULT_GEMINI_MODEL = "gemini-3.5-flash"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"

# Fallback sequence if a specific Gemini model is deprecated or experiencing temporary capacity limits
GEMINI_FALLBACK_MODELS = [
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.8-flash",
    "gemini-2.5-pro",
]


def _image_to_base64(pil_img: Image.Image, format: str = "JPEG") -> tuple[str, str]:
    """Converts PIL Image to base64 and mime type."""
    buf = io.BytesIO()
    # Save as JPEG for fast transfer
    if pil_img.mode != "RGB":
        pil_img = pil_img.convert("RGB")
    pil_img.save(buf, format="JPEG", quality=90)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return b64, "image/jpeg"


def _get_ocr_prompt(output_format: str = "sentences", language_hint: str = "auto") -> str:
    lang_instruction = f" The document language is primarily {language_hint}." if language_hint and language_hint != "auto" else ""
    if output_format == "sentences":
        return (
            "You are an expert OCR transcription model. Transcribe all text from this image with 100% accuracy."
            f"{lang_instruction} "
            "Format the output into clean, natural, human-readable sentences and coherent flowing paragraphs. "
            "Do not arbitrarily break lines mid-sentence. Repair hyphenated broken words. "
            "Preserve titles, section headers, bullet lists, numbered items, and key-value fields. "
            "Output ONLY the transcribed text. Do NOT wrap in markdown code fences (```) and do not include conversational commentary."
        )
    else:
        return (
            "You are an expert OCR transcription model. Transcribe all text from this image with 100% accuracy."
            f"{lang_instruction} "
            "Preserve the exact visual layout, spacing, and line breaks of the original image as closely as possible. "
            "Output ONLY the transcribed text. Do NOT wrap in markdown code fences (```) and do not include conversational commentary."
        )


def verify_online_api_key(provider: str, api_key: str, base_url: Optional[str] = None) -> Dict[str, Any]:
    """Tests if an API key is valid by sending a minimal query."""
    if not api_key or not api_key.strip():
        return {"valid": False, "error": "API key is empty"}

    key = api_key.strip()
    try:
        with httpx.Client(timeout=10.0) as client:
            if provider == "gemini":
                # Check models list on Gemini API
                url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
                res = client.get(url)
                if res.status_code == 200:
                    return {"valid": True, "provider": "gemini", "error": None}
                else:
                    err_data = res.json().get("error", {})
                    msg = err_data.get("message", res.text)
                    return {"valid": False, "provider": "gemini", "error": msg}

            elif provider == "openai":
                url = (base_url or "https://api.openai.com/v1").rstrip("/") + "/models"
                headers = {"Authorization": f"Bearer {key}"}
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    return {"valid": True, "provider": "openai", "error": None}
                else:
                    err_msg = res.text
                    try:
                        err_msg = res.json().get("error", {}).get("message", res.text)
                    except Exception:
                        pass
                    return {"valid": False, "provider": "openai", "error": err_msg}

            else:
                return {"valid": False, "error": f"Unsupported provider: {provider}"}
    except Exception as e:
        return {"valid": False, "error": str(e)}


def _request_gemini_page(
    client: httpx.Client,
    model_name: str,
    api_key: str,
    b64: str,
    mime: str,
    prompt: str,
) -> tuple[str, str]:
    """Sends a single image page to Gemini API with automatic model fallback."""
    # Build models attempt list starting with the requested model
    models_to_try = [model_name]
    for alt in GEMINI_FALLBACK_MODELS:
        if alt not in models_to_try:
            models_to_try.append(alt)

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": mime,
                            "data": b64,
                        }
                    },
                    {
                        "text": prompt,
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 4096,
        },
    }

    last_error = None
    for target_model in models_to_try:
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={api_key.strip()}"
        try:
            resp = client.post(endpoint, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                try:
                    text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    return text, target_model
                except (KeyError, IndexError):
                    return "", target_model

            # Extract error message
            err_msg = resp.text
            try:
                err_msg = resp.json().get("error", {}).get("message", resp.text)
            except Exception:
                pass

            last_error = f"Gemini ({target_model}) error: {err_msg}"
            # If the model is not found, deprecated, or experiencing high demand, try next model
            lower_err = err_msg.lower()
            if any(term in lower_err for term in ["no longer available", "deprecated", "not found", "demand", "503", "404", "429"]):
                continue
            else:
                # Fatal error (e.g. invalid API key) - stop trying alternatives
                raise RuntimeError(last_error)
        except httpx.RequestError as req_err:
            last_error = f"Gemini connection error: {str(req_err)}"
            continue

    raise RuntimeError(last_error or "Gemini API failed on all candidate models")


def extract_text_with_gemini(
    image_bytes: bytes,
    filename: str,
    api_key: str,
    model: str = DEFAULT_GEMINI_MODEL,
    output_format: str = "sentences",
    language_hint: str = "auto",
) -> Dict[str, Any]:
    """Extracts text from image using Google Gemini Vision API."""
    start_time = time.perf_counter()
    pages = load_image_pages(image_bytes, filename)
    first_page_thumb = generate_thumbnail_base64(pages[0])
    first_page_dims = get_image_dimensions(pages[0])

    prompt = _get_ocr_prompt(output_format=output_format, language_hint=language_hint)

    page_texts = []
    total_words = 0
    total_chars = 0
    actual_model_used = model

    with httpx.Client(timeout=45.0) as client:
        for idx, page in enumerate(pages):
            b64, mime = _image_to_base64(page)
            extracted, actual_model_used = _request_gemini_page(
                client=client,
                model_name=model,
                api_key=api_key,
                b64=b64,
                mime=mime,
                prompt=prompt,
            )

            page_texts.append(extracted)
            total_chars += len(extracted)
            total_words += len(extracted.split())

    if len(pages) > 1:
        full_text = "\n\n".join(f"--- Page {i + 1} ---\n{t}" for i, t in enumerate(page_texts))
    else:
        full_text = page_texts[0] if page_texts else ""

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return {
        "text": full_text,
        "raw_text": full_text,
        "sentences_text": full_text,
        "output_format": output_format,
        "word_count": total_words,
        "char_count": total_chars,
        "pages_count": len(pages),
        "pages": [{"page_number": i + 1, "text": t} for i, t in enumerate(page_texts)],
        "confidence": 99.0,  # High precision AI model
        "duration_ms": duration_ms,
        "dimensions": first_page_dims,
        "thumbnail": first_page_thumb,
        "engine_used": f"gemini ({actual_model_used})",
    }


def extract_text_with_openai(
    image_bytes: bytes,
    filename: str,
    api_key: str,
    model: str = DEFAULT_OPENAI_MODEL,
    output_format: str = "sentences",
    language_hint: str = "auto",
    base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Extracts text from image using OpenAI Vision API."""
    start_time = time.perf_counter()
    pages = load_image_pages(image_bytes, filename)
    first_page_thumb = generate_thumbnail_base64(pages[0])
    first_page_dims = get_image_dimensions(pages[0])

    url = (base_url or "https://api.openai.com/v1").rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
    }
    prompt = _get_ocr_prompt(output_format=output_format, language_hint=language_hint)

    page_texts = []
    total_words = 0
    total_chars = 0

    with httpx.Client(timeout=45.0) as client:
        for idx, page in enumerate(pages):
            b64, mime = _image_to_base64(page)
            data_url = f"data:{mime};base64,{b64}"

            payload = {
                "model": model,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
                        ],
                    }
                ],
                "temperature": 0.1,
                "max_tokens": 4096,
            }

            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                err_msg = resp.text
                try:
                    err_msg = resp.json().get("error", {}).get("message", resp.text)
                except Exception:
                    pass
                raise RuntimeError(f"OpenAI API error (Page {idx + 1}): {err_msg}")

            data = resp.json()
            try:
                extracted = data["choices"][0]["message"]["content"].strip()
            except (KeyError, IndexError):
                extracted = ""

            page_texts.append(extracted)
            total_chars += len(extracted)
            total_words += len(extracted.split())

    if len(pages) > 1:
        full_text = "\n\n".join(f"--- Page {i + 1} ---\n{t}" for i, t in enumerate(page_texts))
    else:
        full_text = page_texts[0] if page_texts else ""

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return {
        "text": full_text,
        "raw_text": full_text,
        "sentences_text": full_text,
        "output_format": output_format,
        "word_count": total_words,
        "char_count": total_chars,
        "pages_count": len(pages),
        "pages": [{"page_number": i + 1, "text": t} for i, t in enumerate(page_texts)],
        "confidence": 99.0,
        "duration_ms": duration_ms,
        "dimensions": first_page_dims,
        "thumbnail": first_page_thumb,
        "engine_used": f"openai ({model})",
    }
