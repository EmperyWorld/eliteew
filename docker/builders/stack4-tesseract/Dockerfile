FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-eng tesseract-ocr-rus \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn[standard] python-multipart

COPY server.py /app/server.py

EXPOSE 8884

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8884"]

