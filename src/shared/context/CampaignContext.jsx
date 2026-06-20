import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { db as firestoreDb } from '../db/firebase-config';
import { createDataActions } from '../db/domain/createDataActions';
import { isSoftDeleted, normalizeEmail } from '../db/domain/campaignReducers';
import { selectActorBuckets, selectMyActor } from '../db/selectors/actorSelectors';
import { selectActiveCampaign, selectCampaignBuckets, selectTargetCampaignId } from '../db/selectors/campaignSelectors';
import { selectMyCharacter } from '../db/selectors/characterSelectors';
import {
    actorRepo,
    campaignRepo,
    catalogOverrideRepo,
    characterRepo,
    effectRepo,
    encounterRepo,
    globalRepo,
    lootRepo,
    mapRepo,
    memberRepo,
    questRepo,
} from '../db/v2/repositories';

const CampaignContext = createContext();

const defaultRepositories = {
    actorRepo,
    campaignRepo,
    catalogOverrideRepo,
    characterRepo,
    effectRepo,
    encounterRepo,
    globalRepo,
    lootRepo,
    mapRepo,
    memberRepo,
    questRepo,
};

export function useCampaign() {
    return useContext(CampaignContext);
}

export function CampaignProvider({ db, setDb, children, isAdmin = false, dbMode = 'legacy', dbStatus = null }) {
    const { user } = useAuth();
    const userEmail = normalizeEmail(user?.email);
    const dataActions = useMemo(
        () => createDataActions({
            db,
            setDb,
            mode: dbMode,
            actorEmail: userEmail,
            firestore: firestoreDb,
            repositories: defaultRepositories,
        }),
        [db, setDb, dbMode, userEmail]
    );

    // We need to determine:
    // 1. Is the user a GM? (Simple check for now: matching email or role in db)
    // 2. What is their assigned campaign?
    // 3. What is their assigned character?

    const userInfo = user && db.users ? (db.users[userEmail] || db.users[user.email]) : null;
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

    // Active Character (User's specific character)
    const myCharacter = selectMyCharacter(activeCampaign, userInfo);
    const myActor = selectMyActor(activeCampaign, userInfo);

    useEffect(() => {
        if (selectedCampaignId && !campaigns[selectedCampaignId]) {
            setSelectedCampaignId(null);
        }
    }, [selectedCampaignId, campaigns, setSelectedCampaignId]);

    const runDataAction = React.useCallback((action) => {
        return Promise.resolve(action).catch(err => {
            console.error(err);
            alert(err?.message || String(err));
        });
    }, []);

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
        myCharacter,
        myActor,
        isGM,
        userInfo,
        dbMode,
        dbStatus,
        dataActions,
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
        setPartyXp,
        addPartyXp
    }), [campaigns, archivedCampaigns, activeCampaign, targetCampaignId, actors, archivedActors, myCharacter, myActor, isGM, userInfo, dbMode, dbStatus, dataActions, setSelectedCampaignId, createCampaign, deleteCampaign, restoreCampaign, assignUser, revokeUser, createCharacter, deleteCharacter, restoreCharacter, importLegacyCharacter, setPartyXp, addPartyXp]);

    return (
        <CampaignContext.Provider value={value}>
            {children}
        </CampaignContext.Provider>
    );
}
