import { clsx, type ClassValue } from 'clsx';

export type VariantShape = Record<string, Record<PropertyKey, ClassValue>>;

/** Map variant slot keys (boolean vs "true"/"false" string index keys) to props TypeScript accepts. */
type SlotKey<T> =
	T extends Record<infer K, ClassValue>
		? K extends boolean
			? boolean
			: K extends 'true' | 'false'
				? boolean | K
				: K
		: never;

export interface CvaConfig<V extends VariantShape> {
	variants?: V;
	defaultVariants?: {
		[K in keyof V]?: SlotKey<V[K]> | undefined;
	};
}

export type VariantBag<V extends VariantShape> = {
	[K in keyof V]?: SlotKey<V[K]> | null;
} & {
	class?: ClassValue;
	className?: ClassValue;
};

export type CvaFn<V extends VariantShape> = (
	input?: VariantBag<V> | null
) => string;

export type VariantProps<T extends CvaFn<VariantShape>> =
	T extends CvaFn<infer V> ? Omit<VariantBag<V>, 'class' | 'className'> : never;

export function cva<V extends VariantShape>(
	base: ClassValue,
	config?: CvaConfig<V>
): CvaFn<V> {
	const defaults = (config?.defaultVariants ?? {}) as Partial<{
		[K in keyof V]: SlotKey<V[K]>;
	}>;
	const variants = config?.variants;

	return ((input?: VariantBag<V> | null) => {
		const props = input ?? {};
		const { class: pClass, className, ...variantPick } = props as VariantBag<V>;
		const parts: ClassValue[] = Array.isArray(base) ? [...base] : [base];

		if (variants) {
			for (const key of Object.keys(variants)) {
				const k = key as keyof V & string;
				const group = variants[k] as Record<PropertyKey, ClassValue>;
				const raw = variantPick[k as keyof typeof variantPick];
				const picked =
					raw !== undefined && raw !== null ? raw : defaults[k as keyof V];
				if (picked === undefined || picked === null) continue;
				const slotKey =
					typeof picked === 'boolean' ? (picked ? 'true' : 'false') : picked;
				const slot = group[slotKey as PropertyKey];
				if (slot !== undefined) parts.push(slot);
			}
		}

		return clsx(...parts, pClass, className);
	}) as CvaFn<V>;
}
