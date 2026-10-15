/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Russian humanize maps for updater / WG / entitlement codes.
 *
 * Invariants:
 * - Known codes never echo English machine messages as primary copy.
 *
 * Related:
 * - lib/ui/statusCopy.ts
 */

import { describe, expect, it } from 'vitest';
import {
	humanizeEntitlement,
	humanizeFoflineSpaPack,
	humanizeUpdater,
	humanizeWg,
	editionLabelRu,
	tunnelTone,
} from './statusCopy';

describe('statusCopy', () => {
	it('maps known updater codes to Russian without English append', () => {
		expect(humanizeUpdater('up_to_date', 'Already up to date')).toBe(
			'У вас актуальная версия'
		);
		expect(humanizeUpdater('update_available', '0.4.2')).toBe(
			'Доступно обновление'
		);
		expect(humanizeUpdater('offline_skip')).toContain('Сеть недоступна');
		expect(humanizeUpdater('installed')).toContain('Перезапустить');
		expect(
			humanizeUpdater('invalid_format', 'invalid updater binary format')
		).toContain('формата');
		expect(humanizeUpdater('auth_required')).toContain('администратора');
		expect(humanizeUpdater('signing_required')).toContain(
			'установка заблокирована'
		);
		expect(humanizeUpdater('signing_required')).not.toContain(
			'Восстанавливаем'
		);
	});

	it('maps WG and entitlement codes', () => {
		expect(humanizeWg('conf_missing')).toContain('не установлен');
		expect(humanizeEntitlement('ok')).toContain('подтверждена');
		expect(humanizeEntitlement('missing')).toContain('не найдена');
		expect(humanizeEntitlement('device_keys_missing')).toContain(
			'подготовьте запрос устройства'
		);
		expect(
			humanizeEntitlement('import_error', 'Не удалось открыть файл доступа')
		).toBe('Не удалось открыть файл доступа');
		expect(humanizeEntitlement('import_error')).toContain(
			'импортировать пакет'
		);
		expect(humanizeWg('secure_store_failed')).toContain('повторите импорт');
		expect(humanizeWg('secure_store_load_failed')).toContain(
			'повторите импорт'
		);
		expect(humanizeWg('reconnecting')).toContain('Восстанавливаем');
		expect(humanizeWg('channel_unstable')).toContain('нестабильно');
		expect(humanizeWg('socks_listening')).toContain('Подключение');
	});

	it('maps FoFline SPA pack codes with progress', () => {
		expect(humanizeFoflineSpaPack('pack_missing')).toContain('не загружена');
		expect(humanizeFoflineSpaPack('signature_invalid')).toContain('Подпись');
		expect(humanizeFoflineSpaPack('offline_skip:timed out')).toContain(
			'Сеть недоступна'
		);
		expect(
			humanizeFoflineSpaPack('downloading', undefined, {
				state: 'downloading',
				progressBytes: 50,
				progressTotal: 100,
			})
		).toContain('50%');
		expect(
			humanizeFoflineSpaPack('ready', undefined, { appBuildId: 'abc' })
		).toContain('abc');
		expect(humanizeFoflineSpaPack('pack_not_ready')).toContain('ещё не готова');
		expect(
			humanizeFoflineSpaPack('update_available', undefined, {
				appBuildId: 'old',
				remoteAppBuildId: 'new',
				updateAvailable: true,
			})
		).toContain('old → new');
		expect(
			humanizeFoflineSpaPack('groups_syncing', undefined, {
				groupsReady: 3,
				groupsTotal: 8,
				groupsSyncing: true,
			})
		).toContain('медиа 3/8');
		expect(
			humanizeFoflineSpaPack('ready', undefined, {
				appBuildId: 'abc',
				groupsReady: 2,
				groupsTotal: 8,
			})
		).toContain('медиа 2/8');
		expect(humanizeFoflineSpaPack('update_check_offline')).toContain(
			'проверить обновление'
		);
	});

	it('falls back honestly for unknown codes', () => {
		expect(humanizeUpdater('weird_code', 'детали')).toBe('weird_code: детали');
		expect(humanizeUpdater(null, null)).toBe('Нет данных');
	});

	it('maps Windows WG codes', () => {
		expect(humanizeWg('windows_conf_staged')).toContain(
			'WireGuard for Windows'
		);
		expect(humanizeWg('windows_manual_wg')).toContain('Windows');
		expect(humanizeWg('windows_wg_missing')).toContain('не найден');
	});

	it('maps edition labels without raw profile ids', () => {
		expect(editionLabelRu('client', 'client-offline-ai')).toBe('Офлайн-режим');
		expect(editionLabelRu('connected')).toBe('Облачный режим');
		expect(editionLabelRu('client', 'client-offline-ai')).not.toContain(
			'client-offline'
		);
	});

	it('derives tunnel tone from ok/code', () => {
		expect(tunnelTone(true)).toBe('ok');
		expect(tunnelTone(false, 'install_error')).toBe('danger');
		expect(tunnelTone(false, 'conf_missing')).toBe('warn');
		expect(tunnelTone(undefined)).toBe('neutral');
	});
});
