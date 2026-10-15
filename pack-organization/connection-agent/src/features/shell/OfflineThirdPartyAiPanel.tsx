/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * O3d offline third-party AI panel — URL/model in app data, API key in OS keyring.
 *
 * Invariants:
 * - Never echo saved API key; one primary Send CTA for chat.
 * - Fail closed without key (honest banner).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
 */

import { useEffect, useState } from 'react';
import {
	aiThirdPartyChat,
	aiThirdPartyClearApiKey,
	aiThirdPartySaveApiKey,
	aiThirdPartySaveSettings,
	aiThirdPartyStatus,
	type AiChatMessage,
	type AiThirdPartyStatusView,
} from '../../lib/tauri-bridge/commands';
import {
	canSendThirdPartyAi,
	thirdPartyAiBanner,
} from './thirdPartyAiPanelState';

type Turn = { role: 'user' | 'assistant'; content: string };

export function OfflineThirdPartyAiPanel() {
	const [status, setStatus] = useState<AiThirdPartyStatusView | null>(null);
	const [baseUrl, setBaseUrl] = useState('');
	const [model, setModel] = useState('');
	const [apiKeyDraft, setApiKeyDraft] = useState('');
	const [prompt, setPrompt] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [turns, setTurns] = useState<Turn[]>([]);
	const [settingsNote, setSettingsNote] = useState<string | null>(null);

	async function refreshStatus() {
		try {
			const s = await aiThirdPartyStatus();
			setStatus(s);
			if (s.base_url) {
				setBaseUrl(s.base_url);
			}
			if (s.model) {
				setModel(s.model);
			}
		} catch (e) {
			setStatus({
				ok: false,
				code: 'bridge_error',
				message: e instanceof Error ? e.message : String(e),
				has_api_key: false,
				key_source: 'none',
			});
		}
	}

	useEffect(() => {
		void refreshStatus();
	}, []);

	const baseConfigured = Boolean(baseUrl.trim());
	const hasApiKey = Boolean(status?.has_api_key);
	const banner = thirdPartyAiBanner(
		status?.code ?? null,
		status?.message ?? '…',
		status?.key_source ?? 'none'
	);
	const sendOk = canSendThirdPartyAi({
		baseConfigured,
		hasApiKey,
		busy,
		prompt,
		model,
	});

	async function onSaveSettings() {
		setBusy(true);
		setSettingsNote(null);
		setError(null);
		try {
			const s = await aiThirdPartySaveSettings(baseUrl.trim(), model.trim());
			setStatus(s);
			setSettingsNote('URL и модель сохранены');
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	async function onSaveKey() {
		if (!apiKeyDraft.trim()) {
			setError('Введите API key');
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const s = await aiThirdPartySaveApiKey(apiKeyDraft.trim());
			setStatus(s);
			setApiKeyDraft('');
			setSettingsNote('API key сохранён в OS keyring');
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	async function onClearKey() {
		setBusy(true);
		setError(null);
		try {
			const s = await aiThirdPartyClearApiKey();
			setStatus(s);
			setSettingsNote('API key удалён из keyring');
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

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
			const res = await aiThirdPartyChat(messages, model.trim());
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
		<section
			className="panel ai-third-panel"
			aria-labelledby="ai-third-heading"
		>
			<h2 id="ai-third-heading">Сторонний AI</h2>
			<p className="muted">
				OpenAI-совместимый API (ai.third_party). Ключ только в OS keyring — не в
				файлах приложения.
			</p>
			<p
				className={`status${status && !status.ok ? ' status-warn' : ''}`}
				role="status"
			>
				{banner}
			</p>

			<label className="field">
				<span>Base URL</span>
				<input
					value={baseUrl}
					onChange={(e) => setBaseUrl(e.target.value)}
					placeholder="https://api.openai.com/v1"
					disabled={busy}
					autoComplete="off"
				/>
			</label>
			<label className="field">
				<span>Модель</span>
				<input
					value={model}
					onChange={(e) => setModel(e.target.value)}
					placeholder="gpt-4o-mini"
					disabled={busy}
					autoComplete="off"
				/>
			</label>
			<div className="actions">
				<button type="button" disabled={busy} onClick={() => void onSaveSettings()}>
					Сохранить URL/модель
				</button>
			</div>

			<label className="field">
				<span>API key {hasApiKey ? '(уже сохранён — введите новый чтобы заменить)' : ''}</span>
				<input
					type="password"
					value={apiKeyDraft}
					onChange={(e) => setApiKeyDraft(e.target.value)}
					placeholder="sk-…"
					disabled={busy}
					autoComplete="off"
				/>
			</label>
			<div className="actions">
				<button type="button" disabled={busy} onClick={() => void onSaveKey()}>
					Сохранить ключ в keyring
				</button>
				<button
					type="button"
					className="linkish"
					disabled={busy || !hasApiKey}
					onClick={() => void onClearKey()}
				>
					Удалить ключ
				</button>
			</div>

			{settingsNote ? <p className="status">{settingsNote}</p> : null}

			{!hasApiKey ? (
				<p className="muted">
					Без ключа чат недоступен. Сохраните ключ выше или настройте доступ в
					параметрах ИИ на этом устройстве.
				</p>
			) : (
				<>
					{turns.length === 0 ? (
						<p className="muted">Напишите вопрос сторонней модели.</p>
					) : (
						<ul className="ai-turns" aria-live="polite">
							{turns.map((t, i) => (
								<li
									key={`${t.role}-${i}`}
									className={`ai-turn ai-turn-${t.role}`}
								>
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
							Ждём ответ…
						</p>
					) : null}

					<label className="field">
						<span>Сообщение</span>
						<textarea
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							rows={3}
							disabled={busy}
							placeholder="Спросите стороннюю модель…"
						/>
					</label>
					<div className="actions">
						<button type="button" disabled={!sendOk} onClick={() => void onSend()}>
							Отправить
						</button>
					</div>
				</>
			)}

			{error && !hasApiKey ? (
				<p className="status status-warn" role="alert">
					{error}
				</p>
			) : null}
		</section>
	);
}
