/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-interaction section state, queries, and mutations (chat, docs, presentations, diagnostic).
 *
 * Invariants:
 * - With marketing tab bar, chat bridge and GAF message poll only on `chat` tab.
 * - Lead content/ewrp/diagnostic queries gated by active tab (`marketingCabinetClientInteractionGating`).
 *
 * Related:
 * - ClientInteractionView.tsx, marketingCabinetClientInteractionGating.ts
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { customerCabinetWorkspaceSignalsQueryKey } from '@/pages/CustomerCabinet/customerCabinetQueryOptions';
import { sendMessagePlain } from '@/pages/Desktop/components/GAFChat/api/gafChatApi';
import {
	gafChatMcClientInteractionMessagesQueryKey,
	gafChatMcClientInteractionMessagesQueryOptions,
	gafChatMeQueryOptions,
} from '@/pages/Desktop/components/GAFChat/gafChatQueryOptions';
import { getFriendDisplayName } from '@/features/friends/components/FriendAvatar';

import {
	marketingCabinetClientInteractionBridgeQueryOptions,
	marketingCabinetClientInteractionContentQueryOptions,
	marketingCabinetClientInteractionContextQueryOptions,
	marketingCabinetClientInteractionDocsQueryOptions,
	marketingCabinetClientInteractionEwrpQueryOptions,
	marketingCabinetClientInteractionPresQueryOptions,
	marketingCabinetClientInteractionQueryKey,
	marketingCabinetCustomerDiagnosticSessionInvalidationQueryKey,
	marketingCabinetCustomerDiagnosticSettingsQueryKey,
	marketingCabinetCustomerDiagnosticSettingsQueryOptions,
} from '../../marketingCabinetClientInteractionQueryOptions';
import {
	shouldLoadClientInteractionChat,
	shouldLoadClientInteractionDiagnosticSettings,
	shouldLoadClientInteractionDocs,
	shouldLoadClientInteractionEwrp,
	shouldLoadClientInteractionLeadContent,
	shouldLoadClientInteractionShares,
} from '../../marketingCabinetClientInteractionGating';
import { marketingCabinetApi } from '../../marketingCabinetApi';
import {
	getVisibleMarketingClientInteractionTabs,
	normalizeMarketingClientInteractionTab,
	type ClientInteractionMarketingTab,
} from './clientInteractionTabs';
import type { ClientInteractionLayout } from './clientInteractionTypes';
import type { DocInlinePreview } from './clientInteractionShared';
import { requireChatId, requireProjectId } from './clientInteractionShared';

export type UseClientInteractionControllerArgs = {
	selectedProjectId: string | null;
	readOnlyMarketing: boolean;
	variant: 'default' | 'embedded';
	layout: ClientInteractionLayout;
};

export function useClientInteractionController({
	selectedProjectId,
	readOnlyMarketing,
	variant,
	layout: layoutMode,
}: UseClientInteractionControllerArgs) {
	const embedded = variant === 'embedded';
	const qc = useQueryClient();
	const [marketingTab, setMarketingTab] =
		useState<ClientInteractionMarketingTab>('summary');

	const invalidateCustomerCabinetSummary = useCallback(() => {
		if (!embedded || !selectedProjectId) return;
		void qc.invalidateQueries({
			queryKey: customerCabinetWorkspaceSignalsQueryKey(selectedProjectId),
		});
	}, [embedded, qc, selectedProjectId]);

	const [draft, setDraft] = useState('');
	const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(
		() => new Set()
	);
	const [presObjectUrl, setPresObjectUrl] = useState<string | null>(null);
	const [, setLoadedPresShareId] = useState<string | null>(null);
	const [openingApprovalId, setOpeningApprovalId] = useState<string | null>(
		null
	);
	const [docPreview, setDocPreview] = useState<DocInlinePreview | null>(null);
	const docPreviewObjectUrlRef = useRef<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const revokeDocPreviewObjectUrl = () => {
		if (docPreviewObjectUrlRef.current) {
			URL.revokeObjectURL(docPreviewObjectUrlRef.current);
			docPreviewObjectUrlRef.current = null;
		}
	};

	const clearDocPreview = () => {
		revokeDocPreviewObjectUrl();
		setDocPreview(null);
	};

	const ctxQuery = useQuery({
		...marketingCabinetClientInteractionContextQueryOptions(selectedProjectId),
		enabled: Boolean(selectedProjectId),
	});

	const ctx = ctxQuery.data;
	const isLead = Boolean(ctx?.is_lead && !readOnlyMarketing);
	const showMarketingTabBar =
		getVisibleMarketingClientInteractionTabs({
			variant,
			layout: layoutMode,
			isLead,
		}).length > 0;

	const visibleClientInteractionTabs = useMemo(
		() =>
			getVisibleMarketingClientInteractionTabs({
				variant,
				layout: layoutMode,
				isLead,
			}),
		[variant, layoutMode, isLead]
	);

	useEffect(() => {
		setMarketingTab((cur) =>
			normalizeMarketingClientInteractionTab(visibleClientInteractionTabs, cur)
		);
	}, [visibleClientInteractionTabs]);

	const shouldLoadChat = shouldLoadClientInteractionChat(
		layoutMode,
		marketingTab,
		showMarketingTabBar
	);

	const bridgeQuery = useQuery({
		...marketingCabinetClientInteractionBridgeQueryOptions(selectedProjectId),
		// API разрешает мост только руководителю (владелец/создатель) или представителю заказчика.
		enabled: Boolean(
			selectedProjectId &&
				shouldLoadChat &&
				ctxQuery.isSuccess &&
				ctx?.has_representative &&
				(ctx.is_lead || ctx.is_customer_representative)
		),
	});

	const chatId = bridgeQuery.data?.chat_id ?? null;

	const gafMeQuery = useQuery({
		...gafChatMeQueryOptions(),
		enabled: Boolean(chatId) && shouldLoadChat,
	});

	const messagesQuery = useQuery({
		...gafChatMcClientInteractionMessagesQueryOptions(chatId),
		enabled: Boolean(chatId) && shouldLoadChat,
		refetchInterval: shouldLoadChat && chatId ? 5000 : false,
	});

	const shouldLoadDocs = shouldLoadClientInteractionDocs(
		layoutMode,
		marketingTab,
		showMarketingTabBar,
		Boolean(selectedProjectId)
	);

	const docsQuery = useQuery({
		...marketingCabinetClientInteractionDocsQueryOptions(selectedProjectId),
		enabled: shouldLoadDocs,
	});

	const contentQuery = useQuery({
		...marketingCabinetClientInteractionContentQueryOptions(selectedProjectId),
		enabled: Boolean(
			selectedProjectId &&
				shouldLoadClientInteractionLeadContent(
					layoutMode,
					marketingTab,
					showMarketingTabBar,
					isLead,
					readOnlyMarketing
				)
		),
	});

	const ewrpQuery = useQuery({
		...marketingCabinetClientInteractionEwrpQueryOptions(selectedProjectId),
		enabled: Boolean(
			selectedProjectId &&
				shouldLoadClientInteractionEwrp(
					layoutMode,
					marketingTab,
					showMarketingTabBar,
					isLead,
					readOnlyMarketing
				)
		),
	});

	const shouldLoadShares = shouldLoadClientInteractionShares(
		layoutMode,
		marketingTab,
		showMarketingTabBar,
		Boolean(selectedProjectId)
	);

	const sharesQuery = useQuery({
		...marketingCabinetClientInteractionPresQueryOptions(selectedProjectId),
		enabled: shouldLoadShares,
	});

	const customerDiagSettingsQuery = useQuery({
		...marketingCabinetCustomerDiagnosticSettingsQueryOptions(
			selectedProjectId
		),
		enabled: Boolean(
			selectedProjectId &&
				shouldLoadClientInteractionDiagnosticSettings(
					marketingTab,
					showMarketingTabBar,
					isLead,
					readOnlyMarketing
				)
		),
	});

	const customerDiagPatch = useMutation({
		mutationFn: (enabled: boolean) =>
			marketingCabinetApi.patchCustomerDiagnosticSettings(
				requireProjectId(selectedProjectId),
				{ enabled }
			),
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey:
					marketingCabinetCustomerDiagnosticSettingsQueryKey(selectedProjectId),
			});
			void qc.invalidateQueries({
				queryKey:
					marketingCabinetCustomerDiagnosticSessionInvalidationQueryKey(),
			});
		},
	});

	const meForChat = useMutation({
		mutationFn: (body: string) => sendMessagePlain(requireChatId(chatId), body),
		onSuccess: () => {
			const cid = chatId;
			if (!cid) return;
			void qc.invalidateQueries({
				queryKey: gafChatMcClientInteractionMessagesQueryKey(cid),
			});
			setDraft('');
		},
	});

	const sendDocsMutation = useMutation({
		mutationFn: () =>
			marketingCabinetApi.sendClientDocsForApproval(
				requireProjectId(selectedProjectId),
				Array.from(selectedContentIds)
			),
		onSuccess: () => {
			setSelectedContentIds(new Set());
			void qc.invalidateQueries({
				queryKey: marketingCabinetClientInteractionQueryKey(
					'docs',
					selectedProjectId
				),
			});
			invalidateCustomerCabinetSummary();
		},
	});

	const approveMutation = useMutation({
		mutationFn: (approvalId: string) =>
			marketingCabinetApi.approveClientDoc(
				requireProjectId(selectedProjectId),
				approvalId
			),
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey: marketingCabinetClientInteractionQueryKey(
					'docs',
					selectedProjectId
				),
			});
			invalidateCustomerCabinetSummary();
		},
	});

	const requestRemovalMutation = useMutation({
		mutationFn: (approvalId: string) =>
			marketingCabinetApi.requestClientDocRemoval(
				requireProjectId(selectedProjectId),
				approvalId
			),
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey: marketingCabinetClientInteractionQueryKey(
					'docs',
					selectedProjectId
				),
			});
			invalidateCustomerCabinetSummary();
		},
	});

	const confirmRemovalMutation = useMutation({
		mutationFn: (removalId: string) =>
			marketingCabinetApi.confirmClientDocRemoval(
				requireProjectId(selectedProjectId),
				removalId
			),
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey: marketingCabinetClientInteractionQueryKey(
					'docs',
					selectedProjectId
				),
			});
			invalidateCustomerCabinetSummary();
		},
	});

	const cancelRemovalMutation = useMutation({
		mutationFn: (removalId: string) =>
			marketingCabinetApi.cancelClientDocRemoval(
				requireProjectId(selectedProjectId),
				removalId
			),
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey: marketingCabinetClientInteractionQueryKey(
					'docs',
					selectedProjectId
				),
			});
			invalidateCustomerCabinetSummary();
		},
	});

	const sharePresMutation = useMutation({
		mutationFn: (jobId: string) =>
			marketingCabinetApi.shareClientPresentation(
				requireProjectId(selectedProjectId),
				jobId
			),
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey: marketingCabinetClientInteractionQueryKey(
					'pres',
					selectedProjectId
				),
			});
			invalidateCustomerCabinetSummary();
		},
	});

	const revokePresMutation = useMutation({
		mutationFn: (shareId: string) =>
			marketingCabinetApi.revokeClientPresShare(
				requireProjectId(selectedProjectId),
				shareId
			),
		onSuccess: (_data, shareId) => {
			void qc.invalidateQueries({
				queryKey: marketingCabinetClientInteractionQueryKey(
					'pres',
					selectedProjectId
				),
			});
			invalidateCustomerCabinetSummary();
			setLoadedPresShareId((cur) => {
				if (cur !== shareId) return cur;
				setPresObjectUrl((old) => {
					if (old) URL.revokeObjectURL(old);
					return null;
				});
				return null;
			});
		},
	});

	useEffect(() => {
		void selectedProjectId;
		setLoadedPresShareId(null);
		setPresObjectUrl((prev) => {
			if (prev) URL.revokeObjectURL(prev);
			return null;
		});
		if (docPreviewObjectUrlRef.current) {
			URL.revokeObjectURL(docPreviewObjectUrlRef.current);
			docPreviewObjectUrlRef.current = null;
		}
		setDocPreview(null);
	}, [selectedProjectId]);

	useEffect(() => {
		return () => {
			if (docPreviewObjectUrlRef.current) {
				URL.revokeObjectURL(docPreviewObjectUrlRef.current);
				docPreviewObjectUrlRef.current = null;
			}
		};
	}, []);

	const sortedMessages = useMemo(() => {
		const raw = messagesQuery.data ?? [];
		return [...raw].sort(
			(a, b) =>
				new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
		);
	}, [messagesQuery.data]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, []);

	useEffect(() => {
		return () => {
			if (presObjectUrl) URL.revokeObjectURL(presObjectUrl);
		};
	}, [presObjectUrl]);

	const partner = bridgeQuery.data?.partner ?? ctx?.partner ?? null;
	const selfUid = gafMeQuery.data?.user_id ?? null;
	const partnerName = partner
		? getFriendDisplayName(partner.username, partner.full_name)
		: '—';

	const documents = docsQuery.data ?? [];
	const pendingDocs = documents.filter((d) => d.status === 'pending');
	const approvedDocs = documents.filter((d) => d.status === 'approved');

	const toggleContent = (id: string) => {
		setSelectedContentIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const openPresentationPreview = async (shareId: string) => {
		if (!selectedProjectId) return;
		try {
			const blob = readOnlyMarketing
				? await marketingCabinetApi.getClientPresPdfBlob(
						selectedProjectId,
						shareId
					)
				: await marketingCabinetApi.getClientPresHtmlBlob(
						selectedProjectId,
						shareId
					);
			const url = URL.createObjectURL(blob);
			setLoadedPresShareId(shareId);
			setPresObjectUrl((old) => {
				if (old) URL.revokeObjectURL(old);
				return url;
			});
		} catch {
			// surfaced via UI if needed
		}
	};

	const downloadPresPdf = async (shareId: string) => {
		if (!selectedProjectId) return;
		const blob = await marketingCabinetApi.getClientPresPdfBlob(
			selectedProjectId,
			shareId
		);
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `presentation-${shareId}.pdf`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const openBlobInNewTab = (url: string) => {
		const opened = window.open(url, '_blank', 'noopener,noreferrer');
		if (!opened) {
			const a = document.createElement('a');
			a.href = url;
			a.target = '_blank';
			a.rel = 'noopener noreferrer';
			document.body.appendChild(a);
			a.click();
			a.remove();
		}
	};

	const openApprovalDocument = async (
		approvalId: string,
		title: string
	): Promise<void> => {
		if (!selectedProjectId) return;
		setOpeningApprovalId(approvalId);
		try {
			const blob = await marketingCabinetApi.getClientApprovalFileBlob(
				selectedProjectId,
				approvalId
			);
			const mime =
				(blob.type || '').toLowerCase() || 'application/octet-stream';

			const canInline =
				mime === 'application/pdf' ||
				mime.startsWith('image/') ||
				mime.startsWith('video/') ||
				mime.startsWith('audio/') ||
				mime === 'text/html' ||
				(mime.startsWith('text/') && mime !== 'application/octet-stream');

			if (mime.startsWith('text/') && mime !== 'text/html') {
				const text = await blob.text();
				revokeDocPreviewObjectUrl();
				setDocPreview({
					type: 'text',
					text,
					title,
					approvalId,
				});
				return;
			}

			if (!canInline) {
				const url = URL.createObjectURL(blob);
				openBlobInNewTab(url);
				window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
				return;
			}

			revokeDocPreviewObjectUrl();
			const url = URL.createObjectURL(blob);
			docPreviewObjectUrlRef.current = url;
			setDocPreview({
				type: 'media',
				url,
				mime,
				title,
				approvalId,
			});
		} catch {
			// optional UX toast
		} finally {
			setOpeningApprovalId(null);
		}
	};

	const onSubmitChat = (e: React.FormEvent) => {
		e.preventDefault();
		const text = draft.trim();
		if (!text || !chatId || meForChat.isPending) return;
		meForChat.mutate(text);
	};

	const showChat = layoutMode === 'full' || layoutMode === 'chat-only';
	const showDocs = layoutMode === 'full' || layoutMode === 'documents-only';
	const showPres = layoutMode === 'full' || layoutMode === 'presentations-only';

	const presViewerMinH = embedded
		? 'min-h-[min(38dvh,22rem)]'
		: 'min-h-[min(80dvh,52rem)] lg:min-h-[min(88dvh,58rem)]';

	const chatDocsGridUsesTwoColumns =
		layoutMode === 'full' && !embedded && showChat && showDocs;

	return {
		embedded,
		layoutMode,
		marketingTab,
		setMarketingTab,
		showMarketingTabBar,
		visibleClientInteractionTabs,
		showChat,
		showDocs,
		showPres,
		chatDocsGridUsesTwoColumns,
		ctxQuery,
		ctx,
		bridgeQuery,
		chatId,
		gafMeQuery,
		messagesQuery,
		docsQuery,
		contentQuery,
		ewrpQuery,
		sharesQuery,
		customerDiagSettingsQuery,
		customerDiagPatch,
		meForChat,
		sendDocsMutation,
		approveMutation,
		requestRemovalMutation,
		confirmRemovalMutation,
		cancelRemovalMutation,
		sharePresMutation,
		revokePresMutation,
		isLead,
		partner,
		selfUid,
		partnerName,
		pendingDocs,
		approvedDocs,
		sortedMessages,
		draft,
		setDraft,
		selectedContentIds,
		toggleContent,
		presObjectUrl,
		openingApprovalId,
		docPreview,
		clearDocPreview,
		messagesEndRef,
		openPresentationPreview,
		downloadPresPdf,
		openBlobInNewTab,
		openApprovalDocument,
		onSubmitChat,
		presViewerMinH,
	};
}
