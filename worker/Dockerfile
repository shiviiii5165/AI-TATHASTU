# AI Tathastu worker: resume extraction, connector sync, compute_intelligence.
# Runs as a Render Web Service (free tier): server.py answers /health on
# $PORT and runs the queue loop in a background thread. Build context: worker/.
#
#   docker build -t ait-worker worker/
#   docker run --env-file .env.local ait-worker

# 3.12 on Debian bookworm: patch releases flow in on rebuild. Every dependency
# ships a manylinux wheel for it, so no compiler toolchain is installed.
FROM python:3.15-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Tesseract (+ English data) for scanned PDFs and images. One layer, no
# recommends, apt lists removed.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first so code changes don't reinstall them. --only-binary
# fails the build instead of silently compiling from source.
COPY requirements.txt .
RUN pip install --only-binary=:all: -r requirements.txt

COPY . .

# Unprivileged runtime user; the worker writes nothing to disk.
RUN useradd --system --uid 10001 --no-create-home worker
USER 10001

# Sanity check at build time: imports resolve and tesseract is on PATH.
RUN python -c "import server, worker, fitz, docx, pytesseract, cryptography; import shutil; assert shutil.which('tesseract')"

# Render injects PORT (default 10000); 8000 is the local default.
ENV PORT=8000
EXPOSE 8000

# Exec form: python is PID 1 and receives SIGTERM directly, so the worker
# finishes its current job before Render stops the container.
CMD ["python", "server.py"]
