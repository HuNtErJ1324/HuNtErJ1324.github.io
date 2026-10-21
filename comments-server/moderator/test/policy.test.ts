import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Verdict } from '../src/classify.ts';
import { decide, hasLinkOrImage } from '../src/policy.ts';

const verdict = (decision: Verdict['decision']): Verdict => ({ decision, category: 'ok', reason: 'test' });
const plain = { markdown: 'Nice work on the evals.', html: '<p>Nice work on the evals.</p>' };

test('finds links and images in the rendered HTML or the raw text', () => {
    assert.equal(hasLinkOrImage(plain), false);
    assert.equal(hasLinkOrImage({ markdown: '[cheap](https://spam.example)', html: '<p><a href="https://spam.example">cheap</a></p>' }), true);
    assert.equal(hasLinkOrImage({ markdown: '![x](https://img.example/x.png)', html: '<p><img src="https://img.example/x.png"></p>' }), true);
    // Comentario may not autolink a bare URL; the raw text still counts
    assert.equal(hasLinkOrImage({ markdown: 'see http://spam.example', html: '<p>see http://spam.example</p>' }), true);
    assert.equal(hasLinkOrImage({ markdown: 'visit www.spam-site.example today', html: '<p>visit www.spam-site.example today</p>' }), true);
    // Words that merely start like a tag don't count
    assert.equal(hasLinkOrImage({ markdown: '<abbr>', html: '<p>&lt;abbr&gt; <abbr>x</abbr></p>' }), false);
});

test('follows the verdict, but never auto-approves a link or image', () => {
    assert.deepEqual(decide(verdict('approve'), plain), { action: 'approve' });
    assert.deepEqual(decide(verdict('reject'), plain), { action: 'reject' });
    assert.deepEqual(decide(verdict('hold'), plain), { action: 'hold' });
    const linked = { markdown: 'https://example.com', html: '<p><a href="https://example.com">https://example.com</a></p>' };
    assert.equal(decide(verdict('approve'), linked).action, 'hold');
    assert.equal(decide(verdict('reject'), linked).action, 'reject');
});
