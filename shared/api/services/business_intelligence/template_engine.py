#!/usr/bin/env python3
"""
📄 TEMPLATE ENGINE - Document Generation
Генерация профессиональных документов из AI-анализов

Supported formats:
✅ DOCX (Microsoft Word)
✅ PDF (via HTML conversion)
✅ Markdown
✅ JSON
✅ HTML
"""

import json
import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

try:
    from docx import Document  # type: ignore[import-not-found]

    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False
    Document = Any  # type: ignore
import markdown  # type: ignore[reportMissingModuleSource]
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT  # type: ignore[import-not-found]
from docx.shared import RGBColor  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class TemplateEngine:
    """Professional document generation engine"""

    def __init__(self, output_dir: str = "/tmp/business_intelligence_output"):
        """
        Initialize Template Engine

        Args:
            output_dir: Output directory for generated files
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Document styles
        self.STYLES = {
            "title": {
                "font_name": "Arial",
                "font_size": 24,
                "bold": True,
                "color": RGBColor(0, 51, 102),  # Dark blue
            },
            "heading1": {
                "font_name": "Arial",
                "font_size": 18,
                "bold": True,
                "color": RGBColor(0, 102, 204),  # Blue
            },
            "heading2": {
                "font_name": "Arial",
                "font_size": 14,
                "bold": True,
                "color": RGBColor(51, 51, 51),  # Dark gray
            },
            "normal": {
                "font_name": "Arial",
                "font_size": 11,
                "bold": False,
                "color": RGBColor(0, 0, 0),  # Black
            },
        }

    async def generate_documents(
        self,
        session_id: str,
        analyses: list[dict[str, Any]],
        summary: dict[str, Any],
        formats: list[str] | None = None,
        metadata: dict[str, Any] | None = None,  # ⚡ FIX MYPY: Changed to Optional[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """
        Generate documents in requested formats

        Args:
            session_id: Session ID
            analyses: List of analysis results
            summary: Analysis summary
            formats: Output formats (docx, pdf, markdown, json, html)
            metadata: Additional metadata

        Returns:
            List of generated file info
        """
        if formats is None:
            formats = ["docx"]
        generated_files = []

        try:
            # Prepare content
            full_content = self._prepare_content(analyses, summary, metadata)

            # Generate each format
            for fmt in formats:
                if fmt == "docx":
                    file_path = await self._generate_docx(session_id, full_content)
                elif fmt == "markdown":
                    file_path = await self._generate_markdown(session_id, full_content)
                elif fmt == "json":
                    file_path = await self._generate_json(session_id, analyses, summary)
                elif fmt == "html":
                    file_path = await self._generate_html(session_id, full_content)
                else:
                    logger.warning("Unsupported format: %s", fmt)
                    continue

                if file_path:
                    file_size = Path(file_path).stat().st_size
                    generated_files.append(
                        {
                            "format": fmt,
                            "file_path": file_path,
                            "file_name": Path(file_path).name,
                            "size": file_size,
                            "created_at": datetime.now(UTC).isoformat(),
                        }
                    )

            return generated_files

        except Exception:
            logger.exception("Document generation failed")
            return []

    def _prepare_content(
        self,
        analyses: list[dict[str, Any]],
        summary: dict[str, Any],
        metadata: dict[str, Any] | None = None,  # ⚡ FIX MYPY: Changed to Optional[dict[str, Any]]
    ) -> dict[str, Any]:
        """Prepare structured content for generation"""
        return {
            "title": "Бизнес-Анализ: Comprehensive Report",
            "generated_at": datetime.now(UTC).strftime("%d.%m.%Y %H:%M"),
            "metadata": metadata or {},
            "summary": summary,
            "analyses": analyses,
        }

    async def _generate_docx(self, session_id: str, content: dict[str, Any]) -> str | None:
        """
        Generate DOCX document

        Args:
            session_id: Session ID
            content: Prepared content

        Returns:
            File path or None
        """
        try:
            from docx import Document  # type: ignore[import-not-found]
            from docx.document import Document as DocxDocument  # type: ignore[import-not-found]

            doc: DocxDocument = Document()  # type: ignore[call-overload]
            assert doc is not None  # ⚡ FIX MYPY: Ensure doc is not None

            # Set up styles
            self._setup_docx_styles(doc)

            # Title page
            title = doc.add_heading(content["title"], level=0)
            title.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER

            doc.add_paragraph(f"Сгенерировано: {content['generated_at']}", style="Intense Quote")
            doc.add_paragraph("")  # Empty line

            # Summary section
            doc.add_heading("📊 Executive Summary", level=1)

            summary = content["summary"]
            doc.add_paragraph(f"Всего анализов: {summary.get('total_analyses', 0)}")
            doc.add_paragraph(f"Успешно завершено: {summary.get('successful', 0)}")
            doc.add_paragraph(f"Использовано токенов: {summary.get('total_tokens_used', 0):,}")
            doc.add_paragraph(f"Средний балл качества: {summary.get('average_quality_score', 0)}/100")
            doc.add_paragraph("")

            # Page break
            doc.add_page_break()

            # Analyses sections
            for idx, analysis in enumerate(content["analyses"], 1):
                if not analysis.get("success", False):
                    continue

                # Analysis title
                title = analysis.get("title", f"Анализ {idx}")
                doc.add_heading(f"{idx}. {title}", level=1)

                # Metadata
                doc.add_paragraph(f"Модель: {analysis.get('model_used', 'N/A')}", style="Intense Quote")
                metrics = analysis.get("metrics", {})
                doc.add_paragraph(
                    f"Токены: {metrics.get('tokens_used', 0)} | "
                    f"Время: {metrics.get('generation_time', 0):.1f}s | "
                    f"Качество: {metrics.get('quality_score', 0)}/100",
                    style="Intense Quote",
                )
                doc.add_paragraph("")

                # Content
                analysis_content = analysis.get("content", "")
                self._add_markdown_content_to_docx(doc, analysis_content)

                # Page break before next section
                if idx < len(content["analyses"]):
                    doc.add_page_break()

            # Save document
            filename = f"business_analysis_{uuid.uuid4().hex}.docx"
            file_path = self.output_dir / filename
            doc.save(str(file_path))

            logger.info("Generated DOCX: %s", file_path)
            return str(file_path)

        except Exception:
            logger.exception("DOCX generation failed")
            return None

    def _setup_docx_styles(self, doc: Any) -> None:
        """Setup custom styles for DOCX"""
        # Styles are automatically inherited from template

    def _add_markdown_content_to_docx(self, doc: Any, content: str) -> None:
        """
        Add markdown-formatted content to DOCX

        Args:
            doc: Document object
            content: Markdown content
        """
        assert doc is not None  # ⚡ FIX MYPY: Ensure doc is not None
        lines = content.split("\n")

        for line in lines:
            line = line.strip()

            if not line:
                doc.add_paragraph("")
                continue

            # Heading 1
            if line.startswith("## "):
                doc.add_heading(line[3:], level=2)
            # Heading 2
            elif line.startswith("### "):
                doc.add_heading(line[4:], level=3)
            # Bold text
            elif line.startswith("**") and line.endswith("**"):
                p = doc.add_paragraph()
                p.add_run(line[2:-2]).bold = True
            # List item
            elif line.startswith(("- ", "• ")):
                doc.add_paragraph(line[2:], style="List Bullet")
            # Numbered list
            elif line[:2].replace(".", "").isdigit():
                doc.add_paragraph(line.split(".", 1)[1].strip(), style="List Number")
            # Normal paragraph
            else:
                doc.add_paragraph(line)

    async def _generate_markdown(self, session_id: str, content: dict[str, Any]) -> str | None:
        """Generate Markdown document"""
        try:
            md_lines = []

            # Title
            md_lines.append(f"# {content['title']}\n")
            md_lines.append(f"**Сгенерировано:** {content['generated_at']}\n")
            md_lines.append("---\n")

            # Summary
            md_lines.append("## 📊 Executive Summary\n")
            summary = content["summary"]
            md_lines.append(f"- **Всего анализов:** {summary.get('total_analyses', 0)}")
            md_lines.append(f"- **Успешно:** {summary.get('successful', 0)}")
            md_lines.append(f"- **Токенов использовано:** {summary.get('total_tokens_used', 0):,}")
            md_lines.append(f"- **Средний балл качества:** {summary.get('average_quality_score', 0)}/100\n")
            md_lines.append("---\n")

            # Analyses
            for idx, analysis in enumerate(content["analyses"], 1):
                if not analysis.get("success", False):
                    continue

                title = analysis.get("title", f"Анализ {idx}")
                md_lines.append(f"## {idx}. {title}\n")

                # Metadata
                metrics = analysis.get("metrics", {})
                md_lines.append(f"**Модель:** {analysis.get('model_used', 'N/A')}")
                md_lines.append(
                    f"**Метрики:** {metrics.get('tokens_used', 0)} токенов | "
                    f"{metrics.get('generation_time', 0):.1f}s | "
                    f"Качество: {metrics.get('quality_score', 0)}/100\n"
                )

                # Content
                md_lines.append(analysis.get("content", ""))
                md_lines.append("\n---\n")

            # Save
            filename = f"business_analysis_{uuid.uuid4().hex}.md"
            file_path = self.output_dir / filename

            with open(file_path, "w", encoding="utf-8") as f:
                f.write("\n".join(md_lines))

            logger.info("Generated Markdown: %s", file_path)
            return str(file_path)

        except Exception:
            logger.exception("Markdown generation failed")
            return None

    async def _generate_json(
        self, session_id: str, analyses: list[dict[str, Any]], summary: dict[str, Any]
    ) -> str | None:
        """Generate JSON document"""
        try:
            data = {
                "session_id": session_id,
                "generated_at": datetime.now(UTC).isoformat(),
                "summary": summary,
                "analyses": analyses,
            }

            filename = f"business_analysis_{uuid.uuid4().hex}.json"
            file_path = self.output_dir / filename

            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            logger.info("Generated JSON: %s", file_path)
            return str(file_path)

        except Exception:
            logger.exception("JSON generation failed")
            return None

    async def _generate_html(self, session_id: str, content: dict[str, Any]) -> str | None:
        """Generate HTML document"""
        try:
            html_parts = []

            # HTML header
            html_parts.append("""
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Бизнес-Анализ Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { color: #003366; border-bottom: 3px solid #0066cc; padding-bottom: 10px; }
        h2 { color: #0066cc; margin-top: 30px; }
        h3 { color: #333; }
        .metadata { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .analysis-section { margin: 30px 0; padding: 20px; border-left: 4px solid #0066cc; }
        .metrics { display: flex; gap: 20px; margin: 10px 0; }
        .metric { background: #e8f4f8; padding: 10px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
""")

            # Title
            html_parts.append(f"<h1>{content['title']}</h1>")
            html_parts.append(f"<p><strong>Сгенерировано:</strong> {content['generated_at']}</p>")

            # Summary
            summary = content["summary"]
            html_parts.append("<div class='metadata'>")
            html_parts.append("<h2>📊 Executive Summary</h2>")
            html_parts.append(f"<p><strong>Всего анализов:</strong> {summary.get('total_analyses', 0)}</p>")
            html_parts.append(f"<p><strong>Успешно:</strong> {summary.get('successful', 0)}</p>")
            html_parts.append(f"<p><strong>Токенов:</strong> {summary.get('total_tokens_used', 0):,}</p>")
            html_parts.append(f"<p><strong>Средний балл:</strong> {summary.get('average_quality_score', 0)}/100</p>")
            html_parts.append("</div>")

            # Analyses
            for idx, analysis in enumerate(content["analyses"], 1):
                if not analysis.get("success", False):
                    continue

                html_parts.append("<div class='analysis-section'>")
                html_parts.append(f"<h2>{idx}. {analysis.get('title', 'Анализ')}</h2>")

                metrics = analysis.get("metrics", {})
                html_parts.append("<div class='metrics'>")
                html_parts.append(
                    f"<div class='metric'><strong>Модель:</strong> {analysis.get('model_used', 'N/A')}</div>"
                )
                html_parts.append(f"<div class='metric'><strong>Токены:</strong> {metrics.get('tokens_used', 0)}</div>")
                html_parts.append(
                    f"<div class='metric'><strong>Время:</strong> {metrics.get('generation_time', 0):.1f}s</div>"
                )
                html_parts.append(
                    f"<div class='metric'><strong>Качество:</strong> {metrics.get('quality_score', 0)}/100</div>"
                )
                html_parts.append("</div>")

                # Convert markdown to HTML
                analysis_html = markdown.markdown(analysis.get("content", ""))
                html_parts.append(analysis_html)
                html_parts.append("</div>")

            # HTML footer
            html_parts.append("""
    </div>
</body>
</html>
""")

            # Save
            filename = f"business_analysis_{uuid.uuid4().hex}.html"
            file_path = self.output_dir / filename

            with open(file_path, "w", encoding="utf-8") as f:
                f.write("".join(html_parts))

            logger.info("Generated HTML: %s", file_path)
            return str(file_path)

        except Exception:
            logger.exception("HTML generation failed")
            return None

    async def cleanup_old_files(self, days: int = 7) -> None:
        """
        Cleanup files older than specified days

        Args:
            days: Days threshold
        """
        try:
            cutoff_time = datetime.now(UTC).timestamp() - (days * 86400)
            removed = 0

            for file_path in self.output_dir.glob("*"):
                if file_path.is_file() and file_path.stat().st_mtime < cutoff_time:
                    file_path.unlink()
                    removed += 1

            logger.info("Cleaned up %s old files", removed)

        except Exception:
            logger.exception("Cleanup failed")
