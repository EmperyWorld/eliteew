/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Side panel for inserting chart figures and Mermaid diagrams into Ultimate Doc Editor.
 *
 * Invariants:
 * - Mermaid SVG preview/insert output is sanitized before DOM insertion or editor insertion.
 * - Chart data stays local to the panel until the user inserts the generated figure.
 *
 * Related:
 * - src/components/UltimateDocEditor/utils/docEditorMermaidRender.ts
 * - src/utils/sanitizeUserHtml.ts
 */

import {
	type FC,
	useState,
	useCallback,
	useMemo,
	useRef,
	useEffect,
} from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
	Area,
	AreaChart as RechartsArea,
	Bar,
	BarChart,
	Cell,
	CartesianGrid,
	Legend,
	Line,
	LineChart as RechartsLine,
	Pie,
	PieChart as RechartsPie,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { useDocEditorSidePanelZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import type {
	ChartsDiagramsPanelProps,
	ChartType,
	ChartConfig,
	DiagramConfig,
} from '../types/editor.types';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppInput,
	DesktopAppPanel,
	DesktopAppSectionLabel,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import { buildChartFigureHtml } from '../utils/chartRenderer';
import { renderMermaidDiagramToSvg } from '../utils/docEditorMermaidRender';
import { sanitizeMermaidSvg } from '@/utils/sanitizeUserHtml';
import type { TFunction } from 'i18next';
import {
	ArrowDownTrayIcon,
	ChartBarIcon,
	ChartBarSquareIcon,
	ChartPieIcon,
	CheckIcon,
	GlobeAltIcon,
	PlusIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

const CHART_PREVIEW_WIDTH = 432;
const CHART_PREVIEW_HEIGHT = 256;

const COLORS = [
	'#8884d8',
	'#82ca9d',
	'#ffc658',
	'#ff7300',
	'#00C49F',
	'#FFBB28',
	'#FF8042',
];

interface DataRow {
	id: string;
	name: string;
	value: number;
}

type PanelMode = 'chart' | 'mermaid';

function buildDefaultDataRows(tr: TFunction): DataRow[] {
	return [
		{ id: 'row-0', name: tr('panels.charts.demo.jan'), value: 400 },
		{ id: 'row-1', name: tr('panels.charts.demo.feb'), value: 300 },
		{ id: 'row-2', name: tr('panels.charts.demo.mar'), value: 600 },
		{ id: 'row-3', name: tr('panels.charts.demo.apr'), value: 800 },
		{ id: 'row-4', name: tr('panels.charts.demo.may'), value: 500 },
	];
}

export const ChartsDiagramsPanel: FC<ChartsDiagramsPanelProps> = ({
	onClose,
	onInsertChart,
	onInsertDiagram,
}) => {
	const { t } = useTranslation('docEditorPanels');
	const docSidePanelZ = useDocEditorSidePanelZIndex();
	const [panelMode, setPanelMode] = useState<PanelMode>('chart');
	const [chartType, setChartType] = useState<ChartType>('bar');

	const chartDefaultsRef = useRef({
		title: t('panels.charts.defaultTitle'),
		names: buildDefaultDataRows(t)
			.map((r) => r.name)
			.join('\0'),
	});
	const [title, setTitle] = useState(() => t('panels.charts.defaultTitle'));
	const [data, setData] = useState<DataRow[]>(() => buildDefaultDataRows(t));

	const mermaidDefaultsRef = useRef({
		source: t('panels.charts.mermaid.defaultSource'),
	});
	const [mermaidSource, setMermaidSource] = useState(() =>
		t('panels.charts.mermaid.defaultSource')
	);

	useEffect(() => {
		const dTitle = t('panels.charts.defaultTitle');
		const dRows = buildDefaultDataRows(t);
		const dNames = dRows.map((r) => r.name).join('\0');
		setTitle((prev) =>
			prev === chartDefaultsRef.current.title ? dTitle : prev
		);
		setData((prev) => {
			const pNames = prev.map((r) => r.name).join('\0');
			if (pNames !== chartDefaultsRef.current.names) {
				return prev;
			}
			return dRows.map((row, i) => ({
				id: prev[i]?.id ?? row.id,
				name: row.name,
				value: prev[i]?.value ?? row.value,
			}));
		});
		chartDefaultsRef.current = { title: dTitle, names: dNames };
	}, [t]);

	useEffect(() => {
		const next = t('panels.charts.mermaid.defaultSource');
		setMermaidSource((prev) =>
			prev === mermaidDefaultsRef.current.source ? next : prev
		);
		mermaidDefaultsRef.current = { source: next };
	}, [t]);

	const chartTypes = useMemo(
		() =>
			[
				{
					type: 'bar' as const,
					label: t('panels.charts.types.bar'),
					icon: ChartBarSquareIcon,
				},
				{
					type: 'line' as const,
					label: t('panels.charts.types.line'),
					icon: ChartBarIcon,
				},
				{
					type: 'pie' as const,
					label: t('panels.charts.types.pie'),
					icon: ChartPieIcon,
				},
				{
					type: 'area' as const,
					label: t('panels.charts.types.area'),
					icon: ChartBarIcon,
				},
			] as const,
		[t]
	);
	const [mermaidError, setMermaidError] = useState<string | null>(null);
	const [mermaidBusy, setMermaidBusy] = useState(false);
	const [mermaidPreviewSvg, setMermaidPreviewSvg] = useState<string | null>(
		null
	);

	const addRow = useCallback(() => {
		setData((prev) => [
			...prev,
			{
				id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
				name: t('panels.charts.newRowName', { n: prev.length + 1 }),
				value: 100,
			},
		]);
	}, [t]);

	const removeRow = useCallback((index: number) => {
		setData((prev) => prev.filter((_, i) => i !== index));
	}, []);

	const updateRow = useCallback(
		(index: number, field: 'name' | 'value', value: string) => {
			setData((prev) =>
				prev.map((row, i) =>
					i === index
						? {
								...row,
								[field]: field === 'value' ? Number(value) || 0 : value,
							}
						: row
				)
			);
		},
		[]
	);

	const chartConfig: ChartConfig = useMemo(
		() => ({
			type: chartType,
			title,
			labels: data.map((d) => d.name),
			datasets: [
				{
					label: title,
					data: data.map((d) => d.value),
					backgroundColor: COLORS,
					borderColor: COLORS,
				},
			],
		}),
		[chartType, title, data]
	);

	const hasRenderableData = useMemo(
		() =>
			data.some((row) => {
				const v = typeof row.value === 'number' ? row.value : Number(row.value);
				return row.name.trim().length > 0 && Number.isFinite(v);
			}),
		[data]
	);

	const exportDataCsv = useCallback(() => {
		const header = 'name,value\n';
		const body = data
			.map((row) => `"${row.name.replace(/"/g, '""')}",${row.value}`)
			.join('\n');
		const blob = new Blob([header + body], {
			type: 'text/csv;charset=utf-8',
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `chart-data-${Date.now()}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}, [data]);

	const exportChartHtml = useCallback(() => {
		const html = buildChartFigureHtml(chartConfig);
		const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `chart-figure-${Date.now()}.html`;
		a.click();
		URL.revokeObjectURL(url);
	}, [chartConfig]);

	const handleInsert = useCallback(() => {
		if (!hasRenderableData) {
			return;
		}
		const chartHtml = buildChartFigureHtml(chartConfig);
		onInsertChart(chartHtml, chartConfig);
		onClose();
	}, [chartConfig, hasRenderableData, onInsertChart, onClose]);

	const handlePreviewMermaid = useCallback(async () => {
		setMermaidError(null);
		setMermaidBusy(true);
		try {
			const svg = await renderMermaidDiagramToSvg(mermaidSource);
			setMermaidPreviewSvg(sanitizeMermaidSvg(svg));
		} catch (e) {
			setMermaidPreviewSvg(null);
			setMermaidError(
				e instanceof Error ? e.message : t('panels.charts.errRenderMermaid')
			);
		} finally {
			setMermaidBusy(false);
		}
	}, [mermaidSource, t]);

	const handleInsertMermaid = useCallback(async () => {
		setMermaidError(null);
		setMermaidBusy(true);
		try {
			const svg = sanitizeMermaidSvg(
				await renderMermaidDiagramToSvg(mermaidSource)
			);
			const diagramConfig: DiagramConfig = {
				type: 'flowchart',
				title: t('panels.charts.diagramConfigTitle'),
				nodes: [],
				edges: [],
				options: { mermaidSource: mermaidSource.trim() },
			};
			onInsertDiagram(svg, diagramConfig);
			onClose();
		} catch (e) {
			setMermaidError(
				e instanceof Error ? e.message : t('panels.charts.errInsertMermaid')
			);
		} finally {
			setMermaidBusy(false);
		}
	}, [mermaidSource, onInsertDiagram, onClose, t]);

	const renderChart = () => {
		const commonProps = {
			width: CHART_PREVIEW_WIDTH,
			height: CHART_PREVIEW_HEIGHT,
			data,
			margin: { top: 5, right: 20, left: 0, bottom: 5 },
		};

		switch (chartType) {
			case 'bar':
				return (
					<BarChart {...commonProps}>
						<CartesianGrid strokeDasharray="3 3" stroke="#374151" />
						<XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
						<YAxis stroke="#9CA3AF" fontSize={12} />
						<Tooltip
							contentStyle={{
								background: '#1F2937',
								border: 'none',
								borderRadius: 8,
							}}
						/>
						<Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]} />
					</BarChart>
				);
			case 'line':
				return (
					<RechartsLine {...commonProps}>
						<CartesianGrid strokeDasharray="3 3" stroke="#374151" />
						<XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
						<YAxis stroke="#9CA3AF" fontSize={12} />
						<Tooltip
							contentStyle={{
								background: '#1F2937',
								border: 'none',
								borderRadius: 8,
							}}
						/>
						<Line
							type="monotone"
							dataKey="value"
							stroke="#8884d8"
							strokeWidth={2}
							dot={{ fill: '#8884d8' }}
						/>
					</RechartsLine>
				);
			case 'pie':
				return (
					<RechartsPie
						width={CHART_PREVIEW_WIDTH}
						height={CHART_PREVIEW_HEIGHT}
					>
						<Pie
							data={data}
							dataKey="value"
							nameKey="name"
							cx="50%"
							cy="50%"
							outerRadius={88}
							label
						>
							{data.map((entry, index) => (
								<Cell key={entry.id} fill={COLORS[index % COLORS.length]} />
							))}
						</Pie>
						<Tooltip
							contentStyle={{
								background: '#1F2937',
								border: 'none',
								borderRadius: 8,
							}}
						/>
						<Legend />
					</RechartsPie>
				);
			case 'area':
				return (
					<RechartsArea {...commonProps}>
						<CartesianGrid strokeDasharray="3 3" stroke="#374151" />
						<XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
						<YAxis stroke="#9CA3AF" fontSize={12} />
						<Tooltip
							contentStyle={{
								background: '#1F2937',
								border: 'none',
								borderRadius: 8,
							}}
						/>
						<Area
							type="monotone"
							dataKey="value"
							stroke="#8884d8"
							fill="#8884d8"
							fillOpacity={0.3}
						/>
					</RechartsArea>
				);
			default:
				return null;
		}
	};

	return (
		<motion.div
			initial={{ opacity: 0, x: 300 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: 300 }}
			className="fixed right-0 top-0 h-full w-full max-w-[480px] overflow-y-auto border-l border-(--desktop-border-strong) bg-(--desktop-surface-panel-strong) shadow-(--desktop-shadow-panel) backdrop-blur-xl"
			style={{ zIndex: docSidePanelZ }}
		>
			<div className="min-w-0 space-y-5 p-4 sm:p-6">
				{/* Header */}
				<div className="mb-6 flex flex-col gap-3 border-b border-(--desktop-border-subtle) pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
					<div className="flex min-w-0 items-center gap-3">
						<div className="shrink-0 rounded-lg bg-violet-500/20 p-2">
							<ChartBarSquareIcon className="h-5 w-5 text-violet-400" />
						</div>
						<div className="min-w-0">
							<h2 className="text-lg font-semibold text-(--desktop-text-primary)">
								{t('panels.charts.title')}
							</h2>
							<p className="text-sm text-(--desktop-text-muted) antialiased">
								{t('panels.charts.subtitle')}
							</p>
						</div>
					</div>
					<DesktopAppButton
						type="button"
						onClick={onClose}
						variant="ghost"
						size="icon"
						className="shrink-0 self-end sm:self-auto"
						title={t('panels.charts.closeTitle')}
						aria-label={t('panels.charts.closeAria')}
					>
						<XMarkIcon className="h-5 w-5" />
					</DesktopAppButton>
				</div>

				<div className="min-w-0">
					<DesktopAppSectionLabel className="mb-2 block">
						{t('panels.charts.modeLabel')}
					</DesktopAppSectionLabel>
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
						<DesktopAppButton
							type="button"
							onClick={() => setPanelMode('chart')}
							variant={panelMode === 'chart' ? 'accent' : 'neutral'}
							active={panelMode === 'chart'}
							className="h-auto justify-start gap-2 py-3"
						>
							<ChartBarSquareIcon className="h-5 w-5 shrink-0" />
							<span className="text-left text-sm leading-snug">
								{t('panels.charts.modeChart')}
							</span>
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							onClick={() => {
								setPanelMode('mermaid');
								setMermaidError(null);
							}}
							variant={panelMode === 'mermaid' ? 'accent' : 'neutral'}
							active={panelMode === 'mermaid'}
							className="h-auto justify-start gap-2 py-3"
						>
							<GlobeAltIcon className="h-5 w-5 shrink-0" />
							<span className="text-left text-sm leading-snug">
								{t('panels.charts.modeMermaid')}
							</span>
						</DesktopAppButton>
					</div>
				</div>

				{panelMode === 'chart' && (
					<>
						{/* Chart Type Selection */}
						<div className="min-w-0">
							<DesktopAppSectionLabel className="mb-2 block">
								{t('panels.charts.chartTypeLabel')}
							</DesktopAppSectionLabel>
							<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
								{chartTypes.map(({ type, label, icon: Icon }) => (
									<DesktopAppButton
										key={type}
										type="button"
										onClick={() => setChartType(type)}
										variant={chartType === type ? 'accent' : 'neutral'}
										active={chartType === type}
										className="flex h-auto flex-col items-center gap-1 p-3"
									>
										<Icon className="h-5 w-5" />
										<span className="text-xs">{label}</span>
									</DesktopAppButton>
								))}
							</div>
						</div>

						{/* Title */}
						<div>
							<DesktopAppSectionLabel
								className="mb-2 block"
								id="charts-panel-title-label"
							>
								{t('panels.charts.chartTitleLabel')}
							</DesktopAppSectionLabel>
							<DesktopAppInput
								id="charts-panel-title-input"
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								aria-labelledby="charts-panel-title-label"
							/>
						</div>

						{/* Data Editor */}
						<div className="min-w-0">
							<div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<DesktopAppSectionLabel className="shrink-0">
									{t('panels.charts.dataLabel')}
								</DesktopAppSectionLabel>
								<DesktopAppButton
									type="button"
									onClick={addRow}
									variant="ghost"
									size="sm"
									className="w-full gap-1 sm:w-auto"
								>
									<PlusIcon className="h-4 w-4" /> {t('panels.charts.addRow')}
								</DesktopAppButton>
							</div>
							<DesktopAppPanel className="max-h-48 min-w-0 space-y-2 overflow-y-auto p-3">
								{data.map((row, index) => (
									<div
										key={row.id}
										className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center"
									>
										<div className="min-w-0 flex-1">
											<label
												className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-(--desktop-text-dim)"
												htmlFor={`chart-data-name-${row.id}`}
											>
												{t('panels.charts.nameLabel')}
											</label>
											<DesktopAppInput
												id={`chart-data-name-${row.id}`}
												type="text"
												value={row.name}
												onChange={(e) =>
													updateRow(index, 'name', e.target.value)
												}
												className="min-w-0 w-full"
												placeholder={t('panels.charts.namePlaceholder')}
											/>
										</div>
										<div className="flex min-w-0 items-end gap-2 sm:shrink-0">
											<div className="min-w-0 flex-1 sm:w-24">
												<label
													className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-(--desktop-text-dim)"
													htmlFor={`chart-data-value-${row.id}`}
												>
													{t('panels.charts.valueLabel')}
												</label>
												<DesktopAppInput
													id={`chart-data-value-${row.id}`}
													type="number"
													value={row.value}
													onChange={(e) =>
														updateRow(index, 'value', e.target.value)
													}
													className="w-full min-w-0"
													placeholder={t('panels.charts.valuePlaceholder')}
												/>
											</div>
											<DesktopAppButton
												type="button"
												onClick={() => removeRow(index)}
												variant="ghost"
												size="icon"
												className="h-10 w-10 shrink-0"
												disabled={data.length <= 1}
												title={t('panels.charts.removeRowTitle')}
												aria-label={t('panels.charts.removeRowAria', {
													name: row.name,
												})}
											>
												<TrashIcon className="h-4 w-4" />
											</DesktopAppButton>
										</div>
									</div>
								))}
							</DesktopAppPanel>
						</div>

						{/* Preview */}
						<div className="min-w-0">
							<div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<DesktopAppSectionLabel className="block">
									{t('panels.charts.previewLabel')}
								</DesktopAppSectionLabel>
								<div className="flex flex-wrap gap-2">
									<DesktopAppButton
										type="button"
										variant="neutral"
										size="sm"
										className="gap-1"
										onClick={exportDataCsv}
									>
										<ArrowDownTrayIcon className="h-4 w-4" />
										{t('panels.charts.exportData')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="neutral"
										size="sm"
										className="gap-1"
										onClick={exportChartHtml}
										disabled={!hasRenderableData}
									>
										<ArrowDownTrayIcon className="h-4 w-4" />
										{t('panels.charts.exportConfig')}
									</DesktopAppButton>
								</div>
							</div>
							<DesktopAppPanel className="min-h-[280px] p-4 sm:min-h-[320px]">
								<div className="flex w-full min-w-0 justify-center overflow-x-auto">
									{hasRenderableData ? (
										renderChart()
									) : (
										<DesktopAppEmptyState
											icon={
												<ChartBarSquareIcon className="h-10 w-10 text-violet-400/80" />
											}
											title={t('panels.charts.emptyPreview')}
											description={t('panels.charts.emptyHint')}
											className="h-full min-h-[220px] justify-center py-8"
										/>
									)}
								</div>
							</DesktopAppPanel>
							<p className="mt-2 text-xs text-(--desktop-text-dim)">
								{t('panels.charts.noteChartSvg')}
							</p>
						</div>

						{/* Insert chart */}
						<DesktopAppButton
							type="button"
							onClick={handleInsert}
							variant="accent"
							className="w-full justify-center py-3"
							disabled={!hasRenderableData}
						>
							<CheckIcon className="w-5 h-5" />
							{t('panels.charts.insertChart')}
						</DesktopAppButton>
					</>
				)}

				{panelMode === 'mermaid' && (
					<div className="min-w-0 space-y-4">
						<div>
							<DesktopAppSectionLabel className="mb-2 block">
								{t('panels.charts.mermaidCodeLabel')}
							</DesktopAppSectionLabel>
							<textarea
								className="min-h-[220px] w-full resize-y rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3 font-mono text-sm text-(--desktop-text-primary)"
								value={mermaidSource}
								onChange={(e) => setMermaidSource(e.target.value)}
								spellCheck={false}
								aria-label={t('panels.charts.mermaidAria')}
							/>
						</div>
						{mermaidError ? (
							<p className="text-sm text-rose-300">{mermaidError}</p>
						) : null}
						<div className="flex flex-wrap gap-2">
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								onClick={() => void handlePreviewMermaid()}
								disabled={mermaidBusy || !mermaidSource.trim()}
							>
								{t('panels.charts.previewMermaid')}
							</DesktopAppButton>
						</div>
						{mermaidPreviewSvg ? (
							<DesktopAppPanel className="max-h-[min(400px,50vh)] min-h-[120px] overflow-auto p-3">
								{/* SVG from Mermaid render in this session; sanitized before insertion. */}
								<div
									className="flex justify-center [&_svg]:max-h-[min(360px,45vh)] [&_svg]:max-w-full"
									// eslint-disable-next-line react/no-danger
									// biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized Mermaid SVG preview only
									dangerouslySetInnerHTML={{ __html: mermaidPreviewSvg }}
								/>
							</DesktopAppPanel>
						) : null}
						<p className="text-xs text-(--desktop-text-dim)">
							{t('panels.charts.noteMermaidSvg')}
						</p>
						<DesktopAppButton
							type="button"
							onClick={() => void handleInsertMermaid()}
							variant="accent"
							className="w-full justify-center py-3"
							disabled={mermaidBusy || !mermaidSource.trim()}
						>
							<CheckIcon className="h-5 w-5" />
							{mermaidBusy
								? t('panels.charts.mermaidBusy')
								: t('panels.charts.insertMermaid')}
						</DesktopAppButton>
					</div>
				)}
			</div>
		</motion.div>
	);
};

export default ChartsDiagramsPanel;
