/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * E2EE consent mutations, socket invalidation, and toolbar action handlers for GAF Chat.
 *
 * Invariants:
 * - E2EE starts only through explicit propose/accept; trusted-device suspend shows toast.
 *
 * Related:
 * - GAFChatApp.tsx · GAFChatEncryptionIconButton.tsx
 */
import { Services } from '@/services';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import {
	acceptE2ee,
	declineE2ee,
	disableE2ee,
	gafChatQueryKeys,
	proposeE2ee,
} from '../api/gafChatApi';
import { mapGafChatUserError } from '../gafChatMapUserError';
import type { DesktopGafOpenActions } from '../../../context/DesktopGafActionsContext';
import { requestOpenDesktopApp } from '../../../utils/desktopDeepLink';

export function useGafChatE2eeConsent(options: {
	selectedChatId: string | null;
	t: TFunction<'gafChat'>;
	gafDesktopActions: DesktopGafOpenActions | null;
}) {
	const { selectedChatId, t, gafDesktopActions } = options;
	const queryClient = useQueryClient();

	const refreshE2eeState = useCallback(
		(chatId: string) => {
			void queryClient.invalidateQueries({
				queryKey: gafChatQueryKeys.e2eeStatus(chatId),
			});
			void queryClient.invalidateQueries({ queryKey: gafChatQueryKeys.chats });
		},
		[queryClient]
	);

	const proposeE2eeMutation = useMutation({
		mutationFn: (chatId: string) => proposeE2ee(chatId),
		onSuccess: (_data, chatId) => {
			refreshE2eeState(chatId);
			toast.success(t('e2eeToastProposed'));
		},
		onError: (e: unknown) => {
			toast.error(mapGafChatUserError(e, t, 'e2ee'));
		},
	});

	const acceptE2eeMutation = useMutation({
		mutationFn: (chatId: string) => acceptE2ee(chatId),
		onSuccess: (_data, chatId) => {
			refreshE2eeState(chatId);
			toast.success(t('e2eeToastAccepted'));
		},
		onError: (e: unknown) => {
			toast.error(mapGafChatUserError(e, t, 'e2ee'));
		},
	});

	const declineE2eeMutation = useMutation({
		mutationFn: (chatId: string) => declineE2ee(chatId),
		onSuccess: (_data, chatId) => {
			refreshE2eeState(chatId);
			toast.success(t('e2eeToastDeclined'));
		},
		onError: (e: unknown) => {
			toast.error(mapGafChatUserError(e, t, 'e2ee'));
		},
	});

	const disableE2eeMutation = useMutation({
		mutationFn: (chatId: string) => disableE2ee(chatId),
		onSuccess: (_data, chatId) => {
			refreshE2eeState(chatId);
			toast.success(t('e2eeToastDisabled'));
		},
		onError: (e: unknown) => {
			toast.error(mapGafChatUserError(e, t, 'e2ee'));
		},
	});

	const e2eeConsentBusy =
		proposeE2eeMutation.isPending ||
		acceptE2eeMutation.isPending ||
		declineE2eeMutation.isPending ||
		disableE2eeMutation.isPending;

	useEffect(() => {
		const socket = Services.socket;
		if (!socket || typeof socket.addEventListener !== 'function') return;

		const unsubscribe = socket.addEventListener(
			'gaf_chat.e2ee_consent_changed',
			(data: unknown) => {
				const payload =
					data && typeof data === 'object' && !Array.isArray(data)
						? (data as {
								chat_id?: string;
								status?: string;
								suspend_reason?: string;
							})
						: undefined;
				const chatId = payload?.chat_id;
				if (!chatId) return;
				if (
					payload?.suspend_reason === 'trusted_device_lost' &&
					payload?.status === 'off'
				) {
					toast.info(t('e2eeToastSuspendedTrustedDevice'));
				}
				void queryClient.invalidateQueries({
					queryKey: gafChatQueryKeys.e2eeStatus(chatId),
				});
				void queryClient.invalidateQueries({
					queryKey: gafChatQueryKeys.chats,
				});
			}
		);

		return () => {
			unsubscribe();
		};
	}, [queryClient, t]);

	const handleProposeE2ee = useCallback(() => {
		if (!selectedChatId || e2eeConsentBusy) return;
		proposeE2eeMutation.mutate(selectedChatId);
	}, [selectedChatId, e2eeConsentBusy, proposeE2eeMutation]);

	const handleAcceptE2ee = useCallback(() => {
		if (!selectedChatId || e2eeConsentBusy) return;
		acceptE2eeMutation.mutate(selectedChatId);
	}, [selectedChatId, e2eeConsentBusy, acceptE2eeMutation]);

	const handleDeclineE2ee = useCallback(() => {
		if (!selectedChatId || e2eeConsentBusy) return;
		declineE2eeMutation.mutate(selectedChatId);
	}, [selectedChatId, e2eeConsentBusy, declineE2eeMutation]);

	const handleDisableE2ee = useCallback(() => {
		if (!selectedChatId || e2eeConsentBusy) return;
		disableE2eeMutation.mutate(selectedChatId);
	}, [selectedChatId, e2eeConsentBusy, disableE2eeMutation]);

	const handleSetupE2eeKeys = useCallback(() => {
		if (gafDesktopActions?.openSocialHubTab) {
			gafDesktopActions.openSocialHubTab('phone');
			return;
		}
		requestOpenDesktopApp({
			appComponent: 'SocialHubApp',
			initialPayload: { socialHubTab: 'phone' },
		});
	}, [gafDesktopActions]);

	return {
		e2eeConsentBusy,
		handleProposeE2ee,
		handleAcceptE2ee,
		handleDeclineE2ee,
		handleDisableE2ee,
		handleSetupE2eeKeys,
	};
}
