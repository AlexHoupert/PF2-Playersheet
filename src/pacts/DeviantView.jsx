import React, { useMemo, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppDialogShell from '../shared/components/dialogs/AppDialogShell';
import { useCampaign } from '../shared/context/CampaignContext';
import { selectDeviantAbility } from '../shared/db/selectors/abilitySelectors';
import { selectPact } from '../shared/db/selectors/pactSelectors';
import { useAppFeedback } from '../shared/feedback/AppFeedback';
import DeviantAbilityDetailDialog from './DeviantAbilityDetailDialog';
import {
    calculateDeviationStatistics,
    DEVIATION_RULES,
    selectLearnedDeviantAbilities,
} from './deviantRules.js';

export default function DeviantView({ character, db, readOnly = false }) {
    const { activeCampaignId, dataActions } = useCampaign();
    const { notifyError } = useAppFeedback();
    const [rulesOpen, setRulesOpen] = useState(false);
    const [detailAbility, setDetailAbility] = useState(null);
    const [pendingAwakening, setPendingAwakening] = useState(null);
    const pactState = character?.pact || {};
    const pact = useMemo(() => selectPact(db, pactState.pactId), [db, pactState.pactId]);
    const learnedAbilities = useMemo(() => selectLearnedDeviantAbilities({
        pact,
        pactState,
        resolveAbility: (abilityId) => selectDeviantAbility(db, abilityId),
    }), [db, pact, pactState]);
    const statistics = useMemo(() => calculateDeviationStatistics(character), [character]);
    const awakeningPoints = Number(pactState.awakeningPoints) || 0;

    if (!pact) {
        return <div className="p-5 text-center text-muted-foreground">Accept a pact to learn Deviant Abilities.</div>;
    }

    const spendPoint = async (abilityId, awakeningLevel) => {
        if (readOnly || !activeCampaignId || !character?.id || pendingAwakening) return;
        const key = `${abilityId}:${awakeningLevel}`;
        setPendingAwakening(key);
        try {
            await dataActions.pact.spendAwakeningPoint(
                activeCampaignId,
                character.id,
                abilityId,
                awakeningLevel
            );
        } catch (error) {
            console.error(error);
            notifyError(error);
        } finally {
            setPendingAwakening(null);
        }
    };

    return (
        <div className="flex flex-col gap-5 py-3">
            <section className="border-b border-border pb-4">
                <div className="flex items-center justify-center gap-3">
                    <DeviationStatistic label="Deviation DC" value={statistics.dc} />
                    <DeviationStatistic label="Attack" value={formatModifier(statistics.attack)} />
                    <DeviationStatistic label="Counteract" value={formatModifier(statistics.counteract)} />
                    <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Explain Deviant Ability rules"
                        title="Explain Deviant Ability rules"
                        onClick={() => setRulesOpen(true)}
                    >
                        <HelpCircle aria-hidden="true" />
                    </Button>
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                    Uses the higher of Class DC {statistics.classDc}
                    {statistics.spellDc == null ? '' : ` or Spell DC ${statistics.spellDc}`}.
                </p>
            </section>

            <section>
                <div className="mb-3 flex items-center justify-between gap-3 border-b-2 border-[#5c4033] pb-2">
                    <h2 className="font-cinzel text-lg text-primary">Deviant Abilities</h2>
                    <Badge variant="secondary">{awakeningPoints} Awakening Point{awakeningPoints === 1 ? '' : 's'}</Badge>
                </div>

                {learnedAbilities.length === 0 ? (
                    <p className="py-5 text-center text-muted-foreground">No Deviant Abilities learned.</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {learnedAbilities.map(({ ability, group, unlockedAwakeningLevel }) => (
                            <article key={ability.id} className="overflow-hidden rounded-md border border-border bg-card">
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/50"
                                    onClick={() => setDetailAbility(ability)}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-foreground">{ability.name}</div>
                                        <div className="mt-0.5 text-xs text-muted-foreground">
                                            Level {Number(ability.level) || 0}{group?.label ? ` - ${group.label}` : ''}
                                        </div>
                                    </div>
                                    {[1, 2].filter((level) => unlockedAwakeningLevel >= level).map((level) => (
                                        <Badge key={level} variant="secondary">Aw {level}</Badge>
                                    ))}
                                </button>

                                {[1, 2].map((level) => {
                                    const awakening = ability[`awakening${level}`];
                                    if (!awakening?.name && !awakening?.description) return null;
                                    const unlocked = unlockedAwakeningLevel >= level;
                                    const prerequisiteMissing = level === 2 && unlockedAwakeningLevel < 1;
                                    const pending = pendingAwakening === `${ability.id}:${level}`;
                                    return (
                                        <div key={level} className="flex items-center gap-3 border-t border-border/70 px-3 py-2">
                                            <div className="min-w-0 flex-1">
                                                <div className={unlocked ? 'text-sm text-foreground' : 'text-sm text-muted-foreground'}>
                                                    Awakening {level}: {awakening.name || 'Unnamed'}
                                                </div>
                                                {awakening.levelNote ? (
                                                    <div className="text-xs text-muted-foreground">{awakening.levelNote}</div>
                                                ) : null}
                                            </div>
                                            {unlocked ? (
                                                <Badge>Learned</Badge>
                                            ) : !readOnly ? (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="xs"
                                                    disabled={awakeningPoints <= 0 || prerequisiteMissing || Boolean(pendingAwakening)}
                                                    title={prerequisiteMissing ? 'Unlock Awakening 1 first' : 'Spend one Awakening Point'}
                                                    onClick={() => spendPoint(ability.id, level)}
                                                >
                                                    {pending ? 'Learning...' : 'Spend Point'}
                                                </Button>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <AppDialogShell
                open={rulesOpen}
                onOpenChange={setRulesOpen}
                layerId="deviation-rules"
                title="Deviant Ability Statistics"
                description="Saving throws, attacks, Strikes, and counteract checks"
                size="md"
            >
                <p className="text-sm leading-6">{DEVIATION_RULES}</p>
            </AppDialogShell>

            <DeviantAbilityDetailDialog
                ability={detailAbility}
                pact={pact}
                actor={character}
                onClose={() => setDetailAbility(null)}
            />
        </div>
    );
}

function DeviationStatistic({ label, value }) {
    return (
        <div className="flex min-w-[5.5rem] flex-col items-center justify-center rounded border-2 border-primary/70 bg-card px-3 py-2">
            <div className="text-xl font-bold leading-none text-primary">{value}</div>
            <div className="mt-1 text-center text-[0.65rem] uppercase text-muted-foreground">{label}</div>
        </div>
    );
}

function formatModifier(value) {
    return `${value >= 0 ? '+' : ''}${value}`;
}
