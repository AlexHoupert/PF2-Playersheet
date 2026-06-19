import React from 'react';

export function usePlayerCharacterActions({
    activeCampaign,
    activeCharIndex,
    character,
    dataActions,
    setModalMode,
}) {
    const runDataAction = React.useCallback((action) => {
        Promise.resolve(action).catch(err => {
            console.error(err);
            alert(err?.message || String(err));
        });
    }, []);

    const updateCharacter = React.useCallback((updater) => {
        const campaignId = activeCampaign?.id;
        const characterId = character?.id || activeCampaign?.characters?.[activeCharIndex]?.id;
        if (!campaignId || !characterId) return;
        runDataAction(dataActions.character.updateCharacter(campaignId, characterId, updater));
    }, [activeCampaign, activeCharIndex, character?.id, dataActions, runDataAction]);

    const getTargetIds = React.useCallback(() => {
        const campaignId = activeCampaign?.id;
        const characterId = character?.id || activeCampaign?.characters?.[activeCharIndex]?.id;
        if (!campaignId || !characterId) return null;
        return { campaignId, characterId };
    }, [activeCampaign?.id, activeCampaign?.characters, activeCharIndex, character?.id]);

    const runCharacterAction = React.useCallback((actionName, ...args) => {
        const ids = getTargetIds();
        const action = dataActions.character?.[actionName];
        if (!ids || typeof action !== 'function') return;
        runDataAction(action(ids.campaignId, ids.characterId, ...args));
    }, [dataActions, getTargetIds, runDataAction]);

    const characterActions = React.useMemo(() => ({
        setGold: (amount) => runCharacterAction('setGold', amount),
        adjustGold: (amount) => runCharacterAction('adjustGold', amount),
        setAttribute: (key, value) => runCharacterAction('setAttribute', key, value),
        adjustAttribute: (key, amount) => runCharacterAction('adjustAttribute', key, amount),
        setHp: (value) => runCharacterAction('setHp', value),
        adjustHp: (amount) => runCharacterAction('adjustHp', amount),
        setTempHp: (value) => runCharacterAction('setTempHp', value),
        adjustTempHp: (amount) => runCharacterAction('adjustTempHp', amount),
        setMaxHp: (value) => runCharacterAction('setMaxHp', value),
        adjustMaxHp: (amount) => runCharacterAction('adjustMaxHp', amount),
        setSpeed: (key, value) => runCharacterAction('setSpeed', key, value),
        adjustSpeed: (key, amount) => runCharacterAction('adjustSpeed', key, amount),
        setClassDc: (value) => runCharacterAction('setClassDc', value),
        adjustClassDc: (amount) => runCharacterAction('adjustClassDc', amount),
        setDailyCraftingMax: (value) => runCharacterAction('setDailyCraftingMax', value),
    }), [runCharacterAction]);

    const handleClearNotification = React.useCallback((id) => {
        if (activeCampaign?.id && activeCampaign?.notificationQueue?.some(n => n.id === id)) {
            runDataAction(dataActions.campaign.clearNotification(activeCampaign.id, id));
            return;
        }
        runDataAction(dataActions.globalContent.clearRootNotification(id));
    }, [activeCampaign, dataActions, runDataAction]);

    const saveNewAction = React.useCallback((actionData) => {
        if (!actionData.name) return;

        const finalName = `[gold]${actionData.name}[/gold]`;
        const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

        const actionObj = {
            id,
            name: finalName,
            type: actionData.type,
            subtype: actionData.subtype,
            skill: actionData.skill,
            feat: actionData.feat,
            description: actionData.description
        };

        runDataAction(dataActions.globalContent.saveCustomAction(actionObj));
        setModalMode(null);
    }, [dataActions, runDataAction, setModalMode]);

    return {
        handleClearNotification,
        characterActions,
        runDataAction,
        saveNewAction,
        updateCharacter,
    };
}
