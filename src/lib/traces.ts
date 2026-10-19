// Agent traces published alongside a post: one JSON file per run under
// src/data/traces/<post>/<run>.json, exported from the raw run dumps (the
// export trims long tool output and drops each harness's own system prompt).
// /traces/<post>/ lists a post's runs; /traces/<post>/<run>/ shows one run
// turn by turn. Add a post's runs to TRACE_POSTS to publish them.
import { getPosts, isDraft } from './posts';

export interface TraceScore {
	kind: 'launch' | 'result';
	budget?: string;
	losses?: number[];
	reward?: number | null;
}

export interface TraceCall {
	tool: string;
	args: string;
	out: string | null;
	len: number;
	score: TraceScore | null;
}

export type TraceEntry =
	| { k: 'turn'; id: string; n: number; text: string; think?: string; calls: TraceCall[] }
	| { k: 'env'; id: string; text: string; score?: TraceScore }
	| { k: 'compact'; id: string }
	| { k: 'summary'; id: string; text: string };

// [label, percent, percent as written]
export type MixRow = [string, number, string];

export interface TraceJob {
	budget: string;
	full: boolean;
	loss: number;
	reward: number;
	rows: MixRow[];
	hourStart: number;
	hourEnd: number;
	launch: string | null;
	result: string | null;
}

export interface TraceRun {
	id: string;
	name: string;
	harness: string;
	lab: string;
	model: string;
	logo: string;
	color: 'blue' | 'love' | 'gold';
	stats: {
		testLoss: number;
		reward: number;
		turns: number;
		turnsEnv: number;
		jobs: number;
		// Submissions self_score turned away before training, by reason
		rejected: string[];
		hours: number;
		hellaswag: number | null;
		toolCalls: number;
	};
	submitted: MixRow[];
	task: string | null;
	thinking: boolean;
	jobs: TraceJob[];
	entries: TraceEntry[];
}

interface TracePost {
	title: string;
	// One sentence on what the runs are, for the index page and meta description
	about: string;
	// Run ids in display order (best first)
	runs: string[];
	// Reasoning effort every run used, e.g. 'max'
	effort?: string;
}

export const TRACE_POSTS: Record<string, TracePost> = {
	pretraingym: {
		title: 'PretrainGym',
		about: 'Three coding agents, each curating a 400M-token pretraining corpus for a fixed small model and scored by its loss on a hidden eval set.',
		runs: ['kimi-k3', 'glm-5-3', 'gpt-6-1-sol'],
		effort: 'max'
	}
};

const files = import.meta.glob<TraceRun>('../data/traces/*/*.json', { eager: true, import: 'default' });

export function traceRuns(post: string): TraceRun[] {
	return TRACE_POSTS[post].runs.map((id) => {
		const run = files[`../data/traces/${post}/${id}.json`];
		if (!run) throw new Error(`Missing trace data: src/data/traces/${post}/${id}.json`);
		return run;
	});
}

// Where the traces' post lives and whether it's public. Until it's published
// the trace pages are noindex, and they link to the post only under
// `astro dev`, where getPosts() includes drafts.
export async function tracePostLink(post: string) {
	const entry = (await getPosts()).find((p) => p.id === post);
	return { href: entry ? `/blog/${post}/` : null, published: Boolean(entry && !isDraft(entry)) };
}
