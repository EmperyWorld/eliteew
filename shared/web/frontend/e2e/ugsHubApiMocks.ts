/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Playwright route mocks for UGS Hub E2E (paginated tasks + minimal dashboard).
 *
 * Related:
 * - e2e/ugs-hub-wave4.spec.ts
 * - e2e/ugs-hub-generate-stream-golden.spec.ts
 */

import type { Page } from 'playwright/test';

function makeMockTask(index: number) {
	const iso = new Date(Date.UTC(2026, 4, 1, 12, 0, index)).toISOString();
	return {
		id: `e2e-task-${index}`,
		type_key: 'image_gen',
		status: index % 5 === 0 ? 'completed' : 'processing',
		created_at: iso,
		updated_at: iso,
		user_id: 'e2e-user',
		priority: 0,
	};
}

export interface UgsHubTasksRequestTracker {
	urls: string[];
}

export interface InstallUgsHubMocksOptions {
	/** Total tasks reported across pages (default 150 → hasNextPage with limit 100). */
	totalTasks?: number;
	/** Collect GET /tasks list URLs (excluding tray-summary) for network assertions. */
	tasksRequestTracker?: UgsHubTasksRequestTracker;
	/** Shallow-merge into default queue-ops JSON (backlog prefetch E2E). */
	queueOpsPatch?: Record<string, unknown>;
	/** Override GET /types JSON body (default empty list). */
	types?: unknown[];
}

export async function installUgsHubApiMocks(
	page: Page,
	opts: InstallUgsHubMocksOptions = {}
): Promise<void> {
	const totalTasks = opts.totalTasks ?? 150;
	const tasksRequestTracker = opts.tasksRequestTracker;
	const queueOpsPatch = opts.queueOpsPatch ?? {};

	await page.route('**/api/v1/ugs/tasks**', async (route) => {
		const url = new URL(route.request().url());
		if (url.pathname.includes('/tray-summary')) {
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({
					active_count: 0,
					active_tasks: [],
					recent_transitions: [],
					server_time: new Date().toISOString(),
				}),
			});
			return;
		}

		tasksRequestTracker?.urls.push(route.request().url());

		const offset = Number(url.searchParams.get('offset') || 0);
		const limit = Number(url.searchParams.get('limit') || 100);
		const remaining = Math.max(0, totalTasks - offset);
		const count = Math.min(limit, remaining);
		const tasks = Array.from({ length: count }, (_, i) =>
			makeMockTask(offset + i)
		);

		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify(tasks),
		});
	});

	await page.route('**/api/v1/ugs/stats', async (route) => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				total_generations: totalTasks,
				active_tasks: 0,
				completed_today: 0,
				failed_today: 0,
				avg_response_time: 0,
				queue_size: 0,
			}),
		});
	});

	await page.route('**/api/v1/ugs/types**', async (route) => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify(opts.types ?? []),
		});
	});

	await page.route('**/api/v1/ugs/providers/status**', async (route) => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				providers: [],
				summary: {
					total: 0,
					healthy: 0,
					unhealthy: 0,
					average_response_time: 0,
				},
			}),
		});
	});

	await page.route('**/api/v1/ugs/admin/queue-ops**', async (route) => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				status: 'degraded',
				timestamp: new Date().toISOString(),
				postgres: {
					total_queued: 45,
					stale_candidates: { total: 0 },
					dlq_finalized_failed_24h: 0,
				},
				rabbitmq: { ok: true, queues: [] },
				redis: { ugs_worker_leases: { available: true, active_leases: 2 } },
				hints: [
					{
						level: 'warning',
						code: 'main_queue_backlog',
						message: 'E2E mock backlog',
					},
				],
				...queueOpsPatch,
			}),
		});
	});
}
