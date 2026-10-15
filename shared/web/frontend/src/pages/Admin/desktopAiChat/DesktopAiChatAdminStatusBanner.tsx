/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Success/error status banners for Desktop AI Chat admin actions.
 */

import * as React from 'react';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import type { DesktopAiChatAdminStatusKind } from './desktopAiChatAdminTypes';

type DesktopAiChatAdminStatusBannerProps = {
	kind: DesktopAiChatAdminStatusKind;
	message: string | null;
};

export function DesktopAiChatAdminStatusBanner({
	kind,
	message,
}: DesktopAiChatAdminStatusBannerProps): React.ReactElement | null {
	if (!kind || !message) {
		return null;
	}
	const isSuccess = kind === 'success';
	return (
		<div
			role={isSuccess ? 'status' : 'alert'}
			aria-live={isSuccess ? 'polite' : 'assertive'}
			className={`mb-3 rounded-md border px-3 py-2 text-sm ${
				isSuccess
					? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
					: 'border-red-500/40 bg-red-500/10 text-red-200'
			}`}
		>
			<p className={DESKTOP_TYPOGRAPHY.body}>{message}</p>
		</div>
	);
}
