/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: Mermaid fence must not re-run mermaid.render on parent remounts (perf remount loop).
 * Mermaid 12 initialize stays on dagre + classic (not ELK/neo product-default restyle).
 *
 * Invariants:
 * - Same diagram source → mermaid.render called once across remounts (SVG cache).
 *
 * Related:
 * - desktopAiChatMermaidCache.ts, DesktopAiChatMarkdown.tsx
 */
import { act, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DesktopAiChatMarkdown } from '@/features/desktop-ai-chat/DesktopAiChatMarkdown';
import { clearDesktopAiChatMermaidSvgCache } from '@/features/desktop-ai-chat/desktopAiChatMermaidCache';

const mermaidRender = vi.hoisted(() =>
	vi.fn(async (_id: string, _text: string) => ({
		svg: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20"/></svg>',
	}))
);
const mermaidInitialize = vi.hoisted(() => vi.fn());

vi.mock('mermaid', () => ({
	default: {
		initialize: (...args: unknown[]) => mermaidInitialize(...args),
		render: (id: string, text: string) => mermaidRender(id, text),
	},
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('sonner', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock('@/hooks/useDesktopShellTheme', () => ({
	useDesktopShellTheme: () => 'dark',
}));

vi.mock('@/pages/Desktop/context/DesktopWindowPortalStackContext', () => ({
	useDesktopWindowPortalStackBase: () => 1000,
}));

vi.mock('@/pages/Desktop/shell', () => ({
	getDesktopPortalShellProps: () => null,
}));

vi.mock('@/pages/Desktop/shell/shellPortal', () => ({
	ShellPortalMount: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const MERMAID_MD = [
	'## Flow',
	'',
	'```mermaid',
	'pie title Pets',
	'  "Dogs" : 50',
	'  "Cats" : 50',
	'```',
].join('\n');

describe('DesktopAiChatMarkdown mermaid remount lock', () => {
	beforeEach(() => {
		clearDesktopAiChatMermaidSvgCache();
		mermaidRender.mockClear();
		mermaidInitialize.mockClear();
		document.documentElement.classList.add('dark');
		vi.useFakeTimers({ shouldAdvanceTime: true });
	});

	afterEach(() => {
		vi.useRealTimers();
		clearDesktopAiChatMermaidSvgCache();
	});

	it('calls mermaid.render once across remounts of the same diagram', async () => {
		const first = render(<DesktopAiChatMarkdown markdown={MERMAID_MD} />);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(500);
		});

		await waitFor(() => {
			expect(mermaidRender).toHaveBeenCalledTimes(1);
		});
		expect(mermaidInitialize).toHaveBeenCalledWith(
			expect.objectContaining({
				look: 'classic',
				layout: 'dagre',
			})
		);

		first.unmount();
		render(<DesktopAiChatMarkdown markdown={MERMAID_MD} />);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(500);
		});

		await waitFor(() => {
			expect(mermaidRender).toHaveBeenCalledTimes(1);
		});
	});
});
