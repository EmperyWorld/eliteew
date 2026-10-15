/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * TypeScript surface for Ultimate Document Editor — documents, panels, chrome props, and desktop **`embedded`** payloads
 * (`onPayloadChange` mirrors `WindowInitialPayload` companion keys).
 *
 * Invariants:
 * - TipTap / store contracts stay aligned with `UltimateDocEditorInner.tsx` and persistence hooks.
 *
 * Related:
 * - `UltimateDocEditorInner.tsx`
 * - `src/pages/Desktop/types/desktop.types.ts` (`WindowInitialPayload`)
 */
import type { Editor } from '@tiptap/react';
import type { DesktopWindowStyle } from '../../../types/profile';
import type {
	DocEditorActiveTab,
	DocEditorTabTarget,
} from '../../../pages/Desktop/types/desktop.types';

// ========================================
// DOCUMENT TYPES
// ========================================

export interface UltimateDocument {
	id: string;
	user_id: string;
	title: string;
	content: string;
	content_type: 'html' | 'markdown' | 'text' | 'docx';
	metadata: Record<string, unknown>;
	tags: string[];
	is_public: boolean;
	access_level: 'private' | 'shared' | 'public';
	word_count: number;
	character_count: number;
	version?: number;
	version_number: number;
	created_at: string;
	updated_at: string;
	last_accessed_at: string;
	deleted_at?: string;
	/** Владелец unified_content или соавтор по принятому приглашению */
	document_access_role?: 'owner' | 'collaborator';
	/** Соавтор может сохранять канонический документ (PUT и серверный черновик), если владелец указал при приглашении */
	collaboration_can_save?: boolean;
	/** Краткое превью для списков (list_profile=compact) */
	preview_text?: string;
	/** Plain text из API (extracted_text) */
	plain_text?: string;
}

/** Можно ли сохранять документ в БД (владелец и соавтор с флагом при приглашении). */
export function canPersistCanonicalDocument(
	doc: UltimateDocument | null | undefined
): boolean {
	if (!doc?.id || doc.id === 'temp') return false;
	if (doc.document_access_role === 'collaborator') {
		return doc.collaboration_can_save === true;
	}
	return true;
}

export interface DocumentVersion {
	id: string;
	document_id: string;
	version_number: number;
	title: string;
	content: string;
	content_type: string;
	metadata: Record<string, unknown>;
	change_summary?: string;
	created_by: string;
	created_at: string;
	word_count: number;
	character_count: number;
}

// ========================================
// AI TYPES
// ========================================

export interface AIPrompt {
	id: string;
	user_id: string;
	name: string;
	prompt: string;
	category: AIPromptCategory;
	model?: string;
	temperature: number;
	is_public: boolean;
	usage_count: number;
	last_used_at?: string;
	created_at: string;
	updated_at: string;
}

export type AIPromptCategory =
	| 'general'
	| 'analysis'
	| 'generation'
	| 'improvement'
	| 'correction'
	| 'translation'
	| 'summarization'
	| 'creative'
	| 'technical';

export interface AICompletionRequest {
	prompt: string;
	context?: string;
	model?: string;
	temperature?: number;
	stream?: boolean;
}

export interface AICompletionResponse {
	text: string;
	model: string;
	tokens: number;
	finish_reason: string;
}

export interface AIAnalysisRequest {
	document_id: string;
	analysis_type: 'summary' | 'keywords' | 'questions' | 'structure';
}

export interface AIAnalysisResponse {
	analysis_type: string;
	result: Record<string, unknown>;
	confidence: number;
}

// ========================================
// IMAGE GENERATION TYPES
// ========================================

/** Редактор документов: только UGS + Comfy workflow `01_top`. */
export interface ImageGenerationRequest {
	prompt: string;
	workflow_template?: '01_top';
	width?: number;
	height?: number;
	seed?: number;
}

export interface ImageGenerationResponse {
	job_id?: string; // ComfyUI job ID
	status?: string; // queued, processing, completed
	image_url?: string; // URL when completed
	prompt: string;
	/** Отображение: slug workflow (например 01_top). */
	workflow_type?: string;
	workflow_template?: string;
	width?: number;
	height?: number;
	seed?: number;
	generation_time?: number; // Time in seconds
	error?: string; // Error message when failed
}

// ========================================
// COLLABORATION TYPES
// ========================================

export interface CollaborationSession {
	id: string;
	document_id: string;
	user_id: string;
	socket_id?: string;
	session_token?: string;
	cursor_position?: { line: number; column: number };
	selection_range?: {
		from: { line: number; column: number };
		to: { line: number; column: number };
	};
	current_view?: Record<string, unknown>;
	is_active: boolean;
	joined_at: string;
	last_activity: string;
	left_at?: string;
}

export interface CollaboratorInfo {
	user_id: string;
	username: string;
	email: string;
	color: string;
	cursor_position?: { line: number; column: number };
}

// ========================================
// SEARCH TYPES
// ========================================

export interface SearchRequest {
	query: string;
	search_type: 'fulltext' | 'semantic';
	limit?: number;
}

export interface SearchResult {
	document: UltimateDocument;
	score: number;
	highlights?: string[];
}

// ========================================
// FILE UPLOAD TYPES
// ========================================

export interface UploadRequest {
	file: File;
	parse: boolean;
}

export interface UploadResponse {
	document: UltimateDocument;
	parsed_content?: string;
	metadata?: Record<string, unknown>;
}

// ========================================
// EXPORT TYPES
// ========================================

export interface ExportRequest {
	format: 'pdf' | 'docx' | 'html' | 'txt' | 'md' | 'xlsx';
	document_id: string;
}

export interface ExportResponse {
	file_url: string;
	format: string;
	filename: string;
	size: number;
}

// ========================================
// DOCUMENT LIST
// ========================================

export interface ListDocumentsParams {
	skip?: number;
	limit?: number;
	/** Server-side search (name / extracted text); optional */
	search?: string;
	/** Append page to existing `documents` (infinite scroll / load more) */
	append?: boolean;
	/** full — как раньше; compact — лёгкий список с preview_text */
	listProfile?: 'full' | 'compact';
}

// ========================================
// EDITOR STATE TYPES
// ========================================

/**
 * Снимок неактивной вкладки (документы Doc Editor API).
 * Активная вкладка хранится в обычных полях EditorState.
 */
export interface DocEditorTabSession {
	currentDocument: UltimateDocument | null;
	documentSource: 'doc_editor' | 'unified_content' | null;
	isLoadingDocument: boolean;
	error?: string;
	isDirty: boolean;
	isSaving: boolean;
	lastSaved?: string;
	selectedText: string;
	cursorPosition: { line: number; column: number };
	aiPanelOpen: boolean;
	aiStreaming: boolean;
	aiStreamingText: string;
	imageGenPanelOpen: boolean;
	isGeneratingImage: boolean;
	generatedImages: ImageGenerationResponse[];
	collabPanelOpen: boolean;
	activeCollaborators: CollaboratorInfo[];
	versionsPanelOpen: boolean;
	versions: DocumentVersion[];
}

/** Контекст документа из списка менеджера файлов для панели ИИ (plain text, ограниченная длина). */
export type AiFileManagerContext = {
	documentId: string;
	title: string;
	plainText: string;
};

export interface EditorState {
	/**
	 * Вкладки: порядок id документов (только doc_editor UUID).
	 * Пустой массив — режим без явной модели вкладок (обратная совместимость).
	 */
	docTabOrder: string[];
	/** Снимки для неактивных вкладок; активная вкладка не хранится здесь. */
	docTabSessions: Record<string, DocEditorTabSession>;
	/** Заголовки вкладок до догрузки (из payload окна). */
	docTabTitles: Record<string, string>;

	// Current document
	currentDocument: UltimateDocument | null;
	documents: UltimateDocument[];
	/** Total matching server query (pagination) */
	documentsTotal: number;
	isLoading: boolean;
	/** Loading another page for the document list */
	isLoadingMoreDocuments: boolean;
	/** Загрузка/создание текущего документа (не путать со списком, поиском, экспортом). */
	isLoadingDocument: boolean;
	/**
	 * Активный сценарий: документ из Doc Editor API или файл из Unified Content (разные пути сохранения).
	 */
	documentSource: 'doc_editor' | 'unified_content' | null;
	error?: string;

	// Editor state
	isDirty: boolean;
	isSaving: boolean;
	lastSaved?: Date;

	// Selection
	selectedText: string;
	cursorPosition: { line: number; column: number };

	// AI Panel
	aiPanelOpen: boolean;
	aiStreaming: boolean;
	aiStreamingText: string;

	// Image Generation Panel
	imageGenPanelOpen: boolean;
	isGeneratingImage: boolean;
	generatedImages: ImageGenerationResponse[];

	// Collaboration
	collabPanelOpen: boolean;
	activeCollaborators: CollaboratorInfo[];

	// Search
	searchPanelOpen: boolean;
	searchResults: SearchResult[];

	// Prompts
	savedPrompts: AIPrompt[];
	promptsPanelOpen: boolean;

	// Versions
	versionsPanelOpen: boolean;
	versions: DocumentVersion[];

	/** Компактные строки в менеджере файлов (плотнее список). */
	fileManagerListCompact: boolean;

	/**
	 * Контекст для ИИ из списка менеджера файлов (документ ещё не открыт в поле редактора).
	 * Очищается при закрытии панели ИИ или вручную.
	 */
	aiFileManagerContext: AiFileManagerContext | null;

	/** Конфликт версий при PUT: не перезаписываем документ без выбора пользователя */
	documentVersionConflict: {
		serverDocument: UltimateDocument;
		pendingUpdates: Partial<UltimateDocument>;
	} | null;
}

// ========================================
// EDITOR ACTIONS TYPES
// ========================================

export interface EditorActions {
	// Document CRUD
	loadDocument: (
		id: string,
		options?: { signal?: AbortSignal; requestId?: string }
	) => Promise<void>;
	createDocument: (title: string, content?: string) => Promise<void>;
	updateDocument: (
		updates: Partial<UltimateDocument>,
		options?: { expectedVersion?: number | null; forceSave?: boolean }
	) => Promise<void>;
	deleteDocument: (id: string) => Promise<void>;
	listDocuments: (params?: ListDocumentsParams) => Promise<void>;

	/** Сброс модалки конфликта версий без смены документа */
	clearDocumentVersionConflict: () => void;
	/** Принять серверную ревизию (потерять локальные несохранённые правки в сторе) */
	acceptDocumentVersionConflictServer: () => void;
	/** Повторить сохранение локальных изменений с force_save */
	retryDocumentVersionConflictForceOverwrite: () => Promise<void>;
	/** Сохранить локальные изменения новым документом (копия) */
	saveDocumentVersionConflictAsCopy: () => Promise<void>;

	// Content
	setContent: (content: string) => void;
	/** Oracle commit: HTML + stats atomically (heavy path ground truth). */
	commitAnalyticalSnapshot: (payload: {
		content: string;
		words: number;
		characters: number;
	}) => void;
	setDocumentStats: (stats: { words: number; characters: number }) => void;
	appendContent: (content: string) => void;
	replaceSelection: (content: string) => void;

	// Selection
	setSelectedText: (text: string) => void;
	setCursorPosition: (position: { line: number; column: number }) => void;

	// AI
	openAIPanel: () => void;
	/** Открыть панель ИИ с текстом выбранного в списке документа (фрагмент до лимита). */
	openAIPanelWithFileFromList: (doc: UltimateDocument) => void;
	clearAiFileManagerContext: () => void;
	closeAIPanel: () => void;
	setFileManagerListCompact: (value: boolean) => void;
	completeText: (prompt: string, context?: string) => Promise<void>;
	analyzeDocument: (analysisType: string) => Promise<void>;

	// Image Generation
	openImageGenPanel: () => void;
	closeImageGenPanel: () => void;
	generateImage: (request: ImageGenerationRequest) => Promise<void>;
	pollImageStatus: (jobId: string) => Promise<void>;

	// Collaboration
	openCollabPanel: () => void;
	closeCollabPanel: () => void;
	joinCollaboration: (documentId: string) => Promise<void>;
	leaveCollaboration: () => Promise<void>;

	// Search
	openSearchPanel: () => void;
	closeSearchPanel: () => void;
	search: (query: string, searchType: 'fulltext' | 'semantic') => Promise<void>;

	// Prompts
	openPromptsPanel: () => void;
	closePromptsPanel: () => void;
	savePrompt: (
		name: string,
		prompt: string,
		category: AIPromptCategory
	) => Promise<void>;
	loadPrompts: () => Promise<void>;
	usePrompt: (promptId: string) => Promise<void>;

	// Versions
	openVersionsPanel: () => void;
	closeVersionsPanel: () => void;
	loadVersions: (documentId: string) => Promise<void>;
	restoreVersion: (versionNumber: number) => Promise<void>;

	// File Operations
	uploadFile: (file: File) => Promise<void>;
	importDocument: (
		file: File,
		options?: { enhanceLegacyDoc?: boolean }
	) => Promise<unknown>;
	exportDocument: (format: ExportRequest['format'] | 'xlsx') => Promise<void>;

	// OCR Operations
	performOCR: (file: File, language: string) => Promise<OCRResult>;

	// Multi-tab (Doc Editor API documents only)
	/** Сохранить текущее состояние активной вкладки в docTabSessions (перед переключением). */
	snapshotActiveDocTab: () => void;
	/** Применить снимок к текущему состоянию (после переключения вкладки). */
	applyDocTabSession: (documentId: string) => void;
	/** Очистить снимок вкладки из кэша (после применения). */
	clearDocTabSession: (documentId: string) => void;
	switchDocTab: (documentId: string) => Promise<void>;
	addDocTab: (documentId: string) => Promise<void>;
	removeDocTab: (documentId: string) => void;
	setDocTabTitle: (documentId: string, title: string) => void;
	/** Любая вкладка с несохранёнными изменениями (текущая + кэш неактивных). */
	hasAnyDocTabDirty: () => boolean;
	/** Инициализация вкладок из payload окна (до load). */
	initDocTabsFromWindowPayload: (payload: {
		documentIds?: string[];
		documentId?: string;
		activeDocumentId?: string;
		tabTitles?: Record<string, string>;
	}) => void;
}

// ========================================
// COMPONENT PROPS TYPES
// ========================================

export interface UltimateDocEditorProps {
	mode: 'create' | 'edit' | 'view';
	documentId?: string;
	/** Несколько документов (вкладки); при наличии `activeDocumentId` или первого id — активная вкладка. */
	documentIds?: string[];
	activeDocumentId?: string;
	/** Кэш заголовков вкладок (после F5). */
	tabTitles?: Record<string, string>;
	/** Unified content id — load via `/api/v1/content` (file exchange), not legacy documents API. */
	unifiedContentId?: string;
	/** Canonical mixed tab payload (doc editor + unified content tabs). */
	docEditorTabs?: DocEditorTabTarget[];
	/** Canonical active mixed tab pointer. */
	activeDocEditorTab?: DocEditorActiveTab;
	/** Trace id from desktop deep-link, propagated into load telemetry events. */
	docOpenRequestId?: string;
	initialContent?: string;
	initialTitle?: string;
	onSave?: (document: UltimateDocument) => void;
	onClose?: () => void;
	className?: string;
	/**
	 * Embedded mode: editor is rendered inside a confined container
	 * (e.g. Desktop window) instead of full-page layout.
	 */
	embedded?: boolean;
	/**
	 * Called when the active document context changes (Doc Editor id vs Unified Content file id).
	 * Host merges into `WindowState.initialPayload`; pass `undefined` for a field to clear the other source.
	 */
	onPayloadChange?: (payload: {
		documentId?: string;
		documentIds?: string[];
		activeDocumentId?: string;
		tabTitles?: Record<string, string>;
		unifiedContentId?: string;
		docEditorTabs?: DocEditorTabTarget[];
		activeDocEditorTab?: DocEditorActiveTab;
		docOpenRequestId?: string;
		assistantSurfaceContext?: import('@/pages/Desktop/types/desktop.types').WindowInitialPayload['assistantSurfaceContext'];
		/** Transient excerpt for companion `shell_context` (embedded desktop only). */
		companionSurfaceExcerpt?: string;
		/** Debounced Doc Editor selection plaintext for companion `shell_context.surface_selection`. */
		companionSurfaceSelectionPlain?: string;
		/** Single-line listing hint for companion `shell_context.surface_listing` (mounted document). */
		companionListingPlain?: string;
	}) => void;
	/**
	 * Desktop: после успешной загрузки документа один раз открыть панель «Совместная работа»
	 * (например из уведомления «Только панель» или после «Принять»).
	 */
	openCollabAfterLoad?: boolean;
	/** После загрузки документа включить совместное редактирование (эквивалент «Подключиться»). */
	autoJoinCollaborationAfterLoad?: boolean;
}

export interface DocumentImportResult {
	fileName: string;
	success: boolean;
	document?: UltimateDocument;
	extractedText?: string;
	metadata?: {
		wordCount: number;
		charCount: number;
		mimeType: string;
		processingMethod?: string;
		formatVersion?: string;
	};
	error?: string;
}

export interface ImportProgress {
	current: number;
	total: number;
	status: string;
	fileName?: string;
	method?: string;
}

export interface OCRResult {
	fileName: string;
	success: boolean;
	text?: string;
	confidence?: number;
	language?: string;
	processingTime?: number;
	error?: string;
}

export interface OCRProgress {
	current: number;
	total: number;
	status: string;
	fileName?: string;
}

export interface TableCell {
	id: string;
	value: string;
	formula: string;
	style: {
		backgroundColor: string;
		color: string;
		fontWeight: string;
		fontStyle: string;
		textAlign: string;
		border: string;
	};
}

export interface TableColumn {
	id: string;
	label: string;
	width: number;
}

export interface TableData {
	id: string;
	rows: TableCell[][];
	columns: TableColumn[];
}

export interface MathFormula {
	id: string;
	latex: string;
	rendered: string;
	createdAt: Date;
}

export type ReviewStatus =
	| 'draft'
	| 'in_review'
	| 'approved'
	| 'rejected'
	| 'changes_requested';

export interface Comment {
	id: string;
	threadId: string | null;
	author: {
		id: string;
		name: string;
		avatar?: string;
	};
	content: string;
	createdAt: Date;
	resolved: boolean;
	mentions: string[];
}

export interface CommentThread {
	id: string;
	documentId: string;
	assignedReviewer?: {
		id: string;
		name: string;
		avatar?: string;
	} | null;
	isPinned?: boolean;
	isFollowing?: boolean;
	unread?: boolean;
	lastActivityAt?: Date | null;
	selection?: {
		start: number;
		end: number;
		text: string;
	};
	comments: Comment[];
}

export interface CommentAnchorRange {
	threadId: string;
	start: number;
	end: number;
	resolved?: boolean;
}

export interface CommentAnchorMeta {
	threadId: string;
	totalComments: number;
	unresolvedComments: number;
}

export type CommentThreadAction = 'open' | 'reply' | 'resolve';

export interface ExternalCommentThreadAction {
	threadId: string;
	action: Exclude<CommentThreadAction, 'open'>;
	token: number;
}

export interface TiptapEditorProps {
	/** Синхронизация ПКМ/порталов с пресетом окон (передаётся из UltimateDocEditor). */
	shellWindowStyle?: DesktopWindowStyle;
	/** Масштаб UI рабочего стола — ПКМ в `document.body` масштабируется как контент окна. */
	desktopUiScale?: number;
	initialContent?: string;
	editable?: boolean;
	documentId?: string; // For collaboration
	/** Tab/file/canonical id — suppress stale initialContent sync while typing. */
	documentSyncKey?: string;
	enableCollaboration?: boolean; // Enable Yjs collaboration
	/** Yjs не поднялся (нет y.Doc): выйти из режима коллаба и оставить обычный редактор */
	onCollaborationYjsFailed?: () => void;
	/** Статус live-синхронизации Yjs для панели коллаба (шаг C roadmap). */
	onYjsConnectionStatusChange?: (
		status: import('../utils/docEditorYjsConnectionStatus').DocEditorYjsConnectionStatus
	) => void;
	/** Increments on "jump to comment" to trigger a temporary visual anchor flash in editor */
	commentJumpFlashToken?: number;
	/** Inline comment anchors rendered as editor decorations */
	commentAnchors?: CommentAnchorRange[];
	/** Additional per-thread metadata for anchor tooltip UX */
	commentAnchorMeta?: Record<string, CommentAnchorMeta>;
	/** Focused comment thread id for stronger highlight */
	activeCommentThreadId?: string | null;
	/** Rich anchor action callback (open/reply/resolve) */
	onCommentAnchorAction?: (payload: {
		threadId: string;
		action: CommentThreadAction;
	}) => void;
	/** Called when user clicks an inline comment anchor in editor */
	onCommentAnchorClick?: (threadId: string) => void;
	/** For line-number highlighting: which collaborator is on which line (cursor_position.line) */
	activeCollaborators?: CollaboratorInfo[];
	/** Fast path: doc changed; heavy HTML sync is deferred in parent pipeline. */
	onDocumentChange?: (payload: {
		editor: Editor;
		transaction: import('@tiptap/pm/state').Transaction;
	}) => void;
	/** Sync boundary: flush pending analytical work (blur, save prep). */
	onDocumentFlush?: (payload: { editor: Editor }) => void;
	/** @deprecated Prefer onDocumentChange + versioned analytical pipeline. */
	onUpdate?: (content: string) => void;
	onSelectionUpdate?: (
		text: string,
		position: { from: number; to: number; line?: number; column?: number }
	) => void;
	onEditorReady?: (editor: Editor) => void;
	/** Clears parent-held editor ref when TipTap instance is destroyed or replaced. */
	onEditorUnmounted?: () => void;
}

export interface MonacoCodeEditorProps {
	code: string;
	language?: string;
	readOnly?: boolean;
	onChange?: (code: string) => void;
}

export interface AIAssistantPanelProps {
	isOpen: boolean;
	onClose: () => void;
	selectedText?: string;
	documentText?: string;
	documentId?: string;
	/** Документ из списка менеджера файлов (ещё не открыт в редакторе). */
	fileManagerDocumentContext?: AiFileManagerContext | null;
	onClearFileManagerDocumentContext?: () => void;
	onInsert: (text: string) => void;
	onReplace: (text: string) => void;
}

export interface AIGenerationMeta {
	requestId?: string;
	model?: string;
	actionMode?: 'rewrite' | 'expand' | 'summarize' | 'translate' | 'free';
	contextScope?: 'selection' | 'section' | 'document';
	provider?: string;
	generatedAt?: string;
	documentId?: string | null;
	promptHash?: string;
	contextHash?: string;
	responseHash?: string;
	usage?: Record<string, unknown>;
	policy?: {
		allowed?: boolean;
		warnings?: string[];
	};
}

export interface ImageGenerationPanelProps {
	isOpen: boolean;
	onClose: () => void;
	onInsertImage: (imageUrl: string) => void;
	/** dock — колонка редактора как AI; overlay — фиксированная панель поверх (legacy). */
	layout?: 'dock' | 'overlay';
}

export interface CollaborationPanelProps {
	isOpen: boolean;
	onClose: () => void;
	documentId: string;
	collaborators: CollaboratorInfo[];
	/** Connection state is managed by parent (header); panel only displays it */
	isConnected?: boolean;
	/** Connection error from parent (e.g. Socket.IO) */
	connectionError?: string;
	/** Yjs live-edit sync status (when collab session active). */
	yjsConnectionStatus?: import('../utils/docEditorYjsConnectionStatus').DocEditorYjsConnectionStatus;
	/** When user accepts an invite, open that document in the editor */
	onAcceptInvite?: (documentId: string) => void;
	/** Пользователь нажал «Подключиться» и сессия активна для этого документа */
	canSendInvites?: boolean;
	/** Текущий пользователь — владелец файла (kick) */
	isDocumentOwner?: boolean;
	mySocketId?: string | null;
	onKickParticipant?: (targetSocketId: string) => void;
}

export interface SearchPanelProps {
	isOpen: boolean;
	onClose: () => void;
	onSelectResult: (document: UltimateDocument) => void | Promise<void>;
}

// ========================================
// HOOK RETURN TYPES
// ========================================

export interface UseDocumentReturn {
	document: UltimateDocument | undefined;
	isLoading: boolean;
	error: string | undefined;
	createDocument: (
		title: string,
		content?: string
	) => Promise<UltimateDocument>;
	loadDocument: (id: string) => Promise<UltimateDocument>;
	updateDocument: (
		id: string,
		updates: Partial<UltimateDocument>
	) => Promise<UltimateDocument>;
	deleteDocument: (id: string) => Promise<void>;
	listDocuments: (params?: ListDocumentsParams) => Promise<UltimateDocument[]>;
}

export interface UseLlamaAIReturn {
	isStreaming: boolean;
	streamingText: string;
	error: string | undefined;
	completeText: (prompt: string, context?: string) => Promise<void>;
	completeTextStreaming: (
		prompt: string,
		context?: string,
		onChunk?: (chunk: string) => void,
		options?: {
			actionMode?: 'rewrite' | 'expand' | 'summarize' | 'translate' | 'free';
			contextScope?: 'selection' | 'section' | 'document';
			model?: string;
			documentId?: string;
		}
	) => Promise<{
		aborted: boolean;
		meta: AIGenerationMeta | null;
		partialText?: string;
	}>;
	stopStreaming: () => void;
	lastResponseMeta: AIGenerationMeta | null;
	analyzeDocument: (
		documentId: string,
		analysisType: string
	) => Promise<unknown>;
}

export interface UseComfyUIReturn {
	isGenerating: boolean;
	generatedImages: ImageGenerationResponse[];
	error: string | undefined;
	generateImage: (
		request: ImageGenerationRequest
	) => Promise<ImageGenerationResponse>;
	clearImages: () => void;
}

export interface UseCollaborationReturn {
	collaborators: CollaboratorInfo[];
	isConnected: boolean;
	error: string | undefined;
	join: (
		documentId: string,
		options?: { ownerUserId?: string }
	) => Promise<void>;
	leave: () => Promise<void>;
	updateCursor: (position: { line: number; column: number }) => void;
	/** Только для владельца документа: отключить участника по socket id из списка */
	kickParticipant: (targetSocketId: string) => void;
	/** Текущий socket id (совпадает с collaborator user_id в списке) */
	mySocketId: string | null;
}

export interface UseDocumentSearchReturn {
	results: SearchResult[];
	isSearching: boolean;
	error: string | undefined;
	search: (query: string, searchType: 'fulltext' | 'semantic') => Promise<void>;
	clearResults: () => void;
}

// ========================================
// CHARTS & DIAGRAMS TYPES
// ========================================

export type ChartType =
	| 'bar'
	| 'line'
	| 'pie'
	| 'doughnut'
	| 'area'
	| 'scatter'
	| 'radar'
	| 'bubble'
	| 'histogram'
	| 'heatmap';

export type DiagramType =
	| 'flowchart'
	| 'mindmap'
	| 'orgchart'
	| 'venn'
	| 'timeline'
	| 'gantt'
	| 'network'
	| 'sequence'
	| 'state'
	| 'er';

export interface ChartDataPoint {
	label: string;
	value: number;
	color?: string;
	metadata?: Record<string, unknown>;
}

export interface ChartDataset {
	label: string;
	/**
	 * Numeric values for each chart label. When populated with ChartDataPoint[] for legacy configs,
	 * data will be normalized to numbers internally.
	 */
	data: number[] | ChartDataPoint[];
	backgroundColor?: string | string[];
	borderColor?: string | string[];
	borderWidth?: number;
	fill?: boolean;
}

export interface ChartConfig {
	type: ChartType;
	title: string;
	labels: string[];
	datasets: ChartDataset[];
	options?: Record<string, unknown>;
}

export interface DiagramNode {
	id: string;
	label: string;
	type: 'rectangle' | 'circle' | 'diamond' | 'triangle' | 'hexagon';
	position: { x: number; y: number };
	size: { width: number; height: number };
	color?: string;
	style?: Record<string, unknown>;
	data?: Record<string, unknown>;
}

export interface DiagramEdge {
	id: string;
	source: string;
	target: string;
	label?: string;
	type: 'straight' | 'curved' | 'orthogonal';
	style?: Record<string, unknown>;
	data?: Record<string, unknown>;
}

export interface DiagramConfig {
	type: DiagramType;
	title: string;
	nodes: DiagramNode[];
	edges: DiagramEdge[];
	layout?: 'hierarchical' | 'circular' | 'force' | 'grid';
	theme?: 'default' | 'dark' | 'colorful';
	options?: Record<string, unknown>;
}

export interface ChartsDiagramsPanelProps {
	isOpen: boolean;
	onClose: () => void;
	onInsertChart: (chartHtml: string, chartConfig: ChartConfig) => void;
	onInsertDiagram: (diagramHtml: string, diagramConfig: DiagramConfig) => void;
}

// ========================================
// PDF PROCESSING TYPES
// ========================================

export interface PDFProcessingPanelProps {
	isOpen: boolean;
	onClose: () => void;
	onInsertProcessedPDF: (pdfHtml: string) => void;
}

// ========================================
// VOICE TRANSCRIPTION TYPES
// ========================================

export interface VoiceTranscriptionPanelProps {
	isOpen: boolean;
	onClose: () => void;
	onInsertTranscription: (transcription: string) => void;
	onInsertAudio: (audioHtml: string) => void;
}

// ========================================
// DOCUMENT TEMPLATES TYPES
// ========================================

export interface DocumentTemplate {
	id: string;
	name: string;
	description: string;
	category: 'business' | 'academic' | 'creative' | 'legal';
	content: string;
	tags: string[];
	previewImage?: string;
	estimatedTime: string;
	difficulty: 'easy' | 'medium' | 'hard';
	lifecycleState?: 'draft' | 'review' | 'published' | 'archived' | string;
	releaseVersion?: number;
	releaseChannel?: string;
	ownerUserId?: string | null;
	publishedAt?: string | null;
}

export interface DocumentTemplatesPanelProps {
	isOpen: boolean;
	onClose: () => void;
	onCreateFromTemplate?: (
		template: DocumentTemplate,
		mode?: 'replace' | 'insert' | 'append'
	) => void | Promise<void>;
}
