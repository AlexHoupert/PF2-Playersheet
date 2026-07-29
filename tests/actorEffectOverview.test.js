import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActorEffectOverview,
  resolveVisibleSourceActor,
  selectEffectChipItems,
  selectVisibleAttackRows,
} from '../src/shared/rules/actorEffectOverview.js';
import {
  createPersistentDamageEffectInput,
  createStandardConditionEffectInput,
} from '../src/shared/rules/conditionEffectRules.js';

const persistedEffects = [
  {
    id: 'quicksilver',
    targetActorId: 'hero',
    category: 'item',
    label: 'Quicksilver Mutagen',
    source: { id: 'mutagen', name: 'Quicksilver Mutagen (Moderate)', actorId: 'hero' },
    duration: { unit: 'daily_preparation' },
    modifiers: [
      { id: 'stealth', selector: 'skill.stealth', mode: 'bonus', bonusType: 'item', value: 2 },
      { id: 'hp', selector: 'hp.max', mode: 'penalty', bonusType: 'untyped', value: -8 },
    ],
  },
  {
    id: 'bless',
    targetActorId: 'hero',
    category: 'spell',
    label: 'Bless',
    source: { type: 'spell', id: 'bless', name: 'Bless', actorId: 'nimwe' },
    definitionSnapshot: { activation: { trigger: 'cast' } },
    duration: { unit: 'minutes', remainingRounds: 10 },
    modifiers: [{ id: 'attack', selector: 'melee.attack', mode: 'bonus', bonusType: 'status', value: 1 }],
  },
];

const derivedEffect = {
  id: 'derived:armor',
  targetActorId: 'hero',
  category: 'item',
  label: 'Armor Potency',
  derived: true,
  source: { id: 'armor', name: 'Explorer Clothing', actorId: 'hero' },
  definitionSnapshot: { activation: { trigger: 'equipped' } },
  duration: { unit: 'unlimited' },
  modifiers: [
    { id: 'ac', selector: 'ac', mode: 'bonus', bonusType: 'item', value: 1 },
    { id: 'dex-cap', selector: 'ac.dex_cap', mode: 'cap', bonusType: 'untyped', value: 3 },
  ],
};

const actorRules = { effects: [...persistedEffects, derivedEffect] };
const campaign = {
  actors: [
    { id: 'hero', name: 'Kairos' },
    { id: 'nimwe', name: 'Nimwe' },
  ],
};

test('effect chips include temporary sources but exclude derived passives', () => {
  const chips = selectEffectChipItems(actorRules);
  assert.deepEqual(chips.map((chip) => chip.id), ['quicksilver', 'bless']);
  assert.equal(chips[0].label, 'Quicksilver Mutagen (Moderate)');
});

test('actor effect overview defaults to temporary and explains sources', () => {
  const overview = buildActorEffectOverview({ actorRules, campaign, scope: 'temporary' });
  assert.equal(overview.totalCount, 2);
  assert.equal(overview.derivedCount, 1);
  assert.equal(overview.effectGroups.some((group) => group.rows.some((row) => row.id === 'ac')), false);

  const magicGroup = overview.sourceGroups.find((group) => group.id === 'magic');
  assert.equal(magicGroup.sources[0].sourceActorName, 'Nimwe');
  assert.equal(magicGroup.sources[0].durationLabel, '1 min remaining');
  assert.equal(magicGroup.sources[0].removable, true);
});

test('all-active effect overview includes read-only derived sources', () => {
  const overview = buildActorEffectOverview({ actorRules, campaign, scope: 'all' });
  const itemSources = overview.sourceGroups.find((group) => group.id === 'items').sources;
  const armor = itemSources.find((source) => source.id === 'derived:armor');

  assert.equal(overview.totalCount, 3);
  assert.equal(armor.durationLabel, 'Equipped');
  assert.equal(armor.removable, false);
  assert.equal(armor.modifiers.some((modifier) => modifier.selector === 'ac.dex_cap'), false);
  assert.ok(overview.effectGroups.some((group) => group.rows.some((row) => row.id === 'ac')));
  assert.equal(overview.effectGroups.some((group) => group.rows.some((row) => row.id === 'ac.dex_cap')), false);
});

test('effects without numerical modifiers remain visible as tracked effects', () => {
  const actorRules = {
    effects: [{
      id: 'legacy_frightened',
      category: 'condition',
      label: 'Frightened',
      value: 1,
    }],
  };

  const overview = buildActorEffectOverview({ actorRules, scope: 'temporary' });
  const general = overview.effectGroups.find((group) => group.id === 'general');

  assert.equal(general.rows[0].label, 'Frightened');
  assert.equal(general.rows[0].total, 0);
  assert.equal(general.rows[0].contributions[0].applied, true);
});

test('persistent damage uses one strongest formula row without exposing its average', () => {
  const lower = {
    id: 'persistent-low',
    targetActorId: 'hero',
    ...createPersistentDamageEffectInput({ damageType: 'fire', diceCount: 1, dieSize: 4 }),
  };
  const higher = {
    id: 'persistent-high',
    targetActorId: 'hero',
    ...createPersistentDamageEffectInput({ damageType: 'fire', diceCount: 1, dieSize: 6 }),
  };
  const overview = buildActorEffectOverview({
    actorRules: { effects: [lower, higher] },
    campaign,
  });
  const persistentGroup = overview.effectGroups.find((group) => group.id === 'persistent');

  assert.equal(persistentGroup.rows.length, 1);
  assert.equal(persistentGroup.rows[0].label, 'Persistent Damage');
  assert.equal(persistentGroup.rows[0].formula, '1d6 fire');
  assert.equal(String(persistentGroup.rows[0].formula).includes('3.5'), false);
  assert.equal(persistentGroup.rows[0].sourceActorName, null);
});

test('source actor attribution requires an external actor and explicit activation trigger', () => {
  const cast = persistedEffects.find((effect) => effect.id === 'bless');
  assert.equal(resolveVisibleSourceActor(cast, campaign)?.name, 'Nimwe');
  assert.equal(resolveVisibleSourceActor({ ...cast, definitionSnapshot: null }, campaign), null);
  assert.equal(resolveVisibleSourceActor({
    ...cast,
    source: { ...cast.source, actorId: 'hero' },
  }, campaign), null);
});

test('overview combines all-check penalties with concrete save bonuses', () => {
  const overview = buildActorEffectOverview({
    actorRules: {
      effects: [
        {
          id: 'quicksilver-reflex',
          category: 'item',
          label: 'Quicksilver Mutagen (Lesser)',
          modifiers: [{ id: 'reflex', selector: 'save.reflex', mode: 'bonus', bonusType: 'item', value: 1 }],
        },
        {
          id: 'frightened',
          category: 'condition',
          label: 'Frightened',
          value: 2,
          modifiers: [{ id: 'checks', selector: 'all.checks', mode: 'penalty', bonusType: 'status', value: -2 }],
        },
      ],
    },
  });
  const defenses = overview.effectGroups.find((group) => group.id === 'defenses');
  const reflex = defenses.rows.find((row) => row.id === 'save.reflex');

  assert.equal(reflex.total, -1);
  assert.equal(reflex.breakdown.item, 1);
  assert.equal(reflex.breakdown.status, -2);
  assert.deepEqual(new Set(reflex.contributions.map((entry) => entry.effectId)), new Set(['quicksilver-reflex', 'frightened']));
});

test('attack overview keeps broad rows and only directly affected specializations', () => {
  const frightened = { id: 'frightened', ...createStandardConditionEffectInput('Frightened', 1) };
  const frightenedOverview = buildActorEffectOverview({
    actorRules: { character: { id: 'hero' }, effects: [frightened] },
  });
  const frightenedCombat = frightenedOverview.effectGroups.find((group) => group.id === 'combat');
  assert.deepEqual(
    frightenedCombat.rows.filter((row) => row.id.startsWith('attack.')).map((row) => row.id),
    ['attack.all']
  );

  const enfeebled = { id: 'enfeebled', ...createStandardConditionEffectInput('Enfeebled', 2) };
  const combinedOverview = buildActorEffectOverview({
    actorRules: { character: { id: 'hero' }, effects: [frightened, enfeebled] },
  });
  const combinedCombat = combinedOverview.effectGroups.find((group) => group.id === 'combat');
  assert.deepEqual(
    combinedCombat.rows.filter((row) => row.id.startsWith('attack.')).map((row) => row.id),
    ['attack.all', 'attack.strength']
  );
  assert.equal(combinedCombat.rows.find((row) => row.id === 'attack.all').total, -1);
  assert.equal(combinedCombat.rows.find((row) => row.id === 'attack.strength').total, -2);
});

test('attack row selection respects direct geometry modifiers and actor capabilities', () => {
  const rows = [
    { id: 'attack.all' },
    { id: 'attack.melee' },
    { id: 'attack.ranged' },
    { id: 'spell.attack' },
    { id: 'impulse.attack' },
  ];
  const directContributions = [
    { selector: 'all.checks' },
    { selector: 'attack.melee' },
    { selector: 'spell.attack' },
    { selector: 'impulse.attack' },
  ];
  const martial = selectVisibleAttackRows({
    actorRules: { character: { id: 'martial' } },
    selectorRows: rows,
    directContributions,
  });
  assert.deepEqual(martial.map((row) => row.id), ['attack.all', 'attack.melee']);

  const casterKineticist = selectVisibleAttackRows({
    actorRules: { character: { id: 'hybrid', isCaster: true, isKineticist: true } },
    selectorRows: rows,
    directContributions,
  });
  assert.deepEqual(casterKineticist.map((row) => row.id), [
    'attack.all',
    'attack.melee',
    'spell.attack',
    'impulse.attack',
  ]);
});

test('condition sources use semantic check domains and expose condition references', () => {
  const frightened = { id: 'frightened', ...createStandardConditionEffectInput('Frightened', 2) };
  const overview = buildActorEffectOverview({
    actorRules: { character: { id: 'hero' }, effects: [frightened] },
  });
  const conditionSource = overview.sourceGroups
    .find((group) => group.id === 'conditions')
    .sources.find((source) => source.id === 'frightened');

  assert.deepEqual(conditionSource.modifiers.map((modifier) => modifier.selectorLabel), [
    'Attack Rolls',
    'Skill Checks',
    'Saving Throws',
    'Perception',
    'DCs',
  ]);
  assert.ok(conditionSource.modifiers.every((modifier) => modifier.applied));
  assert.deepEqual(conditionSource.conditionReference, {
    effectId: 'frightened',
    conditionName: 'Frightened',
    value: 2,
    derived: false,
  });
});

test('derived condition contributions reference the derived condition instead of the root effect', () => {
  const restrained = { id: 'restrained', ...createStandardConditionEffectInput('Restrained', 1) };
  const actorRules = {
    character: { id: 'hero' },
    effects: [{
      ...restrained,
      ruleTree: restrained.ruleTree,
    }],
  };
  const overview = buildActorEffectOverview({ actorRules });
  const armorClass = overview.effectGroups
    .find((group) => group.id === 'defenses')
    .rows.find((row) => row.id === 'ac');
  const conditionSource = overview.sourceGroups
    .find((group) => group.id === 'conditions')
    .sources.find((source) => source.id === 'restrained');

  assert.equal(armorClass.contributions.length, 1);
  assert.deepEqual(armorClass.contributions[0].conditionReference, {
    effectId: null,
    conditionName: 'Off-Guard',
    value: 1,
    derived: true,
  });
  assert.deepEqual(conditionSource.children.map((child) => child.conditionReference.conditionName), [
    'Off-Guard',
    'Immobilized',
  ]);
});
