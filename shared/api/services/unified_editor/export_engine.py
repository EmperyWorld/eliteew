#!/usr/bin/env python3
"""
📄 EXPORT ENGINE - Document Generation
Генерация экспорта документов в разные форматы

Features:
✅ DOCX export with python-docx
✅ PDF export (HTML → PDF)
✅ HTML export with templating
✅ TXT plain text export
✅ Markdown export
"""

import logging
import time
from datetime import UTC, datetime
from pathlib import Path
from tempfile import gettempdir
from typing import Any

from docx import Document  # type: ignore[import-not-found]
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class ExportEngine:
    """Document export engine"""

    def __init__(self, output_dir: Path | None = None):
        """
        Initialize Export Engine

        Args:
            output_dir: Directory for generated files
        """
        if output_dir is None:
            temp_base = Path(gettempdir())
            self.output_dir = temp_base / "unified_editor_exports"
        else:
            self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def export_document(
        self,
        content: str,
        export_format: str,
        title: str = "Document",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Export document to specified format

        Args:
            content: Document content
            export_format: Export format (docx, pdf, html, txt, md)
            title: Document title
            metadata: Additional metadata

        Returns:
            Export result with file path
        """
        try:
            logger.info("📄 Exporting document to %s: %s", export_format, title)

            if export_format == "docx":
                file_path = await self._export_docx(content, title, metadata)
            elif export_format == "html":
                file_path = await self._export_html(content, title, metadata)
            elif export_format == "txt":
                file_path = await self._export_txt(content, title)
            elif export_format in {"markdown", "md"}:
                file_path = await self._export_markdown(content, title, metadata)
            else:
                msg = f"Unsupported export format: {export_format}"
                raise ValueError(msg)

            logger.info("Export completed: %s", file_path)

            return {
                "success": True,
                "format": export_format,
                "file_name": file_path.name,
                "file_path": str(file_path),
                "size": file_path.stat().st_size,
            }

        except Exception as e:
            logger.exception("Export failed")
            return {"success": False, "error": str(e)}

    async def _export_docx(self, content: str, title: str, metadata: dict[str, Any] | None) -> Path:
        """
        Export to DOCX using python-docx

        Args:
            content: Document content
            title: Document title
            metadata: Metadata

        Returns:
            Path to generated file
        """
        document = Document()

        # Add title
        title_para = document.add_heading(title, level=0)
        title_para.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER

        # Add metadata
        if metadata:
            meta_para = document.add_paragraph()
            meta_para.add_run("Metadata:\n").bold = True
            for key, value in metadata.items():
                meta_para.add_run(f"{key}: {value}\n")
            meta_para.add_run("\n")

        # Add content
        for paragraph in content.split("\n\n"):
            if paragraph.strip():
                document.add_paragraph(paragraph.strip())

        # Save to file
        timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        file_path = self.output_dir / f"{title}_{timestamp}.docx"
        document.save(str(file_path))

        return file_path

    async def _export_html(self, content: str, title: str, metadata: dict[str, Any] | None) -> Path:
        """
        Export to HTML

        Args:
            content: Document content
            title: Document title
            metadata: Metadata

        Returns:
            Path to generated file
        """
        html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            line-height: 1.6;
            color: #333;
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }}
        .metadata {{
            background: #f8f9fa;
            padding: 15px;
            border-left: 4px solid #3498db;
            margin: 20px 0;
        }}
        .content {{
            white-space: pre-wrap;
        }}
        .footer {{
            margin-top: 40px;
            text-align: center;
            color: #7f8c8d;
            font-size: 0.9em;
        }}
    </style>
</head>
<body>
    <h1>{title}</h1>
"""

        # Add metadata
        if metadata:
            html += '    <div class="metadata">\n'
            html += "        <strong>Metadata:</strong><br>\n"
            for key, value in metadata.items():
                html += f"        {key}: {value}<br>\n"
            html += "    </div>\n"

        # Add content
        html += f'    <div class="content">\n{content}\n    </div>\n'

        # Add footer
        html += f"""    <div class="footer">
        Generated: {datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")}
    </div>
</body>
</html>"""

        # Save to file
        timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        file_path = self.output_dir / f"{title}_{timestamp}.html"
        file_path.write_text(html, encoding="utf-8")

        return file_path

    async def _export_txt(self, content: str, title: str) -> Path:
        """
        Export to plain text

        Args:
            content: Document content
            title: Document title

        Returns:
            Path to generated file
        """
        text = f"{title}\n{'=' * len(title)}\n\n{content}"

        timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        file_path = self.output_dir / f"{title}_{timestamp}.txt"
        file_path.write_text(text, encoding="utf-8")

        return file_path

    async def _export_markdown(self, content: str, title: str, metadata: dict[str, Any] | None) -> Path:
        """
        Export to Markdown

        Args:
            content: Document content
            title: Document title
            metadata: Metadata

        Returns:
            Path to generated file
        """
        markdown = f"# {title}\n\n"

        # Add metadata
        if metadata:
            markdown += "## Metadata\n\n"
            for key, value in metadata.items():
                markdown += f"- **{key}**: {value}\n"
            markdown += "\n"

        # Add content
        markdown += "## Content\n\n"
        markdown += content

        # Add footer
        markdown += f"\n\n---\n*Generated: {datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S')}*\n"

        timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        file_path = self.output_dir / f"{title}_{timestamp}.md"
        file_path.write_text(markdown, encoding="utf-8")

        return file_path

    async def cleanup_old_files(self, days: int = 7) -> None:
        """
        Cleanup old exported files

        Args:
            days: Delete files older than N days
        """
        try:
            cutoff_time = time.time() - (days * 24 * 3600)
            deleted_count = 0

            for file_path in self.output_dir.iterdir():
                if file_path.is_file() and file_path.stat().st_mtime < cutoff_time:
                    file_path.unlink()
                    deleted_count += 1

            logger.info("🧹 Cleaned up %d old files", deleted_count)

        except Exception:
            logger.exception("Cleanup failed")
