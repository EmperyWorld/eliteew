/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * O5 ProjectAbout — local metadata + K1 Kernel presentation CTA (Approach A light).
 *
 * Invariants:
 * - Local license/edition facts always available offline.
 * - Presentation WebviewWindow needs APP_BASE reachability (honest fail).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
 */

import { useState } from 'react';
import { isPresentationUrlMount } from '../../../lib/kernel/kernelOfflineMount';
import { kernelOfflineOpenMount } from '../../../lib/tauri-bridge/commands';

type Props = {
	edition: string;
	profileId: string | null;
	licenseId: string | null;
	appVersion: string;
	appBase: string;
	onBack: () => void;
};

export function ProjectAboutPanel({
	edition,
	profileId,
	licenseId,
	appVersion,
	appBase,
	onBack,
}: Props) {
	const [mountBusy, setMountBusy] = useState(false);
	const [mountDetail, setMountDetail] = useState<string | null>(null);

	async function handleOpenPresentation() {
		if (!isPresentationUrlMount('ProjectAboutApp')) {
			setMountDetail('Презентация недоступна в этом билде (K1 allowlist).');
			return;
		}
		setMountBusy(true);
		setMountDetail(null);
		try {
			const result = await kernelOfflineOpenMount('ProjectAboutApp');
			if (result.ok) {
				setMountDetail(
					result.code === 'focused'
						? 'Окно презентации уже открыто — фокус восстановлен.'
						: 'Открыта презентация продукта (нужен доступ к облачному столу).'
				);
			} else {
				setMountDetail(
					result.message ||
						'Не удалось открыть презентацию — проверьте туннель и APP_BASE.'
				);
			}
		} catch (err) {
			setMountDetail(
				err instanceof Error
					? err.message
					: 'Не удалось открыть презентацию продукта'
			);
		} finally {
			setMountBusy(false);
		}
	}

	return (
		<section className="panel offline-app-panel" aria-labelledby="about-heading">
			<div className="offline-app-toolbar">
				<button type="button" className="secondary" onClick={onBack}>
					← Каталог
				</button>
			</div>
			<h2 id="about-heading">О приложении</h2>
			<p className="muted">
				Локальные сведения о клиенте всегда доступны офлайн. Полная презентация
				продукта открывается в отдельном окне (тот же контент /o-proekte/, что
				на облачном столе).
			</p>
			<ul className="app-catalog">
				<li>
					<strong>Версия</strong>
					<span className="muted"> — {appVersion}</span>
				</li>
				<li>
					<strong>Edition</strong>
					<span className="muted"> — {edition}</span>
				</li>
				<li>
					<strong>Profile</strong>
					<span className="muted"> — {profileId ?? '—'}</span>
				</li>
				<li>
					<strong>License</strong>
					<span className="muted">
						{' '}
						— {licenseId ? `${licenseId.slice(0, 8)}…` : '—'}
					</span>
				</li>
			</ul>
			<div className="actions">
				<button
					type="button"
					className="primary"
					disabled={mountBusy}
					onClick={() => void handleOpenPresentation()}
				>
					{mountBusy ? 'Открытие…' : 'Открыть презентацию продукта'}
				</button>
			</div>
			{mountDetail ? (
				<p className="status" role="status">
					{mountDetail}
				</p>
			) : (
				<p className="muted">
					Нужны туннель и доступ к {appBase || 'облачному столу'} (/o-proekte/).
					Без сети остаются только поля выше.
				</p>
			)}
		</section>
	);
}
