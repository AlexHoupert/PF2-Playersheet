const sourceLevelTiers = [
  { min: 1, value: 1 },
  { min: 3, value: 2 },
  { min: 11, value: 3 },
  { min: 17, value: 4 },
];

const tieredItemBonus = Object.freeze({
  mode: "source_level_tiers",
  value: 1,
  tiers: sourceLevelTiers,
});

export const DECLARATIVE_RULE_SEEDS = Object.freeze({
  item: Object.freeze({
    "bestial mutagen": {
      match: "includes",
      effectDefinitions: [createBestialDefinition()],
    },
    "quicksilver mutagen": {
      match: "includes",
      effectDefinitions: [createQuicksilverDefinition()],
    },
    "juggernaut mutagen": {
      match: "includes",
      effectDefinitions: [createJuggernautDefinition()],
    },
    "serene mutagen": {
      match: "includes",
      effectDefinitions: [createSereneDefinition()],
    },
    "silvertongue mutagen": {
      match: "includes",
      effectDefinitions: [createSilvertongueDefinition()],
    },
    "cognitive mutagen": {
      match: "includes",
      effectDefinitions: [createCognitiveDefinition()],
    },
  }),
  feat: Object.freeze({
    "scaly skin": {
      aliases: ["scaly hide"],
      effectDefinitions: [createScalySkinDefinition()],
    },
  }),
  spell: Object.freeze({
    bless: {
      effectDefinitions: [createBlessDefinition()],
    },
  }),
  impulse: Object.freeze({
    "metal carapace": {
      effectDefinitions: [createMetalCarapaceDefinition()],
    },
  }),
});

function createMutagenDefinition({ id, label, bonuses = [], penalties = [], onApply = [] }) {
  return {
    id,
    label,
    category: "item",
    enabled: true,
    activation: {
      mode: "usable",
      trigger: "consume",
      instancePolicy: "replace",
      stackingGroup: "mutagen",
      cost: { type: "inventory_item", quantity: 1, consumeSource: true },
    },
    targeting: { mode: "self", allowedActorKinds: ["pc", "guest"] },
    duration: { unit: "daily_preparation", value: null, tick: "turn_end" },
    predicates: { all: [], any: [] },
    modifiers: [
      ...bonuses.map((selector, index) => ({
        id: `${id}_bonus_${index}`,
        selector,
        mode: "bonus",
        bonusType: "item",
        value: tieredItemBonus,
        stackingKey: `${id}:${selector}`,
      })),
      ...penalties.flatMap(({ selectors, value, bonusType = "item" }, groupIndex) => selectors.map((selector, index) => ({
        id: `${id}_penalty_${groupIndex}_${index}`,
        selector,
        mode: "penalty",
        bonusType,
        value,
        stackingKey: `${id}:${selector}`,
      }))),
    ],
    onApply,
  };
}

export function createBestialDefinition() {
  return createMutagenDefinition({
    id: "bestial_mutagen",
    label: "Bestial Mutagen",
    bonuses: ["skill.athletics", "melee.attack"],
    penalties: [
      { selectors: ["ac"], value: 1 },
      { selectors: ["save.reflex"], value: 2 },
    ],
  });
}

export function selectSeededEffectDefinitions(sourceType, source) {
  const entries = DECLARATIVE_RULE_SEEDS[sourceType] || {};
  const name = String(source?.name || source?.label || source || "").trim().toLowerCase();
  for (const [canonicalName, entry] of Object.entries(entries)) {
    const names = [canonicalName, ...(entry.aliases || [])];
    const matches = entry.match === "includes"
      ? names.some(candidate => name.includes(candidate))
      : names.includes(name);
    if (matches) return entry.effectDefinitions;
  }
  return [];
}

export function createQuicksilverDefinition() {
  const definition = createMutagenDefinition({
    id: "quicksilver_mutagen",
    label: "Quicksilver Mutagen",
    bonuses: ["skill.acrobatics", "skill.stealth", "skill.thievery", "save.reflex", "ranged.attack"],
    onApply: [{
      id: "quicksilver_hp_current",
      type: "adjust_hp",
      value: { mode: "actor_level_multiplier", value: 0, multiplier: -2, tiers: [] },
    }],
  });
  definition.modifiers.push({
        id: "quicksilver_hp",
        selector: "hp.max",
        mode: "penalty",
        bonusType: "untyped",
        value: { mode: "actor_level_multiplier", value: 0, multiplier: 2, tiers: [] },
        stackingKey: "quicksilver:hp.max",
  });
  return definition;
}

export function createJuggernautDefinition() {
  return createMutagenDefinition({
    id: "juggernaut_mutagen",
    label: "Juggernaut Mutagen",
    bonuses: ["save.fortitude"],
    penalties: [{ selectors: ["save.will", "perception", "initiative"], value: 2 }],
    onApply: [{
      id: "juggernaut_temp_hp",
      type: "ensure_temp_hp",
      value: {
        mode: "source_level_tiers",
        value: 5,
        multiplier: 0,
        tiers: [
          { min: 1, value: 5 },
          { min: 3, value: 10 },
          { min: 11, value: 30 },
          { min: 17, value: 40 },
        ],
      },
    }],
  });
}

export function createSereneDefinition() {
  return createMutagenDefinition({
    id: "serene_mutagen",
    label: "Serene Mutagen",
    bonuses: ["save.will", "skill.medicine", "skill.nature", "skill.religion", "skill.survival"],
    penalties: [{
      selectors: [
        "melee.attack", "ranged.attack", "spell.attack", "impulse.attack",
        "melee.damage", "ranged.damage", "spell.damage", "impulse.damage",
      ],
      value: 1,
    }],
  });
}

export function createSilvertongueDefinition() {
  return createMutagenDefinition({
    id: "silvertongue_mutagen",
    label: "Silvertongue Mutagen",
    bonuses: ["skill.deception", "skill.diplomacy", "skill.intimidation", "skill.performance"],
    penalties: [{
      selectors: ["skill.arcana", "skill.crafting", "skill.lore", "skill.occultism", "skill.society"],
      value: 2,
    }],
  });
}

export function createCognitiveDefinition() {
  return createMutagenDefinition({
    id: "cognitive_mutagen",
    label: "Cognitive Mutagen",
    bonuses: ["skill.arcana", "skill.crafting", "skill.lore", "skill.occultism", "skill.society"],
    penalties: [{
      selectors: ["skill.athletics", "skill.acrobatics", "melee.attack", "ranged.attack", "spell.attack", "impulse.attack"],
      value: 2,
    }],
  });
}

export function createScalySkinDefinition() {
  return {
    id: "scaly_skin_ac",
    label: "Scaly Skin",
    category: "feat",
    enabled: true,
    activation: { mode: "passive", trigger: "owned", instancePolicy: "replace", stackingGroup: "scaly_skin" },
    targeting: { mode: "self", allowedActorKinds: ["pc", "guest"] },
    duration: { unit: "unlimited", value: null, tick: "turn_end" },
    predicates: { all: [{ id: "unarmored", type: "unarmored", operator: "eq", value: true }], any: [] },
    modifiers: [
      {
        id: "scaly_skin_item_ac",
        selector: "ac",
        mode: "bonus",
        bonusType: "item",
        value: {
          mode: "actor_level_tiers",
          value: 1,
          multiplier: 0,
          tiers: [{ min: 1, value: 1 }, { min: 5, value: 2 }],
        },
        stackingKey: "scaly_skin_ac",
        dependencyKey: "ac.item",
      },
      {
        id: "scaly_skin_dex_cap",
        selector: "ac.dex_cap",
        mode: "cap",
        bonusType: "untyped",
        value: { mode: "fixed", value: 3, multiplier: 0, tiers: [] },
        stackingKey: "scaly_skin_dex_cap",
        dependencyKey: "ac.dex_cap",
      },
    ],
    onApply: [],
  };
}

export function createBlessDefinition() {
  return {
    id: "bless_attack_bonus",
    label: "Bless",
    category: "spell",
    enabled: true,
    activation: { mode: "usable", trigger: "cast", instancePolicy: "refresh", stackingGroup: "bless" },
    targeting: { mode: "multiple", allowedActorKinds: ["pc", "guest", "npc"] },
    duration: { unit: "minutes", value: 1, tick: "turn_end" },
    predicates: { all: [], any: [] },
    modifiers: [
      { id: "bless_melee", selector: "melee.attack", mode: "bonus", bonusType: "status", value: 1, stackingKey: "bless" },
      { id: "bless_ranged", selector: "ranged.attack", mode: "bonus", bonusType: "status", value: 1, stackingKey: "bless" },
      { id: "bless_spell", selector: "spell.attack", mode: "bonus", bonusType: "status", value: 1, stackingKey: "bless" },
      { id: "bless_impulse", selector: "impulse.attack", mode: "bonus", bonusType: "status", value: 1, stackingKey: "bless" },
    ],
    onApply: [],
  };
}

export function createMetalCarapaceDefinition() {
  return {
    id: "metal_carapace_armor",
    label: "Metal Carapace",
    category: "impulse",
    enabled: true,
    activation: { mode: "usable", trigger: "activate", instancePolicy: "replace", stackingGroup: "impulse_armor" },
    targeting: { mode: "self", allowedActorKinds: ["pc", "guest"] },
    duration: { unit: "minutes", value: 10, tick: "turn_end" },
    predicates: { all: [], any: [] },
    modifiers: [
      { id: "metal_carapace_ac", selector: "ac", mode: "bonus", bonusType: "item", value: 3, stackingKey: "metal_carapace_ac", dependencyKey: "ac.item" },
      { id: "metal_carapace_dex_cap", selector: "ac.dex_cap", mode: "cap", bonusType: "untyped", value: 2, stackingKey: "metal_carapace_dex_cap", dependencyKey: "ac.dex_cap" },
      { id: "metal_carapace_speed", selector: "speed", mode: "penalty", bonusType: "untyped", value: -5, stackingKey: "metal_carapace_speed" },
    ],
    onApply: [],
  };
}
