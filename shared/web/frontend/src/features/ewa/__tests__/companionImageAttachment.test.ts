/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for companion vision image attachment conversion.
 *
 * Invariants:
 * - Attachment conversion must avoid manual arrayBuffer/binary-string encoding.
 * - Unsupported formats and oversized images fail before preview URL allocation.
 *
 * Related:
 * - src/features/ewa/companionImageAttachment.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	COMPANION_CHAT_IMAGE_MAX_BYTES,
	extractCompanionImageDataBase64,
	readPendingCompanionImage,
	toCompanionImageAttachmentPayload,
} from '../companionImageAttachment';

describe('companionImageAttachment', () => {
	const createObjectUrl = vi.fn(() => 'blob:companion-preview');

	beforeEach(() => {
		vi.stubGlobal('URL', {
			...URL,
			createObjectURL: createObjectUrl,
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		createObjectUrl.mockClear();
	});

	it('reads allowlisted images as base64 data without exposing a binary string path', async () => {
		const file = new File([new Uint8Array([0, 1, 2, 255])], 'vision.png', {
			type: 'image/png',
		});

		const attachment = await readPendingCompanionImage(file);

		expect(attachment).toEqual({
			mimeType: 'image/png',
			dataBase64: 'AAEC/w==',
			previewUrl: 'blob:companion-preview',
		});
		expect(createObjectUrl).toHaveBeenCalledWith(file);
	});

	it('rejects unsupported formats before preview allocation', async () => {
		const file = new File(['<svg />'], 'vision.svg', {
			type: 'image/svg+xml',
		});

		await expect(readPendingCompanionImage(file)).rejects.toThrow(
			'companion_chat_image_unsupported_format'
		);
		expect(createObjectUrl).not.toHaveBeenCalled();
	});

	it('rejects oversized files before preview allocation', async () => {
		const file = new File(
			[new Uint8Array(COMPANION_CHAT_IMAGE_MAX_BYTES + 1)],
			'vision.jpg',
			{ type: 'image/jpeg' }
		);

		await expect(readPendingCompanionImage(file)).rejects.toThrow(
			'companion_chat_image_too_large'
		);
		expect(createObjectUrl).not.toHaveBeenCalled();
	});

	it('extracts payload from data URLs with compatible mime fallback', () => {
		expect(
			extractCompanionImageDataBase64(
				'data:image/jpeg;base64,Zm9v',
				'image/jpeg'
			)
		).toBe('Zm9v');
		expect(
			extractCompanionImageDataBase64(
				'data:image/png;charset=utf-8;base64,YmFy',
				'image/png'
			)
		).toBe('YmFy');
	});

	it('builds wire attachment when text and image are both present', () => {
		const pending = {
			mimeType: 'image/png',
			dataBase64: 'AAEC/w==',
			previewUrl: 'blob:preview',
		};
		expect(toCompanionImageAttachmentPayload(pending)).toEqual({
			mime_type: 'image/png',
			data_base64: 'AAEC/w==',
		});
		expect(toCompanionImageAttachmentPayload(null)).toBeUndefined();
	});
});
