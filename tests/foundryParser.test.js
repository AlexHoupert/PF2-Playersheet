import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFoundry } from '../src/shared/utils/foundryParser.js';

test('parseFoundry resolves pact backlash condition UUID references', () => {
    const html = parseFoundry('You become @UUID[Compendium.pf2e.conditionitems.Item.Fatigued] 1.');

    assert.match(html, /data-type="condition"/);
    assert.match(html, />Fatigued<\/span> 1/);
    assert.doesNotMatch(html, /@UUID/);
});

test('parseFoundry preserves full parenthesized damage formulas with damage type', () => {
    const html = parseFoundry('<p>You regain @Damage[(2d8+5)[healing]] Hit Points.</p>');

    assert.equal(html.includes('@Damage'), false);
    assert.match(html, /2d8\+5 healing/);
    assert.match(html, /Hit Points/);
});

test('parseFoundry formats persistent damage and evaluates actor level coefficients', () => {
    const persistent = parseFoundry('@Damage[1d6[persistent,fire]] damage');
    assert.match(persistent, /1d6 persistent fire/);

    const scaled = parseFoundry('@Damage[(floor(@actor.level/2)+1)d8[poison]] damage', {
        actor: { level: 5 },
    });
    assert.match(scaled, /3d8 poison/);
});
