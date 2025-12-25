import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';

const CampaignContext = createContext();

export function useCampaign() {
    return useContext(CampaignContext);
}

export function CampaignProvider({ db, setDb, children, isAdmin = false }) {
    const { user } = useAuth();

    // We need to determine:
    // 1. Is the user a GM? (Simple check for now: matching email or role in db)
    // 2. What is their assigned campaign?
    // 3. What is their assigned character?

    const userInfo = user && db.users ? db.users[user.email] : null;
    const isGM = (userInfo?.role === 'gm') || isAdmin; // Simple GM check or Admin View override

    // For Players: Resolve Campaign ID from assignment
    // For GMs: Allow Manual Selection (Local State for UI)
    // Persist this choice so it survives Admin <-> Player toggle
    const [selectedCampaignId, setSelectedCampaignIdState] = useState(() => {
        return localStorage.getItem('gm_selected_campaign') || null;
    });

    const setSelectedCampaignId = (id) => {
        setSelectedCampaignIdState(id);
        if (id) localStorage.setItem('gm_selected_campaign', id);
        else localStorage.removeItem('gm_selected_campaign');
    };

    // Auto-select for players
    useEffect(() => {
        if (!isGM && userInfo?.campaignId) {
            setSelectedCampaignId(userInfo.campaignId);
        }
    }, [isGM, userInfo]);

    // Derived Data
    const campaigns = db.campaigns || {};

    // Active Campaign Object
    // If GM, use selected. If Player, use assigned.
    // If nothing selected/assigned, try to use "default" or first available?
    const targetCampaignId = isGM
        ? (selectedCampaignId || Object.keys(campaigns)[0])
        : (userInfo?.campaignId || selectedCampaignId); // Fallback to selected for GM previewing as player

    const activeCampaign = campaigns[targetCampaignId] || null;

    // Active Character (User's specific character)
    const myCharacterId = userInfo?.characterId;
    const myCharacter = activeCampaign?.characters?.find(c => c.id === myCharacterId || c.name === myCharacterId); // Support ID or Name match

    // Actions
    const updateActiveCampaign = (updater) => {
        if (!activeCampaign || !targetCampaignId) return;
        setDb(prev => {
            const next = { ...prev };
            if (!next.campaigns) next.campaigns = {};

            const currentCamp = next.campaigns[targetCampaignId] || {};
            const updatedCamp = typeof updater === 'function' ? updater(currentCamp) : updater;

            next.campaigns[targetCampaignId] = { ...currentCamp, ...updatedCamp };
            return next;
        });
    };

    const createCampaign = (name) => {
        const id = 'campaign_' + Date.now();
        setDb(prev => ({
            ...prev,
            campaigns: {
                ...prev.campaigns,
                [id]: { id, name, characters: [], quests: [], lootBags: [], createdAt: Date.now() }
            }
        }));
        return id;
    };

    const deleteCampaign = (id) => {
        setDb(prev => {
            const next = { ...prev };
            delete next.campaigns[id];
            return next;
        });
        if (selectedCampaignId === id) setSelectedCampaignId(null);
    };

    // Admin: Assign User
    const assignUser = (email, campaignId, characterId, role = 'player') => {
        setDb(prev => ({
            ...prev,
            users: {
                ...prev.users,
                [email]: { role, campaignId, characterId }
            }
        }));
    };

    const value = {
        campaigns,
        activeCampaign,
        activeCampaignId: targetCampaignId,
        myCharacter,
        isGM,
        userInfo,
        // GM Actions
        setSelectedCampaignId,
        createCampaign,
        deleteCampaign,
        assignUser,
        // Data Actions
        updateActiveCampaign
    };

    return (
        <CampaignContext.Provider value={value}>
            {children}
        </CampaignContext.Provider>
    );
}
