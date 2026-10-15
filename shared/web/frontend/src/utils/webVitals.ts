/**
 * Core Web Vitals — локальная реализация (MIT, проект), без пакета `web-vitals` (Apache-2.0).
 * Покрытие: CLS, LCP, FCP, TTFB. INP официально требует тот же алгоритм, что у Google CWV —
 * здесь он намеренно не дублируется; при появлении стабильного Event/Interaction Timing в целевых
 * браузерах можно расширить отдельно.
 *
 * Вызывается один раз из entry (main и т.д.).
 */

import { log } from '@utils/logger';

interface WebVitalsReport {
	name: string;
	value: number;
	rating: 'good' | 'needs-improvement' | 'poor';
	delta: number;
	id: string;
}

export interface MetricLite {
	name: 'CLS' | 'LCP' | 'FCP' | 'TTFB' | 'INP';
	value: number;
	delta: number;
	id: string;
}

const THRESHOLDS = {
	LCP: { good: 2500, poor: 4000 },
	INP: { good: 200, poor: 500 },
	CLS: { good: 0.1, poor: 0.25 },
	FCP: { good: 1800, poor: 3000 },
	TTFB: { good: 600, poor: 1800 },
} as const;

function getRating(
	name: keyof typeof THRESHOLDS,
	value: number
): 'good' | 'needs-improvement' | 'poor' {
	const threshold = THRESHOLDS[name];
	if (value <= threshold.good) return 'good';
	if (value <= threshold.poor) return 'needs-improvement';
	return 'poor';
}

function metricId(metric: MetricLite['name']): string {
	const tail =
		globalThis.crypto?.randomUUID?.() ??
		Math.random().toString(36).slice(2, 10);
	return `ew-${metric}-${Date.now().toString(36)}-${tail}`;
}

function formatMetricReport(metric: MetricLite): WebVitalsReport {
	return {
		name: metric.name,
		value: metric.value,
		rating: getRating(metric.name, metric.value),
		delta: metric.delta,
		id: metric.id,
	};
}

function logToConsole(report: WebVitalsReport): void {
	const emoji =
		report.rating === 'good'
			? '✅'
			: report.rating === 'needs-improvement'
				? '⚠️'
				: '❌';
	const color =
		report.rating === 'good'
			? '#10b981'
			: report.rating === 'needs-improvement'
				? '#f59e0b'
				: '#ef4444';
	const suffix = report.name === 'CLS' ? '' : 'ms';

	console.groupCollapsed(
		`%c${emoji} ${report.name}: ${report.value.toFixed(2)}${suffix}`,
		`color: ${color}; font-weight: bold; font-size: 12px;`
	);
	log.info('WebVitals', 'Rating', report.rating);
	log.info('WebVitals', 'Delta', report.delta);
	log.info('WebVitals', 'ID', report.id);
	console.groupEnd();
}

function sendToAnalytics(_report: WebVitalsReport): void {
	if (process.env.NODE_ENV === 'production') {
		// Заготовка под бэкенд / GA — см. историю файла
	}
}

function handleMetric(metric: MetricLite): void {
	const report = formatMetricReport(metric);
	if (process.env.NODE_ENV === 'development') {
		logToConsole(report);
	}
	sendToAnalytics(report);
}

function observeTTFBOnce(): void {
	try {
		const nav = performance.getEntriesByType('navigation')[0] as
			| PerformanceNavigationTiming
			| undefined;
		if (!nav) return;
		const ms = nav.responseStart - nav.requestStart;
		if (Number.isFinite(ms) && ms >= 0) {
			handleMetric({
				name: 'TTFB',
				value: ms,
				delta: ms,
				id: metricId('TTFB'),
			});
		}
	} catch {
		/* ignore */
	}
}

function observePaintOnce(kind: 'FCP'): void {
	try {
		const paints = performance.getEntriesByType('paint');
		for (let i = paints.length - 1; i >= 0; i--) {
			const p = paints[i];
			if (p.name !== 'first-contentful-paint') continue;
			const ms = p.startTime;
			handleMetric({
				name: kind,
				value: ms,
				delta: ms,
				id: metricId('FCP'),
			});
			return;
		}
	} catch {
		/* ignore */
	}
}

/** Накопление LCP/CLS без спама в консоль; один отчёт на сессию просмотра страницы. */
let lcpLastMs = 0;
let clsAccum = 0;
let clsLastContribution = 0;
let cwvSessionFlushed = false;

function flushLcpAndClsOnce(): void {
	if (cwvSessionFlushed) return;
	cwvSessionFlushed = true;
	if (lcpLastMs > 0) {
		handleMetric({
			name: 'LCP',
			value: lcpLastMs,
			delta: lcpLastMs,
			id: metricId('LCP'),
		});
	}
	if (clsAccum > 0) {
		handleMetric({
			name: 'CLS',
			value: clsAccum,
			delta: clsLastContribution,
			id: metricId('CLS'),
		});
	}
}

function registerCwvSessionEndFlush(): void {
	const flush = () => flushLcpAndClsOnce();
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') flush();
	});
	window.addEventListener('pagehide', flush, { passive: true });
	// Вкладка может не уходить в hidden долго — отдать снимок для dev/аналитики.
	window.setTimeout(flush, 12_000);
}

function observeLCP(): void {
	if (typeof PerformanceObserver === 'undefined') return;
	try {
		const po = new PerformanceObserver((entryList) => {
			const entries = entryList.getEntries();
			const last = entries[entries.length - 1] as PerformanceEntry & {
				renderTime?: number;
				loadTime?: number;
			};
			const value =
				(last.renderTime && last.renderTime > 0
					? last.renderTime
					: last.loadTime && last.loadTime > 0
						? last.loadTime
						: last.startTime) ?? last.startTime;
			lcpLastMs = value;
		});
		po.observe({ type: 'largest-contentful-paint', buffered: true });
	} catch {
		/* LCP недоступен */
	}
}

function observeCLS(): void {
	if (typeof PerformanceObserver === 'undefined') return;
	try {
		const po = new PerformanceObserver((entryList) => {
			for (const raw of entryList.getEntries()) {
				const ls = raw as PerformanceEntry & {
					value?: number;
					hadRecentInput?: boolean;
				};
				if (ls.value == null || ls.hadRecentInput) continue;
				clsLastContribution = ls.value;
				clsAccum += ls.value;
			}
		});
		po.observe({ type: 'layout-shift', buffered: true });
	} catch {
		/* CLS недоступен */
	}
}

/**
 * Однократный запуск подписчиков CWV в браузере.
 */
export function initWebVitals(): void {
	observeTTFBOnce();
	observePaintOnce('FCP');
	registerCwvSessionEndFlush();
	observeLCP();
	observeCLS();
	log.info(
		'WebVitals',
		'Monitoring initialized (native: TTFB, FCP, LCP, CLS; INP omit by design)'
	);
}

/** Снимок по уже буферизованным Performance entries (без ожидания новых наблюдений). */
export async function getCurrentWebVitals(): Promise<WebVitalsReport[]> {
	const out: WebVitalsReport[] = [];

	await new Promise((r) => setTimeout(r, 0));

	try {
		const nav = performance.getEntriesByType('navigation')[0] as
			| PerformanceNavigationTiming
			| undefined;
		if (nav) {
			const ms = nav.responseStart - nav.requestStart;
			if (Number.isFinite(ms) && ms >= 0) {
				out.push(
					formatMetricReport({
						name: 'TTFB',
						value: ms,
						delta: ms,
						id: metricId('TTFB'),
					})
				);
			}
		}
	} catch {
		/* */
	}

	let clsSum = 0;
	try {
		const shifts = performance.getEntriesByType('layout-shift');
		for (const e of shifts) {
			const ls = e as PerformanceEntry & {
				value?: number;
				hadRecentInput?: boolean;
			};
			if (ls.value == null || ls.hadRecentInput) continue;
			clsSum += ls.value;
		}
		out.push(
			formatMetricReport({
				name: 'CLS',
				value: clsSum,
				delta: clsSum,
				id: metricId('CLS'),
			})
		);
	} catch {
		/* */
	}

	try {
		const paints = performance.getEntriesByType('paint');
		for (const p of paints) {
			if (p.name !== 'first-contentful-paint') continue;
			out.push(
				formatMetricReport({
					name: 'FCP',
					value: p.startTime,
					delta: p.startTime,
					id: metricId('FCP'),
				})
			);
			break;
		}
	} catch {
		/* */
	}

	try {
		const lcpCandidates = performance.getEntriesByType(
			'largest-contentful-paint'
		);
		if (lcpCandidates.length > 0) {
			const last = lcpCandidates[
				lcpCandidates.length - 1
			] as PerformanceEntry & {
				renderTime?: number;
				loadTime?: number;
			};
			const value =
				(last.renderTime && last.renderTime > 0
					? last.renderTime
					: last.loadTime && last.loadTime > 0
						? last.loadTime
						: last.startTime) ?? last.startTime;
			out.push(
				formatMetricReport({
					name: 'LCP',
					value,
					delta: value,
					id: metricId('LCP'),
				})
			);
		}
	} catch {
		/* */
	}

	return out;
}

export type { WebVitalsReport };
