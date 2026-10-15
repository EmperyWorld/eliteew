/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify typed desktop telemetry events emitted for editor flows and runtime UX.
 *
 * Invariants:
 * - Uses `desktop-telemetry` event bus with explicit payload shapes.
 * - Ensures non-PII telemetry fields for tested events.
 * - Confirms optional request/context data propagation when provided.
 *
 * Related:
 * - `pages/Desktop/utils/desktopTelemetry.ts`
 * - `pages/Desktop/components/RuntimeDisabledActionsHintCard.tsx`
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	telemetryDocEditorLeaveGuard,
	telemetryDocEditorV2Action,
	telemetryDocEditorTabSwitch,
	telemetryDocEditorLoadFinish,
	telemetryDocEditorLoadStart,
	telemetryRuntimeDisabledReasonsToggle,
} from '../desktopTelemetry';

describe('desktopTelemetry doc editor events', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('emits start and finish events without document ids', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-telemetry', spy);
		vi.spyOn(performance, 'now')
			.mockReturnValueOnce(100)
			.mockReturnValueOnce(148);

		const startMark = telemetryDocEditorLoadStart('unifiedContent');
		telemetryDocEditorLoadFinish('unifiedContent', 'success', startMark);

		expect(spy).toHaveBeenCalledTimes(2);
		const startEvent = spy.mock.calls[0][0] as CustomEvent;
		const finishEvent = spy.mock.calls[1][0] as CustomEvent;
		expect(startEvent.detail).toEqual({
			name: 'doc_editor_load_start',
			targetType: 'unifiedContent',
		});
		expect(finishEvent.detail).toEqual({
			name: 'doc_editor_load_finish',
			targetType: 'unifiedContent',
			status: 'success',
			durationMs: 48,
		});
		window.removeEventListener('desktop-telemetry', spy);
	});

	it('propagates optional requestId in doc editor telemetry', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-telemetry', spy);
		vi.spyOn(performance, 'now')
			.mockReturnValueOnce(300)
			.mockReturnValueOnce(329);
		const requestId = 'doc-open-req-1';

		const startMark = telemetryDocEditorLoadStart('docEditor', requestId);
		telemetryDocEditorLoadFinish(
			'docEditor',
			'not_found',
			startMark,
			requestId
		);

		const startEvent = spy.mock.calls[0][0] as CustomEvent;
		const finishEvent = spy.mock.calls[1][0] as CustomEvent;
		expect(startEvent.detail).toMatchObject({
			name: 'doc_editor_load_start',
			targetType: 'docEditor',
			requestId,
		});
		expect(finishEvent.detail).toMatchObject({
			name: 'doc_editor_load_finish',
			targetType: 'docEditor',
			status: 'not_found',
			durationMs: 29,
			requestId,
		});
		window.removeEventListener('desktop-telemetry', spy);
	});

	it('emits doc editor tab switch telemetry', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-telemetry', spy);
		telemetryDocEditorTabSwitch({
			fromTargetType: 'unifiedContent',
			toTargetType: 'docEditor',
			requestId: 'req-9',
		});
		expect(spy).toHaveBeenCalledTimes(1);
		const event = spy.mock.calls[0][0] as CustomEvent;
		expect(event.detail).toEqual({
			name: 'doc_editor_tab_switch',
			fromTargetType: 'unifiedContent',
			toTargetType: 'docEditor',
			requestId: 'req-9',
		});
		window.removeEventListener('desktop-telemetry', spy);
	});

	it('emits doc editor leave guard reason telemetry', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-telemetry', spy);
		telemetryDocEditorLeaveGuard({
			channel: 'beforeunload',
			reason: 'dirty',
			blocked: true,
			requestId: 'req-guard-1',
		});
		expect(spy).toHaveBeenCalledTimes(1);
		const event = spy.mock.calls[0][0] as CustomEvent;
		expect(event.detail).toEqual({
			name: 'doc_editor_leave_guard',
			channel: 'beforeunload',
			reason: 'dirty',
			blocked: true,
			requestId: 'req-guard-1',
		});
		window.removeEventListener('desktop-telemetry', spy);
	});

	it('emits runtime disabled-reasons toggle telemetry', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-telemetry', spy);
		telemetryRuntimeDisabledReasonsToggle({
			surface: 'site_studio',
			expanded: true,
			rawCount: 5,
			collapsedCount: 2,
			hiddenCount: 3,
		});
		expect(spy).toHaveBeenCalledTimes(1);
		const event = spy.mock.calls[0][0] as CustomEvent;
		expect(event.detail).toEqual({
			name: 'runtime_disabled_reasons_toggle',
			surface: 'site_studio',
			expanded: true,
			rawCount: 5,
			collapsedCount: 2,
			hiddenCount: 3,
		});
		window.removeEventListener('desktop-telemetry', spy);
	});

	it('emits non-PII document editor v2 action telemetry', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-telemetry', spy);
		telemetryDocEditorV2Action('ewa_apply', 'conflict');
		expect(spy).toHaveBeenCalledTimes(1);
		const event = spy.mock.calls[0][0] as CustomEvent;
		expect(event.detail).toEqual({
			name: 'doc_editor_v2_action',
			action: 'ewa_apply',
			status: 'conflict',
		});
		window.removeEventListener('desktop-telemetry', spy);
	});
});
