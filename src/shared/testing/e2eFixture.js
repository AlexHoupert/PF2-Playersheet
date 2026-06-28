import { composeRuntimeDbFromV2Store } from "../db/v2/runtimeDb.js";

export const E2E_USER_EMAIL = "e2e.player@example.test";
export const E2E_CAMPAIGN_ID = "e2e_campaign";
export const E2E_ACTOR_ID = "e2e_actor_nimwe";
export const E2E_CUSTOM_SPELL_ID = "spell_uplifting_overture_e2e";

export function isE2eFixtureEnabled() {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(window.location.search).get("e2e") === "true";
}

export function createE2eV2Store() {
  return {
    campaigns: {
      [E2E_CAMPAIGN_ID]: {
        id: E2E_CAMPAIGN_ID,
        name: "E2E Smoke Campaign",
        advancement: { xpThreshold: 1000 },
        actors: {
          [E2E_ACTOR_ID]: {
            id: E2E_ACTOR_ID,
            kind: "pc",
            campaignId: E2E_CAMPAIGN_ID,
            name: "Nimwe Smoke",
            level: 5,
            sheet: {},
            stats: {
              hp: { current: 24, max: 30, temp: 0 },
              attributes: { str: 0, dex: 3, con: 1, int: 2, wis: 1, cha: 2 },
              ac: { shield_raised: false, armor_equipped: false },
              saves: { fortitude: 4, reflex: 6, will: 5 },
              speed: { land: 25 },
              class_dc: 20,
            },
            skills: { Arcana: 7, Performance: 6 },
            inventory: [
              {
                instanceId: "e2e_item_alchemist_fire",
                name: "Alchemist's Fire (Lesser)",
                type: "Consumable",
                level: 1,
                qty: 2,
                price: 3,
              },
            ],
            magic: {
              slots: { 0: { max: 5, used: 0 }, 1: { max: 2, used: 0 } },
              list: [{ name: "Uplifting Overture", rank: 0, _entityType: "spell" }],
            },
            formulaBook: [{ name: "Alchemist's Fire (Lesser)", level: 1, batches: 1 }],
            gold: 12,
            xp: { current: 100, max: 1000 },
          },
        },
        actorEffects: {
          e2e_effect_frightened: {
            id: "e2e_effect_frightened",
            targetActorId: E2E_ACTOR_ID,
            label: "Frightened",
            category: "condition",
            value: 1,
          },
        },
        effectTemplates: {},
        quests: {
          e2e_quest: {
            id: "e2e_quest",
            title: "Smoke Test Quest",
            status: "Active",
            type: "Main",
            objectives: [{ text: "Keep the table alive", completed: false }],
            rewards: { xp: 20, gold: 1, itemRewards: [] },
          },
        },
        lootBags: {
          e2e_loot: {
            id: "e2e_loot",
            name: "Smoke Loot",
            goldValue: 5,
            items: [{ instanceId: "e2e_loot_item", name: "Healing Potion (Minor)", qty: 1, level: 1 }],
          },
        },
        encounters: {
          e2e_encounter: {
            id: "e2e_encounter",
            name: "Smoke Encounter",
            isActive: true,
            combatants: [
              {
                id: "combatant_player",
                type: "player",
                playerId: E2E_ACTOR_ID,
                name: "Nimwe Smoke",
                initiative: 18,
                hp: 24,
                maxHp: 30,
              },
              {
                id: "combatant_creature",
                type: "creature",
                creatureId: "goblin-warrior",
                name: "Smoke Goblin",
                initiative: 12,
                hp: 8,
                maxHp: 8,
                effectTargetId: "encounter:e2e_encounter:combatant:combatant_creature",
              },
            ],
          },
        },
        maps: {},
        members: {
          [E2E_USER_EMAIL]: {
            id: E2E_USER_EMAIL,
            email: E2E_USER_EMAIL,
            role: "player",
            assignedActorId: E2E_ACTOR_ID,
          },
          "e2e.gm@example.test": {
            id: "e2e.gm@example.test",
            email: "e2e.gm@example.test",
            role: "gm",
            assignedActorId: null,
          },
        },
      },
    },
    global: {
      shop: {
        availableItems: ["Alchemist's Fire (Lesser)", "Healing Potion (Minor)"],
        availableFormulas: ["Alchemist's Fire (Lesser)"],
        traders: [
          {
            id: "e2e_trader",
            name: "Smoke Trader",
            category: "General",
            inventory: ["Alchemist's Fire (Lesser)", "Healing Potion (Minor)"],
          },
        ],
      },
      notificationQueue: [],
    },
    catalogOverrides: {
      [E2E_CUSTOM_SPELL_ID]: {
        id: E2E_CUSTOM_SPELL_ID,
        catalogType: "spell",
        baseId: "spells/uplifting-overture.json",
        mode: "override",
        payload: {
          name: "Uplifting Overture",
          rank: 0,
          level: 0,
          type: "Spell",
          description: "E2E override spell.",
          sourceFile: null,
          overrideSourceFile: "spells/uplifting-overture.json",
        },
      },
    },
    customItems: {},
    customActions: {},
    customCreatures: {},
    loreArticles: {},
    documentCount: 12,
  };
}

export function createE2eRuntimeDb() {
  return composeRuntimeDbFromV2Store(createE2eV2Store());
}

export function createE2eUser() {
  return {
    uid: "e2e-user",
    email: E2E_USER_EMAIL,
    displayName: "E2E Player",
  };
}
