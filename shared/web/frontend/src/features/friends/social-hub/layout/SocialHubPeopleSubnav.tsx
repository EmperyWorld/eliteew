/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Segmented sub-navigation for Social Hub People section (contacts, lists, requests).
 *
 * Invariants:
 * - Incoming request count badge appears only on the Requests segment.
 * - Uses tablist semantics with arrow-key navigation between segments.
 *
 * Related:
 * - sections/SocialHubPeopleSection.tsx
 */

import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
	ChatBubbleLeftRightIcon,
	InboxStackIcon,
	UserGroupIcon,
} from '@heroicons/react/24/outline';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';

import type { SocialHubPeopleSubview } from '../socialHubNavigation';
import {
	SH_PEOPLE_SUBNAV_CLASS,
	shPeopleSubnavBadgeClass,
	shSegmentButtonClass,
} from './socialHubLayoutTokens';

const PEOPLE_SUBVIEWS: SocialHubPeopleSubview[] = [
	'contacts',
	'lists',
	'requests',
];

function subviewIcon(subview: SocialHubPeopleSubview) {
	if (subview === 'contacts') {
		return ChatBubbleLeftRightIcon;
	}
	if (subview === 'lists') {
		return UserGroupIcon;
	}
	return InboxStackIcon;
}

function subviewLabel(
	t: (key: string, options?: Record<string, unknown>) => string,
	subview: SocialHubPeopleSubview
): string {
	if (subview === 'contacts') {
		return t('friends.socialHubPeopleSubviewContacts');
	}
	if (subview === 'lists') {
		return t('friends.socialHubPeopleSubviewLists');
	}
	return t('friends.socialHubPeopleSubviewRequests');
}

function formatBadgeCount(count: number): string {
	return count > 99 ? '99+' : String(count);
}

export function SocialHubPeopleSubnav({
	activeSubview,
	onChangeSubview,
	incomingPending = 0,
	contactsCount = 0,
	listsCount = 0,
}: {
	activeSubview: SocialHubPeopleSubview;
	onChangeSubview: (subview: SocialHubPeopleSubview) => void;
	incomingPending?: number;
	contactsCount?: number;
	listsCount?: number;
}): JSX.Element {
	const { t } = useTranslation('contentManager');
	const listRef = useRef<HTMLDivElement>(null);

	const focusSegment = useCallback(
		(index: number) => {
			const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>(
				'button[data-sh-people-subview]'
			);
			if (!buttons?.length) return;
			const button = buttons[Math.max(0, Math.min(index, buttons.length - 1))];
			button?.focus();
			const id =
				PEOPLE_SUBVIEWS[
					Math.max(0, Math.min(index, PEOPLE_SUBVIEWS.length - 1))
				];
			if (id) {
				onChangeSubview(id);
			}
		},
		[onChangeSubview]
	);

	const onKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			const currentIndex = PEOPLE_SUBVIEWS.indexOf(activeSubview);
			if (currentIndex < 0) return;
			if (event.key === 'ArrowRight') {
				event.preventDefault();
				focusSegment(currentIndex + 1);
			} else if (event.key === 'ArrowLeft') {
				event.preventDefault();
				focusSegment(currentIndex - 1);
			} else if (event.key === 'Home') {
				event.preventDefault();
				focusSegment(0);
			} else if (event.key === 'End') {
				event.preventDefault();
				focusSegment(PEOPLE_SUBVIEWS.length - 1);
			}
		},
		[activeSubview, focusSegment]
	);

	return (
		<nav aria-label={t('friends.socialHubPeopleSubnavLabel')}>
			<div
				ref={listRef}
				role="tablist"
				onKeyDown={onKeyDown}
				className={SH_PEOPLE_SUBNAV_CLASS}
			>
				{PEOPLE_SUBVIEWS.map((subview) => {
					const Icon = subviewIcon(subview);
					const active = activeSubview === subview;
					const countBadge =
						subview === 'requests' && incomingPending > 0
							? incomingPending
							: subview === 'contacts' && contactsCount > 0
								? contactsCount
								: subview === 'lists' && listsCount > 0
									? listsCount
									: 0;
					return (
						<DesktopAppButton
							key={subview}
							data-sh-people-subview
							type="button"
							role="tab"
							aria-selected={active}
							tabIndex={active ? 0 : -1}
							variant={active ? 'neutral' : 'ghost'}
							className={shSegmentButtonClass(active)}
							onClick={() => onChangeSubview(subview)}
						>
							<Icon
								className={DESKTOP_LUCIDE.sm}
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							<span>{subviewLabel(t, subview)}</span>
							{countBadge > 0 ? (
								<span
									className={shPeopleSubnavBadgeClass(subview === 'requests')}
									aria-hidden
								>
									{formatBadgeCount(countBadge)}
								</span>
							) : null}
						</DesktopAppButton>
					);
				})}
			</div>
		</nav>
	);
}
