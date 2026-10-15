/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Magic-byte / header sniffing for DocumentImportPanel format detection.
 *
 * Invariants:
 * - Reads only the first 512 bytes; never mutates the File.
 *
 * Related:
 * - useDocumentImportDropzone.ts, documentImportTypes.ts
 */

import type { FileFormatDetection } from '@/components/UltimateDocEditor/Panels/documentImport/documentImportTypes';

export async function detectFileFormat(
	file: File
): Promise<FileFormatDetection> {
	const extension = file.name.toLowerCase().split('.').pop() || '';

	// Read first 512 bytes for format detection
	const buffer = await file.slice(0, 512).arrayBuffer();
	const bytes = new Uint8Array(buffer);

	// PDF detection
	if (
		bytes.length >= 4 &&
		bytes[0] === 0x25 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x44 &&
		bytes[3] === 0x46
	) {
		return { detectedFormat: 'pdf', confidence: 1.0, extension };
	}

	// PNG detection
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47
	) {
		return { detectedFormat: 'png', confidence: 1.0, extension };
	}

	// JPEG detection
	if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
		return { detectedFormat: 'jpg', confidence: 1.0, extension };
	}

	// Microsoft Office formats (DOC, DOCX)
	if (bytes.length >= 8) {
		// DOCX (ZIP-based Office format)
		if (
			bytes[0] === 0x50 &&
			bytes[1] === 0x4b &&
			bytes[2] === 0x03 &&
			bytes[3] === 0x04
		) {
			// Check for Office document signatures in ZIP
			const zipContent = new TextDecoder().decode(bytes.slice(0, 100));
			if (
				zipContent.includes('word/') ||
				zipContent.includes('[Content_Types].xml')
			) {
				return { detectedFormat: 'docx', confidence: 0.9, extension };
			}
		}

		// Legacy DOC format
		if (
			bytes[0] === 0xd0 &&
			bytes[1] === 0xcf &&
			bytes[2] === 0x11 &&
			bytes[3] === 0xe0
		) {
			return { detectedFormat: 'doc', confidence: 0.9, extension };
		}
	}

	// RTF detection
	if (bytes.length >= 6) {
		const header = new TextDecoder().decode(bytes.slice(0, 6));
		if (header === '{\\rtf1') {
			return { detectedFormat: 'rtf', confidence: 1.0, extension };
		}
	}

	// HTML detection
	if (bytes.length >= 10) {
		const header = new TextDecoder().decode(bytes.slice(0, 10)).toLowerCase();
		if (
			header.includes('<html') ||
			header.includes('<!doctype html') ||
			header.includes('<head')
		) {
			return { detectedFormat: 'html', confidence: 0.8, extension };
		}
	}

	// ODT detection (ZIP-based)
	if (
		bytes.length >= 4 &&
		bytes[0] === 0x50 &&
		bytes[1] === 0x4b &&
		bytes[2] === 0x03 &&
		bytes[3] === 0x04
	) {
		// Check for ODT content
		const zipContent = new TextDecoder().decode(bytes.slice(0, 200));
		if (
			zipContent.includes('office:document') ||
			zipContent.includes('opendocument')
		) {
			return { detectedFormat: 'odt', confidence: 0.8, extension };
		}
	}

	// Plain text detection (fallback)
	if (bytes.length > 0) {
		// Check if it's mostly printable ASCII
		let printableChars = 0;
		const totalChars = Math.min(bytes.length, 100);
		for (let i = 0; i < totalChars; i++) {
			const byte = bytes[i];
			if (
				byte !== undefined &&
				((byte >= 32 && byte <= 126) ||
					byte === 9 ||
					byte === 10 ||
					byte === 13)
			) {
				printableChars++;
			}
		}
		if (printableChars / totalChars > 0.8) {
			return { detectedFormat: 'txt', confidence: 0.6, extension };
		}
	}

	return { detectedFormat: null, confidence: 0, extension };
}
