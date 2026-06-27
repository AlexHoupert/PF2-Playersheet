import { createActionContext } from "./actionContext.js";
import { createActorActions } from "./actorActions.js";
import { createCampaignActions } from "./campaignActions.js";
import { createCampingActions } from "./campingActions.js";
import { createCatalogOverrideActions } from "./catalogOverrideActions.js";
import { createCharacterActions } from "./characterActions.js";
import { createEffectActions } from "./effectActions.js";
import { createEncounterActions } from "./encounterActions.js";
import { createGlobalContentActions } from "./globalContentActions.js";
import { createInventoryActions } from "./inventoryActions.js";
import { createLootActions } from "./lootActions.js";
import { createMapActions } from "./mapActions.js";
import { createMemberActions } from "./memberActions.js";
import { createProgressActions } from "./progressActions.js";
import { createQuestActions } from "./questActions.js";
import { createInstanceId } from "./inventoryReducers.js";

export function createDataActions({
  db,
  setDb,
  mode = "legacy",
  firestore = null,
  createId = () => createInstanceId("item"),
  actorEmail = null,
  repositories = {},
} = {}) {
  const actionContext = createActionContext({ db, setDb, mode, firestore, createId, actorEmail, repositories });
  const actorActions = createActorActions(actionContext);
  const campaignActions = createCampaignActions(actionContext);
  const campingActions = createCampingActions(actionContext);
  const catalogOverrideActions = createCatalogOverrideActions(actionContext);
  const characterActions = createCharacterActions(actionContext);
  const effectActions = createEffectActions(actionContext);
  const encounterActions = createEncounterActions(actionContext);
  const globalActions = createGlobalContentActions(actionContext);
  const inventoryActions = createInventoryActions(actionContext);
  const lootActions = createLootActions(actionContext);
  const mapActions = createMapActions(actionContext);
  const memberActions = createMemberActions(actionContext);
  const progressActions = createProgressActions(actionContext);
  const questActions = createQuestActions(actionContext);

  return {
    mode: actionContext.mode,
    campaign: campaignActions,
    member: memberActions,
    character: characterActions,
    inventory: inventoryActions,
    actor: actorActions,
    effect: effectActions,
    catalogOverride: catalogOverrideActions,
    loot: lootActions,
    quest: questActions,
    encounter: encounterActions,
    map: mapActions,
    progress: progressActions,
    camping: campingActions,
    bestiary: globalActions.bestiary,
    globalContent: globalActions.globalContent,
    pact: globalActions.pact,
    shop: globalActions.shop,
  };
}
