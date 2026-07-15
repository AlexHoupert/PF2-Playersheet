import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useAppFeedback } from '../feedback/AppFeedback';
import { db as firestoreDb } from '../db/firebase-config';
import { createDataActions } from '../db/domain/createDataActions';
import { isSoftDeleted, normalizeEmail } from '../db/domain/campaignReducers';
import { selectActorBuckets, selectMyActor, selectOwnedActors, selectPcActors } from '../db/selectors/actorSelectors';
import { selectActiveCampaign, selectCampaignBuckets, selectLootBagLists, selectQuestLists, selectTargetCampaignId } from '../db/selectors/campaignSelectors';
import { selectMyCharacter } from '../db/selectors/characterSelectors';
import { selectShop } from '../db/selectors/shopSelectors';
import { composeRuntimeDbFromV2Store } from '../db/v2/runtimeDb';
import {
    actorRepo,
    campaignRepo,
    catalogOverrideRepo,
    effectRepo,
    encounterRepo,
    globalRepo,
    lootRepo,
    mapRepo,
    memberRepo,
    questRepo,
} from '../db/v2/repositories';
import { loreRepo } from '../db/v2/loreRepository';

const CampaignContext = createContext();

const defaultRepositories = {
    actorRepo,
    campaignRepo,
    catalogOverrideRepo,
    effectRepo,
    encounterRepo,
    globalRepo,
    lootRepo,
    loreRepo,
    mapRepo,
    memberRepo,
    questRepo,
};

export function useCampaign() {
    return useContext(CampaignContext);
}

export function CampaignProvider({
    v2Store = null,
    runtimeDb = null,
    setRuntimeDb = null,
    children,
    isAdmin = false,
    dbMode = 'legacy',
    dbStatus = null
}) {
    const { user } = useAuth();
    const { notifyError } = useAppFeedback();
    const db = useMemo(() => runtimeDb || composeRuntimeDbFromV2Store(v2Store), [runtimeDb, v2Store]);
    const userEmail = normalizeEmail(user?.email);
    const v2UserInfo = useMemo(() => selectUserInfoFromV2Store(v2Store, userEmail), [v2Store, userEmail]);
    const dataActions = useMemo(
        () => createDataActions({
            db,
            setDb: setRuntimeDb,
            mode: dbMode,
            actorEmail: userEmail,
            firestore: firestoreDb,
            repositories: defaultRepositories,
        }),
        [db, dbMode, userEmail]
    );

    // We need to determine:
    // 1. Is the user a GM? (Simple check for now: matching email or role in db)
    // 2. What is their assigned campaign?
    // 3. What is their assigned character?

    const userInfo = v2UserInfo;
    const isGM = (userInfo?.role === 'gm') || isAdmin; // Simple GM check or Admin View override

    // For Players: Resolve Campaign ID from assignment
    // For GMs: Allow Manual Selection (Local State for UI)
    // Persist this choice so it survives Admin <-> Player toggle
    const [selectedCampaignId, setSelectedCampaignIdState] = useState(() => {
        return localStorage.getItem('gm_selected_campaign') || null;
    });

    const setSelectedCampaignId = React.useCallback((id) => {
        setSelectedCampaignIdState(id);
        if (id) localStorage.setItem('gm_selected_campaign', id);
        else localStorage.removeItem('gm_selected_campaign');
    }, []);

    // Auto-select for players
    useEffect(() => {
        if (!isGM && userInfo?.campaignId && db.campaigns?.[userInfo.campaignId] && !isSoftDeleted(db.campaigns[userInfo.campaignId])) {
            setSelectedCampaignId(userInfo.campaignId);
        }
    }, [isGM, userInfo, db.campaigns, setSelectedCampaignId]);

    // Derived Data
    const { campaigns, archivedCampaigns } = useMemo(() => selectCampaignBuckets(db), [db]);

    // Active Campaign Object
    // If GM, use selected. If Player, use assigned.
    // If nothing selected/assigned, try to use "default" or first available?
    const targetCampaignId = selectTargetCampaignId({ campaigns, isGM, selectedCampaignId, userInfo });

    const activeCampaign = selectActiveCampaign(campaigns, targetCampaignId);
    const { actors, archivedActors } = useMemo(() => selectActorBuckets(activeCampaign), [activeCampaign]);
    const pcActors = useMemo(() => selectPcActors(activeCampaign), [activeCampaign]);

    // Active Character (User's specific character)
    const myCharacter = selectMyCharacter(activeCampaign, userInfo);
    const myActor = selectMyActor(activeCampaign, userInfo);
    const ownedActors = useMemo(() => selectOwnedActors(activeCampaign, myActor?.id), [activeCampaign, myActor?.id]);
    const questLists = useMemo(() => selectQuestLists(db, activeCampaign, targetCampaignId), [db, activeCampaign, targetCampaignId]);
    const lootBagLists = useMemo(() => selectLootBagLists(db, activeCampaign, targetCampaignId), [db, activeCampaign, targetCampaignId]);
    const shop = useMemo(() => selectShop(db), [db]);
    const bestiary = db.bestiary || { creatures: {}, customCreatures: {} };

    useEffect(() => {
        if (selectedCampaignId && !campaigns[selectedCampaignId]) {
            setSelectedCampaignId(null);
        }
    }, [selectedCampaignId, campaigns, setSelectedCampaignId]);

    const runDataAction = React.useCallback((action) => {
        return Promise.resolve(action).catch(err => {
            console.error(err);
            notifyError(err);
        });
    }, [notifyError]);

    const createCampaign = React.useCallback((name) => {
        const action = dataActions.campaign.createCampaign(name);
        runDataAction(action).then(id => {
            if (id) setSelectedCampaignId(id);
        });
        return action;
    }, [dataActions, runDataAction, setSelectedCampaignId]);

    const deleteCampaign = React.useCallback((id) => {
        runDataAction(dataActions.campaign.softDeleteCampaign(id));
        if (selectedCampaignId === id) setSelectedCampaignId(null);
    }, [dataActions, runDataAction, selectedCampaignId, setSelectedCampaignId]);

    const restoreCampaign = React.useCallback((id) => {
        runDataAction(dataActions.campaign.restoreCampaign(id));
    }, [dataActions, runDataAction]);

    const assignUser = React.useCallback((email, campaignId, characterId, role = 'player') => {
        runDataAction(dataActions.member.assignUser(email, campaignId, characterId, role));
    }, [dataActions, runDataAction]);

    const revokeUser = React.useCallback((email) => {
        runDataAction(dataActions.member.revokeUser(email));
    }, [dataActions, runDataAction]);

    const createCharacter = React.useCallback((campaignId, character) => {
        runDataAction(dataActions.character.createCharacter(campaignId, character));
    }, [dataActions, runDataAction]);

    const deleteCharacter = React.useCallback((campaignId, characterId) => {
        runDataAction(dataActions.character.softDeleteCharacter(campaignId, characterId));
    }, [dataActions, runDataAction]);

    const restoreCharacter = React.useCallback((campaignId, characterId) => {
        runDataAction(dataActions.character.restoreCharacter(campaignId, characterId));
    }, [dataActions, runDataAction]);

    const importLegacyCharacter = React.useCallback((campaignId, character, legacyIndex) => {
        runDataAction(dataActions.character.importLegacyCharacter(campaignId, character, legacyIndex));
    }, [dataActions, runDataAction]);

    const setPartyXp = React.useCallback((campaignId, xp) => {
        runDataAction(dataActions.campaign.setPartyXp(campaignId, xp));
    }, [dataActions, runDataAction]);

    const setXpThreshold = React.useCallback((campaignId, threshold) => {
        runDataAction(dataActions.campaign.setXpThreshold(campaignId, threshold));
    }, [dataActions, runDataAction]);

    const addPartyXp = React.useCallback((campaignId, amount) => {
        runDataAction(dataActions.campaign.addPartyXp(campaignId, amount));
    }, [dataActions, runDataAction]);

    const value = useMemo(() => ({
        campaigns,
        archivedCampaigns,
        activeCampaign,
        activeCampaignId: targetCampaignId,
        actors,
        archivedActors,
        pcActors,
        ownedActors,
        myCharacter,
        myActor,
        quests: questLists.quests,
        archivedQuests: questLists.archivedQuests,
        allQuests: questLists.allQuests,
        lootBags: lootBagLists.lootBags,
        archivedLootBags: lootBagLists.archivedLootBags,
        allLootBags: lootBagLists.allLootBags,
        encounters: activeCampaign?.encounters || [],
        archivedEncounters: activeCampaign?.archivedEncounters || [],
        maps: activeCampaign?.maps || [],
        archivedMaps: activeCampaign?.archivedMaps || [],
        members: activeCampaign?.members || {},
        shop,
        bestiary,
        lore: db.lore || { articles: [] },
        pacts: db.pacts || {},
        abilities: db.abilities || { custom: {}, deviant: {} },
        catalogOverrides: db.catalogOverrides || {},
        isGM,
        userInfo,
        dbMode,
        dbStatus,
        dataActions,
        db,
        v2Store,
        // GM Actions
        setSelectedCampaignId,
        createCampaign,
        deleteCampaign,
        restoreCampaign,
        assignUser,
        revokeUser,
        createCharacter,
        deleteCharacter,
        restoreCharacter,
        importLegacyCharacter,
        setXpThreshold,
        setPartyXp,
        addPartyXp
    }), [campaigns, archivedCampaigns, activeCampaign, targetCampaignId, actors, archivedActors, pcActors, ownedActors, myCharacter, myActor, questLists, lootBagLists, shop, bestiary, isGM, userInfo, dbMode, dbStatus, dataActions, db, v2Store, setSelectedCampaignId, createCampaign, deleteCampaign, restoreCampaign, assignUser, revokeUser, createCharacter, deleteCharacter, restoreCharacter, importLegacyCharacter, setXpThreshold, setPartyXp, addPartyXp]);

    return (
        <CampaignContext.Provider value={value}>
            {children}
        </CampaignContext.Provider>
    );
}

function selectUserInfoFromV2Store(v2Store, userEmail) {
    if (!userEmail || !v2Store?.campaigns) return null;
    for (const campaign of Object.values(v2Store.campaigns)) {
        const members = campaign?.members || {};
        const direct = members[userEmail];
        const member = direct || Object.values(members).find((entry) => normalizeEmail(entry?.email || entry?.id) === userEmail);
        if (!member) continue;
        return {
            ...member,
            email: normalizeEmail(member.email || member.id || userEmail),
            campaignId: campaign.id,
            characterId: member.characterId || member.assignedCharacterId || null,
            actorId: member.assignedActorId || member.actorId || member.characterId || null,
            assignedActorId: member.assignedActorId || member.actorId || member.characterId || null,
        };
    }
    return null;
}
