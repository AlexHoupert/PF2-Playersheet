import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEffectPresentationItems,
  isDeprecatedLegacyConditionEffect,
} from '../src/shared/effects/effectPresentation.js';

test('effect presentation covers standard, persistent, affliction, and custom effects', () => {
  const effects = [
    { id: 'frightened', category: 'condition', label: 'Frightened', value: 2 },
    {
      id: 'fire',
      category: 'damage_effect',
      label: '1d6 fire persistent',
      value: { formula: '1d6 fire persistent', damageType: 'fire' },
    },
    { id: 'poison', category: 'affliction', label: 'Goblin Venom', value: { stage: 1 } },
    { id: 'glue', category: 'custom', label: 'Covered in Glue', value: 1 },
    { id: 'item', category: 'item', label: 'Mutagen', value: 1 },
  ];

  const items = buildEffectPresentationItems(effects);
  assert.deepEqual(items.map((item) => item.id), ['frightened', 'fire', 'poison', 'glue']);
  assert.equal(items[0].label, 'Frightened 2');
  assert.equal(items[0].canModifyValue, true);
  assert.match(items[1].description, /DC 15 flat check/i);
  assert.match(items[2].description, /later wave/i);
  assert.match(items[3].description, /no numerical rules effect/i);
});

test('party effect presentation excludes hidden effects while actor owners retain them', () => {
  const effects = [
    { id: 'shown', category: 'condition', label: 'Off-Guard', value: 1 },
    { id: 'hidden', category: 'affliction', label: 'Secret Curse', value: 1, hidden: true },
  ];

  assert.deepEqual(buildEffectPresentationItems(effects, { viewerMode: 'party' }).map((item) => item.id), ['shown']);
  assert.deepEqual(buildEffectPresentationItems(effects, { viewerMode: 'owner' }).map((item) => item.id), ['shown', 'hidden']);
});

test('legacy generic persistent damage and fast healing are excluded from presentation', () => {
  const persistent = { id: 'persistent', category: 'condition', label: 'Persistent Damage', value: 1 };
  const healing = { id: 'healing', category: 'condition', label: 'Fast Healing', value: 1 };

  assert.equal(isDeprecatedLegacyConditionEffect(persistent), true);
  assert.equal(isDeprecatedLegacyConditionEffect(healing), true);
  assert.deepEqual(buildEffectPresentationItems([persistent, healing]), []);
});
