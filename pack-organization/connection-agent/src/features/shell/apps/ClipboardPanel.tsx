/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * O5 ClipboardManager — OS clipboard + local history; K3 spa_deep_link CTA.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
 */

import { useEffect, useState } from 'react';
import {
	clipboardRead,
	clipboardStatus,
	clipboardWrite,
	type ClipboardEntry,
	type ClipboardView,
} from '../../../lib/tauri-bridge/commands';
import { OfflineSpaDeepLinkCta } from './OfflineSpaDeepLinkCta';

type Props = { appBase: string; onBack: () => void };

export function ClipboardPanel({ appBase, onBack }: Props) {
	const [view, setView] = useState<ClipboardView | null>(null);
	const [draft, setDraft] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function refresh() {
		try {
			setView(await clipboardStatus());
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}

	useEffect(() => {
		void refresh();
	}, []);

	const history: ClipboardEntry[] = view?.history ?? [];

	async function onRead() {
		setBusy(true);
		setError(null);
		try {
			setView(await clipboardRead());
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	async function onWrite() {
		setBusy(true);
		setError(null);
		try {
			const next = await clipboardWrite(draft);
			setView(next);
			if (!next.ok) {
				setError(next.message);
			} else {
				setDraft('');
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<section className="panel offline-app-panel" aria-labelledby="clip-heading">
			<div className="offline-app-toolbar">
				<button type="button" className="secondary" onClick={onBack}>
					← Каталог
				</button>
			</div>
			<h2 id="clip-heading">Буфер обмена</h2>
			<p className="muted">Системный буфер этого устройства + короткая локальная история.</p>
			<p className={`status${error ? ' status-warn' : ''}`} role="status">
				{error ?? view?.message ?? '…'}
			</p>
			{view?.text ? (
				<p className="status" role="status">
					Сейчас в буфере: {view.text.slice(0, 160)}
					{view.text.length > 160 ? '…' : ''}
				</p>
			) : null}
			<textarea
				rows={3}
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				placeholder="Текст для записи в буфер"
				aria-label="Текст буфера"
			/>
			<div className="actions">
				<button type="button" disabled={busy} onClick={() => void onWrite()}>
					Записать в буфер
				</button>
				<button
					type="button"
					className="secondary"
					disabled={busy}
					onClick={() => void onRead()}
				>
					Прочитать буфер
				</button>
			</div>
			<h3 className="offline-app-sub">История</h3>
			{history.length === 0 ? (
				<p className="muted">История пуста.</p>
			) : (
				<ul className="app-catalog">
					{history.map((entry) => (
						<li key={`${entry.saved_at}-${entry.text.slice(0, 24)}`}>
							{entry.text.slice(0, 120)}
							{entry.text.length > 120 ? '…' : ''}
						</li>
					))}
				</ul>
			)}
			<OfflineSpaDeepLinkCta appId="ClipboardManager" appBase={appBase} />
		</section>
	);
}
