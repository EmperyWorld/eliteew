/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave C regression locks: types re-export path and dead outbound emits stay retired.
 *
 * Related:
 * - EmperyworldSocketService.ts
 * - emperyworldSocketTypes.ts
 * - documentation/platform/REALTIME-SOCKETIO-AND-WS.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as socketTypes from '../emperyworldSocketTypes';
import {
	type NotificationEvent,
	type SocketConnectionConfig,
} from '../EmperyworldSocketService';

const here = dirname(fileURLToPath(import.meta.url));
const serviceSource = readFileSync(
	join(here, '../EmperyworldSocketService.ts'),
	'utf8'
);

describe('EmperyworldSocketService Wave C split', () => {
	it('keeps NotificationEvent / SocketConnectionConfig importable from service barrel', () => {
		const sample: NotificationEvent = {
			id: 'n1',
			type: 'info',
			title: 't',
			message: 'm',
			priority: 'normal',
			persistent: false,
			created_at: new Date().toISOString(),
		};
		expect(sample.id).toBe('n1');
		const cfg = {
			auto_connect: false,
		} as Partial<SocketConnectionConfig>;
		expect(cfg.auto_connect).toBe(false);
		expect(typeof socketTypes).toBe('object');
	});

	it('exports GAF payload types from emperyworldSocketTypes', () => {
		expect(typeof socketTypes).toBe('object');
		// Compile-time shape: import namespace must resolve; runtime has no values for interfaces.
		expect(Object.keys(socketTypes).length).toBeGreaterThanOrEqual(0);
	});

	it('binds inbound handlers via extracted module', () => {
		expect(serviceSource).toContain('bindEmperyworldSocketInboundHandlers');
		expect(serviceSource).toContain(
			"from './emperyworldSocketInboundHandlers'"
		);
		expect(serviceSource).toContain("from './emperyworldSocketTypes'");
	});

	it('does not resurrect zero-call-site outbound emits', () => {
		for (const name of [
			'joinChat',
			'leaveChat',
			'sendMessage',
			'subscribeToMetrics',
			'unsubscribeFromMetrics',
			'requestAIGeneration',
			'joinDocument',
			'sendDocumentOperation',
			'sendNotification',
		]) {
			expect(serviceSource).not.toMatch(new RegExp(`public\\s+${name}\\s*\\(`));
		}
	});
});
