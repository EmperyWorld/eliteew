/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Force usable audio/* Blob MIME for `<audio>` when the server returns empty/octet-stream,
 * and reject non-audio payloads (JSON/HTML error bodies) before IDB cache / attach.
 *
 * Invariants:
 * - Prefer explicit audio/* mime; else map from filename; else audio/mpeg.
 * - Magic-byte gate: never treat `{`/`<`/empty as playable audio even if type=audio/mpeg.
 *
 * Related:
 * - src/components/Audio/AuthenticatedAudioPreview.tsx
 * - src/pages/Desktop/context/nowPlaying/attachLoadedAudioSource.ts
 * - src/pages/Desktop/utils/musicAudioBlobCache.ts
 * - src/pages/Desktop/components/GAFChat/gafChatAttachmentPreviewUtils.ts
 */

/** Hint MIME for Blob when server returns octet-stream / empty type. */
export function audioMimeHintForFile(
	mime: string | null | undefined,
	fileName: string
): string {
	const m = (mime || '').trim();
	if (m.toLowerCase().startsWith('audio/')) return m;
	const ext = fileName.toLowerCase().split('.').pop() || '';
	const map: Record<string, string> = {
		mp3: 'audio/mpeg',
		m4a: 'audio/mp4',
		aac: 'audio/aac',
		wav: 'audio/wav',
		flac: 'audio/flac',
		ogg: 'audio/ogg',
		opus: 'audio/ogg',
		oga: 'audio/ogg',
		aif: 'audio/aiff',
		aiff: 'audio/aiff',
		wma: 'audio/x-ms-wma',
	};
	return map[ext] || 'audio/mpeg';
}

/** True when leading bytes look like a real audio container (not JSON/HTML error pages). */
export function looksLikeAudioBytes(bytes: ArrayBuffer | Uint8Array): boolean {
	const view =
		bytes instanceof Uint8Array
			? bytes
			: new Uint8Array(bytes.byteLength ? bytes : new ArrayBuffer(0));
	if (view.byteLength < 3) return false;
	// ID3v2 tag
	if (view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33) return true;
	// MPEG frame sync (11 bits set)
	if (view[0] === 0xff && (view[1] & 0xe0) === 0xe0) return true;
	// Ogg / Opus / FLAC / RIFF-WAVE / ftyp (MP4/M4A)
	if (view[0] === 0x4f && view[1] === 0x67 && view[2] === 0x67) return true; // OggS
	if (
		view.byteLength >= 4 &&
		view[0] === 0x66 &&
		view[1] === 0x4c &&
		view[2] === 0x61 &&
		view[3] === 0x43
	) {
		return true; // fLaC
	}
	if (
		view.byteLength >= 4 &&
		view[0] === 0x52 &&
		view[1] === 0x49 &&
		view[2] === 0x46 &&
		view[3] === 0x46
	) {
		return true; // RIFF
	}
	if (
		view.byteLength >= 8 &&
		view[4] === 0x66 &&
		view[5] === 0x74 &&
		view[6] === 0x79 &&
		view[7] === 0x70
	) {
		return true; // ****ftyp
	}
	return false;
}

export async function blobLooksLikeAudio(blob: Blob): Promise<boolean> {
	if (!(blob instanceof Blob) || blob.size < 3) return false;
	const head = await blob.slice(0, 16).arrayBuffer();
	return looksLikeAudioBytes(head);
}

export function normalizeAudioBlob(
	blob: Blob,
	mimeType: string | null | undefined,
	fileName?: string | null
): Blob {
	const resolvedType = audioMimeHintForFile(
		mimeType || blob.type || null,
		(fileName || '').trim()
	);
	if (blob.type === resolvedType) {
		return blob;
	}
	return new Blob([blob], { type: resolvedType });
}
