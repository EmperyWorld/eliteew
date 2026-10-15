/**
 * Убирает из тела ответа ассистента повторяющиеся служебные вставки,
 * которые модель иногда дублирует текстом (телеметрия уже в UI / метаданных).
 */

const LEADING_LINE_PATTERNS: RegExp[] = [
	/^Задействованы инструменты\s*\(\d+\)\s*\.?$/i,
	/^Прикреплён файл:\s*.+$/i,
	/^Прикреплено файлов:\s*\d+\s*\.?$/i,
	/^Ответ на запрос пользователя\s*\.?$/i,
	/^\*{0,2}Ответ на запрос пользователя\*{0,2}\s*\.?$/i,
];

/** Та же фраза в начале строки, если на одной строке с дальнейшим текстом. */
const INLINE_PREFIX_RE =
	/^\s*Задействованы инструменты\s*\(\d+\)\s*(?:\.?\s+|\n+)/i;

const INTERNAL_BULLET_PROBE_RE =
	/Запрос на изображение|Исходные данные|инструмент задействован|Ваша просьба была сформирована|Поиск не был запущен|Проведение поиска|следующие шаги инструментов|шаги инструментов|генерац(ии|ия|ию)\s+изображ|создан(ие|ии|ию)\s+изображ|вызов\s+инструмента|инструмент\s+выполнен/i;

/** Рекап оркестратора в той же строке после точки (перед markdown-списком шагов). Не трогаем `\n` после `:` — иначе список слипается с предложением. */
const INLINE_TOOL_STEPS_RECAP_RE =
	/\.\s+В контексте запроса[^\n]+?(?:следующие\s+)?шаги?\s+инструментов:[ \t]*/gi;

function normalizeNewlines(s: string): string {
	return s.replace(/\r\n/g, '\n');
}

/** Снимает повторяющиеся служебные строки с начала текста. */
export function stripLeadingAssistantBoilerplateLines(text: string): string {
	const s = normalizeNewlines(text).replace(INLINE_PREFIX_RE, '').trimStart();
	const lines = s.split('\n');
	let i = 0;
	while (i < lines.length) {
		const t = lines[i].trim();
		if (t === '') {
			i++;
			continue;
		}
		const hit = LEADING_LINE_PATTERNS.some((re) => re.test(t));
		if (!hit) break;
		i++;
	}
	return lines.slice(i).join('\n').trim();
}

/**
 * Если ответ начинается с markdown-списка «отчёт оркестратора», убираем его целиком.
 * Срабатывает только при явных маркерах в первых пунктах (не трогает обычные списки).
 */
export function stripLeadingInternalBulletReport(text: string): string {
	const s = normalizeNewlines(text).trimStart();
	if (!s) return s;
	const lines = s.split('\n');
	let i = 0;
	while (i < lines.length && lines[i].trim() === '') i++;
	if (i >= lines.length) return text.trim();
	const first = lines[i].trim();
	if (!/^[-*]\s+\S/.test(first)) return text.trim();

	const probe = lines.slice(i, Math.min(lines.length, i + 48)).join('\n');
	if (!INTERNAL_BULLET_PROBE_RE.test(probe)) return text.trim();

	while (i < lines.length) {
		const line = lines[i];
		const tr = line.trim();
		if (tr === '') {
			const next = lines[i + 1];
			if (next !== undefined && /^\s*[-*]\s+\S/.test(next)) {
				i++;
				continue;
			}
			break;
		}
		if (/^\s*[-*]\s+\S/.test(line)) {
			i++;
			continue;
		}
		break;
	}

	return lines.slice(i).join('\n').trim();
}

/**
 * Строка-рекап «шаги инструментов» и следующий за ней служебный markdown-список.
 */
function isToolStepsRecapLine(line: string): boolean {
	const t = line.trim();
	if (!t) return false;
	if (
		/В контексте запроса/i.test(line) &&
		/(?:следующие\s+)?шаги?\s+инструментов:\s*$/i.test(t)
	) {
		return true;
	}
	return /были\s+использованы\s+следующие\s+шаги?\s+инструментов:\s*$/i.test(t);
}

/**
 * Убирает абзац-рекап про шаги инструментов и следующий за ним внутренний список `-` / `*`.
 */
export function stripToolStepsRecapAndList(text: string): string {
	const lines = normalizeNewlines(text).split('\n');
	const out: string[] = [];
	let i = 0;
	while (i < lines.length) {
		if (isToolStepsRecapLine(lines[i])) {
			let j = i + 1;
			while (j < lines.length && lines[j].trim() === '') j++;
			const bulletStart = j;
			while (j < lines.length && /^\s*[-*]\s+\S/.test(lines[j])) j++;
			if (
				bulletStart < j &&
				INTERNAL_BULLET_PROBE_RE.test(lines.slice(bulletStart, j).join('\n'))
			) {
				i = j;
				continue;
			}
		}
		out.push(lines[i]);
		i++;
	}
	return out.join('\n').replace(/\n+$/, '');
}

/**
 * Хвост сообщения: пустая строка и markdown-список с маркерами внутреннего отчёта (после inline-рекапа).
 */
function stripTrailingProbeBulletBlockAfterBlankLine(text: string): string {
	const lines = normalizeNewlines(text).split('\n');
	let end = lines.length;
	while (end > 0 && lines[end - 1]?.trim() === '') end--;
	if (end === 0) return text;
	const bulletEnd = end;
	let bulletStart = end;
	while (bulletStart > 0) {
		const L = lines[bulletStart - 1] ?? '';
		if (L.trim() === '') break;
		if (!/^\s*[-*]\s+\S/.test(L)) break;
		bulletStart--;
	}
	if (bulletStart === bulletEnd) return text;
	const block = lines.slice(bulletStart, bulletEnd).join('\n');
	if (!INTERNAL_BULLET_PROBE_RE.test(block)) return text;
	if (bulletStart === 0) return text;
	const beforeBullet = lines[bulletStart - 1] ?? '';
	if (beforeBullet.trim() !== '') return text;
	return lines
		.slice(0, bulletStart - 1)
		.join('\n')
		.trimEnd();
}

export type StripAssistantReplyOptions = {
	/** Для стрима список может быть неполным — не режем блок списка. */
	stripInternalList?: boolean;
	/**
	 * Блок «цель / рассуждение / контракт» выносится в чип композера; из пузыря убирается.
	 * Во время стрима отключать — разметка может быть неполной.
	 */
	stripOrbitMeta?: boolean;
};

/** Поля «орбиты» ответа (модель bezrazdelny), показываются над композером, не в пузыре. */
export type AssistantOrbitMeta = {
	goal?: string;
	reasoning?: string;
	contract?: string;
};

export function hasAssistantOrbitMeta(m: AssistantOrbitMeta): boolean {
	return Boolean(m.goal?.trim() || m.reasoning?.trim() || m.contract?.trim());
}

/**
 * Явный переход к тексту для пользователя после служебного блока.
 * (\b с кириллицей в JS ненадёжен.) Модель bezrazdelny часто пишет «...требований. Ответ: …» в одном абзаце.
 */
const ORBIT_ANSWER_DELIM_RE =
	/(?:^|[\n\r])\s*(?:итоговый ответ|ответ пользователю|итог|вывод)\s*:\s*|\.\s+Ответ\s*:\s*|(?:^|[\n\r])\s*Ответ\s*:\s*/im;

/**
 * Выделяет из текста ответа блок «Цель ответа / Рассуждение / Контракт ответа».
 * Хвост после разделителя («Итоговый ответ:», «Вывод:», «Ответ:» и т.п.) остаётся в пузыре; префикс до «Цель» — тоже.
 */
export function partitionAssistantOrbitMeta(text: string): {
	remainder: string;
	meta: AssistantOrbitMeta;
} {
	const s = normalizeNewlines(text);
	const meta: AssistantOrbitMeta = {};
	const gIdx = s.toLowerCase().indexOf('цель ответа');
	if (gIdx < 0) {
		return { remainder: s.trim(), meta };
	}

	const prefix = s.slice(0, gIdx).trimEnd();
	const fromGoal = s.slice(gIdx);

	const delimMatch = fromGoal.match(ORBIT_ANSWER_DELIM_RE);
	let metaBlock: string;
	let answerTail: string;
	if (delimMatch?.index !== undefined && delimMatch.index > 0) {
		const rawDelim = delimMatch[0];
		// «...цели. Ответ:» — точка конца предложения остаётся в мета-блоке, не в answerTail.
		const metaEnd = rawDelim.startsWith('.')
			? delimMatch.index + 1
			: delimMatch.index;
		metaBlock = fromGoal.slice(0, metaEnd);
		answerTail = fromGoal.slice(delimMatch.index + rawDelim.length);
	} else {
		metaBlock = fromGoal;
		answerTail = '';
	}

	const ORBIT_LABELS: {
		key: keyof AssistantOrbitMeta;
		needle: string;
	}[] = [
		{ key: 'goal', needle: 'цель ответа' },
		{ key: 'reasoning', needle: 'рассуждение' },
		{ key: 'contract', needle: 'контракт ответа' },
	];
	const lowBlock = metaBlock.toLowerCase();
	const hits: {
		key: keyof AssistantOrbitMeta;
		idx: number;
		labelEnd: number;
	}[] = [];
	for (const { key, needle } of ORBIT_LABELS) {
		const idx = lowBlock.indexOf(needle);
		if (idx < 0) continue;
		let le = idx + needle.length;
		while (le < metaBlock.length && /\s/.test(metaBlock[le] ?? '')) le++;
		if (metaBlock[le] === ':') le++;
		while (le < metaBlock.length && /\s/.test(metaBlock[le] ?? '')) le++;
		hits.push({ key, idx, labelEnd: le });
	}
	hits.sort((a, b) => a.idx - b.idx);
	for (let i = 0; i < hits.length; i++) {
		const h = hits[i];
		const next = hits[i + 1];
		const chunk = metaBlock
			.slice(h.labelEnd, next?.idx ?? metaBlock.length)
			.trim();
		if (chunk) meta[h.key] = chunk;
	}

	const remainder = [prefix, answerTail].filter(Boolean).join('\n\n').trim();

	return { remainder, meta };
}

export type AssistantReplyDisplayParts = {
	bubbleMarkdown: string;
	orbitMeta: AssistantOrbitMeta | null;
};

/**
 * Текст для пузыря + мета для чипа (если есть блок орбиты и разрешено снятие).
 */
export function assistantReplyDisplayParts(
	text: string,
	opts?: StripAssistantReplyOptions
): AssistantReplyDisplayParts {
	let orbitMeta: AssistantOrbitMeta | null = null;
	let body = normalizeNewlines(text).trim();

	if (opts?.stripOrbitMeta !== false) {
		const { remainder, meta } = partitionAssistantOrbitMeta(body);
		/** Без «Итоговый ответ:» / хвоста remainder пустой — не снимаем орбиту, иначе пузырь окажется пустым. */
		if (hasAssistantOrbitMeta(meta) && remainder.trim() !== '') {
			body = remainder;
			orbitMeta = meta;
		}
	}

	const bubbleMarkdown = stripAssistantReplyDisplayNoise(body, opts);
	return {
		bubbleMarkdown,
		orbitMeta: orbitMeta && hasAssistantOrbitMeta(orbitMeta) ? orbitMeta : null,
	};
}

/**
 * Полная очистка для отображения в пузыре (после стрима — со снятием «отчётного» списка).
 */
export function stripAssistantReplyDisplayNoise(
	text: string,
	opts?: StripAssistantReplyOptions
): string {
	let s = stripLeadingAssistantBoilerplateLines(text);
	if (opts?.stripInternalList !== false) {
		s = s.replace(INLINE_TOOL_STEPS_RECAP_RE, '.');
		s = stripToolStepsRecapAndList(s);
		s = stripTrailingProbeBulletBlockAfterBlankLine(s);
		s = stripLeadingInternalBulletReport(s);
		s = stripLeadingAssistantBoilerplateLines(s);
	}
	return s.trim();
}
