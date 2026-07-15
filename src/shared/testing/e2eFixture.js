import { composeRuntimeDbFromV2Store } from "../db/v2/runtimeDb.js";

export const E2E_USER_EMAIL = "e2e.player@example.test";
export const E2E_CAMPAIGN_ID = "e2e_campaign";
export const E2E_ACTOR_ID = "e2e_actor_nimwe";
export const E2E_CUSTOM_SPELL_ID = "spell_uplifting_overture_e2e";
export const E2E_CUSTOM_ITEM_ID = "item_smoke_custom_charm";
const E2E_UPLIFTING_OVERTURE_SOURCE = "spells/focus/uplifting-overture.json";

export function isE2eFixtureEnabled() {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(window.location.search).get("e2e") === "true";
}

export function isE2eAuthGateEnabled() {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(window.location.search).get("e2eAuthGate") === "true";
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
        loreArticles: {
          e2e_lore_history: {
            id: "e2e_lore_history",
            title: "Founding of Smokehaven",
            category: "history",
            groupId: "e2e_lore_group_history",
            tags: ["smoke", "founding"],
            image: null,
            bodyBlocks: [{
              id: "e2e_lore_history_block",
              type: "content",
              content: "Smokehaven grew around the old road to [[lore:e2e_lore_location|Smokehaven Square]]. Its scouts documented [[creature:fLLKuOXwPq1Iq0U4|goblin warriors]].",
              audience: { mode: "inherit", actorIds: [] },
            }],
            infobox: [{ id: "e2e_lore_fact", label: "Era", value: "Founding age" }],
            categoryData: { dateLabel: "4721 AR", sortKey: "4721" },
            links: [
              { type: "lore", id: "e2e_lore_location", label: "Smokehaven Square" },
              { type: "creature", id: "fLLKuOXwPq1Iq0U4", label: "goblin warriors" },
            ],
            publication: {
              status: "published",
              version: 1,
              attentionVersion: 0,
              audience: { mode: "party", actorIds: [] },
              publishedAt: "2026-01-01T12:00:00.000Z",
              publishedBy: "e2e.gm@example.test",
            },
            publishedSnapshot: null,
            createdAt: "2026-01-01T12:00:00.000Z",
            updatedAt: "2026-01-01T12:00:00.000Z",
          },
          e2e_lore_location: {
            id: "e2e_lore_location",
            title: "Smokehaven Square",
            category: "locations",
            groupId: "e2e_lore_group_locations",
            tags: ["settlement"],
            bodyBlocks: [{
              id: "e2e_lore_location_block",
              type: "content",
              content: "A busy square at the center of Smokehaven.",
              audience: { mode: "inherit", actorIds: [] },
            }],
            infobox: [],
            categoryData: { region: "Smokehaven" },
            links: [],
            publication: {
              status: "published",
              version: 1,
              attentionVersion: 0,
              audience: { mode: "party", actorIds: [] },
              publishedAt: "2026-01-01T12:00:00.000Z",
              publishedBy: "e2e.gm@example.test",
            },
            publishedSnapshot: null,
            createdAt: "2026-01-01T12:00:00.000Z",
            updatedAt: "2026-01-01T12:00:00.000Z",
          },
        },
        loreGroups: {
          e2e_lore_group_history: { id: "e2e_lore_group_history", name: "Founding", category: "history", parentId: null, sortOrder: 0 },
          e2e_lore_group_locations: { id: "e2e_lore_group_locations", name: "Smokehaven", category: "locations", parentId: null, sortOrder: 0 },
        },
        loreDeliveries: {
          e2e_lore_history_delivery: {
            id: "e2e_lore_history_delivery",
            articleId: "e2e_lore_history",
            actorId: E2E_ACTOR_ID,
            version: 1,
            attentionVersion: 0,
            readVersion: 0,
            notifiedVersion: 0,
            snapshot: {
              articleId: "e2e_lore_history",
              title: "Founding of Smokehaven",
              category: "history",
              groupId: "e2e_lore_group_history",
              tags: ["smoke", "founding"],
              image: null,
              bodyBlocks: [{ id: "e2e_lore_history_block", type: "content", content: "Smokehaven grew around the old road to [[lore:e2e_lore_location|Smokehaven Square]]. Its scouts documented [[creature:fLLKuOXwPq1Iq0U4|goblin warriors]].", audience: { mode: "inherit", actorIds: [] } }],
              infobox: [{ id: "e2e_lore_fact", label: "Era", value: "Founding age" }],
              categoryData: { dateLabel: "4721 AR", sortKey: "4721" },
              links: [{ type: "lore", id: "e2e_lore_location", label: "Smokehaven Square" }, { type: "creature", id: "fLLKuOXwPq1Iq0U4", label: "goblin warriors" }],
            },
            publishedAt: "2026-01-01T12:00:00.000Z",
            revokedAt: null,
          },
          e2e_lore_location_delivery: {
            id: "e2e_lore_location_delivery",
            articleId: "e2e_lore_location",
            actorId: E2E_ACTOR_ID,
            version: 1,
            attentionVersion: 0,
            readVersion: 0,
            notifiedVersion: 0,
            snapshot: {
              articleId: "e2e_lore_location",
              title: "Smokehaven Square",
              category: "locations",
              groupId: "e2e_lore_group_locations",
              tags: ["settlement"],
              image: null,
              bodyBlocks: [{ id: "e2e_lore_location_block", type: "content", content: "A busy square at the center of Smokehaven.", audience: { mode: "inherit", actorIds: [] } }],
              infobox: [],
              categoryData: { region: "Smokehaven" },
              links: [],
            },
            publishedAt: "2026-01-01T12:00:00.000Z",
            revokedAt: null,
          },
        },
        knowledgeNotes: {},
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
      bestiary: {
        creatures: {
          fLLKuOXwPq1Iq0U4: {
            id: "fLLKuOXwPq1Iq0U4",
            group: "Goblins",
            bestiary: true,
            revealState: { name: "precise", level: "precise", size: "precise" },
          },
        },
      },
    },
    catalogOverrides: {
      [E2E_CUSTOM_SPELL_ID]: {
        id: E2E_CUSTOM_SPELL_ID,
        catalogType: "spell",
        baseId: E2E_UPLIFTING_OVERTURE_SOURCE,
        mode: "override",
        payload: {
          name: "Uplifting Overture",
          rank: 0,
          level: 0,
          type: "Spell",
          description: "E2E override spell.",
          sourceFile: null,
          overrideSourceFile: E2E_UPLIFTING_OVERTURE_SOURCE,
        },
      },
    },
    customItems: {
      [E2E_CUSTOM_ITEM_ID]: {
        id: E2E_CUSTOM_ITEM_ID,
        name: "Smoke Custom Charm",
        type: "equipment",
        img: "icons/equipment/held-items/feather-blue.webp",
        system: {
          level: { value: 0 },
          price: { value: { gp: 1 } },
          traits: { value: ["magical"], rarity: "common" },
          description: { value: "A deterministic E2E custom item." },
          bulk: { value: "L" },
          category: "held",
        },
      },
    },
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
