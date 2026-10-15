/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile security panel: start Keycloak reset-credentials flow (password reset via email).
 *
 * Invariants:
 * - Password changes go through Keycloak SMTP; EliteEW does not accept legacy PG password forms.
 * - Redirect returns to the current profile URL after Keycloak finishes the flow.
 *
 * Related:
 * - `services/keycloak.ts`, `ProfileSettings.tsx`, `KEYCLOAK-ELITEEW.md`
 */

import { motion } from 'framer-motion';
import { EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';

import {
	DesktopAppButton,
	DesktopAppPanel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { getDesktopShellContentPanelClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import { buildKeycloakPasswordResetUrl } from '@/services/keycloak';
import { cn } from '@/utils/cn';

interface ProfilePasswordResetSectionProps {
	email: string | null | undefined;
	embedded?: boolean;
}

export default function ProfilePasswordResetSection({
	email,
	embedded = false,
}: ProfilePasswordResetSectionProps): JSX.Element {
	const shellFrame = useDesktopShellFrame();
	const shellPanel = embedded
		? getDesktopShellContentPanelClassName(shellFrame)
		: '';

	const onResetPassword = (): void => {
		const resetUrl = buildKeycloakPasswordResetUrl({
			redirectUri: window.location.href,
		});
		window.location.assign(resetUrl);
	};

	const emailHint = email?.trim() || null;

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.12 }}
			className="rounded-xl"
		>
			<DesktopAppPanel className={cn(shellPanel, 'p-6')}>
				<div className="mb-4 flex items-center gap-3">
					<span className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)">
						<LockClosedIcon
							className={DESKTOP_LUCIDE.lg}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</span>
					<div>
						<h2 className="text-lg font-semibold tracking-tight text-(--desktop-text-primary)">
							Пароль и вход
						</h2>
						<p className="mt-0.5 text-xs text-(--desktop-text-muted)">
							Пароль хранится в Keycloak (SSO), не в EliteEW.
						</p>
					</div>
				</div>

				<p className="text-sm leading-relaxed text-(--desktop-text-muted)">
					Нажмите кнопку ниже — откроется защищённая форма Keycloak. Укажите
					email аккаунта: на почту придёт ссылка для установки нового пароля.
				</p>

				{emailHint ? (
					<p className="mt-3 flex items-center gap-2 text-sm text-(--desktop-text-secondary)">
						<EnvelopeIcon
							className={DESKTOP_LUCIDE.sm}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						<span>
							Используйте email профиля:{' '}
							<span className="font-medium text-(--desktop-text-primary)">
								{emailHint}
							</span>
						</span>
					</p>
				) : (
					<p className="mt-3 text-sm text-amber-200/90">
						Email в профиле не указан — введите на форме Keycloak тот адрес,
						который привязан к аккаунту.
					</p>
				)}

				<div className="mt-4">
					<DesktopAppButton
						type="button"
						variant="accent"
						className="gap-1.5"
						onClick={onResetPassword}
					>
						<EnvelopeIcon
							className={DESKTOP_LUCIDE.sm}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						Сбросить пароль по email
					</DesktopAppButton>
				</div>
			</DesktopAppPanel>
		</motion.div>
	);
}
