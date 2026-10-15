/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders relationship privacy controls, reporting, and circle assignment.
 *
 * Invariants:
 * - Blocking requires explicit confirmation before the mutation callback runs.
 * - Reporting collects a non-empty reason separately from private notes.
 *
 * Related:
 * - ../../FriendPersonCard.tsx
 * ---
 */

import type { TFunction } from 'i18next';

import {
	DesktopAppButton,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';

import type {
	FriendCircle,
	FriendProfile,
	FriendReportPayload,
} from '../friendPersonCardTypes';

type Props = {
	t: TFunction;
	friend: FriendProfile;
	saving: boolean;
	availableCircles: FriendCircle[];
	blockConfirmOpen: boolean;
	reportOpen: boolean;
	reportReason: string;
	reportDetails: string;
	onToggleMute?: (friend: FriendProfile) => void;
	onToggleBlock?: (friend: FriendProfile) => void;
	onToggleShareActivity?: (friend: FriendProfile) => void;
	onToggleCircle?: (friend: FriendProfile, circleId: string) => void;
	onReport?: (friend: FriendProfile, payload: FriendReportPayload) => void;
	setBlockConfirmOpen: (value: boolean) => void;
	setReportOpen: (value: boolean) => void;
	setReportReason: (value: string) => void;
	setReportDetails: (value: string) => void;
};

export function FriendCardPrivacyTab({
	t,
	friend,
	saving,
	availableCircles,
	blockConfirmOpen,
	reportOpen,
	reportReason,
	reportDetails,
	onToggleMute,
	onToggleBlock,
	onToggleShareActivity,
	onToggleCircle,
	onReport,
	setBlockConfirmOpen,
	setReportOpen,
	setReportReason,
	setReportDetails,
}: Props): JSX.Element {
	const selected = new Set((friend.circles ?? []).map((circle) => circle.id));
	return (
		<div className="space-y-5">
			<div>
				<h4>{t('friends.controlsTitle')}</h4>
				<p className="mb-3 text-xs">{t('friends.controlsHint')}</p>
				{blockConfirmOpen ? (
					<DesktopProductStatusBanner
						tone="danger"
						role="alert"
						aria-live="assertive"
						title={t('friends.blockConfirmTitle')}
						description={t('friends.blockConfirmDescription')}
						actions={
							<>
								<DesktopAppButton
									type="button"
									variant="neutral"
									onClick={() => setBlockConfirmOpen(false)}
								>
									{t('friends.blockConfirmCancel')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									variant="accent"
									disabled={saving}
									onClick={() => {
										onToggleBlock?.(friend);
										setBlockConfirmOpen(false);
									}}
								>
									{t('friends.blockConfirmAction')}
								</DesktopAppButton>
							</>
						}
					/>
				) : null}
				<div className="grid gap-3 md:grid-cols-2">
					<DesktopAppButton
						type="button"
						variant="neutral"
						disabled={saving}
						onClick={() => onToggleMute?.(friend)}
					>
						{friend.is_muted
							? t('friends.muteDisable')
							: t('friends.muteEnable')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant={friend.is_blocked ? 'neutral' : 'ghost'}
						disabled={saving}
						onClick={() =>
							friend.is_blocked
								? onToggleBlock?.(friend)
								: setBlockConfirmOpen(true)
						}
					>
						{friend.is_blocked
							? t('friends.blockDisable')
							: t('friends.blockEnable')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="neutral"
						disabled={saving}
						onClick={() => onToggleShareActivity?.(friend)}
						className="md:col-span-2"
					>
						{friend.share_activity_with_friend
							? t('friends.shareActivityDisable')
							: t('friends.shareActivityEnable')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						disabled={saving}
						onClick={() => setReportOpen(!reportOpen)}
						className="md:col-span-2"
					>
						{t('friends.reportUser')}
					</DesktopAppButton>
				</div>
				{reportOpen ? (
					<section aria-label={t('friends.reportDialogTitle')} className="mt-3">
						<form
							className="space-y-3"
							onSubmit={(event) => {
								event.preventDefault();
								onReport?.(friend, {
									reason: reportReason,
									details: reportDetails.trim() || null,
								});
								setReportOpen(false);
								setReportDetails('');
							}}
						>
							<label className="grid gap-1">
								<span>{t('friends.reportReasonLabel')}</span>
								<select
									value={reportReason}
									onChange={(event) => setReportReason(event.target.value)}
								>
									<option value="safety_concern">
										{t('friends.reportReasonSafety')}
									</option>
									<option value="spam_or_scam">
										{t('friends.reportReasonSpam')}
									</option>
									<option value="harassment">
										{t('friends.reportReasonHarassment')}
									</option>
									<option value="other">
										{t('friends.reportReasonOther')}
									</option>
								</select>
							</label>
							<label className="grid gap-1">
								<span>{t('friends.reportDetailsLabel')}</span>
								<textarea
									value={reportDetails}
									onChange={(event) => setReportDetails(event.target.value)}
									placeholder={t('friends.reportDetailsPlaceholder')}
								/>
							</label>
							<DesktopAppButton
								type="submit"
								variant="accent"
								disabled={saving || !reportReason.trim()}
							>
								{t('friends.reportSubmit')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="neutral"
								onClick={() => setReportOpen(false)}
							>
								{t('friends.reportCancel')}
							</DesktopAppButton>
						</form>
					</section>
				) : null}
			</div>
			<div>
				<h4>{t('friends.circlesTitle')}</h4>
				{availableCircles.length === 0 ? (
					<DesktopProductStatusBanner
						tone="neutral"
						title={t('friends.personCardCirclesEmptyTitle')}
						description={t('friends.personCardCirclesEmptyDescription')}
					/>
				) : (
					<>
						<ul aria-label={t('friends.personCardCirclesSummaryAria')}>
							<li>
								{t('friends.personCardCirclesAssignedMetric', {
									count: selected.size,
								})}
							</li>
							<li>
								{t('friends.personCardCirclesAvailableMetric', {
									count: availableCircles.length,
								})}
							</li>
						</ul>
						<div className="flex flex-wrap gap-2">
							{availableCircles.map((circle) => (
								<DesktopAppButton
									key={circle.id}
									type="button"
									size="sm"
									variant={selected.has(circle.id) ? 'accent' : 'neutral'}
									disabled={saving}
									onClick={() => onToggleCircle?.(friend, circle.id)}
								>
									{circle.name}
								</DesktopAppButton>
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
