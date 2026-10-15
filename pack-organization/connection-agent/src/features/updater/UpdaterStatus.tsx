/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Updater strip with Russian humanized codes; install + post-install restart CTA;
 * optional Linux WebKit graphics recovery («Вернуть плавность»).
 * Honest visual weight: idle = quiet line; available/restart/graphics = elevated strip.
 *
 * Invariants:
 * - Install CTA only when canInstall is true (native update_available).
 * - Restart CTA only when canRestart is true (native installed).
 * - Dual-flag: canRestart wins — one primary CTA (no competing gold buttons).
 * - Graphics recovery is secondary (never competes with OTA install/restart).
 *
 * Related:
 * - lib/ui/statusCopy.ts
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
 * - documentation/product/desktop/DESKTOP-CLIENT-WEBKIT-LINUX-GRAPHICS.md
 */

type UpdaterStatusProps = {
	message: string;
	availableVersion?: string | null;
	canInstall?: boolean;
	installBusy?: boolean;
	onInstall?: () => void;
	canRestart?: boolean;
	restartBusy?: boolean;
	onRestart?: () => void;
	graphicsRecoveryAvailable?: boolean;
	graphicsRecoveryBusy?: boolean;
	onGraphicsRecovery?: () => void;
};

export function UpdaterStatus({
	message,
	availableVersion = null,
	canInstall = false,
	installBusy = false,
	onInstall,
	canRestart = false,
	restartBusy = false,
	onRestart,
	graphicsRecoveryAvailable = false,
	graphicsRecoveryBusy = false,
	onGraphicsRecovery,
}: UpdaterStatusProps) {
	const showRestart = canRestart && Boolean(onRestart);
	const showInstall = !showRestart && canInstall && Boolean(onInstall);
	const showGraphics =
		!showRestart &&
		!showInstall &&
		graphicsRecoveryAvailable &&
		Boolean(onGraphicsRecovery);
	const state = showRestart
		? 'restart'
		: showInstall
			? 'available'
			: showGraphics
				? 'graphics'
				: 'idle';

	return (
		<section
			className="updater-strip"
			data-state={state}
			aria-label="Обновления"
		>
			<p role="status">
				{showGraphics
					? 'Интерфейс в режиме совместимости — может тормозить. Можно вернуть плавность.'
					: message}
			</p>
			{showInstall || showRestart || showGraphics ? (
				<div className="row gap">
					{showRestart ? (
						<button
							type="button"
							className="primary"
							onClick={onRestart}
							disabled={restartBusy || installBusy || graphicsRecoveryBusy}
						>
							{restartBusy ? 'Перезапуск…' : 'Перезапустить'}
						</button>
					) : null}
					{showInstall ? (
						<button
							type="button"
							className="primary"
							onClick={onInstall}
							disabled={installBusy || restartBusy || graphicsRecoveryBusy}
						>
							{installBusy
								? 'Установка…'
								: `Установить ${availableVersion ?? 'обновление'}`}
						</button>
					) : null}
					{showGraphics ? (
						<button
							type="button"
							className="primary"
							onClick={onGraphicsRecovery}
							disabled={graphicsRecoveryBusy}
						>
							{graphicsRecoveryBusy
								? 'Восстановление…'
								: 'Вернуть плавность'}
						</button>
					) : null}
				</div>
			) : null}
		</section>
	);
}
