/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract Waves 1–6: CommentsReviewPanel facade keeps named export while
 * mappers, hooks, UI subpanels, and compose hook live under commentsReview/.
 *
 * Invariants:
 * - Parent Panels/CommentsReviewPanel.tsx re-exports CommentsReviewPanel and is ≤800 LOC.
 * - All child atomization modules are ≤800 LOC.
 * - useCommentsReviewCompose wires dual thread sync and external action token effects.
 *
 * Related:
 * - Panels/CommentsReviewPanel.tsx, useCommentsReviewCompose.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const commentsReviewDir = join(dir, '..');
const panelsDir = join(commentsReviewDir, '..');

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('CommentsReviewPanel atomization contract (waves 1–6)', () => {
	const facadePath = join(panelsDir, 'CommentsReviewPanel.tsx');
	const innerPath = join(commentsReviewDir, 'CommentsReviewPanel.tsx');

	const wave1Modules = [
		'mapCommentApi.ts',
		'mentionUtils.ts',
		'commentsReviewConstants.ts',
		'commentsReviewTypes.ts',
	] as const;

	const wave2Modules = [
		'filterSortCommentThreads.ts',
		'formatCommentRelativeTime.ts',
		'useCommentMentions.ts',
	] as const;

	const wave3Modules = [
		'useCommentsReviewQueries.ts',
		'useCommentsReviewMutations.ts',
	] as const;

	const wave4Modules = [
		'useCommentsReviewSelectionEffects.ts',
		'useCommentsReviewHotkeys.ts',
	] as const;

	const wave5Modules = [
		'CommentsReviewPanelHeader.tsx',
		'CommentsReviewFiltersBar.tsx',
		'CommentsReviewComposer.tsx',
		'CommentsReviewThreadList.tsx',
		'CommentsReviewReviewTab.tsx',
		'CommentsReviewThreadCard.tsx',
	] as const;

	const wave6Modules = ['useCommentsReviewCompose.ts'] as const;

	const allWaveModules = [
		...wave1Modules,
		...wave2Modules,
		...wave3Modules,
		...wave4Modules,
		...wave5Modules,
		...wave6Modules,
	] as const;

	it('facade re-exports CommentsReviewPanel from commentsReview/', () => {
		const src = read(facadePath);
		expect(src).toMatch(
			/export\s+\{\s*CommentsReviewPanel\s*\}\s+from\s+['"]@\/components\/UltimateDocEditor\/Panels\/commentsReview\/CommentsReviewPanel['"]/
		);
		expect(src).toMatch(/export\s+type\s+\{\s*CommentsReviewPanelProps\s*\}/);
	});

	it('inner panel delegates to useCommentsReviewCompose and subpanels', () => {
		const src = read(innerPath);
		expect(src).toContain(
			"from '@/components/UltimateDocEditor/Panels/commentsReview/useCommentsReviewCompose'"
		);
		expect(src).toContain('useCommentsReviewCompose(');
		expect(src).toContain('<CommentsReviewPanelHeader');
		expect(src).toContain('<CommentsReviewFiltersBar');
		expect(src).toContain('<CommentsReviewComposer');
		expect(src).toContain('<CommentsReviewThreadList');
		expect(src).toContain('<CommentsReviewReviewTab');
		expect(src).not.toMatch(/\bfunction\s+mapApiThreadToCommentThread\b/);
		expect(src).not.toMatch(/\bfunction\s+normalizeMentionHandle\b/);
	});

	it('useCommentsReviewCompose wires queries, mutations, selection effects, hotkeys', () => {
		const src = read(join(commentsReviewDir, 'useCommentsReviewCompose.ts'));
		expect(src).toContain('useCommentsReviewQueries(');
		expect(src).toContain('useCommentsReviewMutations(');
		expect(src).toContain('useCommentsReviewSelectionEffects(');
		expect(src).toContain('useCommentsReviewHotkeys(');
		expect(src).toContain('useCommentMentions(');
		expect(src).toContain('onThreadsChange');
		expect(src).toContain('externalThreadAction');
	});

	it('useCommentsReviewSelectionEffects preserves dual thread sync and external token', () => {
		const src = read(
			join(commentsReviewDir, 'useCommentsReviewSelectionEffects.ts')
		);
		expect(src).toContain('onThreadsChange?.(threads)');
		expect(src).toContain(
			'onExternalThreadActionHandled?.(externalThreadAction.token)'
		);
		expect(src).toContain('handleMarkThreadRead');
	});

	it('CommentsReviewThreadCard relocated under commentsReview/', () => {
		expect(
			existsSync(join(commentsReviewDir, 'CommentsReviewThreadCard.tsx'))
		).toBe(true);
		expect(existsSync(join(panelsDir, 'CommentsReviewThreadCard.tsx'))).toBe(
			false
		);
	});

	it('all wave child modules exist', () => {
		for (const name of allWaveModules) {
			expect(existsSync(join(commentsReviewDir, name))).toBe(true);
		}
	});

	it('facade and all child modules stay within LOC gate', () => {
		const facadeLoc = lineCount(facadePath);
		const innerLoc = lineCount(innerPath);
		expect(facadeLoc).toBeLessThanOrEqual(800);
		expect(innerLoc).toBeLessThanOrEqual(800);

		for (const name of allWaveModules) {
			const childLoc = lineCount(join(commentsReviewDir, name));
			expect(childLoc).toBeLessThanOrEqual(800);
		}
	});
});
