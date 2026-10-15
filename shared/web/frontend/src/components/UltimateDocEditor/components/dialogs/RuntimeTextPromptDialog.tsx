import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import {
	useEffect,
	useId,
	useRef,
	useState,
	type ComponentType,
	type SVGProps,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppModalFrame,
	DesktopAppPanel,
	DesktopAppSectionLabel,
} from '../../../../pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_OVERLAY } from '../../../../pages/Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '../../../../pages/Desktop/context/DesktopWindowPortalStackContext';
import { useRuntimeDialogFocusTrap } from '../../hooks/useRuntimeDialogFocusTrap';
import { cn } from '@/utils/cn';

interface RuntimeTextPromptDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (value: string) => void;
	title: string;
	description: string;
	label: string;
	placeholder: string;
	submitLabel: string;
	initialValue?: string;
	icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const RuntimeTextPromptDialog: React.FC<
	RuntimeTextPromptDialogProps
> = ({
	isOpen,
	onClose,
	onSubmit,
	title,
	description,
	label,
	placeholder,
	submitLabel,
	initialValue = '',
	icon: Icon,
}) => {
	const { t } = useTranslation('ultimateDocEditor');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const dialogTitleId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const [value, setValue] = useState(initialValue);
	const [error, setError] = useState<string | null>(null);

	useRuntimeDialogFocusTrap(isOpen, panelRef);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		setValue(initialValue);
		setError(null);
	}, [initialValue, isOpen]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handleEscape = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		document.addEventListener('keydown', handleEscape, true);
		return (): void => {
			document.removeEventListener('keydown', handleEscape, true);
		};
	}, [isOpen, onClose]);

	const handleSubmit = (event: React.FormEvent): void => {
		event.preventDefault();

		const trimmedValue = value.trim();
		if (!trimmedValue) {
			setError(t('textPrompt.errorRequired'));
			return;
		}

		onSubmit(trimmedValue);
	};

	return (
		<AnimatePresence>
			{isOpen ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className={cn(
						'fixed inset-0 flex items-center justify-center p-4',
						DESKTOP_OVERLAY.backdrop
					)}
					style={{ zIndex: embeddedModalZ.backdrop }}
					onClick={onClose}
				>
					<motion.div
						ref={panelRef}
						role="dialog"
						aria-modal="true"
						aria-labelledby={dialogTitleId}
						initial={{ opacity: 0, scale: 0.96, y: 16 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 16 }}
						transition={{ duration: 0.18 }}
						className="w-full max-w-md"
						style={{ zIndex: embeddedModalZ.content }}
						onClick={(event) => event.stopPropagation()}
					>
						<DesktopAppModalFrame
							onClose={onClose}
							title={
								<div
									id={dialogTitleId}
									className="flex min-w-0 items-center gap-3"
								>
									<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent) text-white shadow-(--desktop-shadow-panel)">
										<Icon width={18} height={18} />
									</span>
									<span className="truncate">{title}</span>
								</div>
							}
							className="max-w-none border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) text-(--desktop-text-primary) shadow-(--desktop-shadow-panel)"
						>
							<form className="space-y-4 p-4" onSubmit={handleSubmit}>
								<p className="text-sm leading-relaxed text-(--desktop-text-secondary)">
									{description}
								</p>
								<div className="space-y-2">
									<DesktopAppSectionLabel>{label}</DesktopAppSectionLabel>
									<DesktopAppInput
										value={value}
										onChange={(event) => {
											setValue(event.target.value);
											setError(null);
										}}
										placeholder={placeholder}
										autoFocus
									/>
								</div>
								{error ? (
									<DesktopAppPanel
										role="alert"
										className="border-[color-mix(in_oklab,var(--desktop-border-subtle),#f87171_35%)] bg-[color-mix(in_oklab,var(--desktop-surface-soft),#7f1d1d_22%)] px-3 py-2 text-sm text-(--desktop-text-primary)"
									>
										{error}
									</DesktopAppPanel>
								) : null}
								<div className="flex items-center justify-end gap-2 pt-2">
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={onClose}
									>
										{t('textPrompt.cancel')}
									</DesktopAppButton>
									<DesktopAppButton
										type="submit"
										variant="accent"
										size="sm"
										className="px-5"
									>
										{submitLabel}
									</DesktopAppButton>
								</div>
							</form>
						</DesktopAppModalFrame>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
};
