import React from 'react';
import { Badge } from '@/components/ui/badge';
import AppDialogShell from '../shared/components/dialogs/AppDialogShell';

export function DeviantAbilityDetailContent({ ability, pact }) {
    if (!ability) return null;

    return (
        <div className="space-y-5">
            {ability.description ? (
                <div className="rich-text-content text-sm leading-6" dangerouslySetInnerHTML={{ __html: ability.description }} />
            ) : <p className="text-sm italic text-muted-foreground">No description available.</p>}

            {[1, 2].map((index) => {
                const awakening = ability[`awakening${index}`];
                if (!awakening?.name && !awakening?.description) return null;
                return (
                    <section key={index} className="space-y-2 border-t border-border/70 pt-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">Awakening {index}</Badge>
                            <h3 className="font-semibold text-primary">{awakening.name || 'Unnamed'}</h3>
                        </div>
                        {awakening.levelNote ? <p className="text-xs text-muted-foreground">{awakening.levelNote}</p> : null}
                        {awakening.description ? (
                            <div className="rich-text-content text-sm leading-6" dangerouslySetInnerHTML={{ __html: awakening.description }} />
                        ) : null}
                    </section>
                );
            })}

            {pact ? <p className="text-sm text-destructive">Backlash risk is governed by {pact.name}.</p> : null}
        </div>
    );
}

export default function DeviantAbilityDetailDialog({ ability, pact, onClose }) {
    if (!ability) return null;

    return (
        <AppDialogShell
            open={Boolean(ability)}
            onOpenChange={(open) => { if (!open) onClose?.(); }}
            layerId="deviant-ability-detail"
            title={ability.name || 'Deviant Ability'}
            description={`Level ${ability.level || 0}${pact?.name ? ` - ${pact.name}` : ''}`}
            size="md"
        >
            <DeviantAbilityDetailContent ability={ability} pact={pact} />
        </AppDialogShell>
    );
}
