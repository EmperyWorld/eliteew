# OCRmyPDF API: venv + app inside image (no bind mount)
FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ocrmypdf \
        tesseract-ocr-rus \
        tesseract-ocr-eng \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt app.py ./

RUN python3 -m venv /app/.venv \
    && /app/.venv/bin/pip install --no-cache-dir -r requirements.txt

EXPOSE 5000
CMD ["/app/.venv/bin/python", "/app/app.py"]
