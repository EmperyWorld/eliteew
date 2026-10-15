import { describe, expect, it } from 'vitest';
import {
	commandMessageBubbleClasses,
	statusBadgeDotClasses,
	statusBadgeShellClasses,
	VCC_FEED_IN_SCROLL_CLASSNAME,
	VCC_SCROLL_BODY_CLASSNAME,
} from '../voiceCommandSurfaceStyles';

describe('voiceCommandSurfaceStyles', () => {
	it('VCC scroll body owns overflow-y-auto (accordion expansion must not clip)', () => {
		expect(VCC_SCROLL_BODY_CLASSNAME).toContain('overflow-y-auto');
		expect(VCC_SCROLL_BODY_CLASSNAME).toContain('min-h-0');
		expect(VCC_SCROLL_BODY_CLASSNAME).toContain('flex-1');
		expect(VCC_FEED_IN_SCROLL_CLASSNAME).toContain('min-h-[12rem]');
		expect(VCC_FEED_IN_SCROLL_CLASSNAME).not.toContain('overflow-y-auto');
	});

	it('commandMessageBubbleClasses(success) uses desktop tokens, no zinc', () => {
		const c = commandMessageBubbleClasses('success');
		expect(c).toContain('--desktop-border-subtle');
		expect(c).toContain('--desktop-surface-soft');
		expect(c).toContain('--desktop-accent-rgb');
		expect(c).not.toMatch(/zinc-/);
	});

	it('commandMessageBubbleClasses(error) uses semantic red mix, no zinc', () => {
		const c = commandMessageBubbleClasses('error');
		expect(c).toContain('239_68_68');
		expect(c).toContain('--desktop-surface-soft');
		expect(c).not.toMatch(/zinc-/);
	});

	it('statusBadgeShellClasses toggles accent vs error surface', () => {
		const on = statusBadgeShellClasses(true);
		expect(on).toContain('--desktop-accent-rgb');
		expect(on).not.toMatch(/zinc-/);
		const off = statusBadgeShellClasses(false);
		expect(off).toContain('239_68_68');
		expect(off).not.toMatch(/zinc-/);
	});

	it('statusBadgeDotClasses uses accent when active', () => {
		expect(statusBadgeDotClasses(true)).toContain('--desktop-accent-rgb');
		expect(statusBadgeDotClasses(false)).toContain('239_68_68');
	});
});
