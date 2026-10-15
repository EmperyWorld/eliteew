/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * O5 NotificationsApp — local inbox notes (not push); K3 spa_deep_link CTA.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
 */

import { useEffect, useState } from 'react';
import {
	notificationsAdd,
	notificationsDismiss,
	notificationsList,
	type NotificationsView,
} from '../../../lib/tauri-bridge/commands';
import { OfflineSpaDeepLinkCta } from './OfflineSpaDeepLinkCta';

type Props = { appBase: string; onBack: () => void };

export function NotificationsPanel({ appBase, onBack }: Props) {
	const [view, setView] = useState<NotificationsView | null>(null);
	const [title, setTitle] = useState('');
	const [body, setBody] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function refresh() {
		try {
			setView(await notificationsList());
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}

	useEffect(() => {
		void refresh();
	}, []);

	async function onAdd() {
		setBusy(true);
		setError(null);
		try {
			const next = await notificationsAdd(title, body);
			setView(next);
			setTitle('');
			setBody('');
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	async function onDismiss(id: string) {
		setBusy(true);
		setError(null);
		try {
			setView(await notificationsDismiss(id));
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	const items = view?.items ?? [];

	return (
		<section className="panel offline-app-panel" aria-labelledby="notif-heading">
			<div className="offline-app-toolbar">
				<button type="button" className="secondary" onClick={onBack}>
					← Каталог
				</button>
			</div>
			<h2 id="notif-heading">Уведомления</h2>
			<p className="muted">
				Локальный inbox на устройстве. Это не push и не облачная лента.
			</p>
			<p className={`status${error ? ' status-warn' : ''}`} role="status">
				{error ?? view?.message ?? '…'}
			</p>
			<input
				type="text"
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				placeholder="Заголовок"
				aria-label="Заголовок уведомления"
			/>
			<textarea
				rows={2}
				value={body}
				onChange={(e) => setBody(e.target.value)}
				placeholder="Текст"
				aria-label="Текст уведомления"
			/>
			<div className="actions">
				<button
					type="button"
					disabled={busy || (!title.trim() && !body.trim())}
					onClick={() => void onAdd()}
				>
					Добавить
				</button>
			</div>
			{items.length === 0 ? (
				<p className="muted">Пока пусто — добавьте первую запись.</p>
			) : (
				<ul className="app-catalog">
					{items.map((item) => (
						<li key={item.id} className="offline-notif-row">
							<div>
								<strong>{item.title}</strong>
								{item.body ? (
									<p className="muted" style={{ margin: '0.25rem 0 0' }}>
										{item.body}
									</p>
								) : null}
							</div>
							<button
								type="button"
								className="secondary"
								disabled={busy}
								onClick={() => void onDismiss(item.id)}
							>
								Убрать
							</button>
						</li>
					))}
				</ul>
			)}
			<OfflineSpaDeepLinkCta appId="NotificationsApp" appBase={appBase} />
		</section>
	);
}
