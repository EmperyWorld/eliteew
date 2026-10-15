/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for EWRP workspace headline helpers.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - `ewrpGenerateWorkspaceLabel.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	resolveEwrpGenerateWorkspaceLabel,
	resolveEwrpStatusPresentationLabel,
} from './ewrpGenerateWorkspaceLabel';

describe('resolveEwrpStatusPresentationLabel', () => {
	it('prefers title over topic', () => {
		expect(
			resolveEwrpStatusPresentationLabel({
				statusTitle: ' Deck ',
				statusTopic: 'Topic',
			})
		).toBe('Deck');
	});

	it('falls back to topic when title empty', () => {
		expect(
			resolveEwrpStatusPresentationLabel({
				statusTitle: '',
				statusTopic: ' Quarterly ',
			})
		).toBe('Quarterly');
	});

	it('returns null when both empty', () => {
		expect(resolveEwrpStatusPresentationLabel({})).toBeNull();
	});
});

describe('resolveEwrpGenerateWorkspaceLabel', () => {
	it('prefers form topic over status', () => {
		expect(
			resolveEwrpGenerateWorkspaceLabel({
				formTopic: 'Draft topic',
				formTitle: '',
				statusTitle: 'Job title',
				statusTopic: 'Job topic',
			})
		).toBe('Draft topic');
	});

	it('uses form title when topic empty', () => {
		expect(
			resolveEwrpGenerateWorkspaceLabel({
				formTopic: '',
				formTitle: 'My deck',
				statusTitle: 'Job title',
			})
		).toBe('My deck');
	});

	it('falls back to status when form fields empty', () => {
		expect(
			resolveEwrpGenerateWorkspaceLabel({
				formTopic: '  ',
				formTitle: '',
				statusTitle: '',
				statusTopic: 'Active job',
			})
		).toBe('Active job');
	});
});
