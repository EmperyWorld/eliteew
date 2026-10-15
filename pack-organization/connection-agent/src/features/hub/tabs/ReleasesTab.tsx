/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Journey Hub Релизы — user notes («Что нового») + updater Install/Restart.
 *
 * Invariants:
 * - Notes from bundled docs/RELEASE-NOTES-user.ru.txt (no ops jargon).
 * - Silent Linux auto-apply suppressed while notes are for an unseen version (App gate).
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.2
 */

import { APP_VERSION } from '../../../lib/launcher/appVersion';
import {
	BUNDLED_USER_RELEASE_NOTES,
	historySummariesBetween,
	loadBundledReleaseNotesHistory,
} from '../../../lib/launcher/journey';
import { UpdaterStatus } from '../../updater/UpdaterStatus';

export type ReleasesTabProps = {
	updaterMessage: string;
	updaterAvailable: string | null;
	updateCheckBusy: boolean;
	updateInstallBusy: boolean;
	updateRestartBusy: boolean;
	updaterNeedsRestart: boolean;
	onCheckUpdate: () => void;
	onInstall: () => void;
	onRestart: () => void;
};

export function ReleasesTab(props: ReleasesTabProps) {
	const {
		updaterMessage,
		updaterAvailable,
		updateCheckBusy,
		updateInstallBusy,
		updateRestartBusy,
		updaterNeedsRestart,
		onCheckUpdate,
		onInstall,
		onRestart,
	} = props;

	const historyLines = historySummariesBetween(
		loadBundledReleaseNotesHistory(),
		APP_VERSION,
		updaterAvailable
	);

	return (
		<section className="panel" aria-labelledby="releases-heading">
			<p className="panel-kicker">Обновления</p>
			<h2 id="releases-heading">Релизы</h2>
			<p className="muted" style={{ marginTop: 0 }}>
				Текущая версия клиента: <strong>{APP_VERSION}</strong>
				{updaterAvailable ? (
					<>
						{' '}
						· доступно <strong>{updaterAvailable}</strong>
					</>
				) : null}
			</p>
			<section className="releases-notes" aria-labelledby="whats-new-heading">
				<h3 id="whats-new-heading">Что нового</h3>
				<pre className="releases-notes-body">{BUNDLED_USER_RELEASE_NOTES}</pre>
				{historyLines.length > 0 ? (
					<ul className="releases-history">
						{historyLines.map((line) => (
							<li key={line}>{line}</li>
						))}
					</ul>
				) : null}
			</section>
			<div className="actions" style={{ marginBottom: '0.85rem' }}>
				<button
					type="button"
					className="secondary"
					disabled={updateCheckBusy}
					onClick={onCheckUpdate}
				>
					{updateCheckBusy ? 'Проверка…' : 'Проверить обновления'}
				</button>
			</div>
			<UpdaterStatus
				message={
					updaterAvailable
						? `${updaterMessage} · ${updaterAvailable}`
						: updaterMessage
				}
				availableVersion={updaterAvailable}
				canInstall={Boolean(updaterAvailable)}
				installBusy={updateInstallBusy}
				onInstall={onInstall}
				canRestart={updaterNeedsRestart}
				restartBusy={updateRestartBusy}
				onRestart={onRestart}
			/>
		</section>
	);
}
