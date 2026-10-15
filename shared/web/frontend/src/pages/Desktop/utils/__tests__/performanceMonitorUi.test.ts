import { describe, expect, it } from 'vitest';
import {
	performanceMonitorFabMotionProps,
	performanceMonitorPanelMotionProps,
	virtualizationToggleButtonClasses,
} from '../performanceMonitorUi';

describe('performanceMonitorUi', () => {
	it('performanceMonitorFabMotionProps: reduced motion drops scale', () => {
		const on = performanceMonitorFabMotionProps(true);
		expect(on.initial).not.toHaveProperty('scale');
		expect(on.transition.duration).toBe(0);
		const off = performanceMonitorFabMotionProps(false);
		expect(off.initial).toHaveProperty('scale', 0.8);
		expect(off.transition.duration).toBeGreaterThan(0);
	});

	it('performanceMonitorPanelMotionProps: reduced motion drops scale and y', () => {
		const on = performanceMonitorPanelMotionProps(true);
		expect(on.initial).not.toHaveProperty('scale');
		expect(on.initial).not.toHaveProperty('y');
		expect(on.transition?.duration).toBe(0);
		const off = performanceMonitorPanelMotionProps(false);
		expect(off.initial).toMatchObject({ scale: 0.8, y: -20 });
		expect(off.transition).toBeUndefined();
	});

	it('virtualizationToggleButtonClasses(enabled) uses desktop soft + emerald border mix', () => {
		const c = virtualizationToggleButtonClasses(true);
		expect(c).toContain('--desktop-surface-soft');
		expect(c).toContain('emerald');
		expect(c).toContain('52_211_153');
		expect(c).not.toMatch(/gray-/);
	});

	it('virtualizationToggleButtonClasses(disabled) uses muted text, no gray palette', () => {
		const c = virtualizationToggleButtonClasses(false);
		expect(c).toContain('--desktop-text-muted');
		expect(c).toContain('--desktop-border-subtle');
		expect(c).not.toMatch(/gray-/);
	});
});
