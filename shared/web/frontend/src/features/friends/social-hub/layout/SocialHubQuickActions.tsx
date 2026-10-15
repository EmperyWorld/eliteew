/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Segmented quick-link rail on Social Hub home (contacts, requests, privacy, phone).
 *
 * Invariants:
 * - Requests segment uses accent styling when count > 0.
 * - Quick-links eyebrow is sentence-case (`SH_SECTION_EYEBROW_CLASS`), not chrome uppercase.
 *
 * Related:
 * - sections/SocialHubHomeSection.tsx
 */

import { useTranslation } from 'react-i18next';
import {
	DevicePhoneMobileIcon,
	ShieldCheckIcon,
	UserPlusIcon,
	UsersIcon,
} from '@heroicons/react/24/outline';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import type { SocialHubPeopleSubview } from '../socialHubNavigation';
import {
	SH_HOME_QUICK_ACTIONS_RAIL_CLASS,
	SH_SECTION_EYEBROW_CLASS,
	shSegmentButtonClass,
} from './socialHubLayoutTokens';

export function SocialHubQuickActions({
	incomingCount,
	onOpenPeople,
	onOpenPrivacy,
	onOpenPhone,
}: {
	incomingCount: number;
	onOpenPeople: (subview: SocialHubPeopleSubview) => void;
	onOpenPrivacy: () => void;
	onOpenPhone: () => void;
}): JSX.Element {
	const { t } = useTranslation('contentManager');

	return (
		<fieldset
			aria-label={t('friends.socialHubHomeQuickActionsLabel')}
			className="min-w-0 border-0 p-0"
		>
			<div className={cn(SH_SECTION_EYEBROW_CLASS, 'mb-2 px-0.5')}>
				{t('friends.socialHubHomeQuickActionsLabel')}
			</div>
			<div className={SH_HOME_QUICK_ACTIONS_RAIL_CLASS}>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="ghost"
					className={shSegmentButtonClass(false)}
					onClick={() => onOpenPeople('contacts')}
				>
					<UsersIcon
						className={DESKTOP_LUCIDE.sm}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('friends.socialHubHomeQuickContacts')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="ghost"
					className={shSegmentButtonClass(incomingCount > 0)}
					onClick={() => onOpenPeople('requests')}
				>
					<UserPlusIcon
						className={DESKTOP_LUCIDE.sm}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('friends.socialHubHomeQuickRequests', { count: incomingCount })}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="ghost"
					className={shSegmentButtonClass(false)}
					onClick={onOpenPrivacy}
				>
					<ShieldCheckIcon
						className={DESKTOP_LUCIDE.sm}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('friends.socialHubHomeQuickPrivacy')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="ghost"
					className={shSegmentButtonClass(false)}
					onClick={onOpenPhone}
				>
					<DevicePhoneMobileIcon
						className={DESKTOP_LUCIDE.sm}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('friends.socialHubHomeQuickPhone')}
				</DesktopAppButton>
			</div>
		</fieldset>
	);
}
