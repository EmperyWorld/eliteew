/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Read system clipboard for desktop history (text-first; optional rich when permitted).
 *
 * Related:
 * - hooks/useDesktopShellClipboardHistory.ts
 */

import type { ClipboardHistoryCaptureInput } from './desktopClipboardHistoryCore';

export type OsClipboardCaptureResult = ClipboardHistoryCaptureInput | null;

export async function readOsClipboardForHistory(): Promise<OsClipboardCaptureResult> {
	if (!navigator.clipboard?.readText) {
		return null;
	}
	try {
		const text = await navigator.clipboard.readText();
		if (text?.trim()) {
			return { type: 'text', content: text, source: 'os' };
		}
	} catch {
		/* permission denied or unsupported */
	}

	if (typeof navigator.clipboard.read !== 'function') {
		return null;
	}

	try {
		const items = await navigator.clipboard.read();
		for (const item of items) {
			if (item.types.includes('text/html')) {
				const blob = await item.getType('text/html');
				const html = await blob.text();
				if (html.trim()) {
					return { type: 'html', content: html, source: 'os' };
				}
			}
			if (item.types.includes('text/plain')) {
				const blob = await item.getType('text/plain');
				const plain = await blob.text();
				if (plain.trim()) {
					return { type: 'text', content: plain, source: 'os' };
				}
			}
			const imageType = item.types.find((type) => type.startsWith('image/'));
			if (imageType) {
				const blob = await item.getType(imageType);
				const dataUrl = await blobToDataUrl(blob);
				if (dataUrl) {
					return {
						type: 'image',
						content: dataUrl,
						preview: dataUrl,
						source: 'os',
					};
				}
			}
		}
	} catch {
		/* rich clipboard blocked */
	}

	return null;
}

async function blobToDataUrl(blob: Blob): Promise<string | null> {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => {
			resolve(typeof reader.result === 'string' ? reader.result : null);
		};
		reader.onerror = () => resolve(null);
		reader.readAsDataURL(blob);
	});
}
