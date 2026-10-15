/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map native/updater/entitlement/FoFline-SPA-pack machine codes to Russian user-facing copy.
 *
 * Invariants:
 * - Unknown codes fall back to raw message (honest, never invent success).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
 */

import { resolveSeatModeLabelRu } from '../launcher/licenseModes';

const UPDATER_RU: Record<string, string> = {
	up_to_date: 'У вас актуальная версия',
	update_available: 'Доступно обновление',
	offline_skip: 'Сеть недоступна — проверка обновлений пропущена',
	not_configured: 'Канал обновлений не настроен в этом билде',
	signing_required:
		'Проверка подлинности обновления не настроена — установка заблокирована',
	installed: 'Обновление установлено — нажмите «Перезапустить»',
	install_failed: 'Не удалось установить обновление',
	check_failed:
		'Не удалось проверить обновления. Канал может быть занят — повторите через минуту.',
	ota_sequence_rollback:
		'Обновление временно недоступно — повторите позже или установите пакет вручную',
	ota_manifest_fetch:
		'Не удалось получить список обновлений через защищённый канал',
	ota_manifest_platform_missing:
		'Список обновлений получен, но пакет для этой системы не найден',
	invalid_format:
		'Тип установочного пакета не совпал с вашей установкой. Скачайте обновление того же формата или переустановите клиент.',
	auth_required:
		'Нужно подтвердить установку паролем администратора — повторите обновление',
	package_install_failed:
		'Не удалось установить обновление на этом устройстве. Повторите или обратитесь в поддержку',
	error: 'Не удалось проверить обновления',
};

const WG_RU: Record<string, string> = {
	ok: 'Канал в порядке',
	active: 'Канал активен',
	unit_active: 'Служба канала запущена',
	conf_missing: 'Конфиг канала ещё не установлен',
	conf_invalid: 'Конфиг канала не принят — проверьте файл',
	validate_ok: 'Конфиг проверен',
	validate_error: 'Ошибка проверки конфига',
	install_ok: 'Конфиг установлен',
	install_error: 'Не удалось установить конфиг',
	bring_up_ok: 'Канал подключён',
	bring_up_error: 'Не удалось подключить канал',
	bring_down_ok: 'Канал отключён',
	bring_down_error: 'Не удалось отключить канал',
	status_error: 'Не удалось получить статус канала',
	secure_store_failed:
		'Не удалось безопасно сохранить защищённый канал — повторите импорт файла доступа',
	secure_store_load_failed:
		'Не удалось восстановить защищённый канал — повторите импорт файла доступа',
	channel_restore_failed:
		'Не удалось восстановить защищённый канал — повторите попытку',
	not_linux: 'Автоустановка канала доступна на Linux',
	windows_manual_wg:
		'На Windows откройте WireGuard for Windows и импортируйте сохранённый конфиг (приложение ставится с клиентом EliteEW)',
	windows_conf_staged:
		'Конфиг сохранён — откройте WireGuard for Windows → Import tunnel → Activate',
	windows_wg_missing:
		'WireGuard for Windows не найден. Переустановите клиент EliteEW с правами администратора или установите WireGuard вручную',
	valid: 'Конфиг проверен',
	up: 'Канал активен',
	installed_down: 'Конфиг установлен, канал не запущен',
	missing: 'Канал ещё не установлен',
	socks_up: 'Подключение…',
	socks_listening: 'Подключение…',
	reconnecting: 'Восстанавливаем защищённый канал…',
	protected: 'Защищённый канал подключён',
	channel_unconfirmed: 'Канал не подтверждён. Проверьте интернет и повторите.',
	channel_unstable: 'Соединение нестабильно. Нажмите «Проверить соединение».',
	channel_start_failed:
		'Не удалось подключить защищённый канал. Нажмите «Проверить соединение».',
	fingerprint_mismatch:
		'Канал привязан к другому устройству. Нужен новый пакет доступа.',
	down: 'Канал не подключён',
	idle: 'Защищённый канал не запущен',
	disabled:
		'Системный канал: скрытый режим выключен — используется установка WireGuard ОС',
	w_transport_no_system_stage:
		'Канал работает в приложении — системный WireGuard не используется',
};

const ENTITLEMENT_RU: Record<string, string> = {
	ok: 'Локальная лицензия подтверждена',
	missing: 'Локальная лицензия не найдена',
	invalid: 'Локальная лицензия повреждена или подпись неверна',
	expired: 'Срок локальной лицензии истёк',
	import_error: 'Не удалось импортировать пакет лицензии',
	device_keys_missing:
		'Сначала подготовьте запрос устройства, затем импортируйте новый пакет доступа.',
	invalid_capsule: 'Файл доступа недействителен или повреждён',
	not_capsule: 'Файл не похож на пакет доступа EliteEW',
	verify_error: 'Ошибка проверки лицензии',
	fingerprint_mismatch:
		'Лицензия привязана к другому устройству. Нужен новый пакет доступа для этого компьютера.',
	fingerprint_required: 'Не удалось подтвердить устройство для этой лицензии',
	bind_required: 'Сначала подтвердите пакет доступа на этом устройстве',
	network_unreachable:
		'Нет связи с сервером через защищённый канал. Проверьте интернет и повторите импорт файла доступа.',
	w_transport_proxy_required:
		'Сначала импортируйте файл доступа и дождитесь подтверждения канала, затем повторите активацию.',
	http_client_error:
		'Не удалось подготовить защищённое соединение для активации',
};

const FOFLINE_SPA_PACK_RU: Record<string, string> = {
	pack_missing: 'Рабочая среда FoFline ещё не загружена',
	downloading: 'Загрузка рабочей среды…',
	ready: 'Рабочая среда FoFline готова на устройстве',
	allow_fofline_required: 'FoFline не включён в лицензии',
	signature_required: 'Канал среды без подписи — загрузка отклонена',
	signature_invalid:
		'Подпись среды не подтвердилась — прежняя копия сохранена, если была',
	sha256_mismatch: 'Файл среды повреждён при загрузке — повторите попытку',
	offline_skip: 'Сеть недоступна — не удалось загрузить рабочую среду',
	sync_failed: 'Не удалось загрузить рабочую среду',
	pack_too_large: 'Файл среды слишком большой для этого устройства',
	status_failed: 'Не удалось проверить состояние рабочей среды',
	pack_not_ready:
		'Рабочая среда ещё не готова. Дождитесь загрузки или нажмите «Повторить загрузку среды».',
	remote_fallback: 'Открытие удалённой среды (только для разработки)',
	update_available: 'Доступно обновление рабочей среды FoFline',
	update_check_offline:
		'Рабочая среда на устройстве готова — проверить обновление среды сейчас не удалось',
	update_check_failed:
		'Рабочая среда на устройстве готова — проверка обновления среды не удалась',
	groups_syncing: 'Докачиваем медиа рабочей среды FoFline…',
};

export function humanizeCodeMessage(
	code: string | null | undefined,
	message: string | null | undefined,
	table: Record<string, string>
): string {
	const c = (code ?? '').trim();
	const m = (message ?? '').trim();
	// Known codes → Russian only (no English machine append).
	// import_error is a bucket — show the concrete operator message when present.
	if (c && table[c]) {
		if (c === 'import_error' && m) {
			return m;
		}
		return table[c];
	}
	if (m) return c ? `${c}: ${m}` : m;
	if (c) return c;
	return 'Нет данных';
}

export function humanizeUpdater(
	code: string | null | undefined,
	message?: string | null
): string {
	return humanizeCodeMessage(code, message, UPDATER_RU);
}

export function humanizeWg(
	code: string | null | undefined,
	message?: string | null
): string {
	return humanizeCodeMessage(code, message, WG_RU);
}

export function humanizeEntitlement(
	code: string | null | undefined,
	message?: string | null
): string {
	return humanizeCodeMessage(code, message, ENTITLEMENT_RU);
}

export function humanizeFoflineSpaPack(
	code: string | null | undefined,
	message?: string | null,
	opts?: {
		state?: string | null;
		progressBytes?: number | null;
		progressTotal?: number | null;
		appBuildId?: string | null;
		remoteAppBuildId?: string | null;
		updateAvailable?: boolean;
		groupsReady?: number | null;
		groupsTotal?: number | null;
		groupsSyncing?: boolean;
		activeGroupId?: string | null;
	}
): string {
	const rawCode = (code ?? '').trim();
	const normalized = rawCode.startsWith('offline_skip')
		? 'offline_skip'
		: rawCode;
	if (
		(normalized === 'update_available' || opts?.updateAvailable === true) &&
		opts?.appBuildId &&
		opts?.remoteAppBuildId
	) {
		return `Доступно обновление рабочей среды FoFline (${opts.appBuildId} → ${opts.remoteAppBuildId}). Текущая копия остаётся рабочей до успешного обновления.`;
	}
	if (normalized === 'update_available') {
		return FOFLINE_SPA_PACK_RU.update_available;
	}
	const groupsTotal = opts?.groupsTotal ?? 0;
	const groupsReady = opts?.groupsReady ?? 0;
	if (opts?.groupsSyncing || normalized === 'groups_syncing') {
		if (groupsTotal > 0) {
			return `База готова · медиа ${groupsReady}/${groupsTotal}`;
		}
		return FOFLINE_SPA_PACK_RU.groups_syncing;
	}
	if (normalized === 'ready' && opts?.appBuildId) {
		if (groupsTotal > 0) {
			return `Рабочая среда FoFline готова (${opts.appBuildId}) · медиа ${groupsReady}/${groupsTotal}`;
		}
		return `Рабочая среда FoFline готова на устройстве (${opts.appBuildId})`;
	}
	if (normalized === 'downloading' || opts?.state === 'downloading') {
		const bytes = opts?.progressBytes;
		const total = opts?.progressTotal;
		if (bytes != null && total != null && total > 0) {
			const pct = Math.min(100, Math.round((bytes / total) * 100));
			return `Загрузка рабочей среды… ${pct}%`;
		}
		return FOFLINE_SPA_PACK_RU.downloading;
	}
	return humanizeCodeMessage(normalized, message, FOFLINE_SPA_PACK_RU);
}

/** User-facing edition label — never raw profile_id / edition machine ids. */
export function editionLabelRu(
	edition: string | null | undefined,
	profileId?: string | null
): string {
	return resolveSeatModeLabelRu({ edition, profileId });
}

export function tunnelTone(
	ok: boolean | undefined,
	code?: string | null
): 'ok' | 'warn' | 'danger' | 'neutral' {
	if (code === 'protected') return 'ok';
	if (code === 'channel_unconfirmed' || code === 'channel_unstable')
		return 'warn';
	if (
		code === 'reconnecting' ||
		code === 'socks_listening' ||
		code === 'socks_up'
	) {
		return 'warn';
	}
	if (ok) return 'ok';
	if (!code) return 'neutral';
	if (
		code.includes('error') ||
		code.includes('invalid') ||
		code.includes('fail')
	) {
		return 'danger';
	}
	return 'warn';
}
