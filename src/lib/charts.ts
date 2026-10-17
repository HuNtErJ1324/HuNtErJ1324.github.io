// Shared helpers for the blog's static SVG charts (src/components/blog/).
// Charts render at build time; public/script.js §11 adds the hover layer.

// Chart hues: Rosé Pine accents stepped into the dark-mode chart band
// (OKLCH L 0.48-0.67, C >= 0.10) and validated as sets on --bg (#191724).
// Colors follow the entity across every figure in a post, never its rank.
export type ChartColor = 'love' | 'blue' | 'gold' | 'iris' | 'rose' | 'gray';

export type Format = 'int' | 'comma' | 'pct' | 'pct1' | 'dec1' | 'dec2' | 'dec3';

export const format = (value: number, kind: Format = 'dec2'): string => {
	switch (kind) {
		case 'int':
			return String(Math.round(value));
		case 'comma':
			return Math.round(value).toLocaleString('en-US');
		case 'pct':
			return `${Math.round(value * 100)}%`;
		case 'pct1':
			return `${(value * 100).toFixed(1)}%`;
		case 'dec1':
			return value.toFixed(1);
		case 'dec3':
			return value.toFixed(3);
		default:
			return value.toFixed(2);
	}
};

export interface Axis {
	label?: string;
	min: number;
	max: number;
	ticks: number[];
	log2?: boolean;
	format?: Format;
	// Format for tooltip/table values when it differs from the tick format
	valueFormat?: Format;
}

export const scale = (axis: Axis, from: number, to: number) => {
	const t = (v: number) => (axis.log2 ? Math.log2(v) : v);
	const [lo, hi] = [t(axis.min), t(axis.max)];
	return (v: number) => from + ((t(v) - lo) / (hi - lo)) * (to - from);
};

// Round to 0.1 px so the markup stays small
export const r1 = (v: number) => Math.round(v * 10) / 10;

let uid = 0;
export const chartId = (prefix: string) => `${prefix}-${++uid}`;
