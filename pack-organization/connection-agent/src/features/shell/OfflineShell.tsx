/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * O5 offline catalog — Russian premium empty/catalog states; AI under disclosure.
 *
 * Invariants:
 * - Does not mount full SPA Desktop Kernel; K2/K3 policy drives presentation_url / o5 / spa_deep_link.
 * - Unknown entitlement apps → honest unavailable panel.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
 * - packaging/kernel-offline-mounts.policy.json
 */

import { useState } from 'react';
import { ClipboardPanel } from './apps/ClipboardPanel';
import { MusicPlayerPanel } from './apps/MusicPlayerPanel';
import { NotificationsPanel } from './apps/NotificationsPanel';
import { ProjectAboutPanel } from './apps/ProjectAboutPanel';
import { UnavailableAppPanel } from './apps/UnavailableAppPanel';
import { OfflineEliteewAiPanel } from './OfflineEliteewAiPanel';
import { OfflineLocalAiPanel } from './OfflineLocalAiPanel';
import { OfflineThirdPartyAiPanel } from './OfflineThirdPartyAiPanel';
import { offlineAppLabel, resolveOfflineAppPanel } from './offlineAppRouter';
import { kernelOfflineCatalogHint } from '../../lib/kernel/kernelOfflineMount';
import { resolveSeatModeLabelRu } from '../../lib/launcher/licenseModes';

type OfflineShellProps = {
	edition: string;
	profileId: string | null;
	apps: string[];
	licenseId: string | null;
	detail: string;
	appVersion: string;
	appBase: string;
};

export function OfflineShell({
	edition,
	profileId,
	apps,
	licenseId,
	detail,
	appVersion,
	appBase,
}: OfflineShellProps) {
	const [selectedApp, setSelectedApp] = useState<string | null>(null);

	if (selectedApp) {
		const panel = resolveOfflineAppPanel(selectedApp);
		const back = () => setSelectedApp(null);
		switch (panel) {
			case 'ProjectAboutApp':
				return (
					<ProjectAboutPanel
						edition={edition}
						profileId={profileId}
						licenseId={licenseId}
						appVersion={appVersion}
						appBase={appBase}
						onBack={back}
					/>
				);
			case 'ClipboardManager':
				return <ClipboardPanel appBase={appBase} onBack={back} />;
			case 'NotificationsApp':
				return <NotificationsPanel appBase={appBase} onBack={back} />;
			case 'MusicPlayer':
				return <MusicPlayerPanel appBase={appBase} onBack={back} />;
			default:
				return <UnavailableAppPanel appId={selectedApp} onBack={back} />;
		}
	}

	const modeLabel = resolveSeatModeLabelRu({ edition, profileId });

	return (
		<>
			<section className="panel" aria-labelledby="offline-shell-heading">
				<p className="panel-kicker">На устройстве</p>
				<h2 id="offline-shell-heading">Офлайн-приложения</h2>
				<p className="lead">{detail}</p>
				<p className="muted meta-inline">Режим: {modeLabel}</p>
				{apps.length === 0 ? (
					<div className="empty-state" role="status">
						<p className="status">
							В пакете лицензии пока нет офлайн-приложений.
						</p>
						<p className="muted">
							Облачный рабочий стол ниже всё равно можно открыть при сети и
							активной лицензии.
						</p>
					</div>
				) : (
					<ul className="app-catalog">
						{apps.map((app) => (
							<li key={app}>
								<button
									type="button"
									className="app-catalog-open"
									onClick={() => setSelectedApp(app)}
								>
									<strong>{offlineAppLabel(app)}</strong>
									<span className="muted">
										{kernelOfflineCatalogHint(app)}
									</span>
									<span className="app-catalog-action" aria-hidden="true">
										Открыть
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</section>

			<details className="panel details-panel">
				<summary>ИИ на этом устройстве</summary>
				<p className="muted">
					Локальные и сторонние модели — без облака EliteEW, если сервис
					настроен на машине.
				</p>
				<OfflineLocalAiPanel />
				<OfflineThirdPartyAiPanel />
				<OfflineEliteewAiPanel />
			</details>
		</>
	);
}
