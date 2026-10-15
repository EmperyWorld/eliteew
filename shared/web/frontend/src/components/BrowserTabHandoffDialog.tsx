/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Leader-tab confirmation when another browser tab requests active session (sound + flash, 60s).
 *
 * Invariants:
 * - Shown only on current leader tab; challenger waits on PassiveFollowerTabScreen.
 *
 * Related:
 * - `contexts/BrowserTabLeaderProvider.tsx`, `pages/Desktop/utils/desktopRealtimeLeader.ts`
 */

import { useEffect, useRef, type FC } from 'react';

const HANDOFF_BEEP_INTERVAL_MS = 2500;

type BrowserTabHandoffDialogProps = {
	secondsLeft: number;
	onAccept: () => void;
	onDeny: () => void;
};

export const BrowserTabHandoffDialog: FC<BrowserTabHandoffDialogProps> = ({
	secondsLeft,
	onAccept,
	onDeny,
}) => {
	const beepTimerRef = useRef<number | null>(null);

	useEffect(() => {
		const playBeep = (): void => {
			try {
				const Ctx =
					window.AudioContext ||
					(window as unknown as { webkitAudioContext?: typeof AudioContext })
						.webkitAudioContext;
				if (!Ctx) {
					return;
				}
				const ctx = new Ctx();
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.type = 'sine';
				osc.frequency.value = 880;
				gain.gain.value = 0.08;
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.start();
				osc.stop(ctx.currentTime + 0.12);
				window.setTimeout(() => {
					void ctx.close();
				}, 200);
			} catch {
				/* autoplay policy / WebView */
			}
		};

		playBeep();
		beepTimerRef.current = window.setInterval(
			playBeep,
			HANDOFF_BEEP_INTERVAL_MS
		);
		return () => {
			if (beepTimerRef.current != null) {
				window.clearInterval(beepTimerRef.current);
			}
		};
	}, []);

	return (
		<div
			className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-pulse motion-reduce:animate-none"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="browser-tab-handoff-title"
		>
			<div className="max-w-md rounded-2xl border-2 border-amber-400/80 bg-slate-900 px-6 py-8 text-center shadow-[0_0_40px_rgba(251,191,36,0.35)] motion-reduce:shadow-none">
				<p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
					Запрос с другой вкладки
				</p>
				<h2
					id="browser-tab-handoff-title"
					className="mt-3 text-xl font-semibold text-white"
				>
					Переключить активную сессию?
				</h2>
				<p className="mt-3 text-sm leading-relaxed text-slate-300">
					Другая вкладка EliteEW просит стать основной. Если разрешите, эта
					вкладка перейдёт в режим ожидания, realtime-сокет будет передан.
				</p>
				<p className="mt-4 text-sm font-medium text-amber-200">
					Осталось: {secondsLeft} с
				</p>
				<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
					<button
						type="button"
						onClick={onAccept}
						className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
					>
						Разрешить
					</button>
					<button
						type="button"
						onClick={onDeny}
						className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-slate-400"
					>
						Отказать
					</button>
				</div>
			</div>
		</div>
	);
};
