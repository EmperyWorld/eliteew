/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EmpiierOS FoFline opens a clipped sibling Meet stage. It must not mount
 * the Meet iframe. Hangup and Meet death still end the stack0 call.
 *
 * Related:
 * - VideoCallApp.tsx
 * - videoCallNativeMeetStage.ts
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isEmpiierosFoflineHost } from '@/services/desktopClient/eliteewProductHost';
import { setOidcRuntimeProfile } from '@/services/keycloakProfile';

const joinUrl = 'https://meet.eliteew.ru/room?jwt=abc';
const stageBounds = { x: 12, y: 24, width: 640, height: 360 };
const openMeetStage = vi.fn(async () => ({ ok: true }));
const setMeetStageBounds = vi.fn(async () => ({ ok: true }));
const closeMeetStage = vi.fn(async () => ({ ok: true }));

vi.mock('@/pages/Desktop/utils/videoCallLeader', () => ({
	acquireVideoCallLeadership: (
		_userId: string,
		_callId: string,
		callbacks: { onAcquire: () => void }
	) => {
		callbacks.onAcquire();
		return {
			dispose: () => undefined,
			yieldLeadership: () => undefined,
		};
	},
}));

vi.mock('@/services/authSession', () => ({
	default: { subject: 'user-1' },
	getUserInfo: vi.fn(async () => ({ id: 'user-1' })),
}));

vi.mock('./api/videoCallApi', () => ({
	joinVideoCall: vi.fn(async () => ({
		join_url: 'https://meet.eliteew.ru/room?jwt=abc',
		status: 'active',
		awaiting_accept: false,
	})),
	endVideoCall: vi.fn(async () => ({ already_ended: false })),
	endVideoCallKeepalive: vi.fn(),
	inviteToVideoCall: vi.fn(),
}));

import { endVideoCall, endVideoCallKeepalive } from './api/videoCallApi';
import VideoCallApp from './VideoCallApp';

function renderCall() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<VideoCallApp callId="call-1" initialJoinUrl={joinUrl} />
		</QueryClientProvider>
	);
}

function installEmpiierosHost(): void {
	setOidcRuntimeProfile('foflineNative');
	(
		window as Window & {
			EmperyDesktopNativeOidc?: { refreshSessionJson: () => string };
		}
	).EmperyDesktopNativeOidc = { refreshSessionJson: () => '{}' };
	(
		window as Window & {
			EmperyDesktopMeetStage?: {
				openMeetStage: typeof openMeetStage;
				setMeetStageBounds: typeof setMeetStageBounds;
				closeMeetStage: typeof closeMeetStage;
			};
		}
	).EmperyDesktopMeetStage = {
		openMeetStage,
		setMeetStageBounds,
		closeMeetStage,
	};
}

function stubStageRect(
	width = stageBounds.width,
	height = stageBounds.height
): void {
	vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
		x: stageBounds.x,
		y: stageBounds.y,
		width,
		height,
		top: stageBounds.y,
		left: stageBounds.x,
		bottom: stageBounds.y + height,
		right: stageBounds.x + width,
		toJSON: () => ({}),
	} as DOMRect);
}

describe('VideoCallApp EmpiierOS sibling stage', () => {
	afterEach(() => {
		setOidcRuntimeProfile('web');
		delete (window as Window & { EmperyDesktopNativeOidc?: unknown })
			.EmperyDesktopNativeOidc;
		delete (window as Window & { EmperyDesktopMeetStage?: unknown })
			.EmperyDesktopMeetStage;
		delete (window as Window & { __TAURI_INTERNALS__?: unknown })
			.__TAURI_INTERNALS__;
		openMeetStage.mockClear();
		setMeetStageBounds.mockClear();
		closeMeetStage.mockClear();
		vi.mocked(endVideoCall).mockClear();
		vi.mocked(endVideoCallKeepalive).mockClear();
		vi.restoreAllMocks();
	});

	it('opens the clipped stage with bounds and does not mount Meet iframe', async () => {
		stubStageRect();
		installEmpiierosHost();
		expect(isEmpiierosFoflineHost()).toBe(true);

		renderCall();

		await waitFor(() => {
			expect(openMeetStage).toHaveBeenCalledWith(joinUrl, stageBounds);
		});
		expect(screen.queryByTitle('Video call frame')).not.toBeInTheDocument();
		expect(document.querySelector('iframe')).toBeNull();
		expect(setMeetStageBounds).toHaveBeenCalledWith(stageBounds);
		expect(screen.queryByText('Call in progress')).not.toBeInTheDocument();
		expect(
			screen.queryByText(/shown over this window/)
		).not.toBeInTheDocument();
		expect(screen.queryByText('Call connected')).not.toBeInTheDocument();
		expect(screen.queryByText('Видеозвонок идёт')).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'End video call' }));
		await waitFor(() => {
			expect(endVideoCall).toHaveBeenCalledWith('call-1');
		});
		expect(closeMeetStage).toHaveBeenCalledWith();
	});

	it('ends the stack0 call when the OS Meet process dies', async () => {
		const { EMPIIEROS_MEET_STAGE_LOST_EVENT } = await import(
			'@/pages/Desktop/utils/videoCallNativeMeetStage'
		);
		stubStageRect(200, 120);
		installEmpiierosHost();

		renderCall();
		await waitFor(() => {
			expect(openMeetStage).toHaveBeenCalled();
		});
		expect(endVideoCall).not.toHaveBeenCalled();

		window.dispatchEvent(
			new CustomEvent(EMPIIEROS_MEET_STAGE_LOST_EVENT, {
				detail: { code: 'meet_process_crashed' },
			})
		);
		await waitFor(() => {
			expect(endVideoCall).toHaveBeenCalledWith('call-1');
		});
		expect(closeMeetStage).toHaveBeenCalled();
		expect(document.querySelector('iframe')).toBeNull();
	});

	it('sends keepalive /end on pagehide', async () => {
		stubStageRect();
		installEmpiierosHost();
		renderCall();
		await waitFor(() => {
			expect(openMeetStage).toHaveBeenCalled();
		});
		window.dispatchEvent(new Event('pagehide'));
		expect(endVideoCallKeepalive).toHaveBeenCalledWith('call-1');
	});

	it('ends the call when the window unmounts, not on a strict remount', async () => {
		stubStageRect();
		installEmpiierosHost();
		const first = renderCall();
		await waitFor(() => {
			expect(openMeetStage).toHaveBeenCalled();
		});
		first.unmount();
		openMeetStage.mockClear();
		const second = renderCall();
		await waitFor(() => {
			expect(openMeetStage).toHaveBeenCalled();
		});
		await new Promise((resolve) => {
			window.setTimeout(resolve, 20);
		});
		expect(endVideoCall).not.toHaveBeenCalled();
		second.unmount();
		await waitFor(() => {
			expect(endVideoCall).toHaveBeenCalledWith('call-1');
		});
	});

	it('keeps the browser iframe when the OS hook is absent', async () => {
		setOidcRuntimeProfile('web');
		renderCall();
		const frame = await screen.findByTitle('Video call frame');
		expect(frame).toHaveAttribute('src', joinUrl);
		expect(openMeetStage).not.toHaveBeenCalled();
	});
});
