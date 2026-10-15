/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks for Mermaid sequenceDiagram → SequenceFlow parser.
 */

import { describe, expect, it } from 'vitest';
import {
	isMermaidSequenceSource,
	parseMermaidSequence,
} from '../parseMermaidSequence';

describe('parseMermaidSequence', () => {
	it('detects sequence headers', () => {
		expect(isMermaidSequenceSource('sequenceDiagram\nA->>B: hi')).toBe(true);
		expect(isMermaidSequenceSource('flowchart TD\nA-->B')).toBe(false);
	});

	it('parses participants and messages', () => {
		const src = `sequenceDiagram
  participant U as User
  participant API
  U->>API: POST /missions
  API-->>U: 201`;
		const parsed = parseMermaidSequence(src);
		expect(parsed?.turns).toHaveLength(2);
		expect(parsed?.turns[0]).toMatchObject({
			from: 'User',
			to: 'API',
			text: 'POST /missions',
			kind: 'solid',
		});
		expect(parsed?.turns[1]?.kind).toBe('dashed');
		expect(parsed?.turns[1]?.from).toBe('API');
		expect(parsed?.turns[1]?.to).toBe('User');
	});

	it('skips loop/alt wrappers and still collects messages', () => {
		const src = `sequenceDiagram
  alt ok
    A->>B: yes
  else fail
    A->>B: no
  end`;
		const parsed = parseMermaidSequence(src);
		expect(parsed?.turns.map((t) => t.text)).toEqual(['yes', 'no']);
	});

	it('returns null without messages', () => {
		expect(parseMermaidSequence('sequenceDiagram\nparticipant A')).toBeNull();
	});
});
