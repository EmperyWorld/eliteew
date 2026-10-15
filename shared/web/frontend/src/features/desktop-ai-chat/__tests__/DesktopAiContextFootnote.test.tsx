import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DesktopAiStreamContextSummary } from '../api/desktopChatClient';
import {
	DesktopAiContextFootnote,
	splitContextTooltipDetailLines,
} from '../components/DesktopAiContextFootnote';
import { buildDesktopAiContextFootnote } from '../desktopChatContextSummary';

const GOLDEN_PATH = resolve(
	__dirname,
	'../../../../../../api/tests/fixtures/desktop_chat_context_footnote_golden.json'
);

const tGolden = ((key: string, opts?: Record<string, unknown>) => {
	switch (key) {
		case 'contextChatMaterials':
			return `chat:${opts?.count ?? 0}`;
		case 'contextProjectMaterials':
			return `project:${opts?.count ?? 0}`;
		case 'contextDerivedMaterials':
			return `derived:${opts?.count ?? 0}`;
		case 'contextWebMaterials':
			return `web:${opts?.count ?? 0}`;
		case 'contextNoSupportingMaterials':
			return 'none';
		case 'contextSummaryPrefix':
			return `CTX(${opts?.parts ?? ''})`;
		case 'contextSummaryTooltip':
			return 'TOOLTIP:base';
		case 'contextTooltipChatMaterials':
			return `TIP:chat:${opts?.count ?? 0}`;
		case 'contextTooltipProjectMaterials':
			return `TIP:project:${opts?.count ?? 0}`;
		case 'contextTooltipDerivedMaterials':
			return `TIP:derived:${opts?.count ?? 0}`;
		case 'contextTooltipWebMaterials':
			return `TIP:web:${opts?.count ?? 0}`;
		default:
			return key;
	}
}) as import('i18next').TFunction<'desktopAiChat'>;

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

function mountDesktopNativeTooltips(): void {
	const main = document.createElement('div');
	main.id = 'desktop-main';
	main.setAttribute('data-desktop-styled-tooltips', 'false');
	document.body.appendChild(main);
}

function unmountDesktopNativeTooltips(): void {
	document.getElementById('desktop-main')?.remove();
}

beforeEach(() => {
	mountDesktopNativeTooltips();
});

afterEach(() => {
	unmountDesktopNativeTooltips();
});

describe('splitContextTooltipDetailLines', () => {
	it('keeps all non-empty tooltip rows when summary is omitted', () => {
		expect(splitContextTooltipDetailLines('base\nline-one\nline-two')).toEqual([
			'base',
			'line-one',
			'line-two',
		]);
	});

	it('drops empty trailing lines', () => {
		expect(splitContextTooltipDetailLines('base\n\n  \nrow')).toEqual([
			'base',
			'row',
		]);
	});

	it('does not repeat the visible summary line in details (empty-context lock)', () => {
		expect(
			splitContextTooltipDetailLines(
				'TOOLTIP:base\nДополнительные материалы для ответа не найдены.',
				'Дополнительные материалы для ответа не найдены.'
			)
		).toEqual(['TOOLTIP:base']);
	});
});

describe('DesktopAiContextFootnote', () => {
	it('renders plain paragraph when tooltip has no detail rows', () => {
		const { container } = render(
			<DesktopAiContextFootnote
				footnote={{ line: 'CTX line', tooltip: 'CTX line' }}
			/>
		);
		expect(screen.getByText('CTX line')).toBeInTheDocument();
		expect(container.querySelector('details')).toBeNull();
	});

	it('expands structured detail rows on summary click', () => {
		render(
			<DesktopAiContextFootnote
				footnote={{
					line: 'CTX line',
					tooltip: 'base help\nchat:2\nvault:4',
				}}
			/>
		);
		const summary = screen.getByText('CTX line');
		const details = summary.closest('details');
		expect(details).toBeTruthy();
		expect(details).not.toHaveAttribute('open');
		fireEvent.click(summary);
		expect(details).toHaveAttribute('open');
		expect(screen.getByText('base help')).toBeInTheDocument();
		expect(screen.getByText('chat:2')).toBeInTheDocument();
		expect(screen.getByText('vault:4')).toBeInTheDocument();
	});

	it('empty-context summary is not shown as footnote chrome (builder returns null)', () => {
		expect(
			buildDesktopAiContextFootnote(
				{ chat_rag_requested: 2, chat_rag_chunks: 0 },
				tGolden
			)
		).toBeNull();
	});

	it('renders and expands golden footnote fixture in details UI', () => {
		const golden = JSON.parse(
			readFileSync(GOLDEN_PATH, 'utf-8')
		) as DesktopAiStreamContextSummary;
		const footnote = buildDesktopAiContextFootnote(golden, tGolden);
		if (!footnote) {
			throw new Error('expected golden footnote');
		}
		render(<DesktopAiContextFootnote footnote={footnote} />);
		expect(screen.getByText(footnote.line)).toBeInTheDocument();
		expect(document.querySelector('details')).toBeTruthy();
		fireEvent.click(screen.getByText(footnote.line));
		expect(screen.getByText('TIP:chat:2')).toBeInTheDocument();
		expect(screen.getByText('TIP:project:3')).toBeInTheDocument();
		const detailLines = splitContextTooltipDetailLines(
			footnote.tooltip,
			footnote.line
		);
		expect(detailLines.length).toBeGreaterThanOrEqual(2);
	});
});
