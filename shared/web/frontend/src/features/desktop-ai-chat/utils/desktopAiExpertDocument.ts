/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Analyze assistant Markdown into a professional answer-artifact presentation and provide safe heading navigation.
 * Classification is local, deterministic, and changes chrome only—not model content or factual claims.
 *
 * Invariants:
 * - Headings inside fenced code or Mermaid blocks never become document navigation.
 * - Contract metadata alone does not turn a short conversational reply into a document.
 *
 * Related:
 * - src/features/desktop-ai-chat/DesktopAiExpertAnswerDocument.tsx
 * - src/features/desktop-ai-chat/DesktopAiBlueprintArtifactBubble.tsx
 */
import type { DesktopAiMessageMetadata } from '../api/desktopChatClient';

export const DESKTOP_EXPERT_REPLY_CONTRACT_VERSION = 'expert-document-v1';

export type DesktopAiAnswerArtifactKind =
	| 'analysis'
	| 'decision'
	| 'comparison'
	| 'action_plan'
	| 'technical'
	| 'research';

export type DesktopAiMarkdownHeading = {
	id: string;
	title: string;
	level: 2 | 3;
};

export type DesktopAiExpertDocumentAnalysis = {
	isDocument: boolean;
	contractApplied: boolean;
	headings: DesktopAiMarkdownHeading[];
	sectionCount: number;
	tableCount: number;
	diagramCount: number;
	codeBlockCount: number;
	checklistCount: number;
	sourceCount: number;
	wordCount: number;
	artifactKind: DesktopAiAnswerArtifactKind;
};

export type DesktopAiExpertDocumentAnalysisOptions = {
	sourceCount?: number;
};

export function desktopAiAnswerArtifactFileStem(
	kind: DesktopAiAnswerArtifactKind
): string {
	return kind === 'action_plan' ? 'action-plan' : kind;
}

export function slugifyDesktopAiMarkdownHeading(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s-]/gu, '')
		.replace(/\s+/g, '-')
		.slice(0, 80);
}

function cleanHeadingTitle(input: string): string {
	return input
		.replace(/\s+#+\s*$/, '')
		.replace(/[*_`~]/g, '')
		.trim();
}

function isFenceClose(line: string, marker: string): boolean {
	const escaped = marker[0] === '`' ? '`' : '~';
	return new RegExp(`^\\s*${escaped}{${marker.length},}\\s*$`).test(line);
}

type MarkdownScan = {
	headings: DesktopAiMarkdownHeading[];
	outsideLines: string[];
	diagramCount: number;
	codeBlockCount: number;
};

function scanMarkdown(markdown: string): MarkdownScan {
	const headings: DesktopAiMarkdownHeading[] = [];
	const outsideLines: string[] = [];
	const slugCounts = new Map<string, number>();
	let activeFence: {
		marker: string;
		kind: 'diagram' | 'code' | 'unknown';
		firstContentSeen: boolean;
	} | null = null;
	let diagramCount = 0;
	let codeBlockCount = 0;

	for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
		if (activeFence) {
			if (isFenceClose(line, activeFence.marker)) {
				if (activeFence.kind === 'diagram') {
					diagramCount += 1;
				} else {
					codeBlockCount += 1;
				}
				activeFence = null;
				continue;
			}
			if (!activeFence.firstContentSeen && line.trim()) {
				activeFence.firstContentSeen = true;
				if (
					activeFence.kind === 'unknown' &&
					line.trim().toLowerCase() === 'mermaid'
				) {
					activeFence.kind = 'diagram';
				} else if (activeFence.kind === 'unknown') {
					activeFence.kind = 'code';
				}
			}
			continue;
		}

		const fence = /^\s*(`{3,}|~{3,})\s*([\w+-]*)\s*$/.exec(line);
		if (fence) {
			const language = fence[2]?.toLowerCase() ?? '';
			activeFence = {
				marker: fence[1],
				kind:
					language === 'mermaid' ? 'diagram' : language ? 'code' : 'unknown',
				firstContentSeen: false,
			};
			continue;
		}

		outsideLines.push(line);
		const heading = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
		if (!heading) continue;
		const title = cleanHeadingTitle(heading[2] ?? '');
		if (!title) continue;
		const baseId =
			slugifyDesktopAiMarkdownHeading(title) ||
			`section-${headings.length + 1}`;
		const duplicateIndex = slugCounts.get(baseId) ?? 0;
		slugCounts.set(baseId, duplicateIndex + 1);
		headings.push({
			id: duplicateIndex === 0 ? baseId : `${baseId}-${duplicateIndex}`,
			title,
			level: heading[1]?.length === 3 ? 3 : 2,
		});
	}

	if (activeFence) {
		if (activeFence.kind === 'diagram') {
			diagramCount += 1;
		} else {
			codeBlockCount += 1;
		}
	}

	return {
		headings,
		outsideLines,
		diagramCount,
		codeBlockCount,
	};
}

export function extractDesktopAiMarkdownHeadings(
	markdown: string
): DesktopAiMarkdownHeading[] {
	return scanMarkdown(markdown).headings;
}

function countMarkdownTables(lines: string[]): number {
	let count = 0;
	for (let index = 0; index < lines.length - 1; index += 1) {
		const header = lines[index] ?? '';
		const divider = lines[index + 1] ?? '';
		if (
			header.includes('|') &&
			/^\s*\|?\s*:?-{3,}(?:\s*\|\s*:?-{3,})+\s*\|?\s*$/.test(divider)
		) {
			count += 1;
			index += 1;
		}
	}
	return count;
}

function countWords(lines: string[]): number {
	const plain = lines
		.join('\n')
		.replace(/https?:\/\/\S+/g, ' ')
		.replace(/[#>*_`~|[\](){}]/g, ' ')
		.trim();
	return plain ? plain.split(/\s+/u).filter(Boolean).length : 0;
}

function countChecklistItems(lines: string[]): number {
	return lines.filter((line) => /^\s*[-*+]\s+\[[ xX]\]\s+\S/.test(line)).length;
}

function inferAnswerArtifactKind({
	lines,
	headings,
	tableCount,
	diagramCount,
	codeBlockCount,
	checklistCount,
	sourceCount,
}: {
	lines: string[];
	headings: DesktopAiMarkdownHeading[];
	tableCount: number;
	diagramCount: number;
	codeBlockCount: number;
	checklistCount: number;
	sourceCount: number;
}): DesktopAiAnswerArtifactKind {
	const headingText = headings
		.map((heading) => heading.title)
		.join(' ')
		.toLowerCase();
	const semanticText = [
		headingText,
		...lines.filter((line) => line.trim()).slice(0, 8),
	]
		.join(' ')
		.toLowerCase()
		.slice(0, 1600);
	const technicalSignal =
		/\b(api|sdk|code|implementation|architecture|integration|migration|debug|deploy)\b|техничес|архитект|код|реализац|интеграц|миграц|отлад|депло/u.test(
			semanticText
		);
	const comparisonSignal =
		/\b(compare|comparison|options?|alternatives?|trade-?offs?|versus|vs\.?)\b|сравнен|вариант|альтернатив|компромисс|матриц/u.test(
			semanticText
		);
	const actionSignal =
		/\b(plan|roadmap|steps?|checklist|next steps)\b|план|дорожн|шаг|чек.?лист|следующ/u.test(
			semanticText
		);
	const researchSignal =
		/\b(research|evidence|sources?|findings|literature)\b|исследован|источник|доказатель|факт/u.test(
			headingText
		);
	const decisionSignal =
		/\b(decision|verdict|recommendation|conclusion)\b|решени|вердикт|рекомендац|заключени|вывод/u.test(
			semanticText
		);

	if (technicalSignal && (codeBlockCount > 0 || diagramCount > 0)) {
		return 'technical';
	}
	if (comparisonSignal && tableCount > 0) {
		return 'comparison';
	}
	if ((checklistCount > 0 || actionSignal) && !decisionSignal) {
		return 'action_plan';
	}
	if (researchSignal) {
		return 'research';
	}
	if (decisionSignal) {
		return 'decision';
	}
	if (sourceCount > 0) {
		return 'research';
	}
	if (actionSignal) {
		return 'action_plan';
	}
	if (tableCount > 1) {
		return 'comparison';
	}
	if (codeBlockCount > 1 || diagramCount > 1) {
		return 'technical';
	}
	return 'analysis';
}

export function analyzeDesktopAiExpertDocument(
	markdown: string,
	metadata?: DesktopAiMessageMetadata | null,
	options: DesktopAiExpertDocumentAnalysisOptions = {}
): DesktopAiExpertDocumentAnalysis {
	const scan = scanMarkdown(markdown);
	const tableCount = countMarkdownTables(scan.outsideLines);
	const checklistCount = countChecklistItems(scan.outsideLines);
	const requestedSourceCount = options.sourceCount ?? 0;
	const sourceCount =
		Number.isFinite(requestedSourceCount) && requestedSourceCount > 0
			? Math.floor(requestedSourceCount)
			: 0;
	const wordCount = countWords(scan.outsideLines);
	const sectionCount = scan.headings.filter(
		(heading) => heading.level === 2
	).length;
	const contractApplied =
		metadata?.desktop_expert_reply_contract ===
			DESKTOP_EXPERT_REPLY_CONTRACT_VERSION ||
		metadata?.desktop_structured_reply_prompt === true;
	const hasVisualStructure = tableCount > 0 || scan.diagramCount > 0;
	const isDocument =
		sectionCount >= 2 ||
		(hasVisualStructure && wordCount >= 40) ||
		(scan.headings.length >= 1 && wordCount >= 100) ||
		(contractApplied && wordCount >= 160);
	const artifactKind = inferAnswerArtifactKind({
		lines: scan.outsideLines,
		headings: scan.headings,
		tableCount,
		diagramCount: scan.diagramCount,
		codeBlockCount: scan.codeBlockCount,
		checklistCount,
		sourceCount,
	});

	return {
		isDocument,
		contractApplied,
		headings: scan.headings,
		sectionCount,
		tableCount,
		diagramCount: scan.diagramCount,
		codeBlockCount: scan.codeBlockCount,
		checklistCount,
		sourceCount,
		wordCount,
		artifactKind,
	};
}

export function resolveDesktopAiMarkdownHeadingElement(
	root: HTMLElement,
	heading: DesktopAiMarkdownHeading
): HTMLElement | null {
	if (heading.id) {
		const byId = root.querySelector(`#${CSS.escape(heading.id)}`);
		if (byId instanceof HTMLElement) {
			return byId;
		}
	}
	for (const element of root.querySelectorAll('h2, h3')) {
		if (element.textContent?.trim() === heading.title.trim()) {
			return element as HTMLElement;
		}
	}
	return null;
}

export function desktopAiDocumentScrollBehavior(): ScrollBehavior {
	if (
		typeof window !== 'undefined' &&
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	) {
		return 'auto';
	}
	return 'smooth';
}
