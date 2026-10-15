/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Test notification buttons (info/success/warning/error) for Notification Hub Quick Settings.
 *
 * Invariants:
 * - Adds rows to notification center via `notify.*` with `addToCenter: true`.
 *
 * Related:
 * - NotificationHubQuickSettings.tsx
 */

import { notify } from '@/notifications';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE } from '../../../constants';
import {
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '../../DesktopAppChrome';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';
import {
	NH_QUICK_SETTINGS_ACTION_ROW_CLASS,
	NH_QUICK_SETTINGS_DND_TEST_HINT_CLASS,
	NH_QUICK_SETTINGS_SECTION_CARD_CLASS,
	NH_QUICK_SETTINGS_SECTION_DESC_CLASS,
	NH_QUICK_SETTINGS_TEST_INNER_CLASS,
	NH_QUICK_SETTINGS_TEST_LEAD_ROW_CLASS,
	NH_SECTION_LABEL_NORMAL_CLASS,
	nhQuickSettingsTestIconClass,
} from '../notificationHubLayoutTokens';
import { SparklesIcon } from '@heroicons/react/24/outline';

export type NotificationHubNotifyTestPanelProps = {
	doNotDisturb: boolean;
};

export const NotificationHubNotifyTestPanel: React.FC<NotificationHubNotifyTestPanelProps> =
	memo(({ doNotDisturb }) => {
		const { t } = useTranslation('desktopUi', { keyPrefix: 'notificationHub' });

		return (
			<div className={NH_QUICK_SETTINGS_SECTION_CARD_CLASS}>
				<div className={NH_QUICK_SETTINGS_TEST_LEAD_ROW_CLASS}>
					<SparklesIcon
						className={nhQuickSettingsTestIconClass()}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					<div className={NH_QUICK_SETTINGS_TEST_INNER_CLASS}>
						<DesktopAppSectionLabel className={NH_SECTION_LABEL_NORMAL_CLASS}>
							{t('quickSettings.testSectionTitle')}
						</DesktopAppSectionLabel>
						<p className={NH_QUICK_SETTINGS_SECTION_DESC_CLASS}>
							{t('quickSettings.testSectionHint')}
						</p>
						{doNotDisturb ? (
							<p className={NH_QUICK_SETTINGS_DND_TEST_HINT_CLASS}>
								{t('quickSettings.testDndSoundHint')}
							</p>
						) : null}
						<div className={NH_QUICK_SETTINGS_ACTION_ROW_CLASS}>
							{(
								[
									{
										key: 'info',
										label: t('quickSettings.testNotifyInfo'),
										onClick: () =>
											notify.info(
												t('quickSettings.testNotifyInfoTitle'),
												t('quickSettings.testNotifyInfoBody'),
												{ addToCenter: true }
											),
									},
									{
										key: 'success',
										label: t('quickSettings.testNotifySuccess'),
										onClick: () =>
											notify.success(
												t('quickSettings.testNotifySuccessTitle'),
												t('quickSettings.testNotifySuccessBody'),
												{ addToCenter: true }
											),
									},
									{
										key: 'warning',
										label: t('quickSettings.testNotifyWarning'),
										onClick: () =>
											notify.warning(
												t('quickSettings.testNotifyWarningTitle'),
												t('quickSettings.testNotifyWarningBody'),
												{ addToCenter: true }
											),
									},
									{
										key: 'error',
										label: t('quickSettings.testNotifyError'),
										onClick: () =>
											notify.error(
												t('quickSettings.testNotifyErrorTitle'),
												t('quickSettings.testNotifyErrorBody'),
												{ addToCenter: true }
											),
									},
								] as const
							).map((item) => (
								<DesktopChromeTooltip
									key={item.key}
									content={item.label}
									placement="top"
									offsetExtra={4}
								>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={item.onClick}
									>
										{item.label}
									</DesktopAppButton>
								</DesktopChromeTooltip>
							))}
						</div>
					</div>
				</div>
			</div>
		);
	});

NotificationHubNotifyTestPanel.displayName = 'NotificationHubNotifyTestPanel';
