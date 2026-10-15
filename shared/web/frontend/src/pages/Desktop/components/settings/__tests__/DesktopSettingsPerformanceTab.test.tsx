/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render tests for Desktop Settings performance telemetry copy.
 *
 * Invariants:
 * - Long-task telemetry stays session-local and clearly reports unsupported browsers vs measured thresholds.
 *
 * Related:
 * - src/pages/Desktop/components/settings/DesktopSettingsPerformanceTab.tsx
 */

import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) => {
			if (key === 'settingsPanel.perfMsUnit') return 'ms';
			if (key === 'settingsPanel.perfUnavailable') return 'Unavailable';
			if (key === 'settingsPanel.perfLongTaskStatusCritical') return 'Critical';
			if (key === 'settingsPanel.perfLongTaskStatusUnavailable')
				return 'Unavailable';
			if (key === 'settingsPanel.perfStatLongTaskUnavailableHint') {
				return 'Long-task sampling is unavailable in this browser; frame and render counters still work.';
			}
			if (key === 'settingsPanel.perfStatLongTaskMeasuredHint') {
				return `Session-local samples: ${params?.count}. Warning above ${params?.warnMs} ms, critical above ${params?.criticalMs} ms.`;
			}
			if (key === 'settingsPanel.performanceInactiveSoftBlurExperimental') {
				return 'Background windows';
			}
			if (key === 'settingsPanel.performanceInactiveSoftBlurTitle') {
				return 'Background windows';
			}
			if (
				key === 'settingsPanel.performanceInactiveSoftBlurExperimentalBadge'
			) {
				return 'Experimental';
			}
			if (key === 'settingsPanel.performanceInactiveSoftBlurDoesNotSync') {
				return 'Does not sync to other devices.';
			}
			if (key === 'settingsPanel.performanceInactiveSoftBlurMeasureHint') {
				return 'Open 3+ windows. We will check smoothness for 8 seconds.';
			}
			if (key === 'settingsPanel.performanceInactiveSoftBlurLabel') {
				return 'Softer look for background windows';
			}
			if (key === 'settingsPanel.performanceInactiveSoftBlurHint') {
				return 'Open several windows, then run the check below.';
			}
			if (key === 'settingsPanel.performanceInactiveSoftBlurVerdictTitle') {
				return 'Smoothness:';
			}
			if (key === 'settingsPanel.performanceInactiveSoftBlurVerdictGood') {
				return 'good';
			}
			if (key === 'settingsPanel.perfShowDetailedDiagnostics') {
				return 'Show detailed diagnostics';
			}
			if (key === 'settingsPanel.cardMetricsTitle') {
				return 'Session status';
			}
			if (key === 'settingsPanel.metricsDisclosureHint') {
				return 'Live numbers for this browser tab';
			}
			if (key === 'settingsPanel.cardSmoothnessEffectsTitle') {
				return 'Smoothness & effects';
			}
			if (key === 'settingsPanel.performanceInactiveSoftBlurMeasure') {
				return 'Check smoothness (8 seconds)';
			}
			if (
				key === 'settingsPanel.performanceInactiveSoftBlurMeasureResultTitle'
			) {
				return 'Check results (this device only)';
			}
			if (
				key ===
				'settingsPanel.performanceInactiveSoftBlurMeasureResultSmoothness'
			) {
				return `About ${params?.fps} screen updates per second`;
			}
			if (
				key === 'settingsPanel.performanceInactiveSoftBlurMeasureResultSlowest'
			) {
				return `Longest wait between updates: about ${params?.ms} ms`;
			}
			if (
				key === 'settingsPanel.performanceInactiveSoftBlurMeasureResultStalls'
			) {
				return `Brief freezes detected: ${params?.count}`;
			}
			if (
				key ===
				'settingsPanel.performanceInactiveSoftBlurMeasureResultBackground'
			) {
				return `Background windows with softer look: ${params?.count}`;
			}
			if (key === 'settingsPanel.performanceInactiveSoftBlurCopyResult') {
				return 'Copy check result';
			}
			if (key === 'settingsPanel.performanceInactiveSoftBlurCopyResultDone') {
				return 'Copied';
			}
			return key;
		},
	}),
}));

vi.mock('../../../runtime/desktopLowGpuMode', () => ({
	isDesktopLowGpuModeEnabled: () => false,
}));

vi.mock('../../../runtime/desktopInactiveWindowBlur', () => ({
	DESKTOP_INACTIVE_WINDOW_SOFT_BLUR_CHANGE_EVENT:
		'elite-desktop-inactive-window-soft-blur-change',
	isDesktopInactiveWindowSoftBlurEnabled: () => false,
	setDesktopInactiveWindowSoftBlurEnabled: vi.fn(),
}));

const collectSample = vi.fn();
const serializeSample = vi.fn();
vi.mock('../../../runtime/desktopInactiveWindowSoftBlurPerf', () => ({
	collectDesktopInactiveWindowSoftBlurPerfSample: (...args: unknown[]) =>
		collectSample(...args),
	serializeDesktopInactiveWindowSoftBlurPerfSampleForShare: (
		...args: unknown[]
	) => serializeSample(...args),
}));

vi.mock('@/utils/clipboard', () => ({
	safeCopyToClipboard: vi.fn(async () => true),
}));

import {
	DesktopSettingsPerformanceTab,
	type PerformanceSummary,
} from '../DesktopSettingsPerformanceTab';
import { safeCopyToClipboard } from '@/utils/clipboard';

const shell = {
	windowStyle: 'glass' as const,
	checkboxClass: 'checkbox',
	statTileClass: 'stat-tile',
};

function buildPerformance(
	metrics: Partial<PerformanceSummary['metrics']>
): PerformanceSummary {
	return {
		metrics: {
			fps: 60,
			renderTime: 12,
			memoryUsage: 128,
			...metrics,
		},
		isHighPerformanceMode: false,
		recommendations: [],
	};
}

describe('DesktopSettingsPerformanceTab', () => {
	function openSessionStatusDisclosure(): void {
		const disclosure = screen.getByTestId(
			'desktop-settings-comfort-session-status'
		);
		const summary = disclosure.querySelector('summary');
		expect(summary).toBeTruthy();
		fireEvent.click(summary as HTMLElement);
	}

	it('explains unavailable long-task sampling', () => {
		render(
			<DesktopSettingsPerformanceTab
				performance={buildPerformance({ longTaskSupported: false })}
				shell={shell}
			/>
		);

		openSessionStatusDisclosure();
		fireEvent.click(
			screen.getByRole('button', { name: /Show detailed diagnostics/i })
		);

		expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
		expect(
			screen.getByText(
				'Long-task sampling is unavailable in this browser; frame and render counters still work.'
			)
		).toBeTruthy();
	});

	it('shows measured long-task thresholds', () => {
		render(
			<DesktopSettingsPerformanceTab
				performance={buildPerformance({
					longTaskSupported: true,
					longTaskCount: 3,
					lastLongTaskMs: 125,
				})}
				shell={shell}
			/>
		);

		openSessionStatusDisclosure();
		fireEvent.click(
			screen.getByRole('button', { name: /Show detailed diagnostics/i })
		);

		expect(screen.getByText('125 ms · Critical')).toBeTruthy();
		expect(
			screen.getByText(
				'Session-local samples: 3. Warning above 50 ms, critical above 100 ms.'
			)
		).toBeTruthy();
	});

	it('shows user-facing inactive blur copy and sample results', async () => {
		collectSample.mockResolvedValue({
			sampleMs: 8000,
			frameCount: 480,
			avgFrameMs: 17.2,
			fps: 58.2,
			p95FrameMs: 22.5,
			longTaskCount: 1,
			longTaskSupported: true,
			inactiveSoftBlurShellCount: 3,
			inactiveWindowCount: 4,
			softBlurEnabled: false,
		});
		serializeSample.mockReturnValue(
			'{"kind":"desktop-inactive-soft-blur-smoothness-check"}'
		);

		render(
			<DesktopSettingsPerformanceTab
				performance={buildPerformance({})}
				shell={shell}
			/>
		);

		openSessionStatusDisclosure();
		const experimental = screen.getByTestId(
			'desktop-settings-comfort-experimental-effects'
		);
		fireEvent.click(experimental.querySelector('summary') as HTMLElement);

		expect(
			within(experimental).getAllByText('Background windows').length
		).toBeGreaterThan(0);
		expect(
			within(experimental).getByText('Softer look for background windows')
		).toBeTruthy();
		expect(
			within(experimental).getByText('Does not sync to other devices.')
		).toBeTruthy();
		expect(
			within(experimental).getByText(
				'Open 3+ windows. We will check smoothness for 8 seconds.'
			)
		).toBeTruthy();
		expect(
			screen.queryByText(
				'A gentler look for windows you are not using. Does not dim or block windows.'
			)
		).toBeNull();

		fireEvent.click(
			within(experimental).getByRole('button', { name: /Check smoothness/i })
		);

		await waitFor(() => {
			expect(
				within(experimental).getByText('Check results (this device only)')
			).toBeTruthy();
		});
		expect(within(experimental).getByText(/Smoothness:/)).toBeTruthy();
		expect(within(experimental).getByText(/good/)).toBeTruthy();
		expect(
			within(experimental).getByText('About 58.2 screen updates per second')
		).toBeTruthy();
		expect(
			within(experimental).getByText(
				'Longest wait between updates: about 22.5 ms'
			)
		).toBeTruthy();
		expect(
			within(experimental).getByText('Brief freezes detected: 1')
		).toBeTruthy();
		expect(
			within(experimental).getByText('Background windows with softer look: 3')
		).toBeTruthy();
	});

	it('copies shareable JSON after smoothness check', async () => {
		const sample = {
			sampleMs: 8000,
			frameCount: 480,
			avgFrameMs: 17.2,
			fps: 58.2,
			p95FrameMs: 22.5,
			longTaskCount: 1,
			longTaskSupported: true,
			inactiveSoftBlurShellCount: 3,
			inactiveWindowCount: 4,
			softBlurEnabled: false,
		};
		collectSample.mockResolvedValue(sample);
		serializeSample.mockReturnValue(
			'{"kind":"desktop-inactive-soft-blur-smoothness-check"}'
		);

		render(
			<DesktopSettingsPerformanceTab
				performance={buildPerformance({})}
				shell={shell}
			/>
		);

		openSessionStatusDisclosure();
		const experimental = screen.getByTestId(
			'desktop-settings-comfort-experimental-effects'
		);
		fireEvent.click(experimental.querySelector('summary') as HTMLElement);

		fireEvent.click(
			within(experimental).getByRole('button', { name: /Check smoothness/i })
		);

		await waitFor(() => {
			expect(
				within(experimental).getByRole('button', { name: /Copy check result/i })
			).toBeTruthy();
		});

		fireEvent.click(
			within(experimental).getByRole('button', { name: /Copy check result/i })
		);

		expect(serializeSample).toHaveBeenCalledWith(sample);
		expect(safeCopyToClipboard).toHaveBeenCalledWith(
			'{"kind":"desktop-inactive-soft-blur-smoothness-check"}'
		);
		await waitFor(() => {
			expect(
				within(experimental).getByRole('button', { name: /Copied/i })
			).toBeTruthy();
		});
	});
});
