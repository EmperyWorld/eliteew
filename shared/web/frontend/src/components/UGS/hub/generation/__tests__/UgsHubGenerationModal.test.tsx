/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Form-first lock for UGS Hub generation modal (prompt default, advanced JSON).
 *
 * Related:
 * - ../UgsHubGenerationModal.tsx
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { GenerationType } from '@/hooks/api/useUgsDashboard';
import ruUgsHub from '@/i18n/locales/ru/ugsHub.json';
import { UGS_HUB_NS } from '@/i18n/namespaces';

import { UgsHubGenerationModal } from '../UgsHubGenerationModal';

vi.mock('@/pages/Desktop/context/DesktopWindowPortalStackContext', () => ({
	useEmbeddedPortaledModalZIndex: () => ({ backdrop: 40, content: 50 }),
}));

let hubI18n: i18n;

beforeAll(async () => {
	hubI18n = i18next.createInstance();
	await hubI18n.use(initReactI18next).init({
		lng: 'ru',
		fallbackLng: 'ru',
		ns: [UGS_HUB_NS],
		defaultNS: UGS_HUB_NS,
		resources: {
			ru: { [UGS_HUB_NS]: ruUgsHub },
		},
	});
});

const textType = {
	type_key: 'text_chat',
	display_name: 'Текстовый чат',
	category: 'text',
	description: 'Короткий ответ',
	estimated_time: 12,
	cost_credits: 1,
	provider: 'text-channel',
} as GenerationType;

describe('UgsHubGenerationModal form-first', () => {
	it('shows prompt by default; type_key only under Advanced', () => {
		render(
			<I18nextProvider i18n={hubI18n}>
				<UgsHubGenerationModal
					open
					type={textType}
					inputData={{ prompt: 'Hello world', max_tokens: 100 }}
					onClose={vi.fn()}
					onSubmit={vi.fn()}
					generatingKey={null}
				/>
			</I18nextProvider>
		);

		expect(screen.getByTestId('ugs-hub-generation-prompt')).toBeInTheDocument();
		expect(screen.getByDisplayValue('Hello world')).toBeInTheDocument();
		expect(screen.getByTestId('ugs-hub-generation-submit')).toBeInTheDocument();
		expect(screen.queryByText(/Тип:\s*text_chat/i)).toBeNull();

		const details = screen
			.getByText(ruUgsHub.generation.advancedSummary)
			.closest('details');
		expect(details).toBeTruthy();
		expect(details?.hasAttribute('open')).toBe(false);

		const advanced = within(details as HTMLElement);
		expect(
			advanced.getByLabelText(ruUgsHub.generation.jsonAria)
		).toBeInTheDocument();
		expect(advanced.getByText('text_chat')).toBeInTheDocument();
		expect(advanced.getByDisplayValue(/max_tokens/)).toBeInTheDocument();

		fireEvent.click(screen.getByText(ruUgsHub.generation.advancedSummary));
		expect(details?.open).toBe(true);
	});
});
