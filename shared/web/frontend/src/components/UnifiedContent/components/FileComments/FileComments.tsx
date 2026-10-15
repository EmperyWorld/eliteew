/**
 * FileComments - Комментарии к файлам
 *
 * Функции:
 * - Просмотр комментариев
 * - Добавление комментариев
 * - Удаление своих комментариев
 */

import { useNotifications } from '@/notifications';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import { cn } from '@/utils/cn';
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppStatusBadge,
} from '../../../../pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '../../../../pages/Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '../../../../pages/Desktop/utils/desktopVisualSystem';
import {
	contentApi,
	extractContentComments,
	toContentError,
	type ContentComment,
} from '../../../../services/contentApi';
import type { Content } from '../../types';
import {
	ArrowPathIcon,
	ChatBubbleLeftRightIcon,
	PaperAirplaneIcon,
	TrashIcon,
	UserIcon,
} from '@heroicons/react/24/outline';

const COMMENT_INPUT_ID = 'file-comments-composer-input';
const COMMENT_HEADING_ID = 'file-comments-heading';
const COMMENT_THREAD_ID = 'file-comments-thread';
const COMMENT_HINT_ID = 'file-comments-composer-hint';

/** Highlight @mentions in plain text (stored as plain string on the server). */
function renderCommentWithMentions(text: string): React.ReactNode {
	const parts = text.split(/(@[^\s@]+)/g);
	let offset = 0;
	return parts.map((part) => {
		const key = `c${offset}`;
		offset += part.length;
		if (part.startsWith('@') && part.length > 1) {
			return (
				<span
					key={key}
					className="font-medium text-[rgb(var(--desktop-accent-rgb))]"
				>
					{part}
				</span>
			);
		}
		return <span key={key}>{part}</span>;
	});
}

interface FileCommentsProps {
	content: Content;
	currentUserId: string;
	onUpdate?: () => void;
}

export const FileComments: React.FC<FileCommentsProps> = ({
	content,
	currentUserId,
	onUpdate,
}) => {
	const { t } = useTranslation('contentManager');
	const { toast } = useNotifications();
	const shellFrame = useDesktopShellFrame();
	const shellContentPanelClass = useMemo(
		() => getDesktopShellContentPanelClassName(shellFrame),
		[shellFrame]
	);
	const commentComposerClass = useMemo(
		() =>
			cn(
				'min-h-21 w-full resize-none rounded-(--desktop-radius) px-3 py-2.5 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim)',
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				DESKTOP_CHROME_FOCUS_VISIBLE
			),
		[shellFrame]
	);
	const [comments, setComments] = useState<ContentComment[]>([]);
	const [newComment, setNewComment] = useState('');
	const [loadingCommentId, setLoadingCommentId] = useState<string | null>(null);
	const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<
		string | null
	>(null);
	const [sending, setSending] = useState(false);
	const threadScrollRef = useRef<HTMLDivElement>(null);

	const trimmedComment = useMemo(() => newComment.trim(), [newComment]);
	const canSubmit = trimmedComment.length > 0 && !sending;

	useEffect(() => {
		setComments(extractContentComments(content));
	}, [content]);

	useLayoutEffect(() => {
		const el = threadScrollRef.current;
		if (!el || comments.length === 0) {
			return;
		}
		el.scrollTop = el.scrollHeight;
	}, [comments]);

	const handleAddComment = async (): Promise<void> => {
		if (!trimmedComment) {
			return;
		}

		setSending(true);
		try {
			const updatedContent = await contentApi.addComment(
				content.id,
				trimmedComment
			);
			setComments(extractContentComments(updatedContent));
			setNewComment('');

			if (onUpdate) {
				onUpdate();
			}
		} catch (error: unknown) {
			const errorMessage = toContentError(error, 'Unknown error');
			toast.error('Ошибка добавления комментария', errorMessage);
		} finally {
			setSending(false);
		}
	};

	const executeDeleteComment = async (): Promise<void> => {
		const commentId = pendingDeleteCommentId;
		if (!commentId) {
			return;
		}

		setLoadingCommentId(commentId);
		try {
			const updatedContent = await contentApi.deleteComment(
				content.id,
				commentId
			);
			setComments(extractContentComments(updatedContent));

			if (onUpdate) {
				onUpdate();
			}
		} catch (error: unknown) {
			const errorMessage = toContentError(error, 'Unknown error');
			toast.error('Ошибка удаления комментария', errorMessage);
			throw error instanceof Error ? error : new Error(String(errorMessage));
		} finally {
			setLoadingCommentId(null);
		}
	};

	return (
		<section className="space-y-4" aria-labelledby={COMMENT_HEADING_ID}>
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<ChatBubbleLeftRightIcon
						className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb))]"
						aria-hidden
					/>
					<h3
						id={COMMENT_HEADING_ID}
						className="text-sm font-semibold text-(--desktop-text-primary)"
					>
						Комментарии
					</h3>
				</div>
				<DesktopAppStatusBadge
					className="tabular-nums"
					aria-label={`Всего комментариев: ${comments.length}`}
				>
					{comments.length}
				</DesktopAppStatusBadge>
			</div>

			<div
				className={cn(
					shellContentPanelClass,
					'flex max-h-80 min-h-0 flex-col overflow-hidden p-3'
				)}
			>
				<section
					ref={threadScrollRef}
					id={COMMENT_THREAD_ID}
					aria-label="Лента комментариев"
					className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth"
				>
					<AnimatePresence>
						{comments.length === 0 ? (
							<DesktopAppEmptyState
								icon={
									<ChatBubbleLeftRightIcon
										className="h-8 w-8 text-(--desktop-text-dim)"
										aria-hidden
									/>
								}
								title="Комментариев пока нет"
								description="Оставьте заметку к файлу, чтобы быстро вернуться к контексту позже. В тексте можно отметить человека фрагментом вида @имя — это останется обычным текстом, но будет выделено в списке."
								className="py-8"
							/>
						) : (
							<div className="flex flex-col gap-4 pr-0.5">
								{comments.map((comment) => (
									<motion.article
										key={comment.id}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -10 }}
										aria-label={`Комментарий от ${comment.user_id === currentUserId ? 'вас' : 'пользователя'}, ${new Date(comment.created_at).toLocaleString('ru-RU')}`}
										className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3.5"
									>
										<div className="flex items-start justify-between gap-2">
											<div className="flex-1 min-w-0">
												<div className="mb-1 flex items-center gap-2">
													<UserIcon
														className="h-4 w-4 shrink-0 text-(--desktop-text-dim)"
														aria-hidden
													/>
													<DesktopAppStatusBadge className="border-white/10 bg-white/5 text-(--desktop-text-secondary)">
														{comment.user_id === currentUserId
															? 'Вы'
															: 'Пользователь'}
													</DesktopAppStatusBadge>
													<time
														className="text-xs tabular-nums text-(--desktop-text-dim)"
														dateTime={comment.created_at}
													>
														{new Date(comment.created_at).toLocaleString(
															'ru-RU'
														)}
													</time>
												</div>
												<p className="whitespace-pre-wrap wrap-break-word text-sm text-(--desktop-text-secondary)">
													{renderCommentWithMentions(comment.text)}
												</p>
											</div>
											{(comment.user_id === currentUserId ||
												content.user_id === currentUserId) && (
												<DesktopAppButton
													type="button"
													onClick={() => setPendingDeleteCommentId(comment.id)}
													disabled={loadingCommentId === comment.id}
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-red-300 hover:bg-red-500/10 hover:text-red-100"
													title="Удалить комментарий"
													aria-label="Удалить комментарий"
												>
													{loadingCommentId === comment.id ? (
														<ArrowPathIcon className="h-4 w-4 animate-spin" />
													) : (
														<TrashIcon className="h-4 w-4" />
													)}
												</DesktopAppButton>
											)}
										</div>
									</motion.article>
								))}
							</div>
						)}
					</AnimatePresence>
				</section>
			</div>

			<div className={cn(shellContentPanelClass, 'min-h-0 space-y-3 p-4')}>
				<label htmlFor={COMMENT_INPUT_ID} className="sr-only">
					Текст нового комментария
				</label>
				<textarea
					id={COMMENT_INPUT_ID}
					value={newComment}
					onChange={(e) => setNewComment(e.target.value)}
					placeholder="Добавить комментарий… @имя — по желанию"
					aria-describedby={COMMENT_HINT_ID}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canSubmit) {
							e.preventDefault();
							void handleAddComment();
						}
					}}
					rows={3}
					className={commentComposerClass}
				/>
				<div className="flex items-center justify-between gap-2">
					<p id={COMMENT_HINT_ID} className="text-xs text-(--desktop-text-dim)">
						Ctrl+Enter или ⌘+Enter для отправки. Пустые и пробельные сообщения
						не отправляются.
					</p>
					<DesktopAppButton
						type="button"
						variant="accent"
						size="sm"
						onClick={() => {
							void handleAddComment();
						}}
						disabled={!canSubmit}
						aria-busy={sending}
						aria-label={
							canSubmit
								? 'Отправить комментарий'
								: sending
									? 'Отправка комментария'
									: 'Отправка недоступна: введите текст комментария'
						}
						title={
							canSubmit
								? 'Отправить (Ctrl+Enter)'
								: sending
									? 'Отправка…'
									: 'Сначала введите текст'
						}
					>
						{sending ? (
							<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
						) : (
							<PaperAirplaneIcon className="h-4 w-4" aria-hidden />
						)}
						{sending ? 'Отправка...' : 'Отправить'}
					</DesktopAppButton>
				</div>
			</div>

			<ConfirmDeleteModal
				isOpen={pendingDeleteCommentId !== null}
				onClose={() => setPendingDeleteCommentId(null)}
				onConfirm={executeDeleteComment}
				title={t('fileComments.deleteModalTitle')}
				warningMessage={t('fileComments.deleteModalWarning')}
				cancelButtonLabel={t('fileComments.deleteModalCancel')}
				confirmButtonLabel={t('fileComments.deleteModalConfirm')}
				confirmButtonLoadingLabel={t('fileComments.deleteModalDeleting')}
			/>
		</section>
	);
};

export default FileComments;
