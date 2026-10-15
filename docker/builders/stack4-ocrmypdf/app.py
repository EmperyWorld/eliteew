#!/usr/bin/env python3
"""Minimal Flask API for OCRmyPDF: health + POST /ocr to OCR a PDF."""

import tempfile
from pathlib import Path

from flask import Flask, request, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

try:
    import ocrmypdf
except ImportError:
    ocrmypdf = None  # apt install ocrmypdf provides the module in container


@app.route("/")
def index():
    """Health/root: ok if Flask and (optionally) ocrmypdf are available."""
    return {"status": "ok", "ocrmypdf": ocrmypdf is not None}, 200


@app.route("/health")
def health():
    """Healthcheck endpoint."""
    return {"status": "ok"}, 200


@app.route("/ocr", methods=["POST"])
def ocr():
    """Accept a PDF file, run OCR, return the resulting PDF."""
    if ocrmypdf is None:
        return {"error": "ocrmypdf not installed"}, 503
    if "file" not in request.files and not request.data:
        return {"error": "no file or body"}, 400
    try:
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            inp = tmp / "in.pdf"
            out = tmp / "out.pdf"
            if request.files.get("file"):
                request.files["file"].save(str(inp))
            else:
                inp.write_bytes(request.data)
            if not inp.exists() or inp.stat().st_size == 0:
                return {"error": "empty file"}, 400
            ocrmypdf.ocr(str(inp), str(out), deskew=True)
            if not out.exists():
                return {"error": "ocr produced no output"}, 500
            return send_file(
                str(out),
                mimetype="application/pdf",
                as_attachment=True,
                download_name="ocr.pdf",
            )
    except ocrmypdf.PdfMergeError as e:
        return {"error": f"merge: {e!s}"}, 400
    except Exception as e:
        return {"error": str(e)}, 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
