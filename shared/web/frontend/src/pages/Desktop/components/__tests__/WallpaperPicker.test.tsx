/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wallpaper picker compact surface lock (Everyday IA density wave).
 *
 * Related:
 * - `WallpaperPicker.tsx`
 * - `DESKTOP-SETTINGS-EVERYDAY-IA.md` §4
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import { WallpaperPicker } from '../WallpaperPicker';

const modalProps: { size?: string; contentClassName?: string } = {};

vi.mock('@tanstack/react-virtual', () => ({
	useVirtualizer: ({ count }: { count: number }) => ({
		getVirtualItems: () =>
			Array.from({ length: count }, (_, index) => ({
				index,
				key: index,
				start: index * 88,
				size: 88,
				end: (index + 1) * 88,
			})),
		getTotalSize: () => Math.max(count, 1) * 88,
		scrollToIndex: vi.fn(),
		measureElement: vi.fn(),
	}),
}));

vi.mock('@/components/ui/ModalAdvanced', () => ({
	ModalAdvanced: ({
		children,
		footer,
		title,
		size,
		contentClassName,
	}: {
		children: ReactNode;
		footer?: ReactNode;
		title: string;
		size?: string;
		contentClassName?: string;
	}) => {
		modalProps.size = size;
		modalProps.contentClassName = contentClassName;
		return (
			<div data-testid="modal-advanced">
				<h2>{title}</h2>
				{children}
				{footer}
			</div>
		);
	},
}));

describe('WallpaperPicker (density wave)', () => {
	it('renders virtualized grid and apply/cancel when open', () => {
		const onClose = vi.fn();
		const onSelect = vi.fn();
		render(
			<WallpaperPicker
				isOpen
				onClose={onClose}
				current="/desktop-wallpapers/1.webp"
				history={['/desktop-wallpapers/2.webp']}
				onSelect={onSelect}
				shellWindowStyle="glass"
			/>
		);

		expect(screen.getByRole('grid')).toBeInTheDocument();
		expect(screen.getByTestId('modal-advanced')).toBeInTheDocument();
		expect(modalProps.size).toBe('lg');
		expect(modalProps.contentClassName).toMatch(/max-h-\[min\(42vh,22rem\)\]/);
		expect(screen.getByRole('grid')).toHaveAttribute('aria-colcount', '5');
		expect(
			screen.getByRole('button', { name: /wallpaper\.apply|Применить|Apply/i })
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: /wallpaper\.cancel|Отмена|Cancel/i })
		).toBeInTheDocument();
	});

	it('returns null when closed', () => {
		const { container } = render(
			<WallpaperPicker
				isOpen={false}
				onClose={vi.fn()}
				current="/desktop-wallpapers/1.webp"
				onSelect={vi.fn()}
			/>
		);
		expect(container.firstChild).toBeNull();
	});

	it('source locks pending-upload tile and remove fallback to current', async () => {
		const { readFileSync } = await import('node:fs');
		const { dirname, join } = await import('node:path');
		const { fileURLToPath } = await import('node:url');
		const src = readFileSync(
			join(dirname(fileURLToPath(import.meta.url)), '../WallpaperPicker.tsx'),
			'utf8'
		);
		expect(src).toContain("id: 'pending-upload'");
		expect(src).toContain('!userWallpapers.has(pending)');
		expect(src).toContain('current && current !== style');
		expect(src).toContain('DEFAULT_DESKTOP_WALLPAPER_STYLE');
	});

	it('removing selected user wallpaper falls back to default when it is also current', async () => {
		const onClose = vi.fn();
		const onSelect = vi.fn();
		const onRemoveUserWallpaper = vi.fn();
		const userStyle =
			'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v39gAA=';

		render(
			<WallpaperPicker
				isOpen
				onClose={onClose}
				current={userStyle}
				history={[userStyle]}
				onSelect={onSelect}
				onRemoveUserWallpaper={onRemoveUserWallpaper}
				shellWindowStyle="glass"
			/>
		);

		fireEvent.click(
			screen.getByRole('button', {
				name: /wallpaper\.removeUserAria|Удалить|Remove/i,
			})
		);
		expect(onRemoveUserWallpaper).toHaveBeenCalledWith(userStyle);

		await waitFor(() => {
			expect(
				screen
					.getAllByRole('gridcell')
					.some((el) => el.getAttribute('aria-selected') === 'true')
			).toBe(true);
		});

		fireEvent.click(
			screen.getByRole('button', {
				name: /wallpaper\.apply|Применить|Apply/i,
			})
		);
		expect(onSelect).toHaveBeenCalledWith('/desktop-wallpapers/1.webp');
		expect(onClose).toHaveBeenCalled();
	});
});
