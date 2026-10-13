# Bulk OCR Studio 📄⚡

> High-performance, **100% offline** bulk OCR web application for batch extracting text from images into digital format and saving results locally.

![Bulk OCR Architecture](https://img.shields.io/badge/Security-100%25%20Offline%20%26%20Private-emerald?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-blue?style=flat-square)
![React](https://img.shields.io/badge/React%20%2B%20Vite-Frontend-61dafb?style=flat-square)
![Tesseract](https://img.shields.io/badge/Tesseract%20OCR-5.5+-orange?style=flat-square)

---

## Key Features

- 🔒 **100% Offline & Private**: Zero cloud transmission. All image decoding and OCR extraction runs entirely on your local machine.
- ⚡ **Concurrent Batch Processing**: Non-blocking background worker pool (`ThreadPoolExecutor`) capable of processing large batches (100+ images) smoothly without freezing the UI.
- 📁 **Folder & Multi-File Upload**:
  - Drag-and-drop zone supporting multiple images.
  - "Upload Files" standard picker.
  - "Upload Folder" picker (via HTML5 `webkitdirectory`) to process entire nested directory trees, preserving subfolder paths in the output `.txt` files.
- 🖼️ **Exotic Formats & Multi-Page Support**:
  - Apple HEIC/HEIF via `pillow-heif`
  - Multi-page TIFF documents (extracts and numbers all pages)
  - PNG, JPG/JPEG, WEBP, BMP, TIFF
- 🛠️ **Automated Image Pre-Processing**:
  - OpenCV CLAHE contrast enhancement
  - Otsu binarization & Adaptive Gaussian thresholding for low-contrast/faded scans
  - Auto-orientation from EXIF tags and deskew rotation
- 📊 **Real-Time Progress Tracking**:
  - Server-Sent Events (SSE) streaming live per-file updates: `Queued` → `Processing` → `Completed` / `Failed`.
  - Live progress percentage and dynamic ETA calculation.
- 💾 **Local File Persistence & Export**:
  - Automatically generates `.txt` files in `./output` (e.g. `invoice.heic` → `invoice.txt`).
  - Configurable destination path with native OS "Open Folder" action.
  - One-click "Download All as ZIP" archive.
- ✍️ **Human-Readable Sentence Output (vs. Visual Layout)**:
  - Intelligently reconstructs natural, flowing sentences and paragraphs from fragmented image text.
  - Automatically joins line breaks split mid-sentence, repairs hyphenated words (`docu-\nment` → `document`), fixes punctuation spacing glitches, and capitalizes sentences.
  - Preserves titles, bullet lists, numbered sections, and metadata key-value rows.
  - Toggle between **Flowing Sentences** and **Image Layout** globally in the settings toolbar or live within the side-by-side inspection modal.
- 🔍 **Interactive Inspection Split-View**:
  - Click any document in the results table to view original image side-by-side with recognized text.
  - Zoom, pan, confidence score %, word & character counts, and real-time sentence/layout switcher.

---

## 1. System Prerequisites

### macOS
```bash
brew install tesseract
# Optional: install additional language packages (Indonesian 'ind' is already bundled in backend/tessdata)
# brew install tesseract-lang
```

### Ubuntu / Debian
```bash
sudo apt update
sudo apt install -y tesseract-ocr tesseract-ocr-eng tesseract-ocr-ind
```

### Windows
Download and install the official Windows installer from [UB-Mannheim Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki), and ensure `tesseract.exe` is added to your system `PATH`.

---

## 2. Quick Start (One-Line)

Run the included startup script from the project root:

```bash
./start.sh
```

This will automatically create the Python virtual environment, install requirements, configure frontend dependencies, and launch both servers:
- **Frontend UI**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Output Folder**: `./output`

---

## 3. Manual Step-by-Step Setup

### Backend Setup
```bash
# 1. Create and activate Python virtual environment
python3 -m venv backend/venv
source backend/venv/bin/activate

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Start FastAPI dev server
uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

### Frontend Setup
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install npm dependencies
npm install

# 3. Start Vite dev server
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser.

---

## 4. Project Directory Layout

```
ocr-app/
├── backend/
│   ├── main.py                  # FastAPI server, SSE stream, batch queue & endpoints
│   ├── ocr_engine.py            # Tesseract OCR engine, confidence scoring, multi-page loop
│   ├── utils/
│   │   ├── __init__.py
│   │   └── image_converter.py   # HEIC decoding, multi-page TIFF, OpenCV pre-processing
│   ├── create_sample_data.py    # Test data generator
│   ├── requirements.txt         # Python dependencies
│   └── venv/                    # Isolated Python virtual environment
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dropzone.jsx     # Drag-and-drop, multi-file & folder picker
│   │   │   ├── BatchProgress.jsx# Real-time progress bar & ETA timer
│   │   │   ├── BatchStats.jsx   # Queue statistics & speed cards
│   │   │   ├── ResultsTable.jsx # Inspection table with thumbnails, filters & actions
│   │   │   ├── ResultModal.jsx  # Split-view comparison modal (Image vs Text)
│   │   │   └── SettingsBar.jsx  # Local output folder & preprocessing options
│   │   ├── App.jsx              # Main orchestrator
│   │   ├── main.jsx             # React DOM entry
│   │   └── index.css            # Tailwind & custom glassmorphism styles
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js           # Vite config with backend proxy
├── output/                      # Default local destination for extracted .txt files
├── sample_images/               # Bundled sample images for 1-click testing
├── start.sh                     # One-line concurrent startup script
└── README.md
```

---

## 5. API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/system/info` | Engine availability, Tesseract version, workers, languages |
| `POST` | `/api/system/output-folder` | Updates default local text file output directory |
| `POST` | `/api/system/open-folder` | Opens output directory in native OS file explorer (Finder/Explorer) |
| `GET` | `/api/samples` | Lists bundled test images for quick demo |
| `POST` | `/api/batches` | Creates new batch queue (multipart form with files & options) |
| `GET` | `/api/batches/{id}` | Fetches current batch status and document item records |
| `GET` | `/api/batches/{id}/events` | Server-Sent Events (SSE) real-time event stream |
| `GET` | `/api/batches/{id}/items/{item_id}/image` | Returns original image for side-by-side inspection |
| `POST` | `/api/batches/{id}/items/{item_id}/rerun` | Re-executes OCR on a specific image with options |
| `GET` | `/api/batches/{id}/export/zip` | Downloads all batch `.txt` files as a ZIP archive |
