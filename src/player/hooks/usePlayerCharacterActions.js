import React from 'react';
import { selectActiveCharacters } from '../../shared/db/selectors/characterSelectors';
import { useAppFeedback } from '../../shared/feedback/AppFeedback';

export function usePlayerCharacterActions({
    activeCampaign,
    activeCharIndex,
    character,
    dataActions,
    canAuthorCatalog = false,
    readOnly = false,
    setModalMode,
}) {
    const { notifyError } = useAppFeedback();
    const runDataAction = React.useCallback((action) => {
        return Promise.resolve(action).catch(err => {
            console.error(err);
            notifyError(err);
            return undefined;
        });
    }, [notifyError]);

    const updateCharacter = React.useCallback((updater) => {
        if (readOnly) return;
        const campaignId = activeCampaign?.id;
        const characterId = character?.id || selectActiveCharacters(activeCampaign)[activeCharIndex]?.id;
        if (!campaignId || !characterId) return;
        return runDataAction(dataActions.character.updateCharacter(campaignId, characterId, updater));
    }, [activeCampaign, activeCharIndex, character?.id, dataActions, readOnly, runDataAction]);

    const getTargetIds = React.useCallback(() => {
        const campaignId = activeCampaign?.id;
        const characterId = character?.id || selectActiveCharacters(activeCampaign)[activeCharIndex]?.id;
        if (!campaignId || !characterId) return null;
        return { campaignId, characterId };
    }, [activeCampaign, activeCharIndex, character?.id]);

    const runCharacterAction = React.useCallback((actionName, ...args) => {
        if (readOnly) return;
        const ids = getTargetIds();
        const action = dataActions.character?.[actionName];
        if (!ids || typeof action !== 'function') return;
        runDataAction(action(ids.campaignId, ids.characterId, ...args));
    }, [dataActions, getTargetIds, readOnly, runDataAction]);

    const runActorAction = React.useCallback((actionName, ...args) => {
        if (readOnly) return;
        const ids = getTargetIds();
        const action = dataActions.actor?.[actionName] || dataActions.character?.[actionName];
        if (!ids || typeof action !== 'function') return;
        runDataAction(action(ids.campaignId, ids.characterId, ...args));
    }, [dataActions, getTargetIds, readOnly, runDataAction]);

    const characterActions = React.useMemo(() => ({
        setGold: (amount) => runActorAction('setGold', amount),
        adjustGold: (amount) => runActorAction('adjustGold', amount),
        setAttribute: (key, value) => runCharacterAction('setAttribute', key, value),
        adjustAttribute: (key, amount) => runCharacterAction('adjustAttribute', key, amount),
        setHp: (value) => runActorAction('setHp', value),
        adjustHp: (amount) => runActorAction('adjustHp', amount),
        setTempHp: (value) => runCharacterAction('setTempHp', value),
        adjustTempHp: (amount) => runCharacterAction('adjustTempHp', amount),
        setMaxHp: (value) => runCharacterAction('setMaxHp', value),
        adjustMaxHp: (amount) => runCharacterAction('adjustMaxHp', amount),
        setSpeed: (key, value) => runCharacterAction('setSpeed', key, value),
        adjustSpeed: (key, amount) => runCharacterAction('adjustSpeed', key, amount),
        setClassDc: (value) => runCharacterAction('setClassDc', value),
        adjustClassDc: (amount) => runCharacterAction('adjustClassDc', amount),
        setDailyCraftingMax: (value) => runCharacterAction('setDailyCraftingMax', value),
        setSkill: (key, value) => runActorAction('setSkill', key, value),
        deleteSkill: (key) => runActorAction('setSkill', key, null),
        setSave: (key, value) => runActorAction('setSave', key, value),
        setArmorProficiency: (key, value) => runActorAction('setArmorProficiency', key, value),
        setWeaponProficiency: (key, value) => runActorAction('setProficiency', key, value),
        setSpellProficiency: (value) => runActorAction('setSpellProficiency', value),
        setImpulseProficiency: (value) => runActorAction('setImpulseProficiency', value),
        setPerception: (value) => runActorAction('setPerception', value),
        setMagicAttribute: (attribute) => runActorAction('setMagicAttribute', attribute),
        setMagicProficiency: (value) => runActorAction('setMagicProficiency', value),
        setMagicSlot: (slotKey, value) => runActorAction('setMagicSlot', slotKey, value),
        setEquipmentState: (patch) => runActorAction('setEquipmentState', patch),
    }), [runActorAction, runCharacterAction]);

    const handleClearNotification = React.useCallback((id) => {
        if (activeCampaign?.id && activeCampaign?.notificationQueue?.some(n => n.id === id)) {
            runDataAction(dataActions.campaign.clearNotification(activeCampaign.id, id));
            return;
        }
        runDataAction(dataActions.globalContent.clearRootNotification(id));
    }, [activeCampaign, dataActions, runDataAction]);

    const saveNewAction = React.useCallback((actionData) => {
        if (readOnly || !canAuthorCatalog) return;
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

        runDataAction(dataActions.catalog.saveCatalogOverride({
            catalogType: 'action',
            mode: 'custom',
            label: actionObj.name,
            payload: actionObj,
        }));
        setModalMode(null);
    }, [canAuthorCatalog, dataActions, readOnly, runDataAction, setModalMode]);

    return {
        handleClearNotification,
        characterActions,
        runDataAction,
        saveNewAction,
        updateCharacter,
    };
}
