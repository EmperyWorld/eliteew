/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * POST uploaded binary to Doc Editor convert/upload (Stack4 Tika/Gotenberg).
 *
 * Invariants:
 * - Office/word binaries must not be read via Blob.text() before this call.
 *
 * Related:
 * - api/routers/doc_editor.py convert/upload
 * - UnifiedContent/viewers/UniversalViewer.tsx
 */

import { apiClient } from '@/services/api/client';
import { API_PATHS } from '@/services/api/config';

export type DocEditorConvertTarget = 'html' | 'text' | 'pdf';

const EXTENSION_MIME: Record<string, string> = {
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	doc: 'application/msword',
	odt: 'application/vnd.oasis.opendocument.text',
	rtf: 'application/rtf',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	xls: 'application/vnd.ms-excel',
	pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	ppt: 'application/vnd.ms-powerpoint',
};

function resolveUploadMimeType(
	filename: string,
	mimeType: string | null | undefined,
	blobType: string
): string {
	const declared = (mimeType ?? blobType ?? '').trim();
	if (
		declared &&
		declared !== 'application/octet-stream' &&
		declared !== 'binary/octet-stream'
	) {
		return declared;
	}
	const ext = filename.includes('.')
		? filename.slice(filename.lastIndexOf('.') + 1).toLowerCase()
		: '';
	return EXTENSION_MIME[ext] ?? (declared || 'application/octet-stream');
}

export async function convertUploadedFileViaDocEditor(
	blob: Blob,
	filename: string,
	targetFormat: DocEditorConvertTarget,
	mimeType?: string | null
): Promise<string> {
	const file = new File([blob], filename, {
		type: resolveUploadMimeType(filename, mimeType, blob.type),
	});
	const fd = new FormData();
	fd.append('file', file);
	const { data } = await apiClient.post<{ content: string }>(
		`${API_PATHS.DOC_EDITOR}/convert/upload`,
		fd,
		{ params: { target_format: targetFormat } }
	);
	return data.content;
}
