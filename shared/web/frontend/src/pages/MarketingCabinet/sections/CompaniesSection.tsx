import {
	ArrowPathIcon,
	ArrowTopRightOnSquareIcon,
	ClipboardDocumentIcon,
	PaintBrushIcon,
	PencilSquareIcon,
	PlusIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { FriendPicker } from '@/features/friends/components/FriendPicker';
import {
	FriendAvatar,
	getFriendDisplayName,
} from '@/features/friends/components/FriendAvatar';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppInput,
	DesktopAppListRow,
	DesktopAppSectionLabel,
} from '../../Desktop/components/DesktopAppChrome';
import { cabinetNotify } from '../cabinetNotify';
import { FieldLabel } from '../components/FieldLabel';
import { LoadingGrid } from '../components/LoadingGrid';
import { MarketingCabinetSelect } from '../components/MarketingCabinetSelect';
import { MarketingCabinetVirtualNavList } from '../components/MarketingCabinetVirtualNavList';
import { SectionPanel } from '../components/SectionPanel';
import {
	INPUT_STACK_CLASS,
	MARKETING_FOUNDATION_LIST_FETCH_LIMIT,
	TEXTAREA_CLASS,
	type MarketingView,
} from '../constants';
import { useMarketingShellClasses } from '../hooks/useMarketingShellClasses';
import type {
	MutationLike,
	QueryLike,
} from '../marketingCabinetPage/marketingCabinetComposeHosts';
import type { CompanyFormState } from '../marketingCabinetPageTypes';
import type { MarketingCompany } from '../marketingCabinetApi';
import { copyToClipboard, extractApiErrorMessage, isValidUrl } from '../utils';

export type MarketingDeleteModalSetter = React.Dispatch<
	React.SetStateAction<{
		type:
			| 'company'
			| 'project'
			| 'job'
			| 'valueProp'
			| 'competitor'
			| 'research'
			| 'swot';
		id: string;
		name: string;
	} | null>
>;

export interface CompaniesSectionProps {
	companiesQuery: QueryLike<MarketingCompany[]>;
	companies: MarketingCompany[];
	filteredCompanies: MarketingCompany[];
	selectedCompanyId: string | null;
	setSelectedCompanyId: React.Dispatch<React.SetStateAction<string | null>>;
	selectedCompany: MarketingCompany | null;
	companySearch: string;
	setCompanySearch: React.Dispatch<React.SetStateAction<string>>;
	debouncedCompanySearch: string;
	editingCompany: MarketingCompany | null;
	setEditingCompany: React.Dispatch<
		React.SetStateAction<MarketingCompany | null>
	>;
	creatingCompany: boolean;
	setCreatingCompany: React.Dispatch<React.SetStateAction<boolean>>;
	companyForm: CompanyFormState;
	setCompanyForm: React.Dispatch<React.SetStateAction<CompanyFormState>>;
	companySizeSelectOptions: Array<{ value: string; label: string }>;
	createCompanyMutation: MutationLike;
	updateCompanyMutation: MutationLike;
	handleCreateCompany: (event: React.FormEvent) => void;
	friendsListQuery: QueryLike<import('@/features/friends/types').Friend[]>;
	getFriendDisplayNameFn: typeof getFriendDisplayName;
	friendMetaForMemberUserId: (userId: string) =>
		| import('@/features/friends/types').Friend
		| undefined
		| {
				id: string;
				username: string | null;
				avatar_url: string | null;
				full_name: string | null;
		  };
	canManageSelectedCompany: boolean;
	setActiveView: (view: MarketingView) => void;
	setDeleteModal: MarketingDeleteModalSetter;
}

export function CompaniesSection(props: CompaniesSectionProps) {
	const { t } = useTranslation('marketing');
	const { checkboxControl } = useMarketingShellClasses();
	const {
		companiesQuery,
		companies,
		filteredCompanies,
		selectedCompanyId,
		setSelectedCompanyId,
		selectedCompany,
		companySearch,
		setCompanySearch,
		debouncedCompanySearch,
		editingCompany,
		setEditingCompany,
		creatingCompany,
		setCreatingCompany,
		companyForm,
		setCompanyForm,
		companySizeSelectOptions,
		createCompanyMutation,
		updateCompanyMutation,
		handleCreateCompany,
		friendsListQuery,
		getFriendDisplayNameFn,
		friendMetaForMemberUserId,
		canManageSelectedCompany,
		setActiveView,
		setDeleteModal,
	} = props;
	const showCompanyForm = Boolean(editingCompany || creatingCompany);
	const companiesAtFetchCap =
		companies.length >= MARKETING_FOUNDATION_LIST_FETCH_LIMIT;
	const companySizeLabel =
		companySizeSelectOptions.find(
			(o) => o.value === (selectedCompany?.size ?? 'small')
		)?.label ?? t('common.na');

	return (
		<div className="mc-section-root mx-auto space-y-6">
			<div className="grid gap-6 xl:grid-cols-[1.15fr_1fr] xl:gap-6">
				<SectionPanel
					title={t('cabinetPage.setup.companiesTitle')}
					helpBlockId="companies.list"
					actions={
						<div className="flex flex-wrap items-center gap-2">
							<DesktopAppInput
								placeholder={t('cabinetPage.setup.companySearchPlaceholder')}
								value={companySearch}
								onChange={(e) => setCompanySearch(e.target.value)}
								aria-label={t('cabinetPage.setup.companySearchAria')}
								className="w-56 min-w-0"
							/>
							{companySearch.trim() ? (
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setCompanySearch('')}
									aria-label={t('evidenceView.clearSearchAria')}
								>
									<PaintBrushIcon
										className="h-3.5 w-3.5"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								</DesktopAppButton>
							) : null}
							<DesktopAppButton
								type="button"
								variant="accent"
								size="sm"
								onClick={() => {
									setCreatingCompany(true);
									setEditingCompany(null);
									setCompanyForm({
										name: '',
										industry: '',
										website: '',
										description: '',
										size: 'small',
										representativeUserId: null,
										representativeDeferred: true,
									});
								}}
								aria-label={t('cabinetPage.companiesPage.createCompanyAria')}
							>
								<PlusIcon
									className="h-3.5 w-3.5"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
								{t('cabinetPage.companiesPage.createCompanyButton')}
							</DesktopAppButton>
						</div>
					}
				>
					<div className="space-y-2">
						{companiesQuery.isLoading ? (
							<LoadingGrid />
						) : companiesQuery.isError ? (
							<DesktopAppErrorState
								message={extractApiErrorMessage(
									companiesQuery.error,
									t('cabinetPage.setup.loadCompaniesError')
								)}
								onAction={() => void companiesQuery.refetch()}
							/>
						) : filteredCompanies.length > 0 ? (
							<>
								{companiesAtFetchCap ? (
									<p
										className={cn(
											'mc-meta-caption mb-2',
											DESKTOP_TYPOGRAPHY.meta
										)}
									>
										{t('cabinetPage.listFetchSummaryTruncated', {
											shown: companies.length,
											total: companies.length,
										})}
									</p>
								) : null}
								<MarketingCabinetVirtualNavList
									items={filteredCompanies}
									estimateSize={() => 72}
									getItemKey={(index) =>
										filteredCompanies[index]?.id ?? `company-${index}`
									}
									renderItem={(company) => (
										<DesktopAppListRow
											active={company.id === selectedCompanyId}
											onClick={() => {
												setSelectedCompanyId(company.id);
												setCreatingCompany(false);
												setEditingCompany(null);
											}}
											className="rounded-(--desktop-radius) border border-transparent px-3 py-2.5"
										>
											<div className="flex min-w-0 flex-1 items-center justify-between gap-3">
												<div className="min-w-0">
													<div
														className="truncate text-sm font-medium text-(--desktop-text-primary)"
														title={company.name}
													>
														{company.name}
													</div>
													<div
														className={cn(DESKTOP_TYPOGRAPHY.meta, 'truncate')}
														title={company.website || company.slug || undefined}
													>
														{company.industry ||
															t('cabinetPage.setup.industryNotSet')}{' '}
														· {company.website || company.slug}
													</div>
												</div>
												<div className="flex items-center gap-1">
													{company.website ? (
														<>
															<DesktopAppButton
																type="button"
																variant="ghost"
																size="icon"
																onClick={(event) => {
																	event.stopPropagation();
																	const w = company.website;
																	if (!w) return;
																	const url = w.startsWith('http')
																		? w
																		: `https://${w}`;
																	window.open(
																		url,
																		'_blank',
																		'noopener,noreferrer'
																	);
																}}
																aria-label={t(
																	'cabinetPage.setup.openWebsiteAria',
																	{
																		name: company.name,
																	}
																)}
															>
																<ArrowTopRightOnSquareIcon
																	className="h-4 w-4"
																	strokeWidth={DESKTOP_LUCIDE.stroke}
																/>
															</DesktopAppButton>
															<DesktopAppButton
																type="button"
																variant="ghost"
																size="icon"
																onClick={async (event) => {
																	event.stopPropagation();
																	const w = company.website;
																	if (!w) return;
																	const ok = await copyToClipboard(w);
																	if (ok)
																		cabinetNotify.success(
																			t('toolbar.linkCopied')
																		);
																	else
																		cabinetNotify.error(
																			t('toolbar.idCopyFailed')
																		);
																}}
																aria-label={t(
																	'cabinetPage.setup.copyWebsiteAria',
																	{
																		name: company.name,
																	}
																)}
															>
																<ClipboardDocumentIcon
																	className="h-4 w-4"
																	strokeWidth={DESKTOP_LUCIDE.stroke}
																/>
															</DesktopAppButton>
														</>
													) : null}
													<DesktopAppButton
														type="button"
														variant="ghost"
														size="icon"
														onClick={(event) => {
															event.stopPropagation();
															setCreatingCompany(false);
															setEditingCompany(company);
														}}
														aria-label={t('cabinetPage.setup.editEntityAria', {
															name: company.name,
														})}
													>
														<PencilSquareIcon
															className="h-4 w-4"
															strokeWidth={DESKTOP_LUCIDE.stroke}
														/>
													</DesktopAppButton>
													<DesktopAppButton
														type="button"
														variant="ghost"
														size="icon"
														onClick={(event) => {
															event.stopPropagation();
															setDeleteModal({
																type: 'company',
																id: company.id,
																name: company.name,
															});
														}}
														aria-label={t(
															'cabinetPage.setup.deleteEntityAria',
															{
																name: company.name,
															}
														)}
													>
														<TrashIcon
															className="h-4 w-4"
															strokeWidth={DESKTOP_LUCIDE.stroke}
														/>
													</DesktopAppButton>
												</div>
											</div>
										</DesktopAppListRow>
									)}
								/>
							</>
						) : companies.length > 0 ? (
							<DesktopAppEmptyState
								title={t('cabinetPage.setup.companiesSearchEmptyTitle')}
								description={t(
									'cabinetPage.setup.companiesSearchEmptyDescription',
									{ query: debouncedCompanySearch }
								)}
							/>
						) : (
							<DesktopAppEmptyState
								title={t('cabinetPage.setup.companiesEmptyTitle')}
								description={t('cabinetPage.setup.companiesEmptyDescription')}
							/>
						)}
					</div>
				</SectionPanel>

				{showCompanyForm ? (
					<SectionPanel
						title={
							editingCompany
								? t('cabinetPage.setup.companyFormEditTitle')
								: t('cabinetPage.setup.companyFormCreateTitle')
						}
						description={
							editingCompany
								? t('cabinetPage.setup.companyFormEditDescription')
								: t('cabinetPage.setup.companyFormCreateDescription')
						}
						helpBlockId="companies.form"
					>
						<form className="space-y-3" onSubmit={handleCreateCompany}>
							<FieldLabel
								label={t('cabinetPage.setup.fieldCompanyName')}
								required
							>
								<DesktopAppInput
									value={companyForm.name}
									onChange={(event) =>
										setCompanyForm((prev) => ({
											...prev,
											name: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.setup.phCompanyName')}
								/>
							</FieldLabel>
							<div className={INPUT_STACK_CLASS}>
								<FieldLabel label={t('cabinetPage.setup.fieldIndustry')}>
									<DesktopAppInput
										value={companyForm.industry}
										onChange={(event) =>
											setCompanyForm((prev) => ({
												...prev,
												industry: event.target.value,
											}))
										}
										placeholder={t('cabinetPage.setup.phIndustry')}
									/>
								</FieldLabel>
								<FieldLabel label={t('cabinetPage.setup.fieldCompanySize')}>
									<MarketingCabinetSelect
										value={companyForm.size}
										onChange={(v) =>
											setCompanyForm((prev) => ({ ...prev, size: v }))
										}
										options={companySizeSelectOptions}
									/>
								</FieldLabel>
							</div>
							<FieldLabel label={t('cabinetPage.setup.fieldWebsite')}>
								<DesktopAppInput
									value={companyForm.website}
									onChange={(event) =>
										setCompanyForm((prev) => ({
											...prev,
											website: event.target.value,
										}))
									}
									placeholder="https://site.ru"
									aria-invalid={
										companyForm.website.trim()
											? !isValidUrl(companyForm.website)
											: undefined
									}
								/>
								{companyForm.website.trim() &&
								!isValidUrl(companyForm.website) ? (
									<span className="mt-1 block text-xs text-[rgb(var(--desktop-accent-rgb)/0.92)]">
										{t('cabinetPage.setup.websiteHintInvalid')}
									</span>
								) : null}
							</FieldLabel>
							<FieldLabel label={t('cabinetPage.setup.fieldDescription')}>
								<textarea
									className={TEXTAREA_CLASS}
									value={companyForm.description}
									onChange={(event) =>
										setCompanyForm((prev) => ({
											...prev,
											description: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.setup.phCompanyDescription')}
								/>
							</FieldLabel>
							<div className="space-y-2 border-t border-(--desktop-border-subtle)/40 pt-3">
								<label className="flex cursor-pointer items-center gap-2 text-sm text-(--desktop-text-primary)">
									<input
										type="checkbox"
										className={checkboxControl}
										checked={companyForm.representativeDeferred}
										onChange={(e) => {
											const checked = e.target.checked;
											setCompanyForm((prev) => ({
												...prev,
												representativeDeferred: checked,
												...(checked ? { representativeUserId: null } : {}),
											}));
										}}
									/>
									{t('cabinetPage.setup.representativeDeferredLabel')}
								</label>
								{!companyForm.representativeDeferred ? (
									<>
										<FieldLabel
											label={t('cabinetPage.setup.fieldClientRepresentative')}
										>
											<FriendPicker
												className="max-h-40 overflow-y-auto rounded-md border border-(--desktop-border-subtle)/50 p-1"
												title={t('cabinetPage.setup.representativePickerTitle')}
												friends={friendsListQuery.data ?? []}
												loading={friendsListQuery.isLoading}
												error={
													friendsListQuery.isError
														? (friendsListQuery.error?.message ?? null)
														: null
												}
												emptyMessage={t(
													'cabinetPage.setup.representativePickerEmpty'
												)}
												onPick={(friend) =>
													setCompanyForm((prev) => ({
														...prev,
														representativeUserId: friend.id,
														representativeDeferred: false,
													}))
												}
											/>
										</FieldLabel>
										{companyForm.representativeUserId ? (
											<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
												{t('cabinetPage.setup.representativeSelected', {
													name: (() => {
														const f = friendsListQuery.data?.find(
															(x) => x.id === companyForm.representativeUserId
														);
														return f
															? getFriendDisplayNameFn(f.username, f.full_name)
															: companyForm.representativeUserId;
													})(),
												})}
											</p>
										) : null}
									</>
								) : null}
							</div>
							<div className="flex gap-2">
								{editingCompany || creatingCompany ? (
									<DesktopAppButton
										type="button"
										variant="ghost"
										onClick={() => {
											setEditingCompany(null);
											setCreatingCompany(false);
										}}
									>
										{t('common.cancel')}
									</DesktopAppButton>
								) : null}
								<DesktopAppButton
									type="submit"
									variant="accent"
									disabled={
										createCompanyMutation.isPending ||
										updateCompanyMutation.isPending ||
										!companyForm.name.trim()
									}
								>
									{createCompanyMutation.isPending ||
									updateCompanyMutation.isPending ? (
										<ArrowPathIcon
											className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									) : !editingCompany ? (
										<PlusIcon
											className="h-4 w-4"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									) : null}
									{editingCompany
										? t('cabinetPage.setup.saveCompany')
										: t('cabinetPage.setup.createCompany')}
								</DesktopAppButton>
							</div>
						</form>
					</SectionPanel>
				) : selectedCompany ? (
					<SectionPanel
						title={selectedCompany.name}
						description={t('cabinetPage.companiesPage.companyCardDescription')}
						helpBlockId="companies.detail"
						actions={
							<div className="flex flex-wrap items-center gap-2">
								<DesktopAppButton
									type="button"
									variant="accent"
									size="sm"
									onClick={() => setActiveView('projects')}
								>
									{t('cabinetPage.companiesPage.goToProjects')}
								</DesktopAppButton>
							</div>
						}
					>
						<div className="space-y-4">
							<div className="grid gap-3 sm:grid-cols-2">
								<div>
									<DesktopAppSectionLabel>
										{t('cabinetPage.setup.fieldIndustry')}
									</DesktopAppSectionLabel>
									<p className="text-sm text-(--desktop-text-primary)">
										{selectedCompany.industry?.trim() ||
											t('cabinetPage.setup.industryNotSet')}
									</p>
								</div>
								<div>
									<DesktopAppSectionLabel>
										{t('cabinetPage.setup.fieldCompanySize')}
									</DesktopAppSectionLabel>
									<p className="text-sm text-(--desktop-text-primary)">
										{companySizeLabel}
									</p>
								</div>
							</div>
							<div>
								<DesktopAppSectionLabel>
									{t('cabinetPage.setup.fieldWebsite')}
								</DesktopAppSectionLabel>
								{selectedCompany.website?.trim() ? (
									<div className="flex flex-wrap items-center gap-2">
										<a
											href={
												selectedCompany.website.startsWith('http')
													? selectedCompany.website
													: `https://${selectedCompany.website}`
											}
											target="_blank"
											rel="noopener noreferrer"
											className="break-all text-sm text-(--mc-accent-foreground) underline-offset-2 hover:underline"
										>
											{selectedCompany.website}
										</a>
										<DesktopAppButton
											type="button"
											variant="ghost"
											size="sm"
											onClick={async () => {
												const ok = await copyToClipboard(
													selectedCompany.website ?? ''
												);
												if (ok) cabinetNotify.success(t('toolbar.linkCopied'));
												else cabinetNotify.error(t('toolbar.idCopyFailed'));
											}}
										>
											<ClipboardDocumentIcon
												className="h-3.5 w-3.5"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
											{t('cabinetPage.companiesPage.copyWebsite')}
										</DesktopAppButton>
									</div>
								) : (
									<p className="text-sm text-(--desktop-text-muted) antialiased">
										{t('common.notListed')}
									</p>
								)}
							</div>
							<div>
								<DesktopAppSectionLabel>
									{t('cabinetPage.setup.fieldDescription')}
								</DesktopAppSectionLabel>
								<p className="whitespace-pre-wrap text-sm leading-relaxed text-(--desktop-text-secondary)">
									{selectedCompany.description?.trim() ||
										t('cabinetPage.companiesPage.noDescription')}
								</p>
							</div>
							<div>
								<DesktopAppSectionLabel>
									{t('cabinetPage.setup.fieldClientRepresentative')}
								</DesktopAppSectionLabel>
								{(() => {
									const rep = selectedCompany.representative_user_id?.trim();
									if (!rep) {
										return (
											<p className="text-sm text-(--desktop-text-primary)">
												{t('cabinetPage.companiesPage.noRepresentative')}
											</p>
										);
									}
									const f = friendMetaForMemberUserId(rep);
									const label = f
										? getFriendDisplayNameFn(f.username, f.full_name)
										: rep;
									return (
										<div className="flex items-center gap-2">
											<FriendAvatar
												className="h-8! w-8! text-[11px]"
												avatarUrl={f?.avatar_url}
												username={f?.username}
												fullName={f?.full_name}
												alt=""
											/>
											<p className="text-sm text-(--desktop-text-primary)">
												{label}
											</p>
										</div>
									);
								})()}
							</div>
							{canManageSelectedCompany ? (
								<div className="flex flex-wrap gap-2 border-t border-(--desktop-border-subtle)/40 pt-4">
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => {
											setCreatingCompany(false);
											setEditingCompany(selectedCompany);
										}}
									>
										<PencilSquareIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{t('common.edit')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={() =>
											setDeleteModal({
												type: 'company',
												id: selectedCompany.id,
												name: selectedCompany.name,
											})
										}
									>
										<TrashIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{t('cabinetPage.companiesPage.deleteCompany')}
									</DesktopAppButton>
								</div>
							) : null}
						</div>
					</SectionPanel>
				) : (
					<SectionPanel
						title={t('cabinetPage.companiesPage.detailEmptyTitle')}
						description={t('cabinetPage.companiesPage.pickCompanyHint')}
						helpBlockId="companies.detail"
					>
						<DesktopAppEmptyState
							title={t('cabinetPage.companiesPage.detailEmptyTitle')}
							description={t('cabinetPage.companiesPage.pickCompanyHint')}
						/>
					</SectionPanel>
				)}
			</div>
		</div>
	);
}
