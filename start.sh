#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=================================================="
echo "    Starting Bulk OCR Studio (100% Offline)       "
echo "=================================================="

# Check for Tesseract executable
if command -v tesseract >/dev/null 2>&1; then
    echo "✓ Tesseract OCR detected: $(tesseract --version 2>&1 | head -n 1)"
elif [ -f "/opt/homebrew/bin/tesseract" ]; then
    echo "✓ Tesseract OCR detected at /opt/homebrew/bin/tesseract"
elif [ -f "/usr/local/bin/tesseract" ]; then
    echo "✓ Tesseract OCR detected at /usr/local/bin/tesseract"
else
    echo "⚠️ Warning: Tesseract executable not detected in standard PATH."
    echo "   On macOS: run 'brew install tesseract'"
    echo "   On Ubuntu/Debian: run 'sudo apt install tesseract-ocr'"
fi

# 1. Setup Backend Python Virtual Environment
if [ ! -d "backend/venv" ]; then
    echo "Creating Python virtual environment in backend/venv..."
    python3 -m venv backend/venv
    ./backend/venv/bin/pip install --upgrade pip
    ./backend/venv/bin/pip install -r backend/requirements.txt
fi

# Ensure output directory exists
mkdir -p output

# 2. Setup Frontend dependencies if needed
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd frontend && npm install)
fi

echo "Starting Backend API on http://127.0.0.1:8000..."
./backend/venv/bin/uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "Starting Frontend UI on http://localhost:5173..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

cleanup() {
    echo ""
    echo "Stopping Bulk OCR services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo "=================================================="
echo "  🚀 App running at: http://localhost:5173        "
echo "  📡 API running at: http://127.0.0.1:8000        "
echo "  📂 Output folder:  $DIR/output                  "
echo "=================================================="
echo "Press Ctrl+C to terminate both servers."

wait
