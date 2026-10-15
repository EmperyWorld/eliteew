/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full-screen decision wizard `/guide` (P-406, P-408, P-409): root + branches, two buttons per step.
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §16
 * - src/features/poemma/guide/poemmaDecisionFlow.ts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	DesktopAppButton,
	DesktopProductStatusBanner,
	DesktopProductWorkspace,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	PoemmaEyebrowLabel,
	PoemmaHeroPanel,
	PoemmaPageHeader,
	PoemmaStepIndicator,
	PoemmaSectionTitle,
} from '../ui';
import { POEMMA_SECTION_EYEBROW } from '../poemmaUserChromeCopy';
import {
	findPoemmaDecisionChoice,
	getPoemmaDecisionNode,
	getPoemmaDecisionRoot,
	POEMMA_DECISION_ROOT_ID,
	poemmaDecisionProgressLabel,
	resolvePoemmaDecisionChoice,
	resolvePoemmaGuideStartNodeId,
	type PoemmaDecisionBranchId,
	type PoemmaDecisionChoice,
	type PoemmaDecisionNode,
} from './poemmaDecisionFlow';

export interface PoemmaGuidePageProps {
	onNavigate: (path: string) => void;
	initialBranch?: PoemmaDecisionBranchId;
}

function GuideProgressDots({
	stepIndex,
	stepTotal,
}: {
	stepIndex: number;
	stepTotal: number;
}) {
	return (
		<PoemmaStepIndicator
			filled={stepIndex}
			total={stepTotal}
			ariaLabel={`Шаг ${stepIndex} из ${stepTotal}`}
		/>
	);
}

function GuideChoiceButton({
	choice,
	variant,
	onSelect,
}: {
	choice: PoemmaDecisionChoice;
	variant: 'accent' | 'neutral';
	onSelect: (choiceId: string) => void;
}) {
	return (
		<DesktopAppButton
			type="button"
			variant={variant}
			className="w-full justify-center sm:w-auto sm:min-w-40"
			onClick={() => onSelect(choice.id)}
		>
			{choice.label}
		</DesktopAppButton>
	);
}

function GuideNodeBody({
	node,
	onSelectChoice,
}: {
	node: PoemmaDecisionNode;
	onSelectChoice: (choiceId: string) => void;
}) {
	const progress = poemmaDecisionProgressLabel(node);

	return (
		<div className="space-y-6">
			<div className="space-y-3 text-center">
				{progress && node.stepIndex != null && node.stepTotal != null ? (
					<>
						<GuideProgressDots
							stepIndex={node.stepIndex}
							stepTotal={node.stepTotal}
						/>
						<p className="text-sm font-semibold text-(--desktop-text-secondary)">
							{progress}
						</p>
					</>
				) : null}
			</div>

			<div className="space-y-3 text-center">
				{node.sectionLabel ? (
					<PoemmaSectionTitle>{node.sectionLabel}</PoemmaSectionTitle>
				) : null}
				<h2 className="text-3xl font-semibold tracking-tight text-(--desktop-text-primary)">
					{node.title}
				</h2>
				<p className="text-base leading-7 text-(--desktop-text-secondary)">
					{node.description}
				</p>
			</div>

			{node.layout === 'root' ? (
				<div className="space-y-6">
					<div className="grid gap-3">
						{node.choices.map((choice) => (
							<GuideChoiceButton
								key={choice.id}
								choice={choice}
								variant="accent"
								onSelect={onSelectChoice}
							/>
						))}
					</div>

					{node.secondaryChoices?.length ? (
						<div className="space-y-4 border-t border-(--desktop-border-subtle) pt-5">
							<PoemmaEyebrowLabel tone="muted" className="block text-center">
								или
							</PoemmaEyebrowLabel>
							<div className="space-y-3">
								{node.secondaryChoices.map((choice) => (
									<div
										key={choice.id}
										className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
									>
										<p className="text-sm font-semibold text-(--desktop-text-primary)">
											{choice.prompt ?? choice.label}
										</p>
										<GuideChoiceButton
											choice={choice}
											variant="neutral"
											onSelect={onSelectChoice}
										/>
									</div>
								))}
							</div>
						</div>
					) : null}
				</div>
			) : (
				<div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:justify-center">
					{node.choices.map((choice, index) => (
						<GuideChoiceButton
							key={choice.id}
							choice={choice}
							variant={index === 0 ? 'accent' : 'neutral'}
							onSelect={onSelectChoice}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function buildGuideContextLine(node: PoemmaDecisionNode): string {
	if (node.layout === 'root') {
		return 'Выберите вход и пройдите ветку до конкретного действия.';
	}
	if (node.stepIndex != null && node.stepTotal != null) {
		return `Шаг ${node.stepIndex} из ${node.stepTotal}: после ответа получите маршрут или следующую развилку.`;
	}
	return 'Ответьте на вопрос и двигайтесь по ветке.';
}

export function PoemmaGuidePage({
	onNavigate,
	initialBranch,
}: PoemmaGuidePageProps) {
	const root = useMemo(() => getPoemmaDecisionRoot(), []);
	const [nodeId, setNodeId] = useState(() =>
		resolvePoemmaGuideStartNodeId(initialBranch)
	);

	useEffect(() => {
		setNodeId(resolvePoemmaGuideStartNodeId(initialBranch));
	}, [initialBranch]);

	const node = getPoemmaDecisionNode(nodeId) ?? root;

	const handleChoice = useCallback(
		(choiceId: string) => {
			const choice = findPoemmaDecisionChoice(nodeId, choiceId);
			if (!choice) {
				return;
			}

			const resolved = resolvePoemmaDecisionChoice(choice);
			if (resolved.route) {
				onNavigate(resolved.route);
				return;
			}
			if (resolved.nextNodeId) {
				setNodeId(resolved.nextNodeId);
			}
		},
		[nodeId, onNavigate]
	);

	const handleBackToRoot = useCallback(() => {
		setNodeId(POEMMA_DECISION_ROOT_ID);
	}, []);

	return (
		<DesktopProductWorkspace
			header={
				<PoemmaPageHeader
					eyebrow={POEMMA_SECTION_EYEBROW.guide}
					title="Что делать"
					description="Выберите, что сейчас важнее: стратегия, смысл продукта или удержание клиентов."
					meta={
						nodeId === POEMMA_DECISION_ROOT_ID
							? 'Три входа'
							: (poemmaDecisionProgressLabel(node) ?? 'Ветка')
					}
					actions={
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => onNavigate('/')}
						>
							На карту
						</DesktopAppButton>
					}
				/>
			}
		>
			<div
				data-poemma-guide="decision-guide"
				className="grid min-h-full w-full p-4 sm:p-6"
			>
				<PoemmaHeroPanel className="w-full">
					<DesktopProductStatusBanner
						tone="neutral"
						title={node.layout === 'root' ? 'С чего начать' : 'Следующий шаг'}
						description={buildGuideContextLine(node)}
					/>
					<GuideNodeBody node={node} onSelectChoice={handleChoice} />
					{nodeId !== POEMMA_DECISION_ROOT_ID && node.layout !== 'root' ? (
						<div className="mt-6 flex justify-center border-t border-(--desktop-border-subtle) pt-4">
							<DesktopAppButton
								type="button"
								variant="neutral"
								onClick={handleBackToRoot}
							>
								К корню
							</DesktopAppButton>
						</div>
					) : null}
				</PoemmaHeroPanel>
			</div>
		</DesktopProductWorkspace>
	);
}

export default PoemmaGuidePage;
