import { useEffect } from 'react';
import { deepClone } from '../../shared/utils/deepClone';

export function usePlayerRuntimeRepair({
    activeCampaign,
    dataActions,
    myCharacter,
    runDataAction,
}) {
    useEffect(() => {
        if (!activeCampaign || !activeCampaign.characters || !myCharacter?.id) return;

        const charToCheck = activeCampaign.characters.find(c => c.id === myCharacter.id);
        if (!charToCheck || !charToCheck.skills) return;

        const needsIntimidate = Object.prototype.hasOwnProperty.call(charToCheck.skills, 'Intimidate')
            || Object.prototype.hasOwnProperty.call(charToCheck.skills, 'intimidate');
        const needsPerform = Object.prototype.hasOwnProperty.call(charToCheck.skills, 'Perform')
            || Object.prototype.hasOwnProperty.call(charToCheck.skills, 'perform');

        if (needsIntimidate || needsPerform) {
            console.log("Running Skill Migrations for", charToCheck.name);

            runDataAction(dataActions.character.updateCharacter(activeCampaign.id, myCharacter.id, currentCharacter => {
                const c = deepClone(currentCharacter);
                let changed = false;

                if (Object.prototype.hasOwnProperty.call(c.skills, 'Intimidate')) {
                    const val = c.skills.Intimidate;
                    delete c.skills.Intimidate;
                    c.skills.Intimidation = val;
                    changed = true;
                }
                if (Object.prototype.hasOwnProperty.call(c.skills, 'intimidate')) {
                    const val = c.skills.intimidate;
                    delete c.skills.intimidate;
                    c.skills.Intimidation = val;
                    changed = true;
                }
                if (Object.prototype.hasOwnProperty.call(c.skills, 'Perform')) {
                    const val = c.skills.Perform;
                    delete c.skills.Perform;
                    c.skills.Performance = val;
                    changed = true;
                }
                if (Object.prototype.hasOwnProperty.call(c.skills, 'perform')) {
                    const val = c.skills.perform;
                    delete c.skills.perform;
                    c.skills.Performance = val;
                    changed = true;
                }

                return changed ? c : currentCharacter;
            }));
        }
    }, [activeCampaign, myCharacter, dataActions, runDataAction]);
}
