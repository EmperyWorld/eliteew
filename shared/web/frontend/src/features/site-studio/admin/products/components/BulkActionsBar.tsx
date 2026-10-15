import * as React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import {
	ClipboardDocumentCheckIcon,
	CubeIcon,
	CurrencyDollarIcon,
	PercentBadgeIcon,
	TagIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import { ModalAdvanced } from '@/components/ui/ModalAdvanced';

interface BulkActionsBarProps {
	selectedCount: number;
	selectedValue?: number;
	onClearSelection: () => void;
	onDelete: () => void;
	onUpdateStock: (inStock: boolean) => void;
	onUpdatePrice: (percentage: number) => void;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
	selectedCount,
	selectedValue = 0,
	onClearSelection,
	onDelete,
	onUpdateStock,
	onUpdatePrice,
}) => {
	const { t } = useTranslation('siteStudio');
	const [showPriceMenu, setShowPriceMenu] = useState(false);
	const [showCustomPercentModal, setShowCustomPercentModal] = useState(false);
	const [customPercentInput, setCustomPercentInput] = useState('');
	const priceMenuRef = useRef<HTMLDivElement>(null);
	const customPercentInputRef = useRef<HTMLInputElement>(null);
	const customPercentFieldId = useId();

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				priceMenuRef.current &&
				!priceMenuRef.current.contains(event.target as Node)
			) {
				setShowPriceMenu(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	useEffect(() => {
		if (showCustomPercentModal) {
			requestAnimationFrame(() => {
				customPercentInputRef.current?.focus();
				customPercentInputRef.current?.select();
			});
		}
	}, [showCustomPercentModal]);

	if (selectedCount === 0) return null;

	const closeCustomPercentModal = () => {
		setShowCustomPercentModal(false);
		setCustomPercentInput('');
	};

	const openCustomPercentModal = () => {
		setShowPriceMenu(false);
		setCustomPercentInput('');
		setShowCustomPercentModal(true);
	};

	const applyCustomPercent = () => {
		const raw = customPercentInput.trim().replace(',', '.');
		if (raw === '') {
			toast.error(t('adminCatalog.products.customPercentInvalid'));
			return;
		}
		const n = Number(raw);
		if (!Number.isFinite(n)) {
			toast.error(t('adminCatalog.products.customPercentInvalid'));
			return;
		}
		if (n === 0) {
			closeCustomPercentModal();
			return;
		}
		onUpdatePrice(n);
		closeCustomPercentModal();
	};

	return (
		<>
			<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 motion-reduce:animate-none">
				<div className="bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 rounded-2xl shadow-2xl shadow-black/30 border border-slate-700/50 backdrop-blur-xl">
					<div className="flex items-center gap-1 p-2">
						{/* Selection info */}
						<div className="flex items-center gap-3 px-3 border-r border-slate-700">
							<div className="relative">
								<div className="bg-linear-to-br from-primary-500 to-primary-600 text-white text-sm font-bold w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/40">
									{selectedCount}
								</div>
								<div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-400 rounded-full animate-ping motion-reduce:animate-none" />
							</div>
							<div className="hidden sm:block">
								<span className="text-sm font-medium text-slate-300">
									{t('adminCatalog.products.bulkBarSelected')}
								</span>
								{selectedValue > 0 && (
									<p className="text-xs text-emerald-400 font-semibold">
										{selectedValue.toLocaleString('ru-RU')} ₽
									</p>
								)}
							</div>
							<button
								type="button"
								onClick={onClearSelection}
								className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-[color,background-color,transform] duration-200 motion-reduce:transition-none hover:scale-110"
								aria-label={t('adminCatalog.products.bulkBarClearAria')}
							>
								<XMarkIcon width={14} height={14} />
							</button>
						</div>

						{/* Actions */}
						<div className="flex items-center gap-1.5 px-2">
							<Button
								size="sm"
								onClick={() => onUpdateStock(true)}
								className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 shadow-lg shadow-emerald-600/30 hover:shadow-emerald-500/40 transition-[color,background-color,transform,box-shadow] duration-200 motion-reduce:transition-none hover:scale-105"
							>
								<ClipboardDocumentCheckIcon
									width={14}
									height={14}
									className="mr-1.5"
								/>
								<span className="hidden sm:inline">
									{t('adminCatalog.products.bulkBarInStock')}
								</span>
								<span className="sm:hidden">
									{t('adminCatalog.products.bulkBarInStockShort')}
								</span>
							</Button>

							<Button
								size="sm"
								onClick={() => onUpdateStock(false)}
								className="bg-amber-600 hover:bg-amber-500 text-white border-0 shadow-lg shadow-amber-600/30 hover:shadow-amber-500/40 transition-[color,background-color,transform,box-shadow] duration-200 motion-reduce:transition-none hover:scale-105"
							>
								<CubeIcon width={14} height={14} className="mr-1.5" />
								<span className="hidden sm:inline">
									{t('adminCatalog.products.bulkBarOutOfStock')}
								</span>
								<span className="sm:hidden">
									{t('adminCatalog.products.bulkBarOutOfStockShort')}
								</span>
							</Button>

							<div className="relative" ref={priceMenuRef}>
								<Button
									size="sm"
									onClick={() => setShowPriceMenu(!showPriceMenu)}
									className="bg-slate-700 hover:bg-slate-600 text-white border-0 transition-[color,background-color,transform] duration-200 motion-reduce:transition-none hover:scale-105"
								>
									<TagIcon width={14} height={14} className="mr-1.5" />
									<span className="hidden sm:inline">
										{t('adminCatalog.products.bulkBarPrice')}
									</span>
									<span className="sm:hidden">
										{t('adminCatalog.products.bulkBarPriceShort')}
									</span>
								</Button>

								{showPriceMenu && (
									<div className="absolute bottom-full left-0 mb-2 bg-slate-800 rounded-xl shadow-xl border border-slate-700 py-1 min-w-40 overflow-hidden">
										<div className="px-3 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider">
											{t('adminCatalog.products.bulkBarPriceMenuTitle')}
										</div>
										<button
											type="button"
											onClick={() => {
												onUpdatePrice(10);
												setShowPriceMenu(false);
											}}
											className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-400 hover:bg-slate-700 transition-colors motion-reduce:transition-none"
										>
											<PercentBadgeIcon width={14} height={14} />{' '}
											{t('adminCatalog.products.bulkPricePlus10')}
										</button>
										<button
											type="button"
											onClick={() => {
												onUpdatePrice(20);
												setShowPriceMenu(false);
											}}
											className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-400 hover:bg-slate-700 transition-colors motion-reduce:transition-none"
										>
											<PercentBadgeIcon width={14} height={14} />{' '}
											{t('adminCatalog.products.bulkPricePlus20')}
										</button>
										<button
											type="button"
											onClick={() => {
												onUpdatePrice(-10);
												setShowPriceMenu(false);
											}}
											className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors motion-reduce:transition-none"
										>
											<PercentBadgeIcon width={14} height={14} />{' '}
											{t('adminCatalog.products.bulkPriceMinus10')}
										</button>
										<button
											type="button"
											onClick={() => {
												onUpdatePrice(-20);
												setShowPriceMenu(false);
											}}
											className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors motion-reduce:transition-none"
										>
											<PercentBadgeIcon width={14} height={14} />{' '}
											{t('adminCatalog.products.bulkPriceMinus20')}
										</button>
										<hr className="my-1 border-slate-700" />
										<button
											type="button"
											onClick={openCustomPercentModal}
											className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors motion-reduce:transition-none"
										>
											<CurrencyDollarIcon width={14} height={14} />{' '}
											{t('adminCatalog.products.bulkPriceCustom')}
										</button>
									</div>
								)}
							</div>

							<div className="w-px h-6 bg-slate-700 mx-1" />

							<Button
								size="sm"
								className="bg-red-600 hover:bg-red-500 text-white border-0 shadow-lg shadow-red-600/30 hover:shadow-red-500/40 transition-[color,background-color,transform,box-shadow] duration-200 motion-reduce:transition-none hover:scale-105"
								onClick={onDelete}
							>
								<TrashIcon width={14} height={14} className="mr-1.5" />
								<span className="hidden sm:inline">
									{t('adminCatalog.products.bulkBarDelete')}
								</span>
								<span className="sm:hidden">
									{t('adminCatalog.products.bulkBarDeleteShort')}
								</span>
							</Button>
						</div>
					</div>
				</div>
			</div>

			<ModalAdvanced
				isOpen={showCustomPercentModal}
				onClose={closeCustomPercentModal}
				title={t('adminCatalog.products.customPercentModalTitle')}
				variant="solid"
				size="sm"
				animation="zoom"
				footer={
					<>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={closeCustomPercentModal}
							className="border-white/20 text-white hover:bg-white/10"
						>
							{t('adminCatalog.common.cancel')}
						</Button>
						<Button
							type="button"
							variant="primary"
							size="sm"
							onClick={applyCustomPercent}
						>
							{t('adminCatalog.products.customPercentApply')}
						</Button>
					</>
				}
			>
				<p
					id={`${customPercentFieldId}-hint`}
					className="text-sm text-white/70 mb-4"
				>
					{t('adminCatalog.products.customPercentModalHint')}
				</p>
				<label
					htmlFor={customPercentFieldId}
					className="block text-sm font-medium text-white/90 mb-2"
				>
					{t('adminCatalog.products.customPercentLabel')}
				</label>
				<Input
					ref={customPercentInputRef}
					id={customPercentFieldId}
					type="text"
					inputMode="decimal"
					autoComplete="off"
					aria-describedby={`${customPercentFieldId}-hint`}
					placeholder={t('adminCatalog.products.customPercentPlaceholder')}
					value={customPercentInput}
					onChange={(e) => setCustomPercentInput(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							applyCustomPercent();
						}
					}}
					className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
				/>
			</ModalAdvanced>
		</>
	);
};
