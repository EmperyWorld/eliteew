/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Image Studio SSE generation client (UGS queue worker; API stays responsive).
 *
 * Related:
 * - imageStudioApi.ts
 * - api/routers/image_studio_stream.py
 * - documentation/product/IMAGE-STUDIO.md
 */

import {
	streamUgsGeneration,
	type UGSStreamCallbacks,
} from '@/services/api/ugs/stream';
import type {
	ImageStudioApiResponse,
	ImageStudioResult,
} from './workspaces/types';
import { mapApiError, newIdempotencyKey } from './imageStudioApi';

const STREAM_BASE = '/api/v1/image-studio';

function idempotencyHeader(key?: string): Record<string, string> {
	const resolved = key?.trim() || newIdempotencyKey();
	return { 'Idempotency-Key': resolved };
}

function normalizeStreamResult(
	raw: Record<string, unknown>
): ImageStudioApiResponse {
	const images = Array.isArray(raw.images)
		? (raw.images as ImageStudioResult[])
		: [];
	return {
		images,
		history_saved:
			typeof raw.history_saved === 'boolean' ? raw.history_saved : undefined,
		history_error:
			typeof raw.history_error === 'string' ? raw.history_error : undefined,
		content_id: typeof raw.content_id === 'string' ? raw.content_id : undefined,
		name: typeof raw.name === 'string' ? raw.name : undefined,
	};
}

async function runImageStudioStream(
	path: string,
	body: Record<string, unknown> | FormData,
	idempotencyKey?: string,
	callbacks?: UGSStreamCallbacks
): Promise<ImageStudioApiResponse> {
	try {
		const raw = await streamUgsGeneration(
			`${STREAM_BASE}${path}`,
			body,
			callbacks,
			idempotencyHeader(idempotencyKey)
		);
		if (typeof raw.prompt === 'string') {
			return { images: [], prompt: raw.prompt } as ImageStudioApiResponse & {
				prompt: string;
			};
		}
		return normalizeStreamResult(raw);
	} catch (error) {
		const mapped = mapApiError(error);
		const err = new Error(mapped.message) as Error & {
			code?: string;
			status?: number;
		};
		err.code = mapped.code;
		err.status = mapped.status;
		throw err;
	}
}

export async function streamTextToImage(
	body: {
		prompt: string;
		width: number;
		height: number;
		seed?: number;
		idempotencyKey?: string;
	},
	callbacks?: UGSStreamCallbacks
): Promise<ImageStudioApiResponse> {
	const payload: Record<string, unknown> = {
		prompt: body.prompt,
		width: body.width,
		height: body.height,
	};
	if (typeof body.seed === 'number' && !Number.isNaN(body.seed)) {
		payload.seed = body.seed;
	}
	return runImageStudioStream(
		'/text-to-image/stream',
		payload,
		body.idempotencyKey,
		callbacks
	);
}

export async function streamSuggestPrompt(
	body: {
		idea: string;
		language: 'en' | 'ru';
		idempotencyKey?: string;
	},
	callbacks?: UGSStreamCallbacks
): Promise<{ prompt: string }> {
	const raw = await runImageStudioStream(
		'/suggest-prompt/stream',
		{ idea: body.idea, language: body.language },
		body.idempotencyKey,
		callbacks
	);
	const prompt = (raw as { prompt?: string }).prompt;
	if (!prompt?.trim()) {
		throw new Error('Empty prompt from AI');
	}
	return { prompt };
}

export async function streamImageEdit(
	formData: FormData,
	idempotencyKey?: string,
	callbacks?: UGSStreamCallbacks
): Promise<ImageStudioApiResponse> {
	return runImageStudioStream(
		'/image-edit/stream',
		formData,
		idempotencyKey,
		callbacks
	);
}

export async function streamImageRotate(
	formData: FormData,
	idempotencyKey?: string,
	callbacks?: UGSStreamCallbacks
): Promise<ImageStudioApiResponse> {
	return runImageStudioStream(
		'/image-rotate/stream',
		formData,
		idempotencyKey,
		callbacks
	);
}
