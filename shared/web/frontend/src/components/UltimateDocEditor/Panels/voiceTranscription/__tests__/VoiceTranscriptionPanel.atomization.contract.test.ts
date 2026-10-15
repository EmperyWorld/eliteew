/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract for VoiceTranscriptionPanel: facade keeps named export while
 * types, constants, mappers, hook, shell, tabs live under voiceTranscription/.
 *
 * Invariants:
 * - Parent Panels/VoiceTranscriptionPanel.tsx re-exports VoiceTranscriptionPanel and is ≤50 LOC.
 * - All child atomization modules are ≤800 LOC.
 * - useVoiceTranscriptionPanel wires STT/TTS, mic/TTS registration, playback resolve.
 *
 * Related:
 * - Panels/VoiceTranscriptionPanel.tsx, useVoiceTranscriptionPanel.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { VoiceTranscriptionPanel } from '@/components/UltimateDocEditor/Panels/VoiceTranscriptionPanel';

const dir = dirname(fileURLToPath(import.meta.url));
const voiceDir = join(dir, '..');
const panelsDir = join(voiceDir, '..');

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('VoiceTranscriptionPanel atomization contract', () => {
	const facadePath = join(panelsDir, 'VoiceTranscriptionPanel.tsx');
	const innerPath = join(voiceDir, 'VoiceTranscriptionPanel.tsx');

	const sharedModules = [
		'voiceTranscriptionTypes.ts',
		'voiceTranscriptionConstants.ts',
		'voiceTranscriptionErrorMappers.ts',
		'buildTtsEmbedHtml.ts',
	] as const;

	const hookModules = ['useVoiceTranscriptionPanel.ts'] as const;

	const uiModules = [
		'VoiceProgressBarFill.tsx',
		'VoiceTranscriptionModalShell.tsx',
		'VoiceTranscriptionRecordTab.tsx',
		'VoiceTranscriptionUploadTab.tsx',
		'VoiceTranscriptionSynthTab.tsx',
	] as const;

	const allChildModules = [
		...sharedModules,
		...hookModules,
		...uiModules,
	] as const;

	it('re-exports named VoiceTranscriptionPanel from stable facade path', () => {
		expect(typeof VoiceTranscriptionPanel).toBe('function');
	});

	it('facade re-exports VoiceTranscriptionPanel from voiceTranscription/', () => {
		const src = read(facadePath);
		expect(src).toMatch(
			/export\s+\{\s*VoiceTranscriptionPanel\s*\}\s+from\s+['"]@\/components\/UltimateDocEditor\/Panels\/voiceTranscription\/VoiceTranscriptionPanel['"]/
		);
		expect(src).toMatch(
			/export\s+type\s+\{\s*VoiceTranscriptionPanelProps\s*\}/
		);
	});

	it('inner panel delegates to useVoiceTranscriptionPanel and tab subpanels', () => {
		const src = read(innerPath);
		expect(src).toContain("from './useVoiceTranscriptionPanel'");
		expect(src).toContain('useVoiceTranscriptionPanel(');
		expect(src).toContain('<VoiceTranscriptionRecordTab');
		expect(src).toContain('<VoiceTranscriptionUploadTab');
		expect(src).toContain('<VoiceTranscriptionSynthTab');
		expect(src).not.toMatch(/\bfunction\s+voiceUserMessage\b/);
		expect(src).not.toMatch(/\bconst\s+startRecording\s*=/);
	});

	it('useVoiceTranscriptionPanel wires STT/TTS, mic/TTS registration, playback', () => {
		const src = read(join(voiceDir, 'useVoiceTranscriptionPanel.ts'));
		expect(src).toContain('registerMicActive');
		expect(src).toMatch(/transcribeStt|transcribe\(/);
		expect(src).toMatch(/synthesizeTts|synthesize\(/);
		expect(src).toContain('resolveAudioUrlForPlayback');
		expect(src).toContain('MAX_AUDIO_FILE');
	});

	it('key symbols exist in extracted modules', () => {
		expect(read(join(voiceDir, 'voiceTranscriptionConstants.ts'))).toContain(
			'export const MAX_AUDIO_FILE_MB = 50'
		);
		expect(read(join(voiceDir, 'voiceTranscriptionErrorMappers.ts'))).toContain(
			'export function voiceUserMessage'
		);
		expect(read(join(voiceDir, 'buildTtsEmbedHtml.ts'))).toContain(
			'export function buildTtsEmbedHtml'
		);
		expect(read(join(voiceDir, 'voiceTranscriptionTypes.ts'))).toContain(
			"export type ProcessingMode = 'record' | 'upload' | 'synthesize'"
		);
	});

	it('all child modules exist', () => {
		for (const name of allChildModules) {
			expect(existsSync(join(voiceDir, name))).toBe(true);
		}
	});

	it('facade stays thin and all children stay within LOC gate', () => {
		const facadeLoc = lineCount(facadePath);
		const innerLoc = lineCount(innerPath);
		expect(facadeLoc).toBeLessThanOrEqual(50);
		expect(innerLoc).toBeLessThanOrEqual(800);

		for (const name of allChildModules) {
			const childLoc = lineCount(join(voiceDir, name));
			expect(childLoc).toBeLessThanOrEqual(800);
		}
	});
});
