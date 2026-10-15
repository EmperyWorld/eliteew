/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * O3c offline local AI chat panel — device OpenAI-compat only (ai.local).
 *
 * Invariants:
 * - One primary CTA (Отправить); honest empty / loading / error / degrade.
 * - No third_party / eliteew in this wave.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
 */

import { useEffect, useState } from 'react';
import {
	aiLocalChat,
	aiLocalStatus,
	type AiChatMessage,
	type AiLocalStatusView,
} from '../../lib/tauri-bridge/commands';
import { canSendLocalAi, localAiBanner } from './localAiPanelState';

type Turn = { role: 'user' | 'assistant'; content: string };

export function OfflineLocalAiPanel() {
	const [status, setStatus] = useState<AiLocalStatusView | null>(null);
	const [model, setModel] = useState('');
	const [prompt, setPrompt] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [turns, setTurns] = useState<Turn[]>([]);

	useEffect(() => {
		void (async () => {
			try {
				const s = await aiLocalStatus();
				setStatus(s);
				if (s.model) {
					setModel(s.model);
				}
			} catch (e) {
				setStatus({
					ok: false,
					code: 'bridge_error',
					message: e instanceof Error ? e.message : String(e),
				});
			}
		})();
	}, []);

	const baseConfigured = Boolean(status?.base_url);
	const banner = localAiBanner(status?.code ?? null, status?.message ?? '…');
	const sendOk = canSendLocalAi({
		baseConfigured,
		busy,
		prompt,
		model,
	});

	async function onSend() {
		if (!sendOk) {
			return;
		}
		const userText = prompt.trim();
		setPrompt('');
		setError(null);
		setBusy(true);
		const nextTurns: Turn[] = [...turns, { role: 'user', content: userText }];
		setTurns(nextTurns);
		const messages: AiChatMessage[] = nextTurns.map((t) => ({
			role: t.role,
			content: t.content,
		}));
		try {
			const res = await aiLocalChat(messages, model.trim());
			if (!res.ok || !res.reply) {
				setError(res.message || res.code);
				return;
			}
			setTurns([...nextTurns, { role: 'assistant', content: res.reply }]);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<section className="panel ai-local-panel" aria-labelledby="ai-local-heading">
			<h2 id="ai-local-heading">Локальный AI</h2>
			<p className="muted">
				Чат с моделью на этом устройстве (ai.local). Без облака EliteEW.
			</p>
			<p
				className={`status${status && !status.ok ? ' status-warn' : ''}`}
				role="status"
			>
				{banner}
				{status?.base_url ? ` · ${status.base_url}` : ''}
			</p>

			{!baseConfigured ? (
				<p className="muted">
					Задайте URL локального OpenAI-совместимого сервера в релизе
					(ai_local_base_url).
				</p>
			) : (
				<>
					<label className="field">
						<span>Модель</span>
						<input
							value={model}
							onChange={(e) => setModel(e.target.value)}
							placeholder="например llama3.2"
							disabled={busy}
							autoComplete="off"
						/>
					</label>

					{turns.length === 0 ? (
						<p className="muted">Напишите вопрос — ответ придёт от локальной модели.</p>
					) : (
						<ul className="ai-turns" aria-live="polite">
							{turns.map((t, i) => (
								<li key={`${t.role}-${i}`} className={`ai-turn ai-turn-${t.role}`}>
									<strong>{t.role === 'user' ? 'Вы' : 'Модель'}</strong>
									<p>{t.content}</p>
								</li>
							))}
						</ul>
					)}

					{error ? (
						<p className="status status-warn" role="alert">
							{error}
						</p>
					) : null}

					{busy ? (
						<p className="status" role="status">
							Ждём ответ локальной модели…
						</p>
					) : null}

					<label className="field">
						<span>Сообщение</span>
						<textarea
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							rows={3}
							disabled={busy}
							placeholder="Спросите локальную модель…"
							onKeyDown={(e) => {
								if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
									e.preventDefault();
									void onSend();
								}
							}}
						/>
					</label>
					<div className="actions">
						<button type="button" disabled={!sendOk} onClick={() => void onSend()}>
							Отправить
						</button>
					</div>
				</>
			)}
		</section>
	);
}
