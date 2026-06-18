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
        runDataAction,
        saveNewAction,
        updateCharacter,
    };
}
