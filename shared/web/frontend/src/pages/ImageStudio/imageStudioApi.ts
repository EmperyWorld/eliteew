/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Image Studio HTTP helpers: SSE generation, upload resize, download, base64→File, error mapping.
 *
 * Invariants:
 * - Generation uses SSE `/stream` endpoints (UGS queue worker).
 * - 402 with detail.code `insufficient_credits` maps to a stable code for i18n.
 *
 * Related:
 * - imageStudioStreamApi.ts
 * - documentation/product/IMAGE-STUDIO.md
 */

import { getApiErrorMessage } from '@/utils/apiError';
import { resizeImageForUpload as resizeImageForUploadUtil } from '@/utils/imageResize';
import { confirmCreativeNonCommercialDownload } from '@/constants/creativeOutputNonCommercial';
import type { ImageStudioResult } from './workspaces/types';

export { resizeImageForUploadUtil as resizeImageForUpload };

export function newIdempotencyKey(): string {
	if (
		typeof crypto !== 'undefined' &&
		typeof crypto.randomUUID === 'function'
	) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export type MappedImageStudioError = {
	message: string;
	code?: 'insufficient_credits' | 'payload_too_large' | string;
	status?: number;
};

/**
 * Map API errors for Image Studio UI.
 * 402 + detail.code insufficient_credits → code for i18n; message from detail.message when present.
 */
export function mapApiError(error: unknown): MappedImageStudioError {
	const err = error as {
		response?: {
			status?: number;
			data?: { detail?: unknown };
		};
		code?: string;
		status?: number;
		message?: string;
	};
	const status = err?.response?.status ?? err?.status;
	const detail = err?.response?.data?.detail;

	if (status === 413) {
		return {
			status,
			code: 'payload_too_large',
			message:
				'Файл слишком большой для загрузки. Мы сжимаем изображение автоматически — попробуйте ещё раз.',
		};
	}

	if (
		status === 402 &&
		detail &&
		typeof detail === 'object' &&
		!Array.isArray(detail)
	) {
		const o = detail as { code?: unknown; message?: unknown };
		const code = typeof o.code === 'string' ? o.code : 'insufficient_credits';
		const message =
			typeof o.message === 'string' && o.message.trim()
				? o.message.trim()
				: getApiErrorMessage(error);
		return { status, code, message };
	}

	if (status === 402 || err?.code === 'insufficient_credits') {
		return {
			status: status ?? 402,
			code: 'insufficient_credits',
			message: err?.message || getApiErrorMessage(error),
		};
	}

	return {
		status,
		message: err?.message || getApiErrorMessage(error),
	};
}

export {
	streamImageEdit as postImageEdit,
	streamImageRotate as postImageRotate,
	streamSuggestPrompt as postSuggestPrompt,
	streamTextToImage as postTextToImage,
} from './imageStudioStreamApi';

export function downloadImage(
	img: ImageStudioResult,
	prefix: string,
	opts?: { skipConfirm?: boolean }
): void {
	if (!opts?.skipConfirm && !confirmCreativeNonCommercialDownload()) return;
	if (!img?.data) return;
	const a = document.createElement('a');
	a.href = `data:image/png;base64,${img.data}`;
	a.download = img.filename || `${prefix}.png`;
	a.click();
}

/** Convert base64 image payload to a File for edit/rotate handoff. */
export function base64ToFile(
	base64: string,
	filename = 'image-studio.png',
	mime = 'image/png'
): File {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new File([bytes], filename, { type: mime });
}

export function randomSeed(): number {
	return Math.floor(Math.random() * 2_147_483_647);
}
