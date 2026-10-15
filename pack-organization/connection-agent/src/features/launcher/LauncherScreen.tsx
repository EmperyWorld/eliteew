/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell launch CTA card — open cloud desktop + check private updates.
 *
 * Invariants:
 * - Start disabled when version gate fails.
 * - One filled primary above the fold; update check is secondary.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
 */

import './launcher.css';

type LauncherScreenProps = {
	versionLabel: string;
	canStart: boolean;
	canCheckUpdate: boolean;
	updateBusy?: boolean;
	onStart: () => void;
	onCheckUpdate: () => void;
	detail: string;
	startLabel?: string;
	/** Optional lead; default stays cloud-oriented for unused soak ShellStep. */
	lead?: string;
	/** FoFline secondary CTA — shown only when issued and not already the primary. */
	canFoflineStart?: boolean;
	onFoflineStart?: () => void;
	foflineStartLabel?: string;
};

export function LauncherScreen({
	versionLabel,
	canStart,
	canCheckUpdate,
	updateBusy = false,
	onStart,
	onCheckUpdate,
	detail,
	startLabel = 'Открыть EliteEW',
	lead,
	canFoflineStart = false,
	onFoflineStart,
	foflineStartLabel = 'Открыть FoFline',
}: LauncherScreenProps) {
	const leadText =
		lead ??
		`Откройте облачный рабочий стол или продолжите с офлайн-приложениями справа. Клиент v${versionLabel}.`;
	return (
		<section
			className="panel launcher-panel"
			aria-labelledby="launcher-heading"
		>
			<p className="panel-kicker">Готово к работе</p>
			<h2 id="launcher-heading">Запуск</h2>
			<p className="launcher-lead">{leadText}</p>
			<p className="status status-banner" role="status">
				{detail}
			</p>
			<div className="row gap launcher-actions">
				<button
					type="button"
					className="primary"
					onClick={onStart}
					disabled={!canStart}
				>
					{startLabel}
				</button>
				{onFoflineStart ? (
					<button
						type="button"
						className="secondary"
						onClick={onFoflineStart}
						disabled={!canFoflineStart}
					>
						{foflineStartLabel}
					</button>
				) : null}
				{canCheckUpdate ? (
					<button
						type="button"
						className="secondary"
						onClick={onCheckUpdate}
						disabled={updateBusy}
					>
						{updateBusy ? 'Проверка…' : 'Проверить обновления'}
					</button>
				) : null}
			</div>
		</section>
	);
}
