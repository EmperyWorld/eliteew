/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit locks for audio MIME normalization used by Music Player blob fallback and previews.
 *
 * Related:
 * - src/services/audio/normalizeAudioBlob.ts
 */

import { describe, expect, it } from 'vitest';

import {
	audioMimeHintForFile,
	looksLikeAudioBytes,
	normalizeAudioBlob,
} from '@/services/audio/normalizeAudioBlob';

describe('normalizeAudioBlob', () => {
	it('keeps explicit audio/* mime', () => {
		expect(audioMimeHintForFile('audio/ogg', 'x.bin')).toBe('audio/ogg');
	});

	it('maps extension when mime is octet-stream', () => {
		expect(audioMimeHintForFile('application/octet-stream', 'song.mp3')).toBe(
			'audio/mpeg'
		);
		expect(audioMimeHintForFile('', 'clip.m4a')).toBe('audio/mp4');
	});

	it('retypes blob when type mismatches', () => {
		const raw = new Blob([new Uint8Array([1, 2, 3])], {
			type: 'application/octet-stream',
		});
		const typed = normalizeAudioBlob(raw, null, 'Dramma-nishtak.mp3');
		expect(typed.type).toBe('audio/mpeg');
		expect(typed.size).toBe(3);
	});

	it('accepts ID3 / MPEG frame sync and rejects JSON/HTML heads', () => {
		expect(looksLikeAudioBytes(new Uint8Array([0x49, 0x44, 0x33, 0]))).toBe(
			true
		);
		expect(looksLikeAudioBytes(new Uint8Array([0xff, 0xfb, 0x90, 0]))).toBe(
			true
		);
		expect(
			looksLikeAudioBytes(new TextEncoder().encode('{"error":true}'))
		).toBe(false);
		expect(
			looksLikeAudioBytes(new TextEncoder().encode('<!DOCTYPE html>'))
		).toBe(false);
	});
});
