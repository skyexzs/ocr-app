import os
import io
import re
import sys
import time
import uuid
import json
import zipfile
import asyncio
import subprocess
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response, JSONResponse
from pydantic import BaseModel

from ocr_engine import extract_text_from_image, get_ocr_engine_info
from utils.image_converter import is_supported_image, SUPPORTED_EXTENSIONS
from online_ai_engine import (
    extract_text_with_gemini,
    extract_text_with_openai,
    verify_online_api_key,
    DEFAULT_GEMINI_MODEL,
    DEFAULT_OPENAI_MODEL,
)

# Root project paths
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "output"
DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Bulk OCR Engine",
    description="Offline Batch Image-to-Text OCR with FastAPI, Tesseract & Pillow",
    version="1.0.0",
)

# Enable CORS for local Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Thread pool for CPU-bound OCR execution (adjust according to system CPU count)
CPU_WORKERS = max(2, min(8, (os.cpu_count() or 4)))
ocr_executor = ThreadPoolExecutor(max_workers=CPU_WORKERS, thread_name_prefix="ocr-worker")

# In-memory storage for active batches and jobs
# Key: batch_id -> BatchData
batches_db: Dict[str, Dict[str, Any]] = {}
# Listeners for SSE per batch: batch_id -> list of asyncio.Queue
batch_event_listeners: Dict[str, List[asyncio.Queue]] = {}

# System configuration state
system_config = {
    "output_dir": str(DEFAULT_OUTPUT_DIR.resolve()),
}


class BatchSettings(BaseModel):
    output_dir: Optional[str] = None
    language: str = "eng"
    preprocess_mode: str = "auto"
    enhance_contrast: bool = True
    auto_rotate: bool = False
    psm: int = 3
    output_format: str = "visual"
    engine_type: str = "tesseract"
    online_api_key: Optional[str] = None
    online_model: Optional[str] = None
    online_base_url: Optional[str] = None
    fallback_to_offline: bool = True


def sanitize_relative_path(rel_path: str, fallback_filename: str) -> Path:
    """Sanitize relative path to prevent directory traversal outside output dir."""
    if not rel_path or rel_path.strip() == "":
        rel_path = fallback_filename
    # Clean leading slashes and normpath
    cleaned = os.path.normpath(rel_path.lstrip("/\\"))
    if cleaned.startswith("..") or "/../" in cleaned or "\\..\\" in cleaned:
        cleaned = os.path.basename(fallback_filename)
    return Path(cleaned)


async def broadcast_batch_event(batch_id: str, event_type: str, data: Dict[str, Any]):
    """Send real-time updates to all SSE subscribers of this batch."""
    if batch_id in batch_event_listeners:
        msg = {
            "event": event_type,
            "data": data,
            "timestamp": time.time(),
        }
        for q in list(batch_event_listeners[batch_id]):
            try:
                await q.put(msg)
            except Exception:
                pass


def calculate_batch_stats(batch: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate progress percentage and estimated time remaining."""
    items = batch.get("items", {})
    total = len(items)
    completed = 0
    failed = 0
    processing = 0
    queued = 0
    total_duration_sec = 0.0

    for item in items.values():
        st = item["status"]
        if st == "completed":
            completed += 1
            total_duration_sec += (item.get("duration_ms", 0) / 1000.0)
        elif st == "failed":
            failed += 1
        elif st == "processing":
            processing += 1
        elif st == "queued":
            queued += 1

    done_count = completed + failed
    percentage = round((done_count / total * 100), 1) if total > 0 else 0.0

    # Calculate ETA based on average duration of completed items
    avg_per_item = (total_duration_sec / completed) if completed > 0 else 0.0
    remaining_items = total - done_count
    # Factor concurrency in ETA estimate
    eta_seconds = round((avg_per_item * remaining_items) / max(1, CPU_WORKERS / 2), 1) if remaining_items > 0 else 0.0

    return {
        "total": total,
        "completed": completed,
        "failed": failed,
        "processing": processing,
        "queued": queued,
        "percentage": percentage,
        "eta_seconds": eta_seconds,
    }


def save_text_file(output_folder: Path, relative_file_path: Path, text: str) -> Path:
    """Saves extracted text to local disk, changing extension to .txt."""
    stem = relative_file_path.stem
    parent_rel = relative_file_path.parent
    target_dir = output_folder / parent_rel
    target_dir.mkdir(parents=True, exist_ok=True)

    target_file = target_dir / f"{stem}.txt"
    # Write utf-8 encoded text
    with open(target_file, "w", encoding="utf-8") as f:
        f.write(text)
    return target_file


def process_single_item_sync(
    batch_id: str,
    item_id: str,
    image_bytes: bytes,
    filename: str,
    relative_path_str: str,
    options: Dict[str, Any],
    output_dir_path: Path,
) -> Dict[str, Any]:
    """Worker function executed inside ThreadPoolExecutor for OCR extraction."""
    start_time = time.perf_counter()
    engine_type = options.get("engine_type", "tesseract")
    fallback_to_offline = options.get("fallback_to_offline", True)
    online_key = (options.get("online_api_key") or "").strip()
    online_model = options.get("online_model")
    online_base_url = options.get("online_base_url")
    output_format = options.get("output_format", "visual")

    ocr_result = None
    engine_used = "tesseract (offline)"

    try:
        # Check if online engine is requested and API key is provided or found in env
        if engine_type == "gemini":
            effective_key = online_key or os.getenv("GEMINI_API_KEY", "")
            if not effective_key:
                if not fallback_to_offline:
                    raise ValueError("Gemini API key is missing and offline fallback is disabled.")
            else:
                try:
                    ocr_result = extract_text_with_gemini(
                        image_bytes=image_bytes,
                        filename=filename,
                        api_key=effective_key,
                        model=online_model or DEFAULT_GEMINI_MODEL,
                        output_format=output_format,
                        language_hint=options.get("language", "auto"),
                    )
                    engine_used = ocr_result.get("engine_used", "gemini")
                except Exception as online_err:
                    if not fallback_to_offline:
                        raise online_err
                    ocr_result = None

        elif engine_type == "openai":
            effective_key = online_key or os.getenv("OPENAI_API_KEY", "")
            if not effective_key:
                if not fallback_to_offline:
                    raise ValueError("OpenAI API key is missing and offline fallback is disabled.")
            else:
                try:
                    ocr_result = extract_text_with_openai(
                        image_bytes=image_bytes,
                        filename=filename,
                        api_key=effective_key,
                        model=online_model or DEFAULT_OPENAI_MODEL,
                        output_format=output_format,
                        language_hint=options.get("language", "auto"),
                        base_url=online_base_url,
                    )
                    engine_used = ocr_result.get("engine_used", "openai")
                except Exception as online_err:
                    if not fallback_to_offline:
                        raise online_err
                    ocr_result = None

        # Fallback or default to local Tesseract OCR engine (100% offline)
        if ocr_result is None:
            ocr_result = extract_text_from_image(
                image_bytes=image_bytes,
                filename=filename,
                language=options.get("language", "eng"),
                preprocess_mode=options.get("preprocess_mode", "auto"),
                enhance_contrast=options.get("enhance_contrast", True),
                auto_rotate=options.get("auto_rotate", False),
                psm=options.get("psm", 3),
                output_format=output_format,
            )
            if engine_type in ("gemini", "openai"):
                engine_used = "tesseract (offline fallback)"
            else:
                engine_used = "tesseract (offline)"

        # Save to local text file (uses active formatted text)
        rel_path = sanitize_relative_path(relative_path_str, filename)
        saved_path = save_text_file(
            output_folder=output_dir_path,
            relative_file_path=rel_path,
            text=ocr_result["text"],
        )

        return {
            "status": "completed",
            "text": ocr_result["text"],
            "raw_text": ocr_result.get("raw_text", ocr_result["text"]),
            "sentences_text": ocr_result.get("sentences_text", ocr_result["text"]),
            "output_format": ocr_result.get("output_format", output_format),
            "engine_used": engine_used,
            "word_count": ocr_result["word_count"],
            "char_count": ocr_result["char_count"],
            "pages_count": ocr_result["pages_count"],
            "pages": ocr_result["pages"],
            "confidence": ocr_result["confidence"],
            "duration_ms": ocr_result["duration_ms"],
            "saved_file_path": str(saved_path.resolve()),
            "saved_relative_path": str(saved_path.relative_to(output_dir_path)),
            "thumbnail": ocr_result["thumbnail"],
            "dimensions": ocr_result["dimensions"],
            "error": None,
        }
    except Exception as e:
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "status": "failed",
            "text": "",
            "word_count": 0,
            "char_count": 0,
            "pages_count": 0,
            "pages": [],
            "confidence": 0.0,
            "duration_ms": duration_ms,
            "saved_file_path": None,
            "saved_relative_path": None,
            "thumbnail": None,
            "dimensions": None,
            "error": str(e),
        }


async def run_batch_worker(batch_id: str):
    """Background asynchronous queue processor managing concurrent OCR items."""
    batch = batches_db.get(batch_id)
    if not batch:
        return

    batch["status"] = "processing"
    batch["started_at"] = time.time()
    await broadcast_batch_event(batch_id, "batch_started", {"batch_id": batch_id})

    items = batch["items"]
    options = batch["options"]
    output_dir_path = Path(batch["output_dir"])
    output_dir_path.mkdir(parents=True, exist_ok=True)

    loop = asyncio.get_running_loop()
    semaphore = asyncio.Semaphore(CPU_WORKERS)

    async def handle_item(item_id: str):
        item = items[item_id]
        item["status"] = "processing"
        await broadcast_batch_event(batch_id, "item_status", {
            "item_id": item_id,
            "status": "processing",
            "stats": calculate_batch_stats(batch),
        })

        async with semaphore:
            # Run in thread pool executor to not block async event loop
            result = await loop.run_in_executor(
                ocr_executor,
                process_single_item_sync,
                batch_id,
                item_id,
                item["image_bytes"],
                item["filename"],
                item["relative_path"],
                options,
                output_dir_path,
            )

        # Update item in db
        item.update(result)

        await broadcast_batch_event(batch_id, "item_status", {
            "item_id": item_id,
            "status": item["status"],
            "item": {k: v for k, v in item.items() if k != "image_bytes"},
            "stats": calculate_batch_stats(batch),
        })

    # Launch all item tasks concurrently
    tasks = [asyncio.create_task(handle_item(i_id)) for i_id in items.keys()]
    await asyncio.gather(*tasks, return_exceptions=True)

    batch["status"] = "completed"
    batch["completed_at"] = time.time()
    batch["duration_seconds"] = round(batch["completed_at"] - batch["started_at"], 2)

    await broadcast_batch_event(batch_id, "batch_completed", {
        "batch_id": batch_id,
        "stats": calculate_batch_stats(batch),
        "duration_seconds": batch["duration_seconds"],
    })


class VerifyKeyRequest(BaseModel):
    provider: str
    api_key: str
    base_url: Optional[str] = None


@app.get("/api/system/info")
def get_system_info():
    """Returns engine availability, languages, and configured paths."""
    engine_info = get_ocr_engine_info()
    out_dir = Path(system_config["output_dir"]).resolve()
    return {
        "ocr_engine": engine_info,
        "supported_extensions": sorted(list(SUPPORTED_EXTENSIONS)),
        "output_directory": str(out_dir),
        "output_exists": out_dir.exists(),
        "cpu_workers": CPU_WORKERS,
        "online_engines": [
            {
                "id": "tesseract",
                "name": "Tesseract OCR (100% Offline)",
                "type": "offline",
                "requires_key": False,
                "description": "Fast, fully private, runs locally without internet.",
                "default": True,
            },
            {
                "id": "gemini",
                "name": "Google Gemini Flash (AI Vision)",
                "type": "online",
                "requires_key": True,
                "default_model": DEFAULT_GEMINI_MODEL,
                "models": ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
                "has_env_key": bool(os.getenv("GEMINI_API_KEY")),
                "description": "High accuracy multimodal LLM. Outstanding for handwriting, complex layouts, and fluent sentence transcription.",
            },
            {
                "id": "openai",
                "name": "OpenAI Vision (GPT-4o)",
                "type": "online",
                "requires_key": True,
                "default_model": DEFAULT_OPENAI_MODEL,
                "models": ["gpt-4o-mini", "gpt-4o"],
                "has_env_key": bool(os.getenv("OPENAI_API_KEY")),
                "description": "Powerful OpenAI Vision model. Supports custom proxy / OpenAI-compatible base URLs.",
            },
        ],
    }


@app.post("/api/system/verify-key")
def api_verify_key(req: VerifyKeyRequest):
    """Validates an API key against provider endpoints."""
    return verify_online_api_key(
        provider=req.provider,
        api_key=req.api_key,
        base_url=req.base_url,
    )


@app.post("/api/system/output-folder")
def set_output_folder(data: Dict[str, str]):
    """Configure local output directory."""
    new_path = data.get("path")
    if not new_path:
        raise HTTPException(status_code=400, detail="Path must not be empty")

    p = Path(new_path).expanduser().resolve()
    try:
        p.mkdir(parents=True, exist_ok=True)
        system_config["output_dir"] = str(p)
        return {"success": True, "output_directory": str(p)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot use path: {str(e)}")


@app.post("/api/system/open-folder")
def open_system_folder(data: Optional[Dict[str, str]] = None):
    """Opens output folder in native OS file explorer (macOS Finder, Linux xdg-open, etc.)."""
    folder_path = (data and data.get("path")) or system_config["output_dir"]
    resolved = Path(folder_path).resolve()

    if not resolved.exists():
        resolved.mkdir(parents=True, exist_ok=True)

    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", str(resolved)])
        elif sys.platform == "win32":
            subprocess.Popen(["explorer", str(resolved)])
        else:
            subprocess.Popen(["xdg-open", str(resolved)])
        return {"success": True, "path": str(resolved)}
    except Exception as e:
        return {"success": False, "error": str(e), "path": str(resolved)}


@app.post("/api/batches")
async def create_batch(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    relative_paths: Optional[str] = Form(None),
    output_dir: Optional[str] = Form(None),
    language: str = Form("eng"),
    preprocess_mode: str = Form("auto"),
    enhance_contrast: bool = Form(True),
    auto_rotate: bool = Form(False),
    psm: int = Form(3),
    output_format: str = Form("visual"),
    engine_type: str = Form("tesseract"),
    online_api_key: Optional[str] = Form(None),
    online_model: Optional[str] = Form(None),
    online_base_url: Optional[str] = Form(None),
    fallback_to_offline: bool = Form(True),
):
    """
    Submits a batch of images for OCR extraction.
    Supports directory structure via relative_paths JSON string.
    output_format: 'visual' (preserve line breaks) or 'sentences' (human readable prose)
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    batch_id = str(uuid.uuid4())
    rel_map = {}
    if relative_paths:
        try:
            rel_map = json.loads(relative_paths)
        except Exception:
            rel_map = {}

    target_output_dir = output_dir or system_config["output_dir"]
    target_output_path = Path(target_output_dir).expanduser().resolve()
    target_output_path.mkdir(parents=True, exist_ok=True)

    items: Dict[str, Dict[str, Any]] = {}

    for f in files:
        filename = f.filename or "image.png"
        if not is_supported_image(filename):
            continue

        item_id = str(uuid.uuid4())
        content = await f.read()
        rel_path = rel_map.get(filename, filename)

        items[item_id] = {
            "id": item_id,
            "filename": filename,
            "relative_path": rel_path,
            "file_size": len(content),
            "status": "queued",
            "image_bytes": content,
            "text": "",
            "raw_text": "",
            "sentences_text": "",
            "output_format": output_format,
            "word_count": 0,
            "char_count": 0,
            "confidence": 0.0,
            "duration_ms": 0.0,
            "saved_file_path": None,
            "thumbnail": None,
            "error": None,
        }

    if not items:
        raise HTTPException(
            status_code=400,
            detail=f"None of the uploaded files match supported formats: {', '.join(SUPPORTED_EXTENSIONS)}",
        )

    batch_data = {
        "id": batch_id,
        "status": "queued",
        "output_dir": str(target_output_path),
        "options": {
            "language": language,
            "preprocess_mode": preprocess_mode,
            "enhance_contrast": enhance_contrast,
            "auto_rotate": auto_rotate,
            "psm": psm,
            "output_format": output_format,
            "engine_type": engine_type,
            "online_api_key": online_api_key,
            "online_model": online_model,
            "online_base_url": online_base_url,
            "fallback_to_offline": fallback_to_offline,
        },
        "items": items,
        "created_at": time.time(),
        "started_at": None,
        "completed_at": None,
    }

    batches_db[batch_id] = batch_data

    # Launch background worker
    background_tasks.add_task(run_batch_worker, batch_id)

    # Return initial summary
    return {
        "batch_id": batch_id,
        "total_files": len(items),
        "status": "queued",
        "output_dir": str(target_output_path),
        "stats": calculate_batch_stats(batch_data),
    }


@app.get("/api/batches/{batch_id}")
def get_batch_details(batch_id: str):
    """Retrieve full batch status and items list (excluding raw byte arrays)."""
    batch = batches_db.get(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    safe_items = []
    for item in batch["items"].values():
        safe_items.append({k: v for k, v in item.items() if k != "image_bytes"})

    return {
        "id": batch["id"],
        "status": batch["status"],
        "output_dir": batch["output_dir"],
        "options": batch["options"],
        "created_at": batch["created_at"],
        "started_at": batch["started_at"],
        "completed_at": batch["completed_at"],
        "stats": calculate_batch_stats(batch),
        "items": safe_items,
    }


@app.get("/api/batches/{batch_id}/events")
async def batch_events_sse(batch_id: str):
    """
    Server-Sent Events endpoint streaming real-time batch progress
    and file completion notifications.
    """
    if batch_id not in batches_db:
        raise HTTPException(status_code=404, detail="Batch not found")

    queue = asyncio.Queue()
    if batch_id not in batch_event_listeners:
        batch_event_listeners[batch_id] = []
    batch_event_listeners[batch_id].append(queue)

    async def event_generator():
        # First send immediate snapshot
        batch = batches_db.get(batch_id)
        if batch:
            yield f"event: snapshot\ndata: {json.dumps({'stats': calculate_batch_stats(batch), 'status': batch['status']})}\n\n"

        try:
            while True:
                try:
                    # Wait for next event with a 15-second heartbeat timeout
                    msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"event: {msg['event']}\ndata: {json.dumps(msg['data'])}\n\n"
                    # If batch is completed and queue is empty, finish
                    if msg['event'] == 'batch_completed' and queue.empty():
                        break
                except asyncio.TimeoutError:
                    # Send comment heartbeat to keep HTTP stream active
                    yield ": keep-alive\n\n"
        finally:
            if batch_id in batch_event_listeners and queue in batch_event_listeners[batch_id]:
                batch_event_listeners[batch_id].remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/batches/{batch_id}/items/{item_id}/image")
def get_item_image(batch_id: str, item_id: str):
    """Returns the original image bytes for side-by-side inspection."""
    batch = batches_db.get(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    item = batch["items"].get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Detect mime type from filename
    ext = os.path.splitext(item["filename"])[1].lower()
    mime_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".tiff": "image/tiff",
        ".tif": "image/tiff",
        ".heic": "image/heic",
        ".heif": "image/heif",
    }
    media_type = mime_map.get(ext, "application/octet-stream")

    return Response(
        content=item["image_bytes"],
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.post("/api/batches/{batch_id}/items/{item_id}/rerun")
async def rerun_single_item(
    batch_id: str,
    item_id: str,
    preprocess_mode: Optional[str] = None,
    language: Optional[str] = None,
    output_format: Optional[str] = None,
    engine_type: Optional[str] = None,
    online_api_key: Optional[str] = None,
    online_model: Optional[str] = None,
    fallback_to_offline: Optional[bool] = None,
):
    """Re-runs OCR on an existing item with updated or existing settings."""
    batch = batches_db.get(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    item = batch["items"].get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    options = dict(batch["options"])
    if preprocess_mode:
        options["preprocess_mode"] = preprocess_mode
    if language:
        options["language"] = language
    if output_format:
        options["output_format"] = output_format
    if engine_type:
        options["engine_type"] = engine_type
    if online_api_key is not None:
        options["online_api_key"] = online_api_key
    if online_model is not None:
        options["online_model"] = online_model
    if fallback_to_offline is not None:
        options["fallback_to_offline"] = fallback_to_offline

    item["status"] = "processing"
    await broadcast_batch_event(batch_id, "item_status", {
        "item_id": item_id,
        "status": "processing",
        "stats": calculate_batch_stats(batch),
    })

    loop = asyncio.get_running_loop()
    output_dir_path = Path(batch["output_dir"])

    result = await loop.run_in_executor(
        ocr_executor,
        process_single_item_sync,
        batch_id,
        item_id,
        item["image_bytes"],
        item["filename"],
        item["relative_path"],
        options,
        output_dir_path,
    )

    item.update(result)

    await broadcast_batch_event(batch_id, "item_status", {
        "item_id": item_id,
        "status": item["status"],
        "item": {k: v for k, v in item.items() if k != "image_bytes"},
        "stats": calculate_batch_stats(batch),
    })

    return {"success": True, "item": {k: v for k, v in item.items() if k != "image_bytes"}}


@app.get("/api/batches/{batch_id}/export/zip")
def export_batch_zip(batch_id: str):
    """Generates an in-memory ZIP archive of all generated .txt files."""
    batch = batches_db.get(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for item in batch["items"].values():
            if item.get("status") == "completed" and item.get("text"):
                # Use sanitized relative path stem + .txt
                rel_p = sanitize_relative_path(item.get("relative_path", item["filename"]), item["filename"])
                zip_entry_path = str(rel_p.parent / f"{rel_p.stem}.txt")
                if zip_entry_path.startswith("./"):
                    zip_entry_path = zip_entry_path[2:]
                zf.writestr(zip_entry_path, item["text"].encode("utf-8"))

    zip_buffer.seek(0)
    filename = f"ocr_results_{batch_id[:8]}.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/samples")
def list_demo_samples():
    """List sample test images available in sample_images directory."""
    samples_dir = PROJECT_ROOT / "sample_images"
    if not samples_dir.exists():
        return {"samples": []}

    results = []
    for p in samples_dir.rglob("*"):
        if p.is_file() and is_supported_image(p.name):
            rel = str(p.relative_to(samples_dir))
            results.append({
                "filename": p.name,
                "relative_path": rel,
                "size_bytes": p.stat().st_size,
                "url": f"/api/samples/file/{rel}",
            })
    return {"samples": results}


@app.get("/api/samples/file/{file_path:path}")
def get_sample_file(file_path: str):
    """Serve a sample image binary."""
    samples_dir = PROJECT_ROOT / "sample_images"
    target = (samples_dir / file_path).resolve()
    if not target.exists() or not str(target).startswith(str(samples_dir.resolve())):
        raise HTTPException(status_code=404, detail="Sample not found")

    ext = target.suffix.lower()
    mime_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".tiff": "image/tiff",
        ".tif": "image/tiff",
    }
    media_type = mime_map.get(ext, "application/octet-stream")
    with open(target, "rb") as f:
        data = f.read()
    return Response(content=data, media_type=media_type)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
