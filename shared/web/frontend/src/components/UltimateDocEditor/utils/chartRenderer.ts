import type { JSONContent } from '@tiptap/core';
import { log } from '@/utils/logger';
import type {
	ChartConfig,
	ChartDataPoint,
	ChartType,
} from '../types/editor.types';

const FIGURE_BACKGROUND = '#0f172a';
const FIGURE_PANEL = '#111c33';
const FIGURE_BORDER = 'rgba(148, 163, 184, 0.22)';
const FIGURE_TEXT = '#e2e8f0';
const FIGURE_MUTED = '#94a3b8';
const FIGURE_GRID = 'rgba(148, 163, 184, 0.16)';
const DEFAULT_COLORS = [
	'#7c3aed',
	'#38bdf8',
	'#22c55e',
	'#f59e0b',
	'#f97316',
	'#ec4899',
	'#14b8a6',
];

interface NormalizedDataset {
	labels: string[];
	values: number[];
	colors: string[];
}

const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

const toDataUri = (svg: string): string => {
	// Base64 data URI is more reliable than URI-encoded SVG across browsers/editor sanitizers.
	try {
		const encoded = window.btoa(unescape(encodeURIComponent(svg)));
		return `data:image/svg+xml;base64,${encoded}`;
	} catch {
		return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
	}
};

function ensureSvgXmlnsOnly(svg: string): string {
	let s = svg.trim();
	if (!/^<svg/i.test(s)) {
		return s;
	}
	if (!/\sxmlns\s*=/.test(s)) {
		s = s.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
	}
	return s;
}

/** SVG в `<img src="data:image/svg+xml,...">`: xmlns + явные размеры вместо 100% на корне (стабильный intrinsic size). */
function ensureSvgForRasterImage(svg: string): string {
	let s = ensureSvgXmlnsOnly(svg);
	s = s.replace(/\bwidth\s*=\s*["']100%["']/gi, 'width="640"');
	s = s.replace(/\bheight\s*=\s*["']100%["']/gi, 'height="320"');
	return s;
}

/** Mermaid и др.: `data:` вместо `blob:` + xmlns (viewBox/размеры не переписываем). */
export function svgToDataUriForEditor(svg: string): string {
	return toDataUri(ensureSvgXmlnsOnly(svg));
}

const toColorArray = (
	value: string | string[] | undefined,
	size: number
): string[] => {
	if (Array.isArray(value) && value.length > 0) {
		return Array.from(
			{ length: size },
			(_, index) =>
				value[index] ??
				value[value.length - 1] ??
				DEFAULT_COLORS[index % DEFAULT_COLORS.length] ??
				'#7c3aed'
		);
	}
	if (typeof value === 'string' && value.trim()) {
		return Array.from({ length: size }, () => value);
	}
	return Array.from(
		{ length: size },
		(_, index) => DEFAULT_COLORS[index % DEFAULT_COLORS.length] ?? '#7c3aed'
	);
};

const normalizeValues = (
	data: number[] | ChartDataPoint[] | undefined
): number[] => {
	if (!data) {
		return [];
	}
	return data.map((item) => {
		if (typeof item === 'number') {
			return Number.isFinite(item) ? item : 0;
		}
		return Number.isFinite(item.value) ? item.value : 0;
	});
};

const normalizeLabels = (
	labels: string[] | undefined,
	data: number[] | ChartDataPoint[] | undefined
): string[] => {
	if (labels && labels.length > 0) {
		return labels.map((label, index) => label || `Пункт ${index + 1}`);
	}
	if (Array.isArray(data)) {
		return data.map((item, index) => {
			if (typeof item === 'number') {
				return `Пункт ${index + 1}`;
			}
			return item.label || `Пункт ${index + 1}`;
		});
	}
	return [];
};

const getDatasetColorCandidates = (
	data: number[] | ChartDataPoint[] | undefined,
	fallback: string | string[] | undefined,
	size: number
): string[] => {
	if (
		Array.isArray(data) &&
		data.some((item) => typeof item === 'object' && item !== null && item.color)
	) {
		return data.map((item, index) => {
			if (typeof item === 'number') {
				return DEFAULT_COLORS[index % DEFAULT_COLORS.length] ?? '#7c3aed';
			}
			return (
				item.color ||
				(DEFAULT_COLORS[index % DEFAULT_COLORS.length] ?? '#7c3aed')
			);
		});
	}
	return toColorArray(fallback, size);
};

const normalizeDataset = (config: ChartConfig): NormalizedDataset => {
	const dataset = config.datasets[0];
	const labels = normalizeLabels(config.labels, dataset?.data);
	const values = normalizeValues(dataset?.data);
	const size = Math.max(labels.length, values.length);
	const safeLabels = Array.from(
		{ length: size },
		(_, index) => labels[index] ?? `Пункт ${index + 1}`
	);
	const safeValues = Array.from(
		{ length: size },
		(_, index) => values[index] ?? 0
	);
	const colors = getDatasetColorCandidates(
		dataset?.data,
		dataset?.backgroundColor,
		size
	);

	return {
		labels: safeLabels,
		values: safeValues,
		colors,
	};
};

const describeSeries = (labels: string[], values: number[]): string => {
	return labels
		.map((label, index) => `${label}: ${values[index] ?? 0}`)
		.join(' · ');
};

const createGridLines = (): string => {
	const yPositions = [36, 88, 140, 192, 244];
	return yPositions
		.map(
			(y) =>
				`<line x1="56" y1="${y}" x2="604" y2="${y}" stroke="${FIGURE_GRID}" stroke-width="1" />`
		)
		.join('');
};

const createAxisLabels = (maxValue: number): string => {
	const yPositions = [244, 192, 140, 88, 36];
	return yPositions
		.map((y, index) => {
			const labelValue = Math.round((maxValue / 4) * index);
			return `<text x="48" y="${y + 4}" text-anchor="end" fill="${FIGURE_MUTED}" font-size="11">${escapeHtml(String(labelValue))}</text>`;
		})
		.join('');
};

const renderBarChartSvg = (
	labels: string[],
	values: number[],
	colors: string[]
): string => {
	const maxValue = Math.max(...values, 1);
	const barSpace = 548 / Math.max(labels.length, 1);
	const barWidth = Math.min(48, barSpace * 0.62);
	const bars = values
		.map((value, index) => {
			const ratio = maxValue === 0 ? 0 : value / maxValue;
			const height = Math.max(8, ratio * 208);
			const x = 56 + index * barSpace + (barSpace - barWidth) / 2;
			const y = 244 - height;
			const labelX = x + barWidth / 2;
			return [
				`<rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="12" fill="${colors[index] ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}" opacity="0.95" />`,
				`<text x="${labelX}" y="266" text-anchor="middle" fill="${FIGURE_MUTED}" font-size="11">${escapeHtml(labels[index] ?? '')}</text>`,
				`<text x="${labelX}" y="${Math.max(y - 8, 18)}" text-anchor="middle" fill="${FIGURE_TEXT}" font-size="11" font-weight="600">${escapeHtml(String(value))}</text>`,
			].join('');
		})
		.join('');

	return `
    <svg viewBox="0 0 640 320" width="100%" height="100%" role="img" aria-label="${escapeHtml(describeSeries(labels, values))}">
      <rect x="0" y="0" width="640" height="320" rx="20" fill="${FIGURE_PANEL}" />
      ${createGridLines()}
      ${createAxisLabels(maxValue)}
      <line x1="56" y1="244" x2="604" y2="244" stroke="${FIGURE_GRID}" stroke-width="1.2" />
      ${bars}
    </svg>
  `;
};

const renderLineLikeChartSvg = (
	labels: string[],
	values: number[],
	colors: string[],
	type: Extract<ChartType, 'line' | 'area'>
): string => {
	const maxValue = Math.max(...values, 1);
	const minValue = Math.min(...values, 0);
	const spread = Math.max(maxValue - minValue, 1);
	const step = labels.length > 1 ? 548 / (labels.length - 1) : 0;
	const points = values.map((value, index) => {
		const x = 56 + step * index;
		const ratio = (value - minValue) / spread;
		const y = 244 - ratio * 208;
		return { x, y, value, label: labels[index] ?? '' };
	});
	const polylinePoints = points
		.map((point) => `${point.x},${point.y}`)
		.join(' ');
	const lineColor = colors[0] ?? '#38bdf8';
	const areaPath = [
		`M ${points[0]?.x ?? 56} 244`,
		...points.map((point) => `L ${point.x} ${point.y}`),
		`L ${points[points.length - 1]?.x ?? 56} 244`,
		'Z',
	].join(' ');
	const pointLabels = points
		.map(
			(point) => `<g>
        <circle cx="${point.x}" cy="${point.y}" r="5" fill="${FIGURE_PANEL}" stroke="${lineColor}" stroke-width="3" />
        <text x="${point.x}" y="266" text-anchor="middle" fill="${FIGURE_MUTED}" font-size="11">${escapeHtml(point.label)}</text>
        <text x="${point.x}" y="${Math.max(point.y - 10, 18)}" text-anchor="middle" fill="${FIGURE_TEXT}" font-size="11" font-weight="600">${escapeHtml(String(point.value))}</text>
      </g>`
		)
		.join('');

	return `
    <svg viewBox="0 0 640 320" width="100%" height="100%" role="img" aria-label="${escapeHtml(describeSeries(labels, values))}">
      <rect x="0" y="0" width="640" height="320" rx="20" fill="${FIGURE_PANEL}" />
      ${createGridLines()}
      ${createAxisLabels(maxValue)}
      <line x1="56" y1="244" x2="604" y2="244" stroke="${FIGURE_GRID}" stroke-width="1.2" />
      ${
				type === 'area'
					? `<path d="${areaPath}" fill="${lineColor}" opacity="0.18" />`
					: ''
			}
      <polyline points="${polylinePoints}" fill="none" stroke="${lineColor}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      ${pointLabels}
    </svg>
  `;
};

const polarToCartesian = (
	centerX: number,
	centerY: number,
	radius: number,
	angleInDegrees: number
) => {
	const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
	return {
		x: centerX + radius * Math.cos(angleInRadians),
		y: centerY + radius * Math.sin(angleInRadians),
	};
};

const describeArc = (
	x: number,
	y: number,
	radius: number,
	startAngle: number,
	endAngle: number
) => {
	const start = polarToCartesian(x, y, radius, endAngle);
	const end = polarToCartesian(x, y, radius, startAngle);
	const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
	return `M ${x} ${y} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
};

const renderPieChartSvg = (
	labels: string[],
	values: number[],
	colors: string[]
): string => {
	const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0) || 1;
	let currentAngle = 0;
	const segments = values.map((value, index) => {
		const percentage = Math.max(value, 0) / total;
		const sweep = percentage * 360;
		const startAngle = currentAngle;
		currentAngle += sweep;
		const path = describeArc(212, 156, 92, startAngle, currentAngle);
		return {
			path,
			color:
				colors[index] ??
				DEFAULT_COLORS[index % DEFAULT_COLORS.length] ??
				'#7c3aed',
			label: labels[index] ?? '',
			value,
			percentage: Math.round(percentage * 100),
		};
	});

	const legend = segments
		.map(
			(segment, index) => `<g transform="translate(368, ${56 + index * 28})">
        <rect x="0" y="-10" width="12" height="12" rx="4" fill="${segment.color}" />
        <text x="20" y="0" fill="${FIGURE_TEXT}" font-size="12" font-weight="600">${escapeHtml(segment.label)}</text>
        <text x="200" y="0" text-anchor="end" fill="${FIGURE_MUTED}" font-size="11">${escapeHtml(String(segment.value))} · ${escapeHtml(String(segment.percentage))}%</text>
      </g>`
		)
		.join('');

	return `
    <svg viewBox="0 0 640 320" width="100%" height="100%" role="img" aria-label="${escapeHtml(describeSeries(labels, values))}">
      <rect x="0" y="0" width="640" height="320" rx="20" fill="${FIGURE_PANEL}" />
      ${segments.map((segment) => `<path d="${segment.path}" fill="${segment.color}" opacity="0.96" />`).join('')}
      <circle cx="212" cy="156" r="42" fill="${FIGURE_PANEL}" />
      <text x="212" y="150" text-anchor="middle" fill="${FIGURE_MUTED}" font-size="12">Всего</text>
      <text x="212" y="170" text-anchor="middle" fill="${FIGURE_TEXT}" font-size="20" font-weight="700">${escapeHtml(String(values.reduce((sum, value) => sum + value, 0)))}</text>
      ${legend}
    </svg>
  `;
};

const renderSvgByType = (
	type: ChartType,
	labels: string[],
	values: number[],
	colors: string[]
): string => {
	switch (type) {
		case 'bar':
			return renderBarChartSvg(labels, values, colors);
		case 'line':
			return renderLineLikeChartSvg(labels, values, colors, 'line');
		case 'area':
			return renderLineLikeChartSvg(labels, values, colors, 'area');
		case 'pie':
			return renderPieChartSvg(labels, values, colors);
		default:
			// Нельзя отдавать HTML в `data:image/svg+xml` — в `<img>` будет битая картинка.
			return renderBarChartSvg(labels, values, colors);
	}
};

/**
 * Вставка в TipTap: заголовок + картинка. `insertContent(JSON)` в обход HTML — используем `data:` SVG
 * (стабильнее `blob:`: не отзывается GC и не даёт «пустой» img после пересинхронизации документа).
 */
export function buildChartFigureTiptapContent(
	config: ChartConfig
): JSONContent[] {
	const { labels, values, colors } = normalizeDataset(config);
	const chartSvg = ensureSvgForRasterImage(
		renderSvgByType(config.type, labels, values, colors)
	);
	const src = toDataUri(chartSvg);
	const title = config.title?.trim() || 'Диаграмма';

	log.debug('chartRenderer', '[agent-debug]', {
		sessionId: 'ddc74d',
		hypothesisId: 'H-svg-img',
		location: 'chartRenderer.buildChartFigureTiptapContent',
		data: {
			srcLen: src.length,
			hasXmlns: chartSvg.includes('xmlns'),
			type: config.type,
		},
		timestamp: Date.now(),
	});

	// Блоковое изображение (`inline: false` в CustomImage) нельзя класть внутрь paragraph.
	return [
		{
			type: 'paragraph',
			content: [
				{
					type: 'text',
					text: title,
					marks: [{ type: 'bold' }],
				},
			],
		},
		{
			type: 'image',
			attrs: {
				src,
				alt: title,
				title: null,
			},
		},
	];
}

export interface BuildChartFigureHtmlOptions {
	/** По умолчанию true: строка с типом/суммой/рядами (экспорт HTML). Для вставки в документ — false. */
	includeMeta?: boolean;
}

export function buildChartFigureHtml(
	config: ChartConfig,
	options?: BuildChartFigureHtmlOptions
): string {
	const includeMeta = options?.includeMeta !== false;
	const { labels, values, colors } = normalizeDataset(config);
	const total = values.reduce((sum, value) => sum + value, 0);
	const maxValue = Math.max(...values, 0);
	const chartSvg = ensureSvgForRasterImage(
		renderSvgByType(config.type, labels, values, colors)
	);
	const chartDataUri = toDataUri(chartSvg);
	const summary = labels
		.map((label, index) => `${label}: ${values[index] ?? 0}`)
		.join(', ');
	const title = config.title?.trim() || 'Диаграмма';

	const metaBlock = includeMeta
		? `
    <p style="margin:0 0 20px 0;font-size:12px;line-height:1.6;color:${FIGURE_MUTED};">
      Тип: ${escapeHtml(config.type)} · Макс: ${escapeHtml(String(maxValue))} · Сумма: ${escapeHtml(String(total))} · ${escapeHtml(summary)}
    </p>`
		: '';

	return `
    <p style="margin:24px 0 10px 0;">
      <strong>${escapeHtml(title)}</strong>
    </p>
    <p style="margin:0 0 10px 0;">
      <img
        src="${chartDataUri}"
        alt="${escapeHtml(title)}"
        style="display:block;width:100%;max-width:720px;border-radius:20px;border:1px solid ${FIGURE_BORDER};background:${FIGURE_BACKGROUND};box-shadow:0 18px 40px rgba(15,23,42,0.24);"
      />
    </p>${metaBlock}
  `;
}
