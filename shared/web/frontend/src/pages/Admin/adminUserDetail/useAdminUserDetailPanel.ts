/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * View-model hook for admin user detail panel: queries, mutations, form state, and presence handlers.
 *
 * Invariants:
 * - Hooks run unconditionally; caller handles open/userRow null guard before rendering tabs.
 * - UGS mutations require isUgsAdminAuthorized; store mutations do not.
 *
 * Related:
 * - `pages/Admin/adminUserDetail/AdminUserDetailPanel.tsx`
 * - `hooks/api/useUgsAdmin.ts`
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { APIError } from '../../../services/api/client';
import { adminApi } from '../../../services/admin/api';
import {
	approveAdminMobileDeviceTransfer,
	fetchAdminMobileDeviceTransfers,
	fetchAdminMobileTrustedDeviceAudit,
	fetchAdminMobileTrustedDevices,
	rejectAdminMobileDeviceTransfer,
} from '../../../services/mobileAppApi';
import {
	useAdminUser,
	usePatchUserAdminBadge,
	usePatchUserTrusted,
	useTopUpCredits,
	useUpdateUserLimits,
} from '../../../hooks/api/useUgsAdmin';
import { useAuth } from '../../../contexts/AuthContext';
import { isUgsAdminAuthorized } from '../../../utils/ugsAdminAccess';
import {
	getAccessGroups,
	updateUserAccessGroup,
	updateUserEwBalance,
	updateUserUgsCredits,
	getUserWebSearchQuota,
	patchUserWebSearchQuota,
} from '../../Desktop/services/desktopAdminApi';
import type { AdminUserDetailTab } from '../adminUsersDetailTab';
import { GROUPS_QK } from './constants';
import type { AdminUserDetailPanelProps, PendingPresence } from './types';

export function useAdminUserDetailPanel({
	open,
	userRow,
	onClose,
	onUserUpdated,
	initialDetailTab = 'overview',
	onDetailTabChange,
}: AdminUserDetailPanelProps) {
	const { t } = useTranslation('desktopUi');
	const { user, isAuthenticated, loading: authLoading } = useAuth();
	const ugsOk = isUgsAdminAuthorized({
		user,
		isAuthenticated,
		loading: authLoading,
	});
	const queryClient = useQueryClient();
	const panelRef = React.useRef<HTMLDivElement>(null);

	const ugsUser = useAdminUser(open && userRow ? userRow.id : null, {
		enabled: ugsOk && open && Boolean(userRow),
	});

	const groupsQuery = useQuery({
		queryKey: GROUPS_QK,
		queryFn: getAccessGroups,
		enabled: open,
		staleTime: 60_000,
	});

	const webSearchQuotaQuery = useQuery({
		queryKey: ['desktop', 'admin', 'web-search-quota', userRow?.id],
		queryFn: () => {
			const uid = userRow?.id;
			if (!uid) throw new Error('user id required');
			return getUserWebSearchQuota(uid);
		},
		enabled: open && Boolean(userRow?.id),
		staleTime: 15_000,
	});

	const ssoOverview = useQuery({
		queryKey: ['admin', 'user-sso-overview', userRow?.id],
		queryFn: () => {
			const uid = userRow?.id;
			if (!uid) throw new Error('user id required');
			return adminApi.getUserSsoOverview(uid, 80);
		},
		enabled: open && Boolean(userRow?.id),
		staleTime: 15_000,
	});

	const trustedDevicesQuery = useQuery({
		queryKey: ['admin', 'user-mobile-trusted-devices', userRow?.id],
		queryFn: () => {
			const uid = userRow?.id;
			if (!uid) throw new Error('user id required');
			return fetchAdminMobileTrustedDevices(uid);
		},
		enabled: open && Boolean(userRow?.id),
		staleTime: 15_000,
	});

	const trustedDeviceAuditQuery = useQuery({
		queryKey: ['admin', 'user-mobile-trusted-device-audit', userRow?.id],
		queryFn: () => {
			const uid = userRow?.id;
			if (!uid) throw new Error('user id required');
			return fetchAdminMobileTrustedDeviceAudit(uid);
		},
		enabled: open && Boolean(userRow?.id),
		staleTime: 15_000,
	});

	const trustedDeviceTransfersQuery = useQuery({
		queryKey: ['admin', 'user-mobile-device-transfers', userRow?.id],
		queryFn: () => {
			const uid = userRow?.id;
			if (!uid) throw new Error('user id required');
			return fetchAdminMobileDeviceTransfers(uid);
		},
		enabled: open && Boolean(userRow?.id),
		staleTime: 15_000,
	});

	const [groupId, setGroupId] = React.useState<string | ''>('');
	const [ewVal, setEwVal] = React.useState(0);
	const [storeUgsVal, setStoreUgsVal] = React.useState(0);
	const [webSearchCoinsVal, setWebSearchCoinsVal] = React.useState(0);
	const [webSearchMonthlyLimitVal, setWebSearchMonthlyLimitVal] =
		React.useState('');
	const [topUpAmount, setTopUpAmount] = React.useState('');
	const [topUpReason, setTopUpReason] = React.useState('');
	const [limDaily, setLimDaily] = React.useState('');
	const [limMonthly, setLimMonthly] = React.useState('');
	const [limConcurrent, setLimConcurrent] = React.useState('');
	const [badgeLabel, setBadgeLabel] = React.useState('');
	const [badgeHint, setBadgeHint] = React.useState('');
	const [pendingPresence, setPendingPresence] =
		React.useState<PendingPresence | null>(null);
	const [presenceBusy, setPresenceBusy] = React.useState(false);
	const [detailTab, setDetailTab] =
		React.useState<AdminUserDetailTab>(initialDetailTab);

	const selectDetailTab = React.useCallback(
		(tab: AdminUserDetailTab) => {
			setDetailTab(tab);
			onDetailTabChange?.(tab);
		},
		[onDetailTabChange]
	);

	React.useEffect(() => {
		if (open && userRow) setDetailTab(initialDetailTab);
	}, [open, userRow, initialDetailTab]);

	React.useEffect(() => {
		if (!userRow) return;
		setGroupId(userRow.app_access_group_id ?? '');
		setEwVal(userRow.ew_balance);
		setStoreUgsVal(Number(userRow.ugs_credits));
	}, [userRow]);

	React.useEffect(() => {
		const u = ugsUser.data;
		if (!u) return;
		setLimDaily(String(u.daily_credit_limit ?? 100));
		setLimMonthly(String(u.monthly_credit_limit ?? 3000));
		setLimConcurrent(String(u.concurrent_requests_limit ?? 5));
		setBadgeLabel(u.admin_badge_label ?? '');
		setBadgeHint(u.admin_badge_hint ?? '');
	}, [ugsUser.data]);

	React.useEffect(() => {
		const q = webSearchQuotaQuery.data;
		if (!q) return;
		setWebSearchCoinsVal(q.coins);
		setWebSearchMonthlyLimitVal(String(q.monthly_limit));
	}, [webSearchQuotaQuery.data]);

	React.useEffect(() => {
		if (!open) return;
		const el = panelRef.current;
		const focusTimer = window.setTimeout(() => {
			el?.querySelector<HTMLElement>('button, [href], input, select')?.focus();
		}, 0);
		return () => window.clearTimeout(focusTimer);
	}, [open]);

	React.useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open, onClose]);

	const saveGroupMut = useMutation({
		mutationFn: async () => {
			if (!userRow) return;
			await updateUserAccessGroup(userRow.id, {
				app_access_group_id: groupId || null,
			});
		},
		onSuccess: () => {
			toast.success(t('adminUserDetail.toast.groupSaved'));
			void queryClient.invalidateQueries({
				queryKey: ['desktop', 'admin', 'users'],
			});
			onUserUpdated();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const saveEwMut = useMutation({
		mutationFn: async () => {
			if (!userRow) return;
			await updateUserEwBalance(userRow.id, { ew_balance: ewVal });
		},
		onSuccess: () => {
			toast.success(t('adminUserDetail.toast.ewSaved'));
			void queryClient.invalidateQueries({
				queryKey: ['desktop', 'admin', 'users'],
			});
			onUserUpdated();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const saveStoreUgsMut = useMutation({
		mutationFn: async () => {
			if (!userRow) return;
			await updateUserUgsCredits(userRow.id, { ugs_credits: storeUgsVal });
		},
		onSuccess: () => {
			toast.success(t('adminUserDetail.toast.storeUgsSaved'));
			void queryClient.invalidateQueries({
				queryKey: ['desktop', 'admin', 'users'],
			});
			onUserUpdated();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const saveWebSearchQuotaMut = useMutation({
		mutationFn: async () => {
			if (!userRow) return;
			const q = webSearchQuotaQuery.data;
			const parsedLimit = Number.parseInt(webSearchMonthlyLimitVal, 10);
			const patch: Parameters<typeof patchUserWebSearchQuota>[1] = {
				reset_monthly_limit: false,
			};
			if (q && webSearchCoinsVal !== q.coins) {
				patch.web_search_coins = webSearchCoinsVal;
			}
			if (
				q &&
				Number.isFinite(parsedLimit) &&
				parsedLimit !== q.monthly_limit
			) {
				patch.web_search_monthly_limit = parsedLimit;
			}
			if (
				patch.web_search_coins === undefined &&
				patch.web_search_monthly_limit === undefined
			) {
				return q ?? null;
			}
			return patchUserWebSearchQuota(userRow.id, patch);
		},
		onSuccess: (data) => {
			toast.success(t('adminUserDetail.toast.webSearchQuotaSaved'));
			if (data) {
				setWebSearchCoinsVal(data.coins);
				setWebSearchMonthlyLimitVal(String(data.monthly_limit));
			}
			void queryClient.invalidateQueries({
				queryKey: ['desktop', 'admin', 'web-search-quota', userRow?.id],
			});
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const approveDeviceTransferMut = useMutation({
		mutationFn: approveAdminMobileDeviceTransfer,
		onSuccess: () => {
			toast.success('Transfer approved; confirmation email sent.');
			void queryClient.invalidateQueries({
				queryKey: ['admin', 'user-mobile-device-transfers', userRow?.id],
			});
			void queryClient.invalidateQueries({
				queryKey: ['admin', 'user-mobile-trusted-device-audit', userRow?.id],
			});
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const rejectDeviceTransferMut = useMutation({
		mutationFn: (transferId: string) =>
			rejectAdminMobileDeviceTransfer(
				transferId,
				'admin_rejected_from_user_detail'
			),
		onSuccess: () => {
			toast.success('Transfer rejected.');
			void queryClient.invalidateQueries({
				queryKey: ['admin', 'user-mobile-device-transfers', userRow?.id],
			});
			void queryClient.invalidateQueries({
				queryKey: ['admin', 'user-mobile-trusted-device-audit', userRow?.id],
			});
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const patchTrusted = usePatchUserTrusted();
	const topUpMut = useTopUpCredits();
	const limitsMut = useUpdateUserLimits();
	const badgeMut = usePatchUserAdminBadge();

	const runPresence = React.useCallback(async () => {
		if (!pendingPresence) return;
		setPresenceBusy(true);
		try {
			const r = await adminApi.postPresenceCommand({
				user_id: pendingPresence.userId,
				action: pendingPresence.action,
			});
			setPendingPresence(null);
			if (r.delivered === 0) {
				toast.warning(t('adminUserDetail.toast.presenceNotDelivered'), {
					description: t('adminUserDetail.toast.presenceNotDeliveredDesc'),
				});
			} else {
				toast.success(t('adminUserDetail.toast.presenceSent'), {
					description: t('adminUserDetail.toast.presenceSentDesc', {
						count: r.delivered,
					}),
				});
			}
			onUserUpdated();
		} catch (e) {
			const msg =
				e instanceof APIError
					? e.message
					: e instanceof Error
						? e.message
						: String(e);
			toast.error(t('adminUserDetail.toast.presenceFailed'), {
				description: msg,
			});
		} finally {
			setPresenceBusy(false);
		}
	}, [onUserUpdated, pendingPresence, t]);

	const groups = groupsQuery.data ?? [];
	const webSearchQuota = webSearchQuotaQuery.data;
	const groupDirty = userRow
		? groupId !==
			(userRow.app_access_group_id ? String(userRow.app_access_group_id) : '')
		: false;
	const ewDirty = userRow ? ewVal !== userRow.ew_balance : false;
	const storeUgsDirty = userRow
		? storeUgsVal !== Number(userRow.ugs_credits)
		: false;
	const webSearchCoinsDirty =
		webSearchQuota !== undefined && webSearchCoinsVal !== webSearchQuota.coins;
	const webSearchLimitDirty =
		webSearchQuota !== undefined &&
		Number.parseInt(webSearchMonthlyLimitVal, 10) !==
			webSearchQuota.monthly_limit;
	const webSearchQuotaDirty = webSearchCoinsDirty || webSearchLimitDirty;
	const saving =
		saveGroupMut.isPending ||
		saveEwMut.isPending ||
		saveStoreUgsMut.isPending ||
		saveWebSearchQuotaMut.isPending ||
		patchTrusted.isPending ||
		topUpMut.isPending ||
		limitsMut.isPending ||
		badgeMut.isPending;

	return {
		t,
		ugsOk,
		userRow,
		onClose,
		onUserUpdated,
		panelRef,
		ugsUser,
		groupsQuery,
		webSearchQuotaQuery,
		ssoOverview,
		trustedDevicesQuery,
		trustedDeviceAuditQuery,
		trustedDeviceTransfersQuery,
		groupId,
		setGroupId,
		ewVal,
		setEwVal,
		storeUgsVal,
		setStoreUgsVal,
		webSearchCoinsVal,
		setWebSearchCoinsVal,
		webSearchMonthlyLimitVal,
		setWebSearchMonthlyLimitVal,
		topUpAmount,
		setTopUpAmount,
		topUpReason,
		setTopUpReason,
		limDaily,
		setLimDaily,
		limMonthly,
		setLimMonthly,
		limConcurrent,
		setLimConcurrent,
		badgeLabel,
		setBadgeLabel,
		badgeHint,
		setBadgeHint,
		pendingPresence,
		setPendingPresence,
		presenceBusy,
		detailTab,
		selectDetailTab,
		saveGroupMut,
		saveEwMut,
		saveStoreUgsMut,
		saveWebSearchQuotaMut,
		approveDeviceTransferMut,
		rejectDeviceTransferMut,
		patchTrusted,
		topUpMut,
		limitsMut,
		badgeMut,
		runPresence,
		groups,
		webSearchQuota,
		groupDirty,
		ewDirty,
		storeUgsDirty,
		webSearchQuotaDirty,
		saving,
	};
}

export type AdminUserDetailPanelViewModel = ReturnType<
	typeof useAdminUserDetailPanel
>;
