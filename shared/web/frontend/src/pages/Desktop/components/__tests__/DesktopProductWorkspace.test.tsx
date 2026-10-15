/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for shared Desktop product workspace primitives.
 *
 * Invariants:
 * - Primitive fallback copy must come from `commonUi`.
 * - Workspace sections must remain renderable without product-local wrappers.
 *
 * Related:
 * - src/pages/Desktop/components/DesktopAppChrome.tsx
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@/i18n/config';
import {
	DesktopAppErrorState,
	DesktopProductHeader,
	DesktopProductNextAction,
	DesktopProductStatePanel,
	DesktopProductStatusBanner,
	DesktopProductWorkspace,
} from '../DesktopAppChrome';

describe('Desktop product workspace primitives', () => {
	it('renders the shared workspace structure and next action grammar', () => {
		render(
			<DesktopProductWorkspace
				header={
					<DesktopProductHeader
						eyebrow="Рабочее место"
						title="Студия"
						description="Соберите следующий шаг без лишних деталей."
						actions={<button type="button">Запустить</button>}
					/>
				}
				status={
					<DesktopProductStatusBanner
						tone="success"
						title="Готово"
						description="Можно продолжать работу."
					/>
				}
			>
				<DesktopProductNextAction
					title="Проверьте результат"
					description="Откройте карточку и завершите настройку."
				/>
			</DesktopProductWorkspace>
		);

		expect(screen.getByRole('heading', { name: 'Студия' })).toBeInTheDocument();
		expect(screen.getByRole('status')).toHaveTextContent('Готово');
		expect(
			screen.getByText(
				(content) => content === 'Следующий шаг' || content === 'Next step'
			)
		).toBeInTheDocument();
		expect(screen.getByText('Проверьте результат')).toBeInTheDocument();
	});

	it('keeps status banners in a polite live region by default', () => {
		render(
			<DesktopProductStatusBanner
				title="Состояние"
				description="Идёт проверка"
			/>
		);

		expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
	});

	it('keeps shared workspace primitives free of expensive blur and animation defaults', () => {
		const { container } = render(
			<DesktopProductWorkspace
				status={<DesktopProductStatusBanner title="Состояние" />}
			>
				<DesktopProductNextAction title="Действие" />
			</DesktopProductWorkspace>
		);

		expect(container.innerHTML).not.toMatch(/backdrop-blur|animate-/);
	});

	it('uses a transparent root so desktop window content chrome can show through', () => {
		const { container } = render(
			<DesktopProductWorkspace>
				<span>body</span>
			</DesktopProductWorkspace>
		);
		const root = container.firstElementChild;
		expect(root?.className).toContain('bg-transparent');
		expect(root?.className).not.toContain('desktop-surface-app');
	});

	it('uses commonUi fallback copy for shared states and retry actions', () => {
		render(
			<>
				<DesktopProductStatePanel
					state="offline"
					description="Проверьте связь."
				/>
				<DesktopAppErrorState
					message="Не удалось обновить данные"
					onAction={() => undefined}
				/>
			</>
		);

		expect(screen.getByText(/Нет связи|Offline/i)).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: /Повторить|Try again/i })
		).toBeInTheDocument();
	});
});
