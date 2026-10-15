/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Zod fields and fail-closed parse helpers for Professional Worlds API boundaries.
 *
 * Invariants:
 * - Every failed public parser throws the same ProfessionalWorldsApiParseError class.
 * - Decimal fields preserve the OpenAPI pilot's string/null output and string/number/null input shapes.
 *
 * Related:
 * - ../professionalWorldsApiZod.ts
 * - ../../../../../openapi/pilot/professional-worlds.openapi.json
 */

import { z } from 'zod';

export const decimalOutField = z.union([z.string(), z.null()]).optional();

export const decimalCreateField = z
	.union([z.string(), z.number(), z.null()])
	.optional();

export class ProfessionalWorldsApiParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ProfessionalWorldsApiParseError';
	}
}

export function parseWithSchema<T>(
	schema: z.ZodType<T>,
	raw: unknown,
	message: string
): T {
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		throw new ProfessionalWorldsApiParseError(message);
	}
	return parsed.data;
}

export function parseListWithSchema<T>(
	schema: z.ZodType<T>,
	raw: unknown,
	message: string
): T[] {
	return parseWithSchema(z.array(schema), raw, message);
}
