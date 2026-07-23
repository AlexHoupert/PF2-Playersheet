/**
 * Displays expanded details for creature abilities and actions.
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { getActionIcon } from '../../utils/bestiaryUtils';
import { parseFoundry } from '../utils/foundryParser';
import AppDialogShell from './dialogs/AppDialogShell';

function getActionLabel(ability) {
    const actionType = ability.system?.actionType?.value;
    const actionCount = ability.system?.actions?.value;
    if (actionType === 'passive') return 'Passive';
    if (actionType === 'reaction') return 'Reaction';
    if (actionType === 'free') return 'Free Action';
    if (actionCount === 1) return 'Single Action';
    if (actionCount === 2) return 'Two Actions';
    if (actionCount === 3) return 'Three Actions';
    return 'Action';
}

export function CreatureAbilityDetailContent({ ability, onContentLinkClick }) {
    if (!ability) return null;

    const traits = ability.system?.traits?.value || [];
    const requirements = ability.system?.requirements || '';
    const trigger = ability.system?.trigger || '';
    const frequency = ability.system?.frequency?.value
        ? `${ability.system.frequency.value} per ${ability.system.frequency.per || 'day'}`
        : '';

    return (
        <div className="space-y-4">
            {traits.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                    {traits.map((trait) => <Badge key={trait} variant="secondary" className="capitalize">{trait}</Badge>)}
                </div>
            ) : null}

            {trigger ? <p className="text-sm"><strong className="text-primary">Trigger</strong> {trigger}</p> : null}
            {requirements ? <p className="text-sm"><strong className="text-primary">Requirements</strong> {requirements}</p> : null}
            {frequency ? <p className="text-sm"><strong className="text-primary">Frequency</strong> {frequency}</p> : null}

            <div
                className="ability-description rich-text-content text-sm leading-6 text-foreground"
                onClick={onContentLinkClick}
                dangerouslySetInnerHTML={{ __html: parseFoundry(ability.system?.description?.value || '') }}
            />
        </div>
    );
}

export default function CreatureAbilityModal({ ability, onClose, onContentLinkClick }) {
    if (!ability) return null;

    return (
        <AppDialogShell
            open={Boolean(ability)}
            onOpenChange={(open) => { if (!open) onClose?.(); }}
            layerId="creature-ability-detail"
            title={`${getActionIcon(ability)} ${ability.name || 'Creature Ability'}`}
            description={getActionLabel(ability)}
            size="md"
        >
            <CreatureAbilityDetailContent ability={ability} onContentLinkClick={onContentLinkClick} />
        </AppDialogShell>
    );
}
