/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map W-transport native status into the TunnelScreen WgPortalStatus shape
 * so one UI path covers system wg-quick and userspace SOCKS.
 *
 * Invariants:
 * - unit_active mirrors socks_listening (channel up for continue CTA).
 * - Does not invent ok when native ok is false.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3
 */

import type {
	WgPortalStatus,
	WTransportStatus,
} from '../tauri-bridge/commands';

/** Present TunnelScreen with a system-WG-shaped status from userspace. */
export function wTransportToPortalStatus(
	st: WTransportStatus,
	confPresent: boolean,
	opts?: { l7Ok?: boolean }
): WgPortalStatus {
	const l7Ok = opts?.l7Ok;
	if (st.ok && st.socks_listening && l7Ok === true) {
		return {
			ok: true,
			code: 'protected',
			message: 'Защищённый канал подтверждён',
			unit_active: true,
			conf_present: confPresent,
		};
	}
	if (st.ok && st.socks_listening && l7Ok === false) {
		return {
			ok: false,
			code: 'channel_unconfirmed',
			message: 'Канал не подтверждён. Проверьте интернет и повторите.',
			unit_active: true,
			conf_present: confPresent,
		};
	}
	// Listen-only: honest pending, not «protected».
	if (st.ok && st.socks_listening && l7Ok === undefined && st.code === 'socks_up') {
		return {
			ok: true,
			code: 'socks_listening',
			message: st.message,
			unit_active: true,
			conf_present: confPresent,
		};
	}
	return {
		ok: st.ok,
		code: st.code,
		message: st.message,
		unit_active: st.socks_listening,
		conf_present: confPresent,
	};
}
