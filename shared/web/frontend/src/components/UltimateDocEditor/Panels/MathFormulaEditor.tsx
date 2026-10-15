import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useNotifications } from '@/notifications';
import { cn } from '@/utils/cn';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
	DesktopAppSectionLabel,
	DesktopAppStatusBadge,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '../../../pages/Desktop/context/DesktopShellFrameContext';
import { useEmbeddedPortaledModalZIndex } from '../../../pages/Desktop/context/DesktopWindowPortalStackContext';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellEastColumnClassName,
	getDesktopShellFooterStripClassName,
	getDesktopShellHeaderStripClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '../../../pages/Desktop/utils/desktopVisualSystem';
import { log } from '../../../utils/logger';
import type { MathFormula } from '../types/editor.types';
import {
	ArrowDownTrayIcon,
	BookOpenIcon,
	CalculatorIcon,
	DocumentDuplicateIcon,
	SparklesIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

interface MathFormulaEditorProps {
	isOpen: boolean;
	onClose: () => void;
	onInsertFormula?: (formula: MathFormula) => void;
	initialFormula?: string;
}

interface FormulaTemplate {
	id: string;
	categoryKey: string;
	name: string;
	category: string;
	description: string;
	latex: string;
}

interface FormulaSymbol {
	id: string;
	categoryKey: string;
	symbol: string;
	preview: string;
	name: string;
	category: string;
	description: string;
	example: string;
}

const MATH_PANEL_ACCENT_ICON_CLASS =
	'flex items-center justify-center rounded-xl border border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent) text-white shadow-(--desktop-shadow-panel)';

const MATH_SYMBOL_TILE_CLASS =
	'group rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-app) p-3 transition-colors hover:border-[rgb(var(--desktop-accent-rgb))]/35 hover:bg-(--desktop-surface-soft-hover)';

const MATH_LATEX_MAX_CHARS = 8000;

const SYMBOL_CATEGORY_ORDER = [
	'basics',
	'functions',
	'greek',
	'structures',
	'operators',
] as const;

const FORMULA_TEMPLATE_DEFS = [
	{
		id: 'quadratic',
		categoryKey: 'algebra',
		latex: '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
	},
	{
		id: 'sum',
		categoryKey: 'analysis',
		latex: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}',
	},
	{
		id: 'integral',
		categoryKey: 'analysis',
		latex: '\\int_{a}^{b} f(x)\\,dx',
	},
	{
		id: 'matrix',
		categoryKey: 'linearAlgebra',
		latex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}',
	},
	{
		id: 'probability',
		categoryKey: 'probability',
		latex: 'P(A \\mid B) = \\frac{P(B \\mid A) \\cdot P(A)}{P(B)}',
	},
	{
		id: 'derivative',
		categoryKey: 'analysis',
		latex: '\\frac{d}{dx} f(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}',
	},
	{
		id: 'logic',
		categoryKey: 'discrete',
		latex: '(A \\land B) \\Rightarrow (\\neg C \\lor D)',
	},
] as const;

const SYMBOL_DEFS = [
	{
		id: 'frac',
		categoryKey: 'basics',
		symbol: '\\frac{a}{b}',
		preview: '\\frac{a}{b}',
		example: '\\frac{x + 1}{y - 2}',
	},
	{
		id: 'sqrt',
		categoryKey: 'basics',
		symbol: '\\sqrt{x}',
		preview: '\\sqrt{x}',
		example: '\\sqrt{a^2 + b^2}',
	},
	{
		id: 'power',
		categoryKey: 'basics',
		symbol: 'x^2',
		preview: 'x^2',
		example: 'x^{n+1}',
	},
	{
		id: 'subscript',
		categoryKey: 'basics',
		symbol: 'x_2',
		preview: 'x_2',
		example: 'a_{ij}',
	},
	{
		id: 'sum',
		categoryKey: 'functions',
		symbol: '\\sum_{i=1}^{n}',
		preview: '\\sum_{i=1}^{n}',
		example: '\\sum_{k=0}^{m} c_k x^k',
	},
	{
		id: 'integral',
		categoryKey: 'functions',
		symbol: '\\int_{a}^{b}',
		preview: '\\int_{a}^{b}',
		example: '\\int_{0}^{1} x^2\\,dx',
	},
	{
		id: 'limit',
		categoryKey: 'functions',
		symbol: '\\lim_{x \\to 0}',
		preview: '\\lim_{x \\to 0}',
		example: '\\lim_{x \\to 0} \\frac{\\sin x}{x}',
	},
	{
		id: 'log',
		categoryKey: 'functions',
		symbol: '\\log_{a}{x}',
		preview: '\\log_{a}{x}',
		example: '\\log_{2}{n}',
	},
	{
		id: 'sin',
		categoryKey: 'functions',
		symbol: '\\sin(x)',
		preview: '\\sin(x)',
		example: '\\sin(\\alpha + \\beta)',
	},
	{
		id: 'partial',
		categoryKey: 'functions',
		symbol: '\\partial',
		preview: '\\partial',
		example: '\\frac{\\partial f}{\\partial x}',
	},
	{
		id: 'alpha',
		categoryKey: 'greek',
		symbol: '\\alpha',
		preview: '\\alpha',
		example: '\\alpha + \\beta = \\gamma',
	},
	{
		id: 'lambda',
		categoryKey: 'greek',
		symbol: '\\lambda',
		preview: '\\lambda',
		example: 'A v = \\lambda v',
	},
	{
		id: 'pi',
		categoryKey: 'greek',
		symbol: '\\pi',
		preview: '\\pi',
		example: 'e^{i\\pi} + 1 = 0',
	},
	{
		id: 'matrixTemplate',
		categoryKey: 'structures',
		symbol: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}',
		preview: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}',
		example: '\\begin{bmatrix} x_1 \\\\ x_2 \\end{bmatrix}',
	},
	{
		id: 'piecewise',
		categoryKey: 'structures',
		symbol: '\\begin{cases} x, & x \\ge 0 \\\\ -x, & x < 0 \\end{cases}',
		preview: '\\begin{cases} x, & x \\ge 0 \\\\ -x, & x < 0 \\end{cases}',
		example: '\\begin{cases} 1, & n=0 \\\\ n!, & n>0 \\end{cases}',
	},
	{
		id: 'autoBrackets',
		categoryKey: 'structures',
		symbol: '\\left( \\frac{a+b}{c} \\right)',
		preview: '\\left( \\frac{a+b}{c} \\right)',
		example: '\\left[ \\sum_{i=1}^{n} x_i \\right]',
	},
	{
		id: 'vec',
		categoryKey: 'structures',
		symbol: '\\vec{v}',
		preview: '\\vec{v}',
		example: '\\vec{AB}',
	},
	{
		id: 'leq',
		categoryKey: 'operators',
		symbol: '\\leq',
		preview: '\\leq',
		example: 'x \\leq y',
	},
	{
		id: 'infty',
		categoryKey: 'operators',
		symbol: '\\infty',
		preview: '\\infty',
		example: '\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx',
	},
] as const;

function buildFormulaTemplates(t: TFunction): FormulaTemplate[] {
	return FORMULA_TEMPLATE_DEFS.map((d) => ({
		id: d.id,
		categoryKey: d.categoryKey,
		latex: d.latex,
		name: t(`panels.mathFormula.templates.${d.id}.name`),
		description: t(`panels.mathFormula.templates.${d.id}.description`),
		category: t(`panels.mathFormula.categories.${d.categoryKey}`),
	}));
}

function buildSymbolPalette(t: TFunction): FormulaSymbol[] {
	return SYMBOL_DEFS.map((d) => ({
		id: d.id,
		categoryKey: d.categoryKey,
		symbol: d.symbol,
		preview: d.preview,
		example: d.example,
		name: t(`panels.mathFormula.symbols.${d.id}.name`),
		description: t(`panels.mathFormula.symbols.${d.id}.description`),
		category: t(`panels.mathFormula.categories.${d.categoryKey}`),
	}));
}

const renderKatex = (latex: string, displayMode = false): string => {
	return katex.renderToString(latex, {
		throwOnError: false,
		displayMode,
		strict: false,
	});
};

const katexOutputHasError = (html: string): boolean =>
	html.includes('katex-error');

export const MathFormulaEditor: React.FC<MathFormulaEditorProps> = ({
	isOpen,
	onClose,
	onInsertFormula,
	initialFormula = '',
}) => {
	const { t } = useTranslation('docEditorPanels');
	const { success, error: showError } = useNotifications();
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const previewRef = useRef<HTMLDivElement>(null);

	const [latexCode, setLatexCode] = useState(initialFormula);
	const [renderedFormula, setRenderedFormula] = useState('');
	const [isRendering, setIsRendering] = useState(false);
	const [selectedCategory, setSelectedCategory] = useState<
		(typeof SYMBOL_CATEGORY_ORDER)[number]
	>(SYMBOL_CATEGORY_ORDER[0]);
	const [showTemplates, setShowTemplates] = useState(false);
	const [activeSymbol, setActiveSymbol] = useState<FormulaSymbol | null>(null);

	const formulaTemplates = useMemo(() => buildFormulaTemplates(t), [t]);
	const symbolPalette = useMemo(() => buildSymbolPalette(t), [t]);

	const categoryTabs = useMemo(
		() =>
			SYMBOL_CATEGORY_ORDER.map((key) => ({
				key,
				label: t(`panels.mathFormula.categories.${key}`),
			})),
		[t]
	);

	const shellFrame = useDesktopShellFrame();
	const mathModalShellClass = useMemo(
		() =>
			cn(
				'fixed inset-4 flex flex-col overflow-hidden rounded-2xl shadow-(--desktop-shadow-panel)',
				getDesktopShellContentPanelClassName(shellFrame)
			),
		[shellFrame]
	);
	const mathHeaderStripClass = useMemo(
		() => getDesktopShellHeaderStripClassName(shellFrame),
		[shellFrame]
	);
	const mathFooterStripClass = useMemo(
		() => getDesktopShellFooterStripClassName(shellFrame),
		[shellFrame]
	);
	const mathEastColumnClass = useMemo(
		() =>
			cn(
				'flex min-h-0 w-[360px] flex-col',
				getDesktopShellEastColumnClassName(shellFrame)
			),
		[shellFrame]
	);
	const mathLatexTextareaClass = useMemo(
		() =>
			cn(
				'h-36 w-full resize-none rounded-xl px-3 py-3 font-mono text-base leading-relaxed text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim)',
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				DESKTOP_CHROME_FOCUS_VISIBLE
			),
		[shellFrame]
	);

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		setLatexCode(initialFormula);
		setShowTemplates(false);
	}, [initialFormula, isOpen]);

	const renderFormula = useCallback(
		(latex: string): void => {
			if (!latex.trim()) {
				setRenderedFormula('');
				return;
			}

			setIsRendering(true);
			try {
				setRenderedFormula(renderKatex(latex.trim(), true));
			} catch (error) {
				const detail = error instanceof Error ? error.message : String(error);
				log.error(
					'MathFormulaEditor',
					`Formula rendering error: ${detail}`,
					error instanceof Error ? error : undefined
				);
				setRenderedFormula(
					`<span class="text-red-400 text-sm">${t('panels.mathFormula.preview.renderFailed')}</span>`
				);
			} finally {
				setIsRendering(false);
			}
		},
		[t]
	);

	useEffect(() => {
		const timeoutId = setTimeout(() => {
			renderFormula(latexCode);
		}, 220);

		return (): void => clearTimeout(timeoutId);
	}, [latexCode, renderFormula]);

	const insertSnippet = useCallback(
		(snippet: string): void => {
			const textarea = document.getElementById(
				'latex-input'
			) as HTMLTextAreaElement | null;
			if (!textarea) {
				setLatexCode((current) => `${current}${snippet}`);
				return;
			}

			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const newValue = `${latexCode.slice(0, start)}${snippet}${latexCode.slice(end)}`;
			setLatexCode(newValue);

			setTimeout(() => {
				textarea.focus();
				const newCursor = start + snippet.length;
				textarea.setSelectionRange(newCursor, newCursor);
			}, 0);
		},
		[latexCode]
	);

	const insertTemplate = useCallback(
		(template: FormulaTemplate): void => {
			setLatexCode(template.latex);
			setShowTemplates(false);
			success(
				t('panels.mathFormula.toast.templateTitle'),
				t('panels.mathFormula.toast.templateBody', { name: template.name })
			);
		},
		[success, t]
	);

	const copyLatexCode = useCallback(async (): Promise<void> => {
		try {
			await navigator.clipboard.writeText(latexCode);
			success(
				t('panels.mathFormula.toast.copiedTitle'),
				t('panels.mathFormula.toast.copiedBody')
			);
		} catch {
			showError(
				t('panels.mathFormula.toast.copyFailedTitle'),
				t('panels.mathFormula.toast.copyFailedBody')
			);
		}
	}, [latexCode, success, showError, t]);

	const exportAsImage = useCallback(async (): Promise<void> => {
		if (!previewRef.current || !renderedFormula) {
			showError(
				t('panels.mathFormula.errors.enterFormulaFirstTitle'),
				t('panels.mathFormula.errors.enterFormulaFirstBody')
			);
			return;
		}

		try {
			const canvas = await html2canvas(previewRef.current, {
				backgroundColor: null,
				scale: 2,
			});
			const url = canvas.toDataURL('image/png');
			const link = document.createElement('a');
			link.href = url;
			link.download = `formula-${Date.now()}.png`;
			link.click();
			success(
				t('panels.mathFormula.toast.exportTitle'),
				t('panels.mathFormula.toast.exportBody')
			);
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			log.error(
				'MathFormulaEditor',
				`Formula export error: ${detail}`,
				error instanceof Error ? error : undefined
			);
			showError(
				t('panels.mathFormula.errors.exportFailedTitle'),
				t('panels.mathFormula.errors.exportFailedBody')
			);
		}
	}, [renderedFormula, success, showError, t]);

	const insertFormula = useCallback((): void => {
		if (!latexCode.trim()) {
			showError(
				t('panels.mathFormula.errors.enterLatexTitle'),
				t('panels.mathFormula.errors.enterLatexBody')
			);
			return;
		}
		if (latexCode.length > MATH_LATEX_MAX_CHARS) {
			showError(t('panels.math.latexTooLong', { max: MATH_LATEX_MAX_CHARS }));
			return;
		}

		const formula: MathFormula = {
			id: `formula-${Date.now()}`,
			latex: latexCode,
			rendered: renderedFormula,
			createdAt: new Date(),
		};

		onInsertFormula?.(formula);
		success(
			t('panels.mathFormula.toast.insertTitle'),
			t('panels.mathFormula.toast.insertBody')
		);
		onClose();
	}, [
		latexCode,
		onInsertFormula,
		onClose,
		renderedFormula,
		success,
		showError,
		t,
	]);

	const previewHasKatexError = useMemo(
		() => katexOutputHasError(renderedFormula),
		[renderedFormula]
	);

	const latexOverLimit = latexCode.length > MATH_LATEX_MAX_CHARS;

	const symbolsForCategory = useMemo(
		() =>
			symbolPalette.filter((symbol) => symbol.categoryKey === selectedCategory),
		[symbolPalette, selectedCategory]
	);

	useEffect(() => {
		if (!symbolsForCategory.length) {
			setActiveSymbol(null);
			return;
		}
		setActiveSymbol((current) => {
			if (
				current &&
				symbolsForCategory.some((symbol) => symbol.id === current.id)
			) {
				return current;
			}
			return symbolsForCategory[0] ?? null;
		});
	}, [symbolsForCategory]);

	if (!isOpen) {
		return null;
	}

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			transition={{ duration: 0.2 }}
			className={mathModalShellClass}
			style={{ zIndex: embeddedModalZ.content }}
		>
			<div
				className={cn(
					'flex items-center justify-between p-4',
					mathHeaderStripClass
				)}
			>
				<div className="flex items-center gap-3">
					<div className={`${MATH_PANEL_ACCENT_ICON_CLASS} p-2`}>
						<CalculatorIcon width={20} height={20} />
					</div>
					<div>
						<h2 className="text-lg font-semibold text-(--desktop-text-primary)">
							{t('panels.mathFormula.title')}
						</h2>
						<p className="text-sm text-(--desktop-text-muted) antialiased">
							{t('panels.mathFormula.subtitle')}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<DesktopAppButton
						onClick={() => setShowTemplates((current) => !current)}
						variant={showTemplates ? 'accent' : 'neutral'}
						size="sm"
					>
						<BookOpenIcon width={14} height={14} />
						{t('panels.mathFormula.templatesButton')}
					</DesktopAppButton>
					<DesktopAppButton
						onClick={() => void copyLatexCode()}
						variant="ghost"
						size="icon"
						title={t('panels.mathFormula.copyLatexTitle')}
						aria-label={t('panels.mathFormula.copyLatexAria')}
					>
						<DocumentDuplicateIcon width={16} height={16} />
					</DesktopAppButton>
					<DesktopAppButton
						onClick={() => void exportAsImage()}
						variant="ghost"
						size="icon"
						title={t('panels.mathFormula.exportPngTitle')}
						aria-label={t('panels.mathFormula.exportPngAria')}
					>
						<ArrowDownTrayIcon width={16} height={16} />
					</DesktopAppButton>
					<DesktopAppButton
						onClick={onClose}
						variant="ghost"
						size="icon"
						title={t('panels.mathFormula.closeTitle')}
						aria-label={t('panels.mathFormula.closeAria')}
					>
						<XMarkIcon width={16} height={16} />
					</DesktopAppButton>
				</div>
			</div>

			<div className="flex min-h-0 flex-1">
				<div className="flex min-h-0 flex-1 flex-col border-r border-(--desktop-border-subtle)">
					<div className={cn('p-4', mathHeaderStripClass)}>
						<DesktopAppSectionLabel className="mb-2 block">
							{t('panels.mathFormula.latexLabel')}
						</DesktopAppSectionLabel>
						<textarea
							id="latex-input"
							value={latexCode}
							onChange={(event) => setLatexCode(event.target.value)}
							placeholder={t('panels.mathFormula.latexPlaceholder')}
							className={mathLatexTextareaClass}
							aria-invalid={previewHasKatexError || latexOverLimit}
							aria-describedby={
								previewHasKatexError
									? 'latex-katex-error-hint'
									: latexOverLimit
										? 'latex-length-hint'
										: undefined
							}
						/>
						{latexOverLimit ? (
							<div
								id="latex-length-hint"
								role="alert"
								className="mt-2 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm text-amber-100"
							>
								{t('panels.math.latexTooLong', { max: MATH_LATEX_MAX_CHARS })}
							</div>
						) : null}
						{previewHasKatexError && latexCode.trim() ? (
							<div
								id="latex-katex-error-hint"
								role="status"
								className="mt-2 flex items-start gap-2 rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-sm text-red-200"
							>
								<span className="shrink-0 font-semibold text-red-100">
									{t('panels.mathFormula.katexErrorLabel')}
								</span>
								<span className="text-red-100/90">
									{t('panels.mathFormula.katexErrorHint')}
								</span>
							</div>
						) : null}
						<div className="mt-3 flex flex-wrap gap-2">
							<DesktopAppButton
								onClick={() => insertSnippet('\\frac{}{}')}
								variant="neutral"
								size="sm"
							>
								{t('panels.mathFormula.snippets.fraction')}
							</DesktopAppButton>
							<DesktopAppButton
								onClick={() => insertSnippet('\\sqrt{}')}
								variant="neutral"
								size="sm"
							>
								{t('panels.mathFormula.snippets.sqrt')}
							</DesktopAppButton>
							<DesktopAppButton
								onClick={() => insertSnippet('\\sum_{}^{}')}
								variant="neutral"
								size="sm"
							>
								{t('panels.mathFormula.snippets.sum')}
							</DesktopAppButton>
							<DesktopAppButton
								onClick={() => insertSnippet('\\int_{}^{}')}
								variant="neutral"
								size="sm"
							>
								{t('panels.mathFormula.snippets.integral')}
							</DesktopAppButton>
							<DesktopAppButton
								onClick={() =>
									insertSnippet('\\begin{bmatrix}  &  \\\\  &  \\end{bmatrix}')
								}
								variant="neutral"
								size="sm"
							>
								{t('panels.mathFormula.snippets.matrix')}
							</DesktopAppButton>
						</div>
					</div>

					<div className="min-h-0 flex-1 p-4">
						<div className="mb-3 flex items-center justify-between">
							<DesktopAppSectionLabel className="block">
								{t('panels.mathFormula.preview.label')}
							</DesktopAppSectionLabel>
							{isRendering ? (
								<DesktopAppStatusBadge className="gap-2 border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)">
									<div
										className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[rgb(var(--desktop-accent-rgb))] border-t-transparent motion-reduce:animate-none motion-reduce:border-t-[rgb(var(--desktop-accent-rgb))/0.35]"
										aria-hidden
									/>
									<span>{t('panels.mathFormula.preview.rendering')}</span>
								</DesktopAppStatusBadge>
							) : null}
						</div>

						<DesktopAppPanel className="relative min-h-[240px] border-dashed bg-(--desktop-surface-app) p-5">
							{isRendering && latexCode.trim() ? (
								<div
									role="status"
									aria-live="polite"
									aria-busy="true"
									aria-label={t('panels.mathFormula.preview.loadingAria')}
									className="absolute inset-5 z-10 flex min-h-[200px] items-center justify-center rounded-2xl border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-panel)_88%,transparent)] backdrop-blur-sm"
								>
									<div className="flex flex-col items-center gap-3 text-(--desktop-text-muted)">
										<div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgb(var(--desktop-accent-rgb))] border-t-transparent motion-reduce:animate-none motion-reduce:border-t-[rgb(var(--desktop-accent-rgb))/0.35]" />
										<span className="text-sm">
											{t('panels.mathFormula.preview.updating')}
										</span>
									</div>
								</div>
							) : null}
							{renderedFormula ? (
								<div
									ref={previewRef}
									className="flex min-h-[220px] items-center justify-center rounded-2xl border-2 border-(--desktop-border-strong) bg-(--desktop-surface-panel) p-6 shadow-inner shadow-black/10"
								>
									<div
										className="katex-preview max-w-full text-center text-(--desktop-text-primary) [&_.katex]:text-2xl [&_.katex-display]:text-(--desktop-text-primary) [&_.katex-error]:block [&_.katex-error]:rounded-md [&_.katex-error]:border-l-4 [&_.katex-error]:border-red-400 [&_.katex-error]:bg-red-500/20 [&_.katex-error]:px-3 [&_.katex-error]:py-2 [&_.katex-error]:text-left [&_.katex-error]:text-sm [&_.katex-error]:text-red-100"
										// biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX-rendered formula HTML from user LaTeX
										dangerouslySetInnerHTML={{ __html: renderedFormula }}
									/>
								</div>
							) : (
								<DesktopAppEmptyState
									icon={
										<SparklesIcon
											width={40}
											height={40}
											className="text-[rgb(var(--desktop-accent-rgb))]"
										/>
									}
									title={t('panels.mathFormula.preview.emptyTitle')}
									description={t('panels.mathFormula.preview.emptyDescription')}
									className="py-10"
								/>
							)}
						</DesktopAppPanel>
					</div>
				</div>

				<div className={mathEastColumnClass}>
					{showTemplates ? (
						<>
							<div className={cn('p-4', mathHeaderStripClass)}>
								<div className="flex items-center justify-between gap-3">
									<div>
										<h3 className="text-sm font-semibold text-(--desktop-text-primary)">
											{t('panels.mathFormula.templatesPanel.title')}
										</h3>
										<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
											{t('panels.mathFormula.templatesPanel.subtitle')}
										</p>
									</div>
									<DesktopAppButton
										onClick={() => setShowTemplates(false)}
										variant="ghost"
										size="icon"
										title={t('panels.mathFormula.templatesPanel.closeTitle')}
										aria-label={t(
											'panels.mathFormula.templatesPanel.closeAria'
										)}
									>
										<XMarkIcon width={16} height={16} />
									</DesktopAppButton>
								</div>
							</div>
							<div className="min-h-0 flex-1 overflow-y-auto p-4">
								<div className="space-y-3">
									{formulaTemplates.map((template) => (
										<DesktopAppPanel key={template.id} className="p-4">
											<div className="mb-2 flex items-start justify-between gap-3">
												<div>
													<h4 className="text-sm font-semibold text-(--desktop-text-primary)">
														{template.name}
													</h4>
													<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
														{template.description}
													</p>
												</div>
												<DesktopAppStatusBadge className="border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)">
													{template.category}
												</DesktopAppStatusBadge>
											</div>
											<div
												className="mb-3 overflow-hidden rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-app) p-3 text-(--desktop-text-primary)"
												// biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output for built-in formula templates
												dangerouslySetInnerHTML={{
													__html: renderKatex(template.latex, false),
												}}
											/>
											<DesktopAppButton
												onClick={() => insertTemplate(template)}
												variant="accent"
												size="sm"
												className="w-full justify-center"
											>
												{t('panels.mathFormula.templatesPanel.useTemplate')}
											</DesktopAppButton>
										</DesktopAppPanel>
									))}
								</div>
							</div>
						</>
					) : (
						<>
							<div className={cn('p-4', mathHeaderStripClass)}>
								<h3 className="text-sm font-semibold text-(--desktop-text-primary)">
									{t('panels.mathFormula.reference.title')}
								</h3>
								<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
									{t('panels.mathFormula.reference.subtitle')}
								</p>
							</div>

							<div className={cn('p-3', mathHeaderStripClass)}>
								<div className="flex gap-1 overflow-x-auto">
									{categoryTabs.map((tab) => (
										<DesktopAppButton
											key={tab.key}
											onClick={() => setSelectedCategory(tab.key)}
											variant={
												selectedCategory === tab.key ? 'accent' : 'ghost'
											}
											active={selectedCategory === tab.key}
											size="sm"
											className="shrink-0"
										>
											{tab.label}
										</DesktopAppButton>
									))}
								</div>
							</div>

							<div className={cn('p-4', mathHeaderStripClass)}>
								{activeSymbol ? (
									<DesktopAppPanel className="space-y-3 border-[rgb(var(--desktop-accent-rgb))]/25 bg-[color-mix(in_srgb,var(--desktop-surface-accent)_30%,transparent)] p-4">
										<div className="flex items-center justify-between gap-3">
											<div>
												<div className="text-sm font-semibold text-(--desktop-text-primary)">
													{activeSymbol.name}
												</div>
												<div className="text-xs text-(--desktop-text-dim)">
													{activeSymbol.category}
												</div>
											</div>
											<DesktopAppStatusBadge className="border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)">
												{t('panels.mathFormula.reference.helpBadge')}
											</DesktopAppStatusBadge>
										</div>
										<div
											className="overflow-hidden rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-app) p-3 text-(--desktop-text-primary)"
											// biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX symbol preview
											dangerouslySetInnerHTML={{
												__html: renderKatex(activeSymbol.preview, false),
											}}
										/>
										<p className="text-sm leading-6 text-(--desktop-text-secondary)">
											{activeSymbol.description}
										</p>
										<div className="rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-app) p-3">
											<div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-(--desktop-text-dim)">
												{t('panels.mathFormula.reference.exampleLabel')}
											</div>
											<code className="font-mono text-sm text-[rgb(var(--desktop-accent-rgb))]">
												{activeSymbol.example}
											</code>
										</div>
									</DesktopAppPanel>
								) : (
									<DesktopAppEmptyState
										title={t('panels.mathFormula.reference.emptyTitle')}
										description={t(
											'panels.mathFormula.reference.emptyDescription'
										)}
										className="py-6"
									/>
								)}
							</div>

							<div className="min-h-0 flex-1 overflow-y-auto p-4">
								<div className="grid grid-cols-2 gap-3">
									{symbolsForCategory.map((symbol) => (
										<button
											key={symbol.id}
											type="button"
											onClick={() => {
												setActiveSymbol(symbol);
												insertSnippet(symbol.symbol);
											}}
											onMouseEnter={() => setActiveSymbol(symbol)}
											className={MATH_SYMBOL_TILE_CLASS}
											title={symbol.name}
										>
											<div
												className="flex min-h-[48px] items-center justify-center text-(--desktop-text-primary)"
												// biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX symbol tile preview
												dangerouslySetInnerHTML={{
													__html: renderKatex(symbol.preview, false),
												}}
											/>
											<div className="mt-2 text-xs font-medium text-(--desktop-text-primary)">
												{symbol.name}
											</div>
											<div className="mt-1 text-[11px] leading-5 text-(--desktop-text-muted) line-clamp-2">
												{symbol.description}
											</div>
										</button>
									))}
								</div>
							</div>
						</>
					)}
				</div>
			</div>

			<div
				className={cn(
					'flex items-center justify-between p-4',
					mathFooterStripClass
				)}
			>
				<div className="text-sm text-(--desktop-text-muted) antialiased">
					{t('panels.mathFormula.footerHint')}
				</div>

				<div className="flex items-center gap-3">
					<DesktopAppButton onClick={onClose} variant="ghost">
						{t('panels.mathFormula.cancel')}
					</DesktopAppButton>
					<DesktopAppButton
						onClick={insertFormula}
						disabled={!latexCode.trim() || latexOverLimit}
						variant="accent"
					>
						<ArrowDownTrayIcon width={16} height={16} />
						{t('panels.mathFormula.insert')}
					</DesktopAppButton>
				</div>
			</div>
		</motion.div>
	);
};

export default MathFormulaEditor;
