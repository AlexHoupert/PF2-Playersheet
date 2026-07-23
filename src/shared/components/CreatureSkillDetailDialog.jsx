import React from 'react';
import AppDialogShell from './dialogs/AppDialogShell';

const formatBonus = (value) => Number(value || 0) >= 0 ? `+${Number(value || 0)}` : `${Number(value || 0)}`;

export function CreatureSkillDetailContent({ skill }) {
    if (!skill) return null;

    return (
        <div className="space-y-5">
            <div className="flex items-baseline gap-3">
                <span className="font-semibold text-primary">Modifier</span>
                <span className="text-3xl font-bold text-foreground">{formatBonus(skill.bonus)}</span>
            </div>

            {skill.specials?.length > 0 ? (
                <section className="space-y-2">
                    <h3 className="font-semibold text-primary">Special Uses</h3>
                    <div className="divide-y divide-border/60 rounded-md border border-border/60 bg-muted/20 px-3">
                        {skill.specials.map((special) => (
                            <div key={special.id} className="flex justify-between gap-4 py-2 text-sm">
                                <span>{special.label}</span>
                                <strong>{formatBonus(special.bonus)}</strong>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null}

            {skill.notes ? (
                <section className="space-y-2">
                    <h3 className="font-semibold text-primary">Notes</h3>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{skill.notes}</p>
                </section>
            ) : null}
        </div>
    );
}

export default function CreatureSkillDetailDialog({ skill, onClose }) {
    if (!skill) return null;

    const context = [
        skill.creatureName,
        skill.creatureLevel !== null && skill.creatureLevel !== undefined ? `Level ${skill.creatureLevel}` : null,
    ].filter(Boolean).join(' - ');

    return (
        <AppDialogShell
            open={Boolean(skill)}
            onOpenChange={(open) => { if (!open) onClose?.(); }}
            layerId="creature-skill-detail"
            title={skill.label || 'Creature Skill'}
            description={context || 'Creature skill details'}
            size="sm"
        >
            <CreatureSkillDetailContent skill={skill} />
        </AppDialogShell>
    );
}
