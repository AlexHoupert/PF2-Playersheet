import { composeRuntimeDbFromV2Store } from "../db/v2/runtimeDb.js";

export const E2E_USER_EMAIL = "e2e.player@example.test";
export const E2E_CAMPAIGN_ID = "e2e_campaign";
export const E2E_ACTOR_ID = "e2e_actor_nimwe";
export const E2E_CUSTOM_SPELL_ID = "spell_uplifting_overture_e2e";
export const E2E_CUSTOM_ITEM_ID = "item_smoke_custom_charm";
export const E2E_CUSTOM_CREATURE_ID = "creature_smoke_ember_bear";
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
            sheet: {
              impulses: [{
                id: "e2e_impulse_elemental_blast",
                name: "Elemental Blast",
                level: 1,
                range: "30 feet",
              }],
            },
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
              {
                instanceId: "e2e_item_slide_pistol",
                name: "Slide Pistol",
                type: "Weapon",
                qty: 1,
              },
              {
                instanceId: "e2e_item_universal_rounds",
                name: "Rounds (Universal)",
                type: "Ammo",
                qty: 3,
              },
              {
                instanceId: "e2e_item_versatile_vial",
                name: "Versatile Vial",
                type: "Consumable",
                qty: 2,
              },
            ],
            magic: {
              slots: { 0: { max: 5, used: 0 }, 1: { max: 2, used: 0 } },
              list: [{ name: "Uplifting Overture", rank: 0, _entityType: "spell" }],
            },
            formulaBook: [
              { name: "Alchemist's Fire (Lesser)", level: 1, batches: 1 },
              { name: "Alchemist's Fire (Moderate)", level: 3, batches: 1 },
              { name: "Rope", level: 0, batches: 1 },
            ],
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
        catalogEntries: {
          e2e_campaign_spell: {
            id: "e2e_campaign_spell",
            campaignId: E2E_CAMPAIGN_ID,
            catalogType: "spell",
            mode: "custom",
            origin: "custom",
            name: "Smoke Campaign Spell",
            payload: { name: "Smoke Campaign Spell", rank: 1 },
            createdBy: "e2e.player@example.test",
            ownerEmail: "e2e.player@example.test",
            isPlayerAuthored: true,
          },
        },
        catalogChangeEvents: {
          e2e_catalog_event: {
            id: "e2e_catalog_event",
            campaignId: E2E_CAMPAIGN_ID,
            entryId: "e2e_campaign_spell",
            catalogType: "spell",
            operation: "create",
            actorEmail: "e2e.player@example.test",
            actorRole: "trusted_player",
            createdAt: "2026-01-03T12:00:00.000Z",
            before: null,
            after: { id: "e2e_campaign_spell", name: "Smoke Campaign Spell" },
          },
        },
        effectRequests: {
          e2e_effect_request: {
            id: "e2e_effect_request",
            campaignId: E2E_CAMPAIGN_ID,
            status: "pending",
            activationKey: "e2e_bless_request",
            sourceActorId: E2E_ACTOR_ID,
            source: { id: "e2e_bless", name: "Bless", catalogType: "spell" },
            definitionSnapshot: {
              id: "e2e_bless_effect",
              label: "Smoke Bless",
              category: "spell",
              enabled: true,
              activation: { mode: "usable", trigger: "cast", instancePolicy: "refresh", stackingGroup: "e2e_bless" },
              targeting: { mode: "single", allowedActorKinds: ["npc"] },
              duration: { unit: "rounds", value: 2, tick: "turn_end" },
              predicates: { all: [], any: [] },
              modifiers: [{ id: "e2e_bless_attack", selector: "melee.attack", mode: "bonus", bonusType: "status", value: 1 }],
              onApply: [],
            },
            targets: [{
              targetActorId: "encounter:e2e_encounter:combatant:combatant_creature",
              targetType: "combatant",
              actorKind: "npc",
              name: "Smoke Goblin",
              encounterId: "e2e_encounter",
              combatantId: "combatant_creature",
            }],
            requestedBy: E2E_USER_EMAIL,
            createdBy: E2E_USER_EMAIL,
            createdAt: "2026-01-03T12:00:00.000Z",
          },
        },
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
        knowledgeNotes: {
          e2e_party_note_history: {
            id: "e2e_party_note_history",
            actorId: "e2e_party_actor",
            targetType: "loreArticle",
            targetId: "e2e_lore_history",
            content: "A party member marked the old road as worth revisiting.",
            sharedWithGm: false,
            sharedWithParty: true,
            createdAt: "2026-01-02T12:00:00.000Z",
            updatedAt: "2026-01-02T12:00:00.000Z",
          },
        },
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
      abilities: {
        custom: {
          e2e_legacy_ability: {
            id: "e2e_legacy_ability",
            name: "Legacy Smoke Aura",
            system: {
              actionType: { value: "passive" },
              description: { value: "A legacy ability without a traits field." },
            },
          },
        },
        deviant: {},
      },
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
      [E2E_CUSTOM_CREATURE_ID]: {
        id: E2E_CUSTOM_CREATURE_ID,
        catalogType: "creature",
        baseId: null,
        mode: "custom",
        label: "Smoke Ember Bear",
        payload: {
          id: "smoke-ember-bear",
          name: "Smoke Ember Bear",
          type: "npc",
          isCustom: true,
          sourceFile: null,
          data: {
            id: "smoke-ember-bear",
            name: "Smoke Ember Bear",
            type: "npc",
            system: {
              details: { level: { value: 4 } },
              attributes: {
                hp: { max: 44 },
                ac: { value: 21 },
                perception: { value: 12 },
              },
              saves: {
                fortitude: { value: 13 },
                reflex: { value: 10 },
                will: { value: 9 },
              },
              traits: { value: ["animal", "fire"], rarity: "uncommon", size: { value: "large" } },
            },
          },
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
