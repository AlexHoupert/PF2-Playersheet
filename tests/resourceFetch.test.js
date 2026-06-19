import test from 'node:test';
import assert from 'node:assert/strict';
import {
    fetchJsonFromResourceCandidates,
    getResourceCandidateUrls,
    normalizeResourceSourceFile,
} from '../src/shared/catalog/resourceFetch.js';

test('resource source files normalize legacy prefixes', () => {
    assert.equal(normalizeResourceSourceFile('ressources/spells/1st-rank/heal.json'), 'spells/1st-rank/heal.json');
    assert.equal(normalizeResourceSourceFile('/api/static/spells/1st-rank/heal.json'), 'spells/1st-rank/heal.json');
    assert.equal(normalizeResourceSourceFile('spells\\1st-rank\\heal.json'), 'spells/1st-rank/heal.json');
});

test('resource candidate URLs prefer dev API static before legacy static path', () => {
    assert.deepEqual(getResourceCandidateUrls('ressources/spells/heal.json'), [
        '/api/static/spells/heal.json',
        '/ressources/spells/heal.json',
    ]);

    assert.deepEqual(getResourceCandidateUrls('spells/heal.json', { isProd: true }), [
        '/ressources/spells/heal.json',
        '/api/static/spells/heal.json',
    ]);
});

test('resource JSON fetch falls back when first candidate returns non-JSON page text', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
        calls.push(url);
        if (url.startsWith('/api/static/')) {
            return {
                ok: true,
                status: 200,
                statusText: 'OK',
                text: async () => 'The page could not be found',
            };
        }
        return {
            ok: true,
            status: 200,
            statusText: 'OK',
            text: async () => '{"name":"Heal"}',
        };
    };

    const data = await fetchJsonFromResourceCandidates('spells/1st-rank/heal.json', { fetchImpl });
    assert.deepEqual(data, { name: 'Heal' });
    assert.deepEqual(calls, [
        '/api/static/spells/1st-rank/heal.json',
        '/ressources/spells/1st-rank/heal.json',
    ]);
});
