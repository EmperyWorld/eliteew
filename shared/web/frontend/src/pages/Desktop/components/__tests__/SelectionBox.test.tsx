import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopItem } from '../../types/desktop.types';
import * as desktopSnapGeometry from '../../utils/desktopSnapGeometry';
import { SelectionBox } from '../SelectionBox';

const cachedWorkArea = {
	offsetLeft: 0,
	offsetTop: 0,
	width: 1280,
	height: 720,
	layoutScale: 1,
};

const sampleItems: DesktopItem[] = [
	{
		id: 'icon-a',
		type: 'app',
		name: 'App A',
		position: { x: 10, y: 10 },
		appComponent: 'TestApp',
	},
	{
		id: 'icon-b',
		type: 'app',
		name: 'App B',
		position: { x: 200, y: 200 },
		appComponent: 'TestApp',
	},
];

describe('SelectionBox', () => {
	let rafQueue: FrameRequestCallback[];

	beforeEach(() => {
		rafQueue = [];
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			rafQueue.push(cb);
			return rafQueue.length;
		});
		vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
			rafQueue = [];
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders paint-safe marquee without animation library classes', () => {
		const { getByTestId } = render(
			<SelectionBox enabled items={sampleItems} onSelectionChange={() => {}} />
		);
		const marquee = getByTestId('desktop-selection-marquee');
		expect(marquee.className).not.toMatch(/animate-/);
		expect(marquee.className).not.toMatch(/motion-/);
		expect(marquee.className).toContain('border-2');
		expect(marquee.className).not.toContain('bg-[');
	});

	it('defers React selection until mouseup during drag', () => {
		const onSelectionChange = vi.fn();
		const root = document.createElement('div');
		root.id = 'desktop-main';
		const background = document.createElement('div');
		background.setAttribute('data-desktop-background', '');
		root.appendChild(background);
		document.body.appendChild(root);

		render(
			<SelectionBox
				enabled
				items={sampleItems}
				onSelectionChange={onSelectionChange}
			/>,
			{ container: background }
		);

		background.dispatchEvent(
			new MouseEvent('mousedown', {
				bubbles: true,
				cancelable: true,
				button: 0,
				clientX: 20,
				clientY: 20,
			})
		);

		window.dispatchEvent(
			new MouseEvent('mousemove', { clientX: 40, clientY: 40 })
		);
		window.dispatchEvent(
			new MouseEvent('mousemove', { clientX: 60, clientY: 60 })
		);

		for (const cb of rafQueue) {
			cb(0);
		}

		expect(onSelectionChange).not.toHaveBeenCalled();

		window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));

		expect(onSelectionChange).toHaveBeenCalledTimes(1);

		root.remove();
	});

	it('snapshots work area on mousedown and avoids layout reads on mousemove', () => {
		const readSpy = vi
			.spyOn(desktopSnapGeometry, 'readDesktopWorkArea')
			.mockReturnValue(cachedWorkArea);

		const root = document.createElement('div');
		root.id = 'desktop-main';
		const background = document.createElement('div');
		background.setAttribute('data-desktop-background', '');
		root.appendChild(background);
		document.body.appendChild(root);

		render(
			<SelectionBox enabled items={sampleItems} onSelectionChange={() => {}} />,
			{ container: background }
		);

		background.dispatchEvent(
			new MouseEvent('mousedown', {
				bubbles: true,
				cancelable: true,
				button: 0,
				clientX: 20,
				clientY: 20,
			})
		);
		expect(readSpy).toHaveBeenCalledTimes(1);

		for (let i = 0; i < 20; i += 1) {
			window.dispatchEvent(
				new MouseEvent('mousemove', { clientX: 20 + i, clientY: 20 + i })
			);
		}
		expect(readSpy).toHaveBeenCalledTimes(1);

		window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
		root.remove();
	});
});
