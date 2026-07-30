import React, { useMemo, useState } from 'react';
import { HelpCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCampaign } from '../shared/context/CampaignContext';
import AppDialogShell from '../shared/components/dialogs/AppDialogShell';
import { RichDescription } from '../shared/components/catalog-detail';
import { useAppFeedback } from '../shared/feedback/AppFeedback';
import { countUnlockedAwakeningPoints } from '../shared/pacts/pactState.js';
import { selectPact } from '../shared/db/selectors/pactSelectors';
import { BACKLASH_RULES } from './deviantRules.js';
import { BACKLASH_COLORS, BACKLASH_LABELS, BACKLASH_TIERS, ELEMENTS } from './pactsData';

export default function PactView({ character, db, readOnly = false }) {
    const { activeCampaignId, dataActions } = useCampaign();
    const { confirm, notifyError, notifySuccess } = useAppFeedback();
    const [rulesOpen, setRulesOpen] = useState(false);
    const [resetting, setResetting] = useState(false);
    const pactState = character?.pact || {};
    const assignedPact = useMemo(
        () => selectPact(db, pactState.pactId),
        [db, pactState.pactId]
    );

    if (!assignedPact) {
        return <div className="p-5 text-center text-muted-foreground">No pact assigned.</div>;
    }

    const element = ELEMENTS[assignedPact.element] || ELEMENTS.Fire;
    const awakeningPoints = Number(pactState.awakeningPoints) || 0;
    const refundablePoints = countUnlockedAwakeningPoints(pactState.unlockedAwakenings);
    const dedicationName = pactState.dedicationName
        || (typeof assignedPact.dedication === 'string'
            ? assignedPact.dedication
            : assignedPact.dedication?.name);

    const resetAwakenings = async () => {
        if (readOnly || resetting || refundablePoints <= 0 || !activeCampaignId || !character?.id) return;
        const accepted = await confirm({
            title: 'Reset awakenings?',
            message: `Reset all selected awakenings and refund ${refundablePoints} Awakening Point${refundablePoints === 1 ? '' : 's'}?`,
            confirmLabel: 'Reset Awakenings',
            danger: true,
        });
        if (!accepted) return;

        setResetting(true);
        try {
            await dataActions.pact.resetAwakenings(activeCampaignId, character.id);
            notifySuccess('Awakenings reset and points refunded.');
        } catch (error) {
            console.error(error);
            notifyError(error);
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 py-3">
            <section
                className="rounded-lg border p-4"
                style={{ background: element.bg, borderColor: element.dim }}
            >
                <div className="flex items-start gap-3">
                    <span className="text-2xl" aria-hidden="true">{element.icon}</span>
                    <div className="min-w-0 flex-1">
                        <h2 className="font-cinzel text-base font-bold" style={{ color: element.color }}>
                            {assignedPact.name}
                        </h2>
                        <p className="text-xs text-muted-foreground">{assignedPact.element} Element</p>
                    </div>
                </div>
                {assignedPact.description ? (
                    <div className="mt-3 text-muted-foreground">
                        <RichDescription description={assignedPact.description} actor={character} />
                    </div>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {dedicationName ? (
                        <PactPill element={element}>
                            Dedication: {dedicationName}
                        </PactPill>
                    ) : null}
                    <PactPill element={element}>Awakening Points: {awakeningPoints}</PactPill>
                    {!readOnly && refundablePoints > 0 ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={resetting}
                            onClick={resetAwakenings}
                            title="Reset selected awakenings and refund their points"
                        >
                            <RotateCcw aria-hidden="true" />
                            {resetting ? 'Resetting...' : 'Reset Awakenings'}
                        </Button>
                    ) : null}
                </div>
            </section>

            <section className="rounded-md border border-red-950 bg-red-950/20 p-3">
                <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-red-300">
                        Backlash Reference
                    </h2>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Explain backlash rules"
                        title="Explain backlash rules"
                        onClick={() => setRulesOpen(true)}
                    >
                        <HelpCircle aria-hidden="true" />
                    </Button>
                </div>
                <div className="flex flex-col gap-3">
                    {BACKLASH_TIERS.map((tier) => {
                        const tierData = assignedPact.backlash?.[tier] || {};
                        const tierColor = BACKLASH_COLORS[tier];
                        const effects = tierData.effects || [];
                        return (
                            <article key={tier} className="border-l-2 pl-3" style={{ borderColor: tierColor }}>
                                <h3 className="mb-1 text-sm font-bold" style={{ color: tierColor }}>
                                    {BACKLASH_LABELS[tier]}
                                </h3>
                                {effects.length > 0 ? (
                                    <p className="mb-1 text-xs text-muted-foreground">
                                        {effects.map((effect) => `${effect.conditionName}${effect.value ? ` ${effect.value}` : ''}`).join(', ')}
                                    </p>
                                ) : null}
                                {tierData.description ? (
                                    <RichDescription description={tierData.description} actor={character} />
                                ) : (
                                    <p className="text-sm italic text-muted-foreground">No backlash description defined.</p>
                                )}
                            </article>
                        );
                    })}
                </div>
            </section>

            <AppDialogShell
                open={rulesOpen}
                onOpenChange={setRulesOpen}
                layerId="backlash-rules"
                title="Backlash"
                description="Rules for using deviations and escalating backlash"
                size="md"
            >
                <div className="space-y-4 text-sm leading-6">
                    {BACKLASH_RULES.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
            </AppDialogShell>
        </div>
    );
}

function PactPill({ element, children }) {
    return (
        <span
            className="rounded-full border bg-background px-2 py-1 text-xs"
            style={{ color: element.color, borderColor: element.dim }}
        >
            {children}
        </span>
    );
}
