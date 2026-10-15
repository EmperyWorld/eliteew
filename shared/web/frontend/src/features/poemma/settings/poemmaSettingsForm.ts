/**
 * Settings form helpers — threshold parsing and backup download filename.
 */

import type { PoemmaStorageBackupPayload } from '../poemmaStorage';

export function parsePoemmaExperienceThresholdInput(
	raw: string
): number | null {
	const normalized = raw.replace(/\s/g, '').replace(',', '.');
	if (!normalized) {
		return null;
	}
	const value = Number(normalized);
	if (!Number.isFinite(value)) {
		return null;
	}
	return value;
}

export function validatePoemmaExperienceThreshold(
	value: number
): string | null {
	if (value <= 0 || value > 100) {
		return 'Порог: от 1 до 100%';
	}
	return null;
}

export function buildPoemmaBackupDownloadName(
	backup: PoemmaStorageBackupPayload
): string {
	const date = backup.exportedAt.slice(0, 10);
	return `poemma-backup-${backup.userId}-${date}.json`;
}

export function triggerPoemmaJsonDownload(
	payload: unknown,
	filename: string
): void {
	const blob = new Blob([JSON.stringify(payload, null, 2)], {
		type: 'application/json',
	});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}
