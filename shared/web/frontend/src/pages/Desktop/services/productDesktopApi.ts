/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin re-export aggregator for product-desktop API client (EWDesk, Feedback, Assistant).
 * Implementation lives in `./productDesktopApi/*` (P36 atomization).
 *
 * Invariants:
 * - All public symbols remain importable from this path (zero consumer changes).
 * - Feedback list normalizers owned by `./productDesktopApi/feedback.ts`.
 *
 * Related:
 * - `shared/api/routers/product_desktop.py`
 * - `documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md`
 */

export {
	PRODUCT_DESKTOP_API_V1_BASE,
	ewDeskNewsLinkedImagePath,
	ewDeskNewsLinkedVideoPath,
	ewDeskNewsLinkedAudioPath,
} from './productDesktopApi/constants';

export type {
	CompanyNewsPost,
	CompanyNewsPostListItem,
	CompanyNewsPostListPage,
	EwDeskNewsFeedFilters,
	CompanyNewsPostAdmin,
	EwDeskNewsUserState,
	EwDeskNewsCounts,
	EwDeskNewsPolishResult,
} from './productDesktopApi/news';

export {
	EWDESK_WIDGET_PREVIEW_LIMIT_FULL,
	EWDESK_WIDGET_PREVIEW_LIMIT_COMPACT,
	fetchPublishedNewsPage,
	ewDeskNewsWidgetPreviewQueryKey,
	fetchEwDeskNewsWidgetPreview,
	ewDeskNewsPagedQueryKey,
	fetchNewsPost,
	fetchEwDeskNewsUserState,
	patchEwDeskNewsUserState,
	fetchEwDeskNewsCounts,
	adminListNews,
	adminCreateNews,
	adminUpdateNews,
	adminDeleteNews,
	adminPolishNewsBody,
} from './productDesktopApi/news';

export type {
	FeedbackTicket,
	FeedbackSubmitter,
	FeedbackTicketAdmin,
	FeedbackTicketListPage,
	FeedbackSummary,
	FeedbackTicketAdminListPage,
} from './productDesktopApi/feedback';

export {
	normalizeFeedbackTicketListPage,
	normalizeFeedbackAdminListPage,
	createFeedbackTicket,
	fetchFeedbackSummary,
	listMyFeedbackTickets,
	adminListFeedbackTickets,
	adminPatchFeedbackTicket,
	adminCloseFeedbackTicket,
} from './productDesktopApi/feedback';

export type {
	AssistantFaqEntry,
	AssistantChatMessage,
	AssistantSettings,
	AssistantKbDocument,
	AssistantKbDocumentDetail,
	AssistantKbSummary,
	AssistantKbBulkUploadResult,
	AssistantKbUploadLimits,
	AssistantKbPurgeResult,
	AssistantKbReindexAllResult,
	AssistantStreamErrorMeta,
	AssistantPreviewResult,
	AssistantKbSyncHandbookResult,
} from './productDesktopApi/assistant';

export {
	ASSISTANT_STREAM_ERROR_CODE,
	fetchAssistantFaq,
	listAssistantMessages,
	clearAssistantMessages,
	sendAssistantMessage,
	adminListAssistantFaq,
	adminCreateAssistantFaq,
	adminUpdateAssistantFaq,
	adminDeleteAssistantFaq,
	getAssistantSettings,
	patchAssistantSettings,
	adminGetKbSummary,
	adminListKbDocuments,
	adminGetKbDocument,
	adminCreateKbDocument,
	adminUploadKbDocument,
	adminUploadKbDocumentsBulk,
	adminPatchKbDocument,
	adminReindexKbDocument,
	adminDeleteKbDocument,
	getAssistantKbUploadLimits,
	adminPurgeKbDocuments,
	adminPreviewAssistantPrompt,
	adminReindexAllKbDocuments,
	adminSyncHandbookKb,
	sendAssistantMessageStream,
} from './productDesktopApi/assistant';
