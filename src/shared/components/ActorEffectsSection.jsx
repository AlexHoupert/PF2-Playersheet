import { useMemo, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { selectEffectChipItems } from '../rules/actorEffectOverview';
import { ActorEffectsDrawer } from './ActorEffectsDrawer';
import { ConditionList } from './ConditionList';
import './ActorEffectsOverview.css';

export function ActorEffectsSection({
  actorRules,
  campaign,
  displayEffects = [],
  canManageEffects = false,
  onOpenEffect,
  onAddCondition,
  onRemoveEffect,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [removingIds, setRemovingIds] = useState(() => new Set());
  const chipItems = useMemo(() => {
    const fromRules = selectEffectChipItems(actorRules);
    return fromRules.length || actorRules?.effects ? fromRules : displayEffects;
  }, [actorRules, displayEffects]);

  const removeEffect = async (effect) => {
    if (!canManageEffects || !effect?.id || effect.derived || removingIds.has(effect.id)) return;
    setRemovingIds((current) => new Set(current).add(effect.id));
    try {
      await onRemoveEffect?.(effect);
    } finally {
      setRemovingIds((current) => {
        const next = new Set(current);
        next.delete(effect.id);
        return next;
      });
    }
  };

  return (
    <section className="actor-effects-section">
      <h3>Conditions & Effects</h3>
      <div className="actor-effects-section__content">
        <ActorEffectsDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          trigger={(
            <Button
              type="button"
              variant="outline"
              className="actor-effects-section__overview"
              data-testid="actor-effects-overview-button"
              aria-label="Open active effects overview"
            >
              <CircleHelp />
            </Button>
          )}
          actorRules={actorRules}
          campaign={campaign}
          canManageEffects={canManageEffects}
          onRemoveEffect={onRemoveEffect}
        />
        <ConditionList
          conditions={chipItems}
          onClick={onOpenEffect}
          onAdd={onAddCondition}
          onRemove={removeEffect}
          removingIds={removingIds}
          readOnly={!canManageEffects}
        />
      </div>
    </section>
  );
}
