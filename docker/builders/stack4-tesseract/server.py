import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse

app = FastAPI()


@app.get("/")
async def root() -> dict:
    return {"status": "ok"}


@app.post("/recognize")
async def recognize(file: UploadFile = File(...), lang: str = Form("rus+eng")) -> JSONResponse:
    # Save uploaded file to a temporary location
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir) / file.filename
        out_base = Path(tmpdir) / "out"
        with tmp_path.open("wb") as f:
            f.write(await file.read())

        # Run tesseract CLI: output to text file
        cmd = ["tesseract", str(tmp_path), str(out_base), "-l", lang, "--psm", "3"]
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            txt_path = out_base.with_suffix(".txt")
            text = txt_path.read_text(encoding="utf-8", errors="ignore") if txt_path.exists() else ""
        except subprocess.CalledProcessError as e:
            return JSONResponse(status_code=500, content={"error": f"tesseract failed: {e}"})

    return JSONResponse(content={"text": text})
