/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for blueprint artifact message detection.
 */

import { describe, expect, it } from 'vitest';

import type { DesktopAiMessage } from './desktopChatClient';
import { isDesktopEnsembleBlueprintArtifactMessage } from './desktopChatClient';

const assistant = (
	metadata?: DesktopAiMessage['metadata']
): DesktopAiMessage => ({
	id: 'msg-1',
	role: 'assistant',
	content: '## Doc',
	created_at: '2026-06-17T00:00:00Z',
	metadata,
});

describe('isDesktopEnsembleBlueprintArtifactMessage', () => {
	it('returns false for user messages', () => {
		expect(
			isDesktopEnsembleBlueprintArtifactMessage({
				...assistant({ desktop_ensemble_blueprint: true }),
				role: 'user',
			})
		).toBe(false);
	});

	it('detects desktop_ensemble_blueprint flag', () => {
		expect(
			isDesktopEnsembleBlueprintArtifactMessage(
				assistant({ desktop_ensemble_blueprint: true })
			)
		).toBe(true);
	});

	it('detects plan_template_id metadata', () => {
		expect(
			isDesktopEnsembleBlueprintArtifactMessage(
				assistant({ plan_template_id: 'marketing_brief_v1' })
			)
		).toBe(true);
	});

	it('returns false for plain assistant replies', () => {
		expect(isDesktopEnsembleBlueprintArtifactMessage(assistant())).toBe(false);
	});
});
