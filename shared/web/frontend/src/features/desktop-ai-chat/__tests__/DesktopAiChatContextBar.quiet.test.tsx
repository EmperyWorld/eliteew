/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock quiet context bar: no empty «no project / no attachments» strip.
 */
import { render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';

import { DesktopAiChatContextBar } from '../components/DesktopAiChatContextBar';
import type { DesktopAiChatItem } from '../api/desktopChatClient';

vi.mock('@/pages/Desktop/components/DesktopChromeTooltip', () => ({
	DesktopChromeTooltip: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

const t = ((key: string) => key) as unknown as TFunction<'desktopAiChat'>;

const chatNoProject: DesktopAiChatItem = {
	id: 'chat-1',
	user_id: 'u1',
	company_id: null,
	project_id: null,
	title: 'T',
	llama_model: null,
	system_prompt_override: null,
	use_project_rag: false,
	vault_rag_eligible: false,
	settings: {},
	created_at: null,
	updated_at: null,
};

describe('DesktopAiChatContextBar quiet chrome', () => {
	it('renders nothing without project or attachments', () => {
		const { container } = render(
			<DesktopAiChatContextBar
				activeChat={chatNoProject}
				activeId={chatNoProject.id}
				attachments={[]}
				selectedProjectName={null}
				lucideStroke={1.5}
				t={t}
			/>
		);
		expect(container).toBeEmptyDOMElement();
		expect(screen.queryByText('contextNoProject')).toBeNull();
		expect(screen.queryByText('attachmentsNone')).toBeNull();
	});
});
