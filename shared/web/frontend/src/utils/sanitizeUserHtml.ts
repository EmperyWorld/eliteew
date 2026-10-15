/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Conservative HTML sanitizers for user/markdown content and search highlight snippets
 * before `dangerouslySetInnerHTML`.
 *
 * Invariants:
 * - `sanitizeUserHtml` allowlist is tuned for rich markdown previews.
 * - User HTML previews do not load remote/inline images; images are downgraded to text by policy.
 * - `sanitizeSearchHighlightHtml` allows only inline emphasis tags from search API highlights.
 * - `sanitizeMermaidSvg` allows SVG drawing primitives only; script/event handlers and external URL protocols are stripped.
 *
 * Related:
 * - `components/UltimateDocEditor/Panels/SearchPanel.tsx`
 * - `components/UltimateDocEditor/utils/renderMarkdownToHtml.ts`
 * - `features/desktop-ai-chat/DesktopAiChatMarkdown.tsx`
 */
import sanitizeHtml from 'sanitize-html';

/**
 * Conservative allowlist for user/markdown-produced HTML before `dangerouslySetInnerHTML`.
 * Replaces dual-license DOMPurify with MIT `sanitize-html`.
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: [
		'a',
		'abbr',
		'b',
		'blockquote',
		'br',
		'caption',
		'cite',
		'code',
		'col',
		'colgroup',
		'dd',
		'div',
		'dl',
		'dt',
		'em',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'hr',
		'i',
		'kbd',
		'li',
		'ol',
		'p',
		'pre',
		'q',
		's',
		'span',
		'strike',
		'strong',
		'sub',
		'sup',
		'table',
		'tbody',
		'td',
		'tfoot',
		'th',
		'thead',
		'tr',
		'u',
		'ul',
	],
	allowedAttributes: {
		a: ['href', 'name', 'target', 'rel', 'title'],
		td: ['colspan', 'rowspan'],
		th: ['colspan', 'rowspan'],
		col: ['span'],
		colgroup: ['span'],
		div: ['class'],
		span: ['class'],
		code: ['class'],
		pre: ['class'],
		p: ['class'],
		blockquote: ['class'],
	},
	allowedStyles: {},
	allowedSchemes: ['http', 'https', 'mailto'],
	allowProtocolRelative: false,
};

const SEARCH_HIGHLIGHT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: ['mark', 'em', 'strong', 'b', 'span'],
	allowedAttributes: {
		mark: ['class'],
		span: ['class'],
	},
	allowedSchemes: [],
};

const MERMAID_SVG_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: [
		'svg',
		'g',
		'path',
		'rect',
		'circle',
		'ellipse',
		'line',
		'polyline',
		'polygon',
		'text',
		'tspan',
		'defs',
		'marker',
		'pattern',
		'linearGradient',
		'radialGradient',
		'stop',
		'clipPath',
		'foreignObject',
		'div',
		'span',
		'p',
		'br',
	],
	allowedAttributes: {
		'*': [
			'id',
			'class',
			'role',
			'aria-label',
			'aria-roledescription',
			'aria-hidden',
			'focusable',
			'transform',
			'fill',
			'stroke',
			'stroke-width',
			'stroke-linecap',
			'stroke-linejoin',
			'stroke-dasharray',
			'stroke-opacity',
			'fill-opacity',
			'opacity',
			'x',
			'y',
			'x1',
			'y1',
			'x2',
			'y2',
			'cx',
			'cy',
			'r',
			'rx',
			'ry',
			'width',
			'height',
			'points',
			'd',
		],
		svg: ['xmlns', 'viewBox', 'width', 'height', 'preserveAspectRatio'],
		marker: [
			'id',
			'viewBox',
			'refX',
			'refY',
			'markerWidth',
			'markerHeight',
			'orient',
			'markerUnits',
		],
		pattern: [
			'id',
			'viewBox',
			'x',
			'y',
			'width',
			'height',
			'patternUnits',
			'patternTransform',
		],
		linearGradient: ['id', 'x1', 'x2', 'y1', 'y2', 'gradientUnits'],
		radialGradient: ['id', 'cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits'],
		stop: ['offset', 'stop-color', 'stop-opacity'],
		clipPath: ['id'],
		path: ['d', 'marker-start', 'marker-mid', 'marker-end'],
		text: ['text-anchor', 'dominant-baseline', 'font-size', 'font-family'],
		tspan: ['dx', 'dy', 'text-anchor'],
		foreignObject: ['x', 'y', 'width', 'height'],
		div: ['class'],
		span: ['class'],
		p: ['class'],
	},
	allowedSchemes: ['http', 'https'],
	allowProtocolRelative: false,
	parser: {
		lowerCaseTags: false,
		lowerCaseAttributeNames: false,
	},
};

export function sanitizeUserHtml(dirty: string): string {
	return sanitizeHtml(dirty, SANITIZE_OPTIONS);
}

/** Strip XSS from Elasticsearch highlight snippets before innerHTML render. */
export function sanitizeSearchHighlightHtml(dirty: string): string {
	return sanitizeHtml(dirty, SEARCH_HIGHLIGHT_SANITIZE_OPTIONS);
}

/** Strip active content from Mermaid-rendered SVG before assigning `innerHTML`. */
export function sanitizeMermaidSvg(dirty: string): string {
	return sanitizeHtml(dirty, MERMAID_SVG_SANITIZE_OPTIONS);
}
