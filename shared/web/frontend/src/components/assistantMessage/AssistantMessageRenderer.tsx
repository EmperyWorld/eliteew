/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders assistant bubble markdown in desktop/GAF chat with safe links, fenced code panels,
 * streaming-friendly segmentation, and a shared sanitize pipeline.
 *
 * Invariants:
 * - Untrusted markdown must pass URL guards and shared `rehype-sanitize` before rendering links/images.
 * - Streaming mode never blocks on heavy markdown transforms and keeps progressive text delivery stable.
 *
 * Related:
 * - src/features/desktop-ai-chat/DesktopAiChatMarkdown.tsx
 * - src/components/assistantMessage/sharedChatRehypePlugins.ts
 */
import { CodeBlock as SyntaxCodeBlock } from '@/components/CodeBlock';
import { buildSharedChatRehypePlugins } from '@/components/assistantMessage/sharedChatRehypePlugins';
import { safeCopyToClipboard } from '@/utils/clipboard';
import { cn } from '@/utils/cn';
import { isTrustedMarkdownImageSrc } from '@/utils/markdownSecurity';
import * as React from 'react';
import { useEffect, useId, useMemo, useState } from 'react';
import {
	CheckIcon,
	DocumentDuplicateIcon,
	WrenchIcon,
} from '@heroicons/react/24/outline';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { assistantReplyDisplayParts } from './assistantReplySanitize';
import {
	ASSISTANT_BLOCK_FRAME,
	ASSISTANT_BLOCK_TOOLBAR,
	ASSISTANT_BLOCK_TOOLBAR_LABEL,
	ASSISTANT_CODE_BODY_SCROLL,
	ASSISTANT_COPY_BUTTON,
	PROSE_BLOCKQUOTE,
	PROSE_CODE,
	PROSE_CONTAINER,
	PROSE_HEADING_FONT,
	PROSE_LI,
	PROSE_LINK,
	PROSE_LINK_DISABLED,
	PROSE_LINK_STREAMING,
	PROSE_P,
	PROSE_TABLE_SCROLL,
} from './chatTokens';

/** Тело ответа: `PROSE_CONTAINER` без отката к `text-sm`, чтобы совпадать с пузырём пользователя. */
const ASSISTANT_PROSE = cn(
	PROSE_CONTAINER,
	/** Vertical rhythm between mixed markdown blocks (tables, lists, fences). */
	'[&>*+*]:mt-1 [&_h1+*]:mt-2 [&_h2+*]:mt-2 [&_h3+*]:mt-1.5 [&_hr+*]:mt-4'
);

/** Stronger focus ring than token default so links read clearly on dark bubbles. */
const PROSE_LINK_A11Y = cn(
	'rounded-sm',
	'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/55',
	'focus-visible:ring-offset-2 focus-visible:ring-offset-[color-mix(in_srgb,var(--desktop-surface-app)_100%,transparent)]'
);

/** Fenced / trace panels: lift contrast vs bubble body. */
const CODE_PANEL_SURFACE =
	'border-(--desktop-border-strong) bg-[color-mix(in_srgb,var(--desktop-surface-app)_78%,rgb(0_0_0/0.32))] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]';

/** Scrollable code body under toolbar: slightly darker well for syntax colors. */
const CODE_BODY_WELL =
	'bg-[color-mix(in_srgb,rgb(0_0_0)_22%,var(--desktop-surface-app))]';

/** Inline `code`: readable on dark panels without blending into body text. */
const PROSE_CODE_INLINE_CONTRAST = cn(
	'border-(--desktop-border-strong)/75',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_52%,rgb(0_0_0/0.22))]',
	'text-[color-mix(in_srgb,var(--desktop-text-primary)_98%,var(--desktop-text-secondary)_2%)]'
);

/** Long fenced blocks: start collapsed for scanability; full scroll cap still applies when expanded. */
const CODE_COLLAPSE_MIN_LINES = 20;
const CODE_COLLAPSE_MIN_CHARS = 1400;

const H_BASE = `${PROSE_HEADING_FONT} text-(--desktop-text-primary) font-semibold tracking-tight`;
const LIST_CODE_BODY =
	'px-3 py-2.5 font-mono text-[0.8125rem] sm:text-[0.825rem] leading-6 text-[color-mix(in_srgb,var(--desktop-text-secondary)_92%,white_8%)]';

/** Body + code fences: readable on dark panels (slightly lifted from pure secondary) */
const STREAMING_PRE_TEXT =
	'text-[color-mix(in_srgb,var(--desktop-text-secondary)_90%,white_10%)]';

const MAX_URL_LENGTH = 8192;

/** Boolean check only — use in loops where a `href is string` guard would false-narrow to `never`. */
function urlMeetsSafetyRules(href: string | undefined): boolean {
	if (typeof href !== 'string' || !href) return false;
	const trimmed = href.trim();
	if (!trimmed || trimmed.length > MAX_URL_LENGTH) return false;
	try {
		const u = new URL(trimmed);
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
		if (!u.hostname) return false;
		return true;
	} catch {
		return false;
	}
}

/** Allow only http/https with a real host (blocks javascript:, data:, //evil, etc.) */
function isSafeUrl(href: string | undefined): href is string {
	return urlMeetsSafetyRules(href);
}

/**
 * Autolink regex often includes trailing `).,;]` from surrounding prose.
 * Returns a shorter string that still parses as a safe URL, or the original trim.
 */
function trimUrlTrailingNoise(raw: string): string {
	let s: string = raw.trim();
	while (s.length > 1) {
		if (urlMeetsSafetyRules(s)) return s;
		const last = s.charAt(s.length - 1);
		if (last && /[.,;:!?)\]}>'"`«»]+$/.test(last)) {
			s = s.slice(0, -1);
			continue;
		}
		break;
	}
	return urlMeetsSafetyRules(s) ? s : raw.trim();
}

function MarkdownCopyButton({
	text,
	ariaLabel,
	titleIdle,
	titleDone,
}: {
	text: string;
	ariaLabel: string;
	titleIdle: string;
	titleDone: string;
}) {
	const [copied, setCopied] = useState(false);
	const [pending, setPending] = useState(false);

	useEffect(() => {
		if (!copied) return undefined;
		const timeoutId = window.setTimeout(() => setCopied(false), 2000);
		return () => window.clearTimeout(timeoutId);
	}, [copied]);

	const handleCopy = async () => {
		if (!text || pending) return;
		setPending(true);
		try {
			const didCopy = await safeCopyToClipboard(text);
			if (didCopy) setCopied(true);
		} finally {
			setPending(false);
		}
	};

	const busy = pending;
	const disabled = !text || busy;

	return (
		<button
			type="button"
			onClick={handleCopy}
			disabled={disabled}
			aria-busy={busy}
			aria-label={copied ? titleDone : ariaLabel}
			title={copied ? titleDone : titleIdle}
			className={ASSISTANT_COPY_BUTTON}
		>
			{copied ? (
				<CheckIcon
					className="h-3.5 w-3.5 text-[rgb(var(--desktop-accent-rgb))]"
					aria-hidden
				/>
			) : (
				<DocumentDuplicateIcon className="h-3.5 w-3.5" aria-hidden />
			)}
			<span aria-hidden>{copied ? 'Скопировано' : 'Копировать'}</span>
		</button>
	);
}

/** Renders one markdown image. On error, shows placeholder and never retries (avoids infinite requests). */
function SafeMarkdownImage({ src, alt }: { src?: string; alt?: string }) {
	const [failed, setFailed] = useState(false);
	const trimmedSrc = typeof src === 'string' ? src.trim() : '';
	const safeSrc =
		trimmedSrc && isTrustedMarkdownImageSrc(trimmedSrc)
			? trimmedSrc
			: undefined;
	const label = (alt ?? '').trim() || 'Изображение из ответа';
	if (!safeSrc || failed) {
		return (
			<span className="inline-block rounded bg-(--desktop-surface-soft) px-2 py-1 text-sm text-[var(--desktop-text-muted)] antialiased">
				{failed ? 'Изображение недоступно' : '(неверная ссылка)'}
				{safeSrc && failed && (
					<a
						href={safeSrc}
						target="_blank"
						rel="noopener noreferrer"
						className={cn(
							'ml-2 text-[rgb(var(--desktop-accent-rgb))] underline',
							PROSE_LINK_A11Y
						)}
					>
						Открыть
					</a>
				)}
			</span>
		);
	}
	return (
		<img
			src={safeSrc}
			alt={label}
			className="h-auto max-w-full rounded border border-(--desktop-border-subtle)"
			loading="lazy"
			referrerPolicy="no-referrer"
			onError={() => setFailed(true)}
		/>
	);
}

function getNodeText(node: React.ReactNode): string {
	if (typeof node === 'string' || typeof node === 'number') {
		return String(node);
	}
	if (Array.isArray(node)) {
		return node.map(getNodeText).join('');
	}
	if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
		return getNodeText(node.props.children);
	}
	return '';
}

function getCodeLanguage(className?: string): string | null {
	const match = /language-([\w-]+)/.exec(className ?? '');
	return match?.[1] ?? null;
}

function looksLikeShellCommands(code: string): boolean {
	const lines = code
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);

	if (lines.length === 0) {
		return false;
	}

	const commandPattern =
		/^(?:[$#>%]\s*)?(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S+)\s+)*(?:(?:sudo|doas)\s+)?(?:dnf(?:5)?|yum|apt(?:-get|-(?:cache|mark|file))?|pacman|yay|paru|zypper|apk|rpm(?:-ostree)?|flatpak|snap|systemctl|journalctl|firewall-cmd|nmcli|podman|docker|kubectl|helm|curl|wget|git|pnpm|npm|yarn|bun|node|python(?:3)?|pip(?:3)?|uv|poetry|cargo|rustup|go|make|cmake|java|javac|gradle|mvn|php|composer|ruby|bundle|rails|ls|cd|pwd|mkdir|touch|cp|mv|rm|chmod|chown|cat|echo|printf|export|source|sed|awk|grep|rg|tail|head|less|ssh|scp|rsync|tar|zip|unzip|psql|mysql|sqlite3|tee|vim|nano)\b/;
	const shellKeywordPattern =
		/^(?:if|then|else|elif|fi|for|while|do|done|case|esac|function)\b/;
	const matchingLines = lines.filter(
		(line) => commandPattern.test(line) || shellKeywordPattern.test(line)
	).length;

	return matchingLines / lines.length >= 0.6;
}

function looksLikeJson(code: string): boolean {
	const trimmed = code.trim();
	if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
		return false;
	}

	try {
		JSON.parse(trimmed);
		return true;
	} catch {
		return false;
	}
}

function looksLikeSql(code: string): boolean {
	return /^(select|insert|update|delete|create|alter|drop|with|grant|revoke)\b/i.test(
		code.trim()
	);
}

function normalizeCodeLanguage(language?: string | null): string {
	const normalized = (language ?? '').trim().toLowerCase();
	if (!normalized) return 'text';

	const aliases: Record<string, string> = {
		js: 'javascript',
		jsx: 'jsx',
		ts: 'typescript',
		tsx: 'tsx',
		sh: 'bash',
		shell: 'bash',
		shellsession: 'bash',
		'shell-session': 'bash',
		terminal: 'bash',
		console: 'bash',
		linux: 'bash',
		unix: 'bash',
		fedora: 'bash',
		rhel: 'bash',
		redhat: 'bash',
		rocky: 'bash',
		rockylinux: 'bash',
		alma: 'bash',
		almalinux: 'bash',
		centos: 'bash',
		ubuntu: 'bash',
		debian: 'bash',
		arch: 'bash',
		manjaro: 'bash',
		opensuse: 'bash',
		suse: 'bash',
		alpine: 'bash',
		dnf: 'bash',
		yum: 'bash',
		apt: 'bash',
		aptget: 'bash',
		pacman: 'bash',
		zypper: 'bash',
		apk: 'bash',
		flatpak: 'bash',
		docker: 'bash',
		podman: 'bash',
		zsh: 'bash',
		fish: 'bash',
		yml: 'yaml',
		py: 'python',
		rb: 'ruby',
		rs: 'rust',
		golang: 'go',
		csharp: 'csharp',
		'c#': 'csharp',
		'c++': 'cpp',
		ps: 'powershell',
		ps1: 'powershell',
		pwsh: 'powershell',
		powershell: 'powershell',
		bat: 'batch',
		cmd: 'batch',
		dos: 'batch',
		md: 'markdown',
		text: 'text',
		plaintext: 'text',
		plain: 'text',
	};

	return aliases[normalized] ?? normalized;
}

function inferCodeLanguage(
	code: string,
	explicitLanguage?: string | null
): string {
	if (explicitLanguage) {
		return normalizeCodeLanguage(explicitLanguage);
	}

	if (looksLikeShellCommands(code)) {
		return 'bash';
	}

	if (looksLikeJson(code)) {
		return 'json';
	}

	if (looksLikeSql(code)) {
		return 'sql';
	}

	return 'text';
}

function isBlockCode(
	className: string | undefined,
	children: React.ReactNode
): boolean {
	const code = getNodeText(children);
	return Boolean(getCodeLanguage(className) || code.includes('\n'));
}

/** Fenced languages or heuristics for orchestrator / tool log lines in assistant text */
function isToolTraceFenceLanguage(
	language: string | null | undefined
): boolean {
	if (!language) return false;
	const n = language.trim().toLowerCase();
	return (
		n === 'tool' ||
		n === 'tools' ||
		n === 'trace' ||
		n === 'log' ||
		n === 'logs' ||
		n === 'agent' ||
		n === 'orchestrator' ||
		n === 'step' ||
		n === 'steps'
	);
}

function looksLikeToolTraceBody(text: string): boolean {
	const t = text.trim();
	if (t.length === 0 || t.length > 12000) return false;
	if (/^\[STEP\]/im.test(t)) return true;
	if (/tool_(?:start|done|failed)\s*:/i.test(t)) return true;
	if (/^>?\s*(?:Executing tools|Planning|tool\s*loop|orchestrator)/im.test(t))
		return true;
	if (/["']tool_calls["']\s*:/.test(t)) return true;
	if (/\b(?:planner_plan_ready|tool_start:|tool_done:|tool_failed:)\b/i.test(t))
		return true;
	return false;
}

function parseStreamingFence(raw: string): {
	info: string | null;
	code: string;
} {
	const trimmed = raw.replace(/^\n/, '').replace(/\n$/, '');
	const firstNl = trimmed.indexOf('\n');
	if (firstNl === -1) {
		if (/^[a-z][\w#+.-]*$/i.test(trimmed) && trimmed.length <= 40) {
			return { info: trimmed, code: '' };
		}
		return { info: null, code: trimmed };
	}
	const firstLine = trimmed.slice(0, firstNl).trim();
	const rest = trimmed.slice(firstNl + 1);
	if (/^[a-z][\w#+.-]*$/i.test(firstLine) && firstLine.length <= 40) {
		return { info: firstLine, code: rest.replace(/\n$/, '') };
	}
	return { info: null, code: trimmed };
}

function ToolTraceBlock({ text }: { text: string }) {
	const trimmed = text.replace(/\n$/, '');

	return (
		<section
			className={cn(
				'my-4 overflow-hidden rounded-xl border border-dashed',
				'border-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_32%,var(--desktop-border-strong))]',
				'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_42%,rgb(0_0_0/0.18))]',
				'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]',
				'first:mt-0 last:mb-0'
			)}
			aria-label="Служебная трассировка инструментов"
		>
			<div className="flex items-center justify-between gap-3 border-b border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-app)_70%,transparent)] px-3 py-2">
				<span
					className={cn(
						ASSISTANT_BLOCK_TOOLBAR_LABEL,
						'flex min-w-0 items-center gap-2 tracking-[0.2em]'
					)}
				>
					<WrenchIcon
						className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.85)]"
						aria-hidden
					/>
					Трассировка
				</span>
				<MarkdownCopyButton
					text={trimmed}
					ariaLabel="Копировать трассировку"
					titleIdle="Копировать трассировку"
					titleDone="Скопировано"
				/>
			</div>
			<pre
				className={cn(
					'max-h-[min(24rem,50vh)] overflow-auto px-3 py-2.5 font-mono text-[0.8125rem] leading-6',
					STREAMING_PRE_TEXT
				)}
			>
				<code>{trimmed}</code>
			</pre>
		</section>
	);
}

function CodeBlock({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	const code = useMemo(
		() => getNodeText(children).replace(/\n$/, ''),
		[children]
	);
	const rawLanguage = useMemo(() => getCodeLanguage(className), [className]);
	const language = useMemo(
		() => inferCodeLanguage(code, rawLanguage),
		[code, rawLanguage]
	);
	const languageLabel = useMemo(
		() => (rawLanguage ?? language ?? 'text').toUpperCase(),
		[language, rawLanguage]
	);

	const lineCount = useMemo(() => (code ? code.split('\n').length : 0), [code]);
	const needsCollapse =
		lineCount > CODE_COLLAPSE_MIN_LINES ||
		code.length > CODE_COLLAPSE_MIN_CHARS;
	const [codeExpanded, setCodeExpanded] = useState(false);
	const codeBodyId = useId();

	// biome-ignore lint/correctness/useExhaustiveDependencies: collapse state must reset when fenced body changes (code is the trigger, not read in the effect body)
	useEffect(() => {
		setCodeExpanded(false);
	}, [code]);

	const bodyScrollClass = cn(
		ASSISTANT_CODE_BODY_SCROLL,
		CODE_BODY_WELL,
		'rounded-b-xl',
		needsCollapse && !codeExpanded && 'max-h-[min(11rem,32vh)] overflow-y-auto'
	);

	return (
		<div className={cn(ASSISTANT_BLOCK_FRAME, CODE_PANEL_SURFACE)}>
			<div className={ASSISTANT_BLOCK_TOOLBAR}>
				<span className={ASSISTANT_BLOCK_TOOLBAR_LABEL}>{languageLabel}</span>
				<div className="flex min-w-0 shrink-0 items-center gap-2">
					{needsCollapse ? (
						<button
							type="button"
							className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-2 py-1 text-[11px] font-medium text-(--desktop-text-secondary) transition hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/40"
							onClick={() => setCodeExpanded((v) => !v)}
							aria-expanded={codeExpanded}
							aria-controls={codeBodyId}
						>
							{codeExpanded ? 'Свернуть' : 'Показать полностью'}
						</button>
					) : null}
					<MarkdownCopyButton
						text={code}
						ariaLabel="Копировать код"
						titleIdle="Копировать код"
						titleDone="Код скопирован"
					/>
				</div>
			</div>
			<div id={codeBodyId} className={bodyScrollClass}>
				<SyntaxCodeBlock
					language={language}
					code={code}
					showLineNumbers={false}
					className="text-xs"
					themeVariant="desktop-chat"
				/>
			</div>
		</div>
	);
}

function getListPlainText(children: React.ReactNode, ordered: boolean): string {
	const items = React.Children.toArray(children).filter((child) => {
		if (!React.isValidElement(child)) {
			return false;
		}
		return typeof child.type === 'string' && child.type.toLowerCase() === 'li';
	}) as React.ReactElement<{ children?: React.ReactNode }>[];

	if (items.length > 0) {
		return items
			.map((item, index) => {
				const text = getNodeText(item.props.children)
					.replace(/\s*\n\s*/g, '\n')
					.trim();
				if (!text) {
					return '';
				}
				return ordered ? `${index + 1}. ${text}` : `- ${text}`;
			})
			.filter(Boolean)
			.join('\n');
	}

	return getNodeText(children).trim();
}

function ListBlock({
	children,
	ordered,
}: {
	children: React.ReactNode;
	ordered: boolean;
}) {
	const plainText = useMemo(
		() => getListPlainText(children, ordered),
		[children, ordered]
	);

	return (
		<div className={cn(ASSISTANT_BLOCK_FRAME, CODE_PANEL_SURFACE)}>
			<div className={ASSISTANT_BLOCK_TOOLBAR}>
				<span className={ASSISTANT_BLOCK_TOOLBAR_LABEL}>СПИСОК</span>
				<MarkdownCopyButton
					text={plainText}
					ariaLabel="Копировать список"
					titleIdle="Копировать список"
					titleDone="Список скопирован"
				/>
			</div>
			<div
				className={cn(
					CODE_BODY_WELL,
					'bg-[linear-gradient(180deg,rgba(255,255,255,0.022)_0%,rgba(2,6,23,0.16)_100%)]'
				)}
			>
				{ordered ? (
					<ol
						className={cn(
							LIST_CODE_BODY,
							'list-inside list-decimal marker:font-semibold marker:text-(--desktop-text-dim) [&>li]:rounded-md [&>li]:bg-[color-mix(in_srgb,var(--desktop-surface-soft)_42%,transparent)] [&>li]:px-2 [&>li]:py-1 [&>li]:break-words [&>li+li]:mt-1.5'
						)}
					>
						{children}
					</ol>
				) : (
					<ul
						className={cn(
							LIST_CODE_BODY,
							'list-inside list-disc marker:text-[rgb(var(--desktop-accent-rgb)/0.85)] [&>li]:rounded-md [&>li]:bg-[color-mix(in_srgb,var(--desktop-surface-soft)_42%,transparent)] [&>li]:px-2 [&>li]:py-1 [&>li]:break-words [&>li+li]:mt-1.5'
						)}
					>
						{children}
					</ul>
				)}
			</div>
		</div>
	);
}

/**
 * Safe markdown renderer for assistant messages.
 * Renders content as markdown with GFM; no raw HTML (safe from XSS).
 * If onInsertLink is provided, clicking a link inserts its URL into the chat input instead of navigating.
 */
type AssistantMessageRendererProps = {
	content: string;
	/** When set, link clicks insert the URL into chat instead of opening in new tab */
	onInsertLink?: (url: string) => void;
	className?: string;
	streaming?: boolean;
};

const STREAMING_URL_RE = /(https?:\/\/[^\s<]+)/gi;

function renderStreamingInlineText(
	text: string,
	onInsertLink: AssistantMessageRendererProps['onInsertLink'],
	keyPrefix: string
): React.ReactNode[] {
	const parts = text.split(STREAMING_URL_RE);
	return parts.map((part, index) => {
		const key = `${keyPrefix}-${index}`;
		if (!part) {
			return <React.Fragment key={key} />;
		}
		const trimmedHref = trimUrlTrailingNoise(part);
		if (isSafeUrl(trimmedHref)) {
			const suffix =
				part.length > trimmedHref.length ? part.slice(trimmedHref.length) : '';
			const url = trimmedHref;
			const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
				if (onInsertLink) {
					event.preventDefault();
					onInsertLink(url);
				}
			};
			return (
				<React.Fragment key={key}>
					<a
						href={url}
						onClick={handleClick}
						className={cn(PROSE_LINK_STREAMING, PROSE_LINK_A11Y)}
						target={onInsertLink ? undefined : '_blank'}
						rel="noopener noreferrer"
					>
						{trimmedHref}
					</a>
					{suffix}
				</React.Fragment>
			);
		}
		return <React.Fragment key={key}>{part}</React.Fragment>;
	});
}

function StreamingParagraph({
	text,
	onInsertLink,
	segmentIndex,
}: {
	text: string;
	onInsertLink: AssistantMessageRendererProps['onInsertLink'];
	segmentIndex: number;
}) {
	const lines = text.split('\n');
	let lineOffset = 0;
	let firstLine = true;
	return (
		<p
			className={cn(
				PROSE_P,
				'my-4 [&+p]:mt-2.5',
				'whitespace-pre-wrap break-words [overflow-wrap:anywhere]'
			)}
		>
			{lines.map((line) => {
				const fragKey = `${segmentIndex}-line@${lineOffset}`;
				const inlineKey = `${segmentIndex}-line@${lineOffset}`;
				const showBr = !firstLine;
				firstLine = false;
				lineOffset += line.length + 1;
				return (
					<React.Fragment key={fragKey}>
						{showBr ? <br /> : null}
						{renderStreamingInlineText(line, onInsertLink, inlineKey)}
					</React.Fragment>
				);
			})}
		</p>
	);
}

function StreamingFenceBlock({ segment }: { segment: string }) {
	const { info, code } = useMemo(() => parseStreamingFence(segment), [segment]);
	const trace =
		isToolTraceFenceLanguage(info) || looksLikeToolTraceBody(code || segment);

	if (trace) {
		const body = code || segment.replace(/^\n/, '').replace(/\n$/, '');
		return <ToolTraceBlock text={body} />;
	}

	if (info && !code.trim()) {
		return (
			<div
				className={cn(ASSISTANT_BLOCK_FRAME, CODE_PANEL_SURFACE, 'my-3')}
				role="status"
				aria-live="polite"
				aria-busy="true"
				aria-label={`Формируется блок кода${info ? `, язык ${info}` : ''}`}
			>
				<div className={ASSISTANT_BLOCK_TOOLBAR}>
					<span className={ASSISTANT_BLOCK_TOOLBAR_LABEL}>
						{(info ?? 'код').toUpperCase()}
					</span>
					<span className="h-2 w-16 shrink-0 motion-safe:animate-pulse motion-reduce:animate-none motion-reduce:opacity-70 rounded-md bg-(--desktop-border-subtle)" />
				</div>
				<div className={cn('px-3 py-3', CODE_BODY_WELL)}>
					<div className="h-3 w-[92%] motion-safe:animate-pulse motion-reduce:animate-none motion-reduce:opacity-70 rounded-md bg-(--desktop-border-subtle)/80" />
					<div className="mt-2 h-3 w-[72%] motion-safe:animate-pulse motion-reduce:animate-none motion-reduce:opacity-70 rounded-md bg-(--desktop-border-subtle)/70" />
				</div>
			</div>
		);
	}

	return (
		<CodeBlock
			className={info ? `language-${normalizeCodeLanguage(info)}` : undefined}
		>
			{code}
		</CodeBlock>
	);
}

function StreamingAssistantRenderer({
	content,
	onInsertLink,
	className,
}: AssistantMessageRendererProps) {
	/** Родитель уже прогнал через {@link stripAssistantReplyDisplayNoise} (без тяжёлого снятия списка). */
	const safe = typeof content === 'string' ? content : '';
	const segments = safe.split(/```/);

	return (
		<section
			className={cn(
				ASSISTANT_PROSE,
				'[&_*:first-child]:mt-0 [&_*:last-child]:mb-0',
				className
			)}
			aria-label="Ответ ассистента, текст появляется по мере генерации"
			aria-live="polite"
			aria-busy="true"
		>
			{segments.map((segment, segmentIndex) => {
				const key = `segment-${segmentIndex}`;
				if (!segment.trim()) {
					return null;
				}
				if (segmentIndex % 2 === 1) {
					return <StreamingFenceBlock key={key} segment={segment} />;
				}
				let paraCursor = 0;
				return segment.split(/\n{2,}/).map((paragraph) => {
					if (!paragraph.trim()) return null;
					const at = segment.indexOf(paragraph, paraCursor);
					if (at >= 0) paraCursor = at + paragraph.length;
					const paraKey = at >= 0 ? `${key}-p@${at}` : `${key}-p@${paraCursor}`;
					return (
						<StreamingParagraph
							key={paraKey}
							text={paragraph}
							onInsertLink={onInsertLink}
							segmentIndex={segmentIndex * 1000 + Math.max(0, at)}
						/>
					);
				});
			})}
		</section>
	);
}

const AssistantMessageRendererBase: React.FC<AssistantMessageRendererProps> = ({
	content,
	onInsertLink,
	className,
	streaming = false,
}) => {
	const rehypePlugins = useMemo(() => buildSharedChatRehypePlugins(), []);
	const raw = typeof content === 'string' ? content.trim() : '';
	const { bubbleMarkdown: safe } = assistantReplyDisplayParts(raw, {
		stripInternalList: !streaming,
		stripOrbitMeta: !streaming,
	});
	if (!safe) {
		return <span className="italic text-(--desktop-text-dim)">(пусто)</span>;
	}
	if (streaming) {
		return (
			<StreamingAssistantRenderer
				content={safe}
				onInsertLink={onInsertLink}
				className={className}
				streaming={streaming}
			/>
		);
	}
	return (
		<div
			className={cn(
				ASSISTANT_PROSE,
				'[&_*:first-child]:mt-0 [&_*:last-child]:mb-0',
				className
			)}
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={rehypePlugins}
				urlTransform={(url) => {
					const t = typeof url === 'string' ? url.trim() : '';
					return isSafeUrl(t) ? t : '';
				}}
				components={{
					h1: ({ children }) => (
						<h1
							className={`${H_BASE} mt-6 first:mt-0 mb-3 border-b border-(--desktop-border-strong) pb-2.5 text-[1.35rem] sm:text-[1.45rem]`}
						>
							{children}
						</h1>
					),
					h2: ({ children }) => (
						<h2
							className={`${H_BASE} mt-6 first:mt-0 mb-2.5 border-b border-(--desktop-border-subtle) pb-2 text-[1.2rem] sm:text-[1.25rem]`}
						>
							{children}
						</h2>
					),
					h3: ({ children }) => (
						<h3
							className={`${H_BASE} mt-5 first:mt-0 mb-2 text-[1.05rem] sm:text-[1.1rem]`}
						>
							{children}
						</h3>
					),
					h4: ({ children }) => (
						<h4 className={`${H_BASE} mt-4 first:mt-0 mb-1.5 text-base`}>
							{children}
						</h4>
					),
					h5: ({ children }) => (
						<h5
							className={`${H_BASE} mt-3 first:mt-0 mb-1 text-sm uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--desktop-text-secondary)_92%,white_8%)]`}
						>
							{children}
						</h5>
					),
					h6: ({ children }) => (
						<h6
							className={`${H_BASE} mt-3 first:mt-0 mb-1 text-xs uppercase tracking-[0.14em] text-(--desktop-text-dim)`}
						>
							{children}
						</h6>
					),
					p: ({ children }) => (
						<p
							className={cn(
								PROSE_P,
								'my-4 [&+p]:mt-2.5',
								'whitespace-pre-wrap break-words [overflow-wrap:anywhere]'
							)}
						>
							{children}
						</p>
					),
					ul: ({ children }) => (
						<ListBlock ordered={false}>{children}</ListBlock>
					),
					ol: ({ children }) => <ListBlock ordered>{children}</ListBlock>,
					li: ({ children }) => <li className={PROSE_LI}>{children}</li>,
					blockquote: ({ children }) => (
						<blockquote className={PROSE_BLOCKQUOTE}>{children}</blockquote>
					),
					hr: () => (
						<hr className="my-6 border-0 border-t border-(--desktop-border-strong) first:mt-0 last:mb-0" />
					),
					strong: ({ children }) => (
						<strong className="font-semibold text-(--desktop-text-primary)">
							{children}
						</strong>
					),
					em: ({ children }) => (
						<em className="italic text-[color-mix(in_srgb,var(--desktop-text-secondary)_92%,white_8%)]">
							{children}
						</em>
					),
					del: ({ children }) => (
						<del className="text-[color-mix(in_srgb,var(--desktop-text-muted)_95%,white_5%)] line-through decoration-[color-mix(in_srgb,var(--desktop-border-strong)_85%,transparent)] [text-decoration-thickness:1px]">
							{children}
						</del>
					),
					code: ({ className, children }) => {
						const raw = getCodeLanguage(className);
						const body = getNodeText(children);
						if (
							isBlockCode(className, children) &&
							(isToolTraceFenceLanguage(raw) || looksLikeToolTraceBody(body))
						) {
							return <ToolTraceBlock text={body} />;
						}
						return isBlockCode(className, children) ? (
							<CodeBlock className={className}>{children}</CodeBlock>
						) : (
							<code
								className={cn(
									PROSE_CODE,
									PROSE_CODE_INLINE_CONTRAST,
									'[overflow-wrap:anywhere]'
								)}
							>
								{children}
							</code>
						);
					},
					pre: ({ children }) => <>{children}</>,
					img: ({ src, alt }) => <SafeMarkdownImage src={src} alt={alt} />,
					table: ({ children }) => (
						<div className={PROSE_TABLE_SCROLL}>
							<table className="w-max min-w-full border-collapse text-left text-[0.875rem]">
								{children}
							</table>
						</div>
					),
					thead: ({ children }) => (
						<thead className="border-b border-(--desktop-border-strong) bg-(--desktop-surface-soft)/85">
							{children}
						</thead>
					),
					tbody: ({ children }) => (
						<tbody className="divide-y divide-(--desktop-border-subtle)">
							{children}
						</tbody>
					),
					tr: ({ children }) => (
						<tr className="transition-colors hover:bg-[color-mix(in_srgb,var(--desktop-surface-soft)_38%,transparent)]">
							{children}
						</tr>
					),
					th: ({ children }) => (
						<th className="max-w-[min(100%,14rem)] break-words px-3 py-2.5 font-semibold text-(--desktop-text-primary) [overflow-wrap:anywhere]">
							{children}
						</th>
					),
					td: ({ children }) => (
						<td className="max-w-[min(100%,22rem)] break-words px-3 py-2 align-top text-[color-mix(in_srgb,var(--desktop-text-secondary)_92%,white_8%)] [overflow-wrap:anywhere]">
							{children}
						</td>
					),
					a: ({
						href,
						children,
						node: _node,
						target: _mdTarget,
						rel: _mdRel,
						...rest
					}) => {
						const safeHref =
							typeof href === 'string' && isSafeUrl(href)
								? href.trim()
								: undefined;
						if (!safeHref) {
							return (
								<span
									className={PROSE_LINK_DISABLED}
									title="Ссылка отключена: неподдерживаемый или небезопасный адрес"
								>
									{children}
								</span>
							);
						}
						const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
							if (onInsertLink) {
								e.preventDefault();
								onInsertLink(safeHref);
							}
						};
						return (
							<a
								{...rest}
								href={safeHref}
								onClick={handleClick}
								className={cn(PROSE_LINK, PROSE_LINK_A11Y)}
								target={onInsertLink ? undefined : '_blank'}
								rel="noopener noreferrer"
							>
								{children}
							</a>
						);
					},
				}}
			>
				{safe}
			</ReactMarkdown>
		</div>
	);
};

const AssistantMessageRenderer = React.memo(
	AssistantMessageRendererBase,
	(prev, next) =>
		prev.content === next.content &&
		prev.className === next.className &&
		prev.onInsertLink === next.onInsertLink &&
		prev.streaming === next.streaming
);

export default AssistantMessageRenderer;
