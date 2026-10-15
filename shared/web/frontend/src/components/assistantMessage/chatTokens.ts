/**
 * Typography and spacing tokens for Arly chat message bubbles and metadata.
 * Use these class names for consistent appearance across MessageList and AssistantMessageRenderer.
 *
 * Token budget / context copy and small format helpers live here so status lines and notices
 * stay consistent (long contexts, truncation, tool traces).
 *
 * Chat chrome (scroll shell, z-index, row rhythm) is aligned with `MessageList` and
 * `ChatSkeletons` (`MessageListSkeleton`, `ChatHeaderSkeleton` legacy name).
 */

/** Join Tailwind class fragments; omit falsy entries. */
function cx(...parts: Array<string | false | undefined | null>): string {
	return parts.filter(Boolean).join(' ');
}

// --- Context window & token budget (thresholds + user-facing copy) ---

/** Above this share of the context limit, show a “filling up” hint. */
export const CONTEXT_USAGE_HIGH_RATIO = 0.75;

/** Above this share, warn that the window is nearly full. */
export const CONTEXT_USAGE_CRITICAL_RATIO = 0.95;

export type ContextPressureLevel = 'ok' | 'high' | 'critical';

/**
 * Classify how full the context window is (used / limit).
 * Invalid or zero limit yields `ok` (no pressure UI).
 */
export function getContextPressureLevel(
	usedTokens: number,
	limitTokens: number
): ContextPressureLevel {
	if (
		!Number.isFinite(usedTokens) ||
		!Number.isFinite(limitTokens) ||
		limitTokens <= 0
	) {
		return 'ok';
	}
	const ratio = usedTokens / limitTokens;
	if (ratio >= CONTEXT_USAGE_CRITICAL_RATIO) return 'critical';
	if (ratio >= CONTEXT_USAGE_HIGH_RATIO) return 'high';
	return 'ok';
}

/** Short hint for status UI; empty string when no extra message is needed. */
export const CONTEXT_PRESSURE_HINT: Record<ContextPressureLevel, string> = {
	ok: '',
	high: 'Контекст почти заполнен — старые реплики могут сжиматься или отбрасываться.',
	critical:
		'Лимит контекста почти исчерпан; для надёжности начните новый чат или уберите лишние вложения.',
};

/**
 * Notice when the backend signals that history/attachments were truncated before a reply.
 * Pair with `truncation_notice` (or similar) from chat metadata.
 */
export const LONG_CONTEXT_TRUNCATION_TITLE = 'Контекст сокращён';

export const LONG_CONTEXT_TRUNCATION_BODY =
	'Часть более ранних сообщений или вложений не поместилась в окно модели; ответ опирается на сохранённый фрагмент истории.';

// --- Tool / orchestrator trace blocks (fenced ```trace```, [STEP], etc.) ---

/** `aria-label` for the trace `<aside>` region */
export const TOOL_TRACE_REGION_ARIA_LABEL =
	'Служебная трассировка: шаги планировщика и вызовы инструментов, не пользовательский ответ';

/** Visible heading above trace body */
export const TOOL_TRACE_HEADER_LABEL = 'Трассировка инструментов';

export const TOOL_TRACE_COPY_ARIA_LABEL =
	'Копировать текст трассировки инструментов';

export const TOOL_TRACE_COPY_TITLE_IDLE = 'Копировать трассировку инструментов';

export const TOOL_TRACE_COPY_TITLE_DONE = 'Скопировано';

export const TOOL_TRACE_COPY_BUTTON_IDLE = 'Копировать';

export const TOOL_TRACE_COPY_BUTTON_DONE = 'Скопировано';

// --- Formatting helpers (token counts in UI) ---

/**
 * Full token count for precise budget lines (long contexts, large limits).
 * Uses grouping appropriate for Russian locale.
 */
export function formatTokenCountFull(tokens: number): string {
	if (!Number.isFinite(tokens) || tokens < 0) return '—';
	return new Intl.NumberFormat('ru-RU', {
		maximumFractionDigits: 0,
	}).format(Math.round(tokens));
}

/**
 * Compact token count for tight UI (badges, secondary lines).
 * Examples: 842 → "842", 1_600 → "1,6k", 48_000 → "48k".
 */
export function formatCompactTokenCount(tokens: number): string {
	if (!Number.isFinite(tokens) || tokens < 0) return '—';
	if (tokens < 1000) return String(Math.round(tokens));
	if (tokens < 10_000) {
		const k = tokens / 1000;
		const s = k >= 10 ? k.toFixed(0) : k.toFixed(1).replace('.', ',');
		return `${s.replace(/,0$/, '')}k`;
	}
	if (tokens < 1_000_000) return `${Math.round(tokens / 1000)}k`;
	const m = tokens / 1_000_000;
	const s = m >= 10 ? m.toFixed(0) : m.toFixed(1).replace('.', ',');
	return `${s.replace(/,0$/, '')}M`;
}

/** One-line budget: "12 345 / 128 000 токенов" */
export function formatTokenBudgetLine(used: number, limit: number): string {
	return `${formatTokenCountFull(used)} / ${formatTokenCountFull(limit)} токенов`;
}

/** Compact budget for narrow headers: "12k / 128k ток." */
export function formatTokenBudgetLineCompact(
	used: number,
	limit: number
): string {
	return `${formatCompactTokenCount(used)} / ${formatCompactTokenCount(limit)} ток.`;
}

/** Percent of context used, for screen readers or tooltips; 0–100, no % sign. */
export function formatContextUsagePercent(used: number, limit: number): string {
	if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0)
		return '—';
	const pct = Math.min(100, Math.max(0, (100 * used) / limit));
	return new Intl.NumberFormat('ru-RU', {
		maximumFractionDigits: pct >= 10 ? 0 : 1,
	}).format(pct);
}

/** Optional suffix for tooltips: "занято 87,2 % окна контекста" */
export function formatContextUsageTooltip(used: number, limit: number): string {
	const p = formatContextUsagePercent(used, limit);
	if (p === '—') return 'Размер окна контекста неизвестен';
	return `Занято ${p} % окна контекста`;
}

/** Padding inside message bubbles (px, py) */
export const BUBBLE_PADDING = 'px-4 py-2.5';

/** Compact variant for density mode */
export const BUBBLE_PADDING_COMPACT = 'px-3 py-1.5';

/** Gap between consecutive messages */
export const MESSAGE_GAP = 'space-y-3';

/** Compact message gap */
export const MESSAGE_GAP_COMPACT = 'space-y-2';

/**
 * Flex `gap` for list tail blocks (typing row + end anchor) — same 0.75rem step as `MESSAGE_GAP`.
 */
export const CHAT_LIST_TAIL_GAP = 'gap-3';

// --- Chat chrome: scroll viewport, sticky layers, row rhythm (MessageList + ChatSkeletons) ---

/** Scroll viewport shell when the list is loading (skeleton) or populated. */
export const CHAT_LIST_SCROLL_OVERFLOW =
	'flex-1 min-h-0 min-w-0 overflow-y-auto relative [overflow-anchor:none]';

/** Horizontal + vertical inset for the message history scroll area (`p-4`). */
export const CHAT_LIST_INSET = 'p-4';

/**
 * Bottom scroll-padding so the last messages clear the input chrome (~5.5rem).
 * Equivalent to `[scroll-padding-bottom:5.5rem]` on the live `MessageList` root.
 */
export const CHAT_LIST_SCROLL_PADDING_BOTTOM = 'scroll-pb-22';

/**
 * Full scroll container: overflow shell + inset + bottom scroll-padding + vertical message gap.
 * @param messageGap `MESSAGE_GAP` or `MESSAGE_GAP_COMPACT`
 */
export function chatListScrollContainerClass(messageGap: string): string {
	return cx(
		CHAT_LIST_SCROLL_OVERFLOW,
		CHAT_LIST_INSET,
		CHAT_LIST_SCROLL_PADDING_BOTTOM,
		messageGap
	);
}

/** Per-message row vertical rhythm (`motion.article` / `MessageRowSkeleton`). */
export const CHAT_MESSAGE_ROW_Y = 'py-1';

/** Virtualized row wrapper spacing under measured items. */
export const CHAT_VIRTUAL_ROW_PAD_BOTTOM = 'pb-3';

/** Typing-indicator row top padding. */
export const CHAT_TYPING_ROW_PAD_TOP = 'pt-1';

/** Focus/jump target: margin below last line so content clears the input bar. */
export const CHAT_LIST_END_SCROLL_MARGIN = 'scroll-mb-28';

/** Overlapping avatars, sticky “load older” strip — above message paint by default. */
export const CHAT_LAYER_OVERLAY_LOW = 'z-10';

/** Scroll-to-bottom FAB sticky wrapper — above `CHAT_LAYER_OVERLAY_LOW`. */
export const CHAT_LAYER_SCROLL_JUMP = 'z-20';

/** Sticky vertical offset for the scroll-down control cluster. */
export const CHAT_SCROLL_JUMP_STICKY_BOTTOM = 'bottom-3';

/**
 * Assistant avatar: **top-right** of bubble (`-right-4 -top-4` как в `GAFChatApp`); user — bottom-left.
 * Matches `MessageList` + `MessageBubbleSkeleton` (align === 'left').
 */
export const CHAT_ASSISTANT_AVATAR_OFFSET =
	'-right-4 -top-4 z-20 sm:-right-4 sm:-top-4';

/** Horizontal gutter so текст не заезжает под аватар ассистента справа. */
export const CHAT_ASSISTANT_LANE_GUTTER = 'pr-12 sm:pr-14';

/** User avatar: bottom-left of bubble (toward center). Live list + skeleton. */
export const CHAT_USER_AVATAR_OFFSET =
	'-bottom-2 -left-2 z-20 sm:-bottom-3 sm:-left-3';

/** Tool-run separator row: horizontal rule + pill (MessageList). */
export const CHAT_TOOL_SEPARATOR_ROW = 'flex min-w-0 items-center gap-3 py-2';

/** Empty-state section: scrollable main area without `min-w-0` (MessageList empty view). */
export const CHAT_EMPTY_SCROLL_SECTION = 'flex-1 min-h-0 overflow-y-auto p-4';

/** Chat header chrome height (see `ChatHeaderSkeleton`). */
export const CHAT_HEADER_HEIGHT = 'h-14';

/** Header horizontal padding (see `ChatHeaderSkeleton`). */
export const CHAT_HEADER_INSET_X = 'px-4';

/** Bubble border radius */
export const BUBBLE_RADIUS = 'rounded-2xl';

export const BUBBLE_RADIUS_COMPACT = 'rounded-xl';

/**
 * Внешняя обёртка пузыря: `relative` для аватаров, **без** overflow — иначе `absolute` аватары
 * (-top/-right) обрезаются. См. `MessageList` / `ChatSkeletons`.
 */
export const BUBBLE_OUTER_WRAP = 'relative w-full min-w-0 max-w-full';

/**
 * Внутренняя поверхность пузыря: горизонтальный скролл только для контента (таблицы, длинные URL).
 * Не вешать на тот же узел, где висят аватары за пределами рамки.
 */
export const BUBBLE_FILL_LANE = 'w-full min-w-0 max-w-full overflow-x-auto';

/** Body text in bubbles */
export const BUBBLE_TEXT = 'text-sm';

/**
 * Общая оптика тела сообщения: вопрос пользователя и markdown-ответ ассистента (см. `PROSE_CONTAINER`).
 */
export const BUBBLE_BODY_METRICS =
	'min-w-0 max-w-full break-words text-[0.9375rem] sm:text-[0.95rem] leading-[1.65] tracking-[0.015em] antialiased [font-feature-settings:"kern"_1,"liga"_1] [overflow-wrap:anywhere]';

/** Плоский текст пользователя в пузыре — те же размер/интерлиньяж, что у ответа модели. */
export const BUBBLE_BODY_USER = cx(
	BUBBLE_BODY_METRICS,
	'text-(--desktop-text-primary)'
);

/** Плейсхолдер/пустой ассистент без markdown — та же сетка, цвет как у prose. */
export const BUBBLE_BODY_ASSISTANT_PLAIN = cx(
	BUBBLE_BODY_METRICS,
	'text-[color-mix(in_srgb,var(--desktop-text-secondary)_94%,white_6%)]'
);

/** Time/metadata text size and color */
export const META_TEXT = 'text-[11px] text-(--desktop-text-muted) mt-1.5';

export const META_TEXT_COMPACT = 'text-[10px] text-(--desktop-text-dim) mt-1';

/** Inline token / context budget line (same rhythm as message metadata). */
export const CONTEXT_BUDGET_TEXT = META_TEXT;

/** Secondary line under budget: hints, truncation, tool-trace captions. */
export const CONTEXT_BUDGET_HINT_TEXT = META_TEXT_COMPACT;

/**
 * Assistant markdown: slightly larger body, relaxed leading; headings use editorial serif
 * for clear structure (sans body + serif titles reads “premium” without extra font files).
 */
export const PROSE_CONTAINER = cx(
	BUBBLE_BODY_METRICS,
	'text-[color-mix(in_srgb,var(--desktop-text-secondary)_94%,white_6%)]'
);

/** Serif stack for headings inside assistant bubbles */
export const PROSE_HEADING_FONT =
	"font-[ui-serif,Georgia,Cambria,'Times_New_Roman',serif]";

/** Paragraph spacing — clear blocks */
export const PROSE_P = 'my-3 first:mt-0 last:mb-0 [&+p]:mt-2';

/** Lists — indented, spaced from body */
export const PROSE_UL =
	'my-3 list-disc space-y-1.5 pl-5 marker:text-[rgb(var(--desktop-accent-rgb)/0.75)] first:mt-0 last:mb-0';
export const PROSE_OL =
	'my-3 list-decimal space-y-1.5 pl-5 marker:font-medium marker:text-(--desktop-text-dim) first:mt-0 last:mb-0';

export const PROSE_LI = 'whitespace-pre-wrap pl-0.5 leading-relaxed';

/** Code inline */
export const PROSE_CODE =
	'rounded-md border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-app)_88%,transparent)] px-1.5 py-px font-mono text-[0.8125rem] text-(--desktop-text-primary)';

/** Code block */
export const PROSE_PRE =
	'my-2 overflow-x-auto rounded-lg bg-black/40 p-2 text-xs';

/** GFM + streaming: safe http(s) anchors */
export const PROSE_LINK =
	'break-words font-medium text-[rgb(var(--desktop-accent-rgb))] underline decoration-[rgb(var(--desktop-accent-rgb)/0.45)] underline-offset-2 transition hover:text-(--desktop-text-primary) hover:decoration-[rgb(var(--desktop-accent-rgb)/0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[color-mix(in_srgb,var(--desktop-surface-app)_100%,transparent)]';

/** Long bare URLs in streaming paragraphs */
export const PROSE_LINK_STREAMING = `${PROSE_LINK} break-all`;

/** Disallowed protocol / invalid URL: text only, no navigation */
export const PROSE_LINK_DISABLED =
	'break-words text-(--desktop-text-muted) [text-decoration:underline_dotted] decoration-(--desktop-border-strong)/70';

/** Shared chrome for fenced code, lists, trace blocks */
export const ASSISTANT_BLOCK_FRAME =
	'my-4 overflow-hidden rounded-xl border border-(--desktop-border-strong) bg-(--desktop-surface-app) first:mt-0 last:mb-0';

export const ASSISTANT_BLOCK_TOOLBAR =
	'flex items-center justify-between gap-3 border-b border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_60%,transparent)] px-3 py-2';

export const ASSISTANT_BLOCK_TOOLBAR_LABEL =
	'min-w-0 truncate font-mono text-[11px] uppercase tracking-[0.24em] text-(--desktop-text-dim)';

export const ASSISTANT_COPY_BUTTON =
	'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-2 py-1 text-[11px] font-medium text-(--desktop-text-secondary) transition hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary) disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/40 active:scale-[0.99]';

/** Scrollable body under syntax highlighter */
export const ASSISTANT_CODE_BODY_SCROLL =
	'max-h-[min(28rem,55vh)] min-w-0 overflow-x-auto overflow-y-auto';

/** Blockquote body in assistant markdown */
export const PROSE_BLOCKQUOTE =
	'my-4 border-l-[3px] border-[rgb(var(--desktop-accent-rgb)/0.5)] bg-[color-mix(in_srgb,var(--desktop-surface-soft)_58%,transparent)] py-2 pl-4 pr-3 text-[0.925rem] italic text-[color-mix(in_srgb,var(--desktop-text-secondary)_88%,white_12%)] first:mt-0 last:mb-0 rounded-r-lg [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0';

/** GFM table scroll shell */
export const PROSE_TABLE_SCROLL =
	'my-4 min-w-0 max-w-full overflow-x-auto rounded-xl border border-(--desktop-border-strong) bg-[color-mix(in_srgb,var(--desktop-surface-app)_45%,transparent)] first:mt-0 last:mb-0';
