import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import { NewFolderDialog } from '../NewFolderDialog';

vi.mock('@/components/ui/ModalAdvanced', () => ({
	ModalAdvanced: ({
		children,
		footer,
		title,
	}: {
		children: ReactNode;
		footer?: ReactNode;
		title: string;
	}) => (
		<div data-testid="modal-advanced">
			<h2>{title}</h2>
			{children}
			{footer}
		</div>
	),
}));

describe('NewFolderDialog', () => {
	it('renders footer actions with DesktopAppButton semantics (Создать / Отмена)', () => {
		const onClose = vi.fn();
		const onCreate = vi.fn();
		render(<NewFolderDialog isOpen onClose={onClose} onCreate={onCreate} />);

		fireEvent.click(screen.getByRole('button', { name: /Отмена|Cancel/i }));
		expect(onClose).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByRole('button', { name: /Создать|Create/i }));
		expect(onCreate).toHaveBeenCalled();
		expect(onClose).toHaveBeenCalledTimes(2);
	});
});
