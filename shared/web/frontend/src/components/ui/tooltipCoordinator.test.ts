/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for TooltipV2 coordinator (singleton visibility + pointer integrity).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	dismissAllCoordinatorTooltips,
	notifyTooltipCoordinatorHidden,
	notifyTooltipCoordinatorShown,
	registerTooltipCoordinatorHandle,
} from './tooltipCoordinator';

describe('tooltipCoordinator', () => {
	beforeEach(() => {
		dismissAllCoordinatorTooltips();
	});

	afterEach(() => {
		dismissAllCoordinatorTooltips();
		vi.restoreAllMocks();
	});

	it('shows only one tooltip at a time', () => {
		const hideA = vi.fn();
		const hideB = vi.fn();
		const triggerA = document.createElement('button');
		const triggerB = document.createElement('button');
		document.body.append(triggerA, triggerB);

		const unregisterA = registerTooltipCoordinatorHandle({
			id: 'a',
			getTrigger: () => triggerA,
			forceHide: hideA,
		});
		registerTooltipCoordinatorHandle({
			id: 'b',
			getTrigger: () => triggerB,
			forceHide: hideB,
		});

		notifyTooltipCoordinatorShown('a', triggerA, hideA);
		notifyTooltipCoordinatorShown('b', triggerB, hideB);

		expect(hideA).toHaveBeenCalledTimes(1);
		expect(hideB).not.toHaveBeenCalled();

		unregisterA();
		triggerA.remove();
		triggerB.remove();
	});

	it('dismisses tooltip when pointer is outside trigger', async () => {
		const hide = vi.fn();
		const trigger = document.createElement('button');
		const outside = document.createElement('div');
		document.body.append(trigger, outside);

		registerTooltipCoordinatorHandle({
			id: 't1',
			getTrigger: () => trigger,
			forceHide: hide,
		});
		notifyTooltipCoordinatorShown('t1', trigger, hide);

		if (typeof document.elementFromPoint === 'function') {
			vi.spyOn(document, 'elementFromPoint').mockReturnValue(outside);
		} else {
			Object.defineProperty(document, 'elementFromPoint', {
				configurable: true,
				value: vi.fn(() => outside),
			});
		}

		window.dispatchEvent(
			new PointerEvent('pointermove', { clientX: 250, clientY: 220 })
		);

		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => {
				expect(hide).toHaveBeenCalledTimes(1);
				trigger.remove();
				outside.remove();
				vi.restoreAllMocks();
				resolve();
			});
		});
	});

	it('clears visible tooltip on global dismissAll', () => {
		const hide = vi.fn();
		const trigger = document.createElement('button');
		document.body.append(trigger);

		registerTooltipCoordinatorHandle({
			id: 't2',
			getTrigger: () => trigger,
			forceHide: hide,
		});
		notifyTooltipCoordinatorShown('t2', trigger, hide);
		dismissAllCoordinatorTooltips();
		expect(hide).toHaveBeenCalledTimes(1);

		notifyTooltipCoordinatorHidden('t2');
		trigger.remove();
	});
});
