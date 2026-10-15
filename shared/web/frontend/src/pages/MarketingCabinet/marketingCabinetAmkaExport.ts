/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side fallback Markdown export for an AMKA run when the server export endpoint is unavailable.
 *
 * Invariants:
 * - Final assessment markdown is rendered once; final_assessment step markdown is skipped to avoid duplicate facts.
 * - Server export remains preferred from `AmkaView`.
 *
 * Related:
 * - src/features/amka/AmkaView.tsx
 * - shared/api/services/marketing_cabinet/amka_run_export_markdown.py
 */
import type { AmkaRun, AmkaRunStep } from './marketingCabinetApi';
import {
	buildAmkaStepExportMetaLines,
	countAmkaPlanEnsembleTasks,
} from '@/features/amka/amkaViewUtils';

function safeJson(value: unknown, indent = 2): string {
	try {
		return JSON.stringify(value, null, indent);
	} catch {
		return String(value);
	}
}

/** Собирает markdown-отчёт по запуску AMKA для скачивания / обмена. */
export function buildAmkaRunExportMarkdown(
	run: AmkaRun,
	steps: AmkaRunStep[]
): string {
	const lines: string[] = [
		`# AMKA — отчёт по запуску`,
		'',
		`- ID: ${run.id}`,
		`- Проект: ${run.project_id}`,
		`- Компания: ${run.company_id}`,
		`- Статус: ${run.status}`,
		`- Создан: ${run.created_at ?? '—'}`,
		`- Подтверждён: ${run.approved_at ?? '—'}`,
		`- Запущен: ${run.started_at ?? '—'}`,
		`- Завершён: ${run.completed_at ?? '—'}`,
		'',
	];
	const ensemblePlanCount = countAmkaPlanEnsembleTasks(run.master_plan ?? []);
	if (ensemblePlanCount > 0) {
		lines.push(`- Шагов «Команда» в плане: ${ensemblePlanCount}`, '');
	}

	if (run.master_plan_summary) {
		lines.push('## Краткое резюме плана', '', run.master_plan_summary, '');
	}

	if (run.final_assessment && Object.keys(run.final_assessment).length > 0) {
		lines.push(
			'## Финальная оценка (JSON)',
			'',
			'```json',
			safeJson(run.final_assessment),
			'```',
			''
		);
	}

	if (steps.length > 0) {
		lines.push('## Этапы', '');
		for (const s of steps) {
			lines.push(
				`### #${s.ordinal} ${s.title}`,
				'',
				`- Вид: ${s.stage_kind}`,
				`- Раздел: ${s.section_key ?? '—'}`,
				`- Статус: ${s.status}`,
				`- Начало: ${s.started_at ?? '—'}`,
				`- Конец: ${s.completed_at ?? '—'}`,
				''
			);
			const metaLines = buildAmkaStepExportMetaLines(s);
			if (metaLines.length > 0) {
				lines.push(...metaLines, '');
			}
			if (s.stage_kind !== 'final_assessment' && s.report_markdown?.trim()) {
				lines.push(s.report_markdown.trim(), '');
			}
			if (s.operation_trail?.length) {
				lines.push(
					'#### Трасса операций',
					'',
					'```json',
					safeJson(s.operation_trail),
					'```',
					''
				);
			}
		}
	}

	if (run.final_summary_markdown?.trim()) {
		lines.push(
			'## Итоговые факты и комментарий',
			'',
			run.final_summary_markdown.trim(),
			''
		);
	}

	return `${lines.join('\n').trim()}\n`;
}

export function downloadAmkaRunMarkdown(
	run: AmkaRun,
	steps: AmkaRunStep[],
	filenameBase = 'amka-run'
): void {
	const md = buildAmkaRunExportMarkdown(run, steps);
	const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${filenameBase}-${run.id.slice(0, 8)}.md`;
	a.rel = 'noopener';
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
