import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldUseCompactAddButton } from '../src/shared/components/conditionListLayout.js';

test('condition add button compacts only when it prevents a new row', () => {
    assert.equal(shouldUseCompactAddButton({
        containerWidth: 360,
        itemWidths: [140, 140],
        fullWidth: 105,
        compactWidth: 30,
        gap: 6,
    }), true);

    assert.equal(shouldUseCompactAddButton({
        containerWidth: 420,
        itemWidths: [140, 140],
        fullWidth: 105,
        compactWidth: 30,
        gap: 6,
    }), false);

    assert.equal(shouldUseCompactAddButton({
        containerWidth: 300,
        itemWidths: [270],
        fullWidth: 105,
        compactWidth: 30,
        gap: 6,
    }), false);
});
