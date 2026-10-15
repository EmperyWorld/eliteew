/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Playwright helper for collecting the desktop shell idle runtime smoke
 * profile used after compositor and reliability changes.
 *
 * Invariants:
 * - The helper only observes page state; it does not mutate shell data or auth.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md
 * ---
 */

import type { Page } from 'playwright/test';

/** Count running CSS animations under `root` (DOM lib has no Document.getAnimations options). */
function countRunningAnimationsInSubtree(root: ParentNode = document): number {
	let count = 0;
	if (root instanceof Element) {
		count += root
			.getAnimations()
			.filter((animation) => animation.playState === 'running').length;
	}
	for (const element of root.querySelectorAll('*')) {
		count += element
			.getAnimations()
			.filter((animation) => animation.playState === 'running').length;
	}
	return count;
}

export type DesktopRuntimeSmokeProfile = {
	buildId: string;
	frameCount: number;
	avgFrameMs: number;
	fps: number;
	p95FrameMs: number;
	longTaskCount: number;
	runningAnimationCount: number;
	hasDesktopMain: boolean;
	hasStaleChip: boolean;
	hasStalledLoader: boolean;
	title: string;
};

export async function collectDesktopRuntimeSmokeProfile(
	page: Page,
	options: { sampleMs?: number } = {}
): Promise<DesktopRuntimeSmokeProfile> {
	const sampleMs = Math.max(1000, Math.min(options.sampleMs ?? 8000, 30_000));
	return page.evaluate(async (durationMs) => {
		const startedAt = performance.now();
		const longTasks: number[] = [];
		let observer: PerformanceObserver | null = null;
		try {
			if (
				'PerformanceObserver' in window &&
				PerformanceObserver.supportedEntryTypes?.includes('longtask')
			) {
				observer = new PerformanceObserver((list) => {
					for (const entry of list.getEntries()) {
						longTasks.push(Math.round(entry.duration * 10) / 10);
					}
				});
				observer.observe({ entryTypes: ['longtask'] });
			}
		} catch {
			observer = null;
		}

		const frames: number[] = [];
		let lastFrameAt: number | null = null;
		await new Promise<void>((resolve) => {
			const tick = (now: number) => {
				if (lastFrameAt !== null) frames.push(now - lastFrameAt);
				lastFrameAt = now;
				if (performance.now() - startedAt >= durationMs) {
					resolve();
					return;
				}
				requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		});
		observer?.disconnect();

		const avgFrame =
			frames.reduce((acc, value) => acc + value, 0) /
			Math.max(1, frames.length);
		const sortedFrames = [...frames].sort((a, b) => a - b);
		const p95Frame = sortedFrames[Math.floor(sortedFrames.length * 0.95)] ?? 0;
		const bodyText = document.body?.innerText ?? '';
		const buildId = await fetch('/app-build-version.txt', { cache: 'no-store' })
			.then((response) => response.text())
			.catch(() => '');

		return {
			buildId: buildId.trim(),
			frameCount: frames.length,
			avgFrameMs: Math.round(avgFrame * 10) / 10,
			fps: Math.round((1000 / Math.max(avgFrame, 1)) * 10) / 10,
			p95FrameMs: Math.round(p95Frame * 10) / 10,
			longTaskCount: longTasks.length,
			runningAnimationCount: countRunningAnimationsInSubtree(document),
			hasDesktopMain: Boolean(document.querySelector('#desktop-main')),
			hasStaleChip: bodyText.includes('Состояние оболочки изменилось'),
			hasStalledLoader: bodyText.includes('открывается дольше обычного'),
			title: document.title,
		};
	}, sampleMs);
}
