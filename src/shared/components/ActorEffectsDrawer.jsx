import React, { useMemo, useState } from 'react';
import { ShieldQuestion, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useWindowSize } from '../hooks/useWindowSize';
import { ModalLayerMount } from '../overlays/ModalLayerProvider';
import { buildActorEffectOverview } from '../rules/actorEffectOverview';

const BONUS_TYPES = ['item', 'status', 'circumstance', 'untyped'];

export function ActorEffectsDrawer({
  open,
  onOpenChange,
  actorRules,
  campaign,
  canManageEffects = false,
  onRemoveEffect,
}) {
  const { isMobile } = useWindowSize();
  const [view, setView] = useState('effects');
  const [scope, setScope] = useState('temporary');
  const [removingIds, setRemovingIds] = useState(() => new Set());
  const overview = useMemo(
    () => buildActorEffectOverview({ actorRules, campaign, scope }),
    [actorRules, campaign, scope]
  );

  const removeEffect = async (source) => {
    if (!canManageEffects || !source?.id || source.derived || removingIds.has(source.id)) return;
    setRemovingIds((current) => new Set(current).add(source.id));
    try {
      await onRemoveEffect?.(source);
    } finally {
      setRemovingIds((current) => {
        const next = new Set(current);
        next.delete(source.id);
        return next;
      });
    }
  };

  return (
    <ModalLayerMount id="actor-effects-drawer" active={open}>
      <Drawer open={open} onOpenChange={onOpenChange} direction={isMobile ? 'bottom' : 'right'}>
      <DrawerContent className="actor-effects-drawer" data-testid="actor-effects-drawer">
        <DrawerHeader className="actor-effects-drawer__header">
          <div className="actor-effects-drawer__title-row">
            <div>
              <DrawerTitle className="actor-effects-drawer__title">
                <ShieldQuestion /> Active Effects
              </DrawerTitle>
              <DrawerDescription>
                See what changes your values and which sources are currently active.
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Close active effects">
                <X />
              </Button>
            </DrawerClose>
          </div>

          <div className="actor-effects-drawer__controls">
            <div className="actor-effects-drawer__segments" aria-label="Effect overview mode">
              <Button type="button" size="sm" variant={view === 'effects' ? 'default' : 'outline'} data-testid="actor-effects-view-effects" aria-pressed={view === 'effects'} onClick={() => setView('effects')}>Effects</Button>
              <Button type="button" size="sm" variant={view === 'sources' ? 'default' : 'outline'} data-testid="actor-effects-view-sources" aria-pressed={view === 'sources'} onClick={() => setView('sources')}>Sources</Button>
            </div>
            <div className="actor-effects-drawer__segments" aria-label="Effect scope">
              <Button type="button" size="sm" variant={scope === 'temporary' ? 'secondary' : 'outline'} data-testid="actor-effects-scope-temporary" aria-pressed={scope === 'temporary'} onClick={() => setScope('temporary')}>Temporary</Button>
              <Button type="button" size="sm" variant={scope === 'all' ? 'secondary' : 'outline'} data-testid="actor-effects-scope-all" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>All active</Button>
            </div>
          </div>
        </DrawerHeader>

        <div className="actor-effects-drawer__body">
          {overview.totalCount === 0 && (
            <div className="actor-effects-drawer__empty">
              {scope === 'temporary' ? 'No temporary effects are active.' : 'No effects are active.'}
            </div>
          )}
          {view === 'effects'
            ? <EffectGroups groups={overview.effectGroups} />
            : (
              <SourceGroups
                groups={overview.sourceGroups}
                canManageEffects={canManageEffects}
                removingIds={removingIds}
                onRemove={removeEffect}
              />
            )}
        </div>
      </DrawerContent>
      </Drawer>
    </ModalLayerMount>
  );
}

function EffectGroups({ groups }) {
  return (groups || []).map((group) => (
    <section key={group.id} className="actor-effects-group">
      <h3>{group.label}</h3>
      <div className="actor-effects-group__rows">
        {group.rows.map((row) => <EffectRow key={row.id} row={row} />)}
      </div>
    </section>
  ));
}

function EffectRow({ row }) {
  return (
    <div className="actor-effect-row">
      <div className="actor-effect-row__summary">
        <strong>{row.label}</strong>
        <div className="actor-effect-row__totals">
          {BONUS_TYPES.map((type) => (
            <span key={type} data-tone={type} data-zero={!row.breakdown?.[type]} title={`${capitalize(type)} total`}>
              {formatSigned(row.breakdown?.[type] || 0)}
            </span>
          ))}
          <b data-negative={Number(row.total) < 0}>{formatSigned(row.total)}</b>
        </div>
      </div>
      {row.formula && <div className="actor-effect-row__formula">{row.formula}</div>}
      {(row.cap != null || row.set != null) && (
        <div className="actor-effect-row__constraints">
          {row.cap != null && <span>Cap {row.cap}</span>}
          {row.set != null && <span>Set {row.set}</span>}
        </div>
      )}
      {row.contributions.map((contribution) => (
        <div key={`${contribution.effectId}:${contribution.modifierId}`} className="actor-effect-contribution" data-suppressed={!contribution.applied}>
          <span data-tone={contribution.tone}>{formatSourceLabel(contribution)}</span>
          <span>{formatSigned(contribution.value)}</span>
          {contribution.suppressionReason && <small>{contribution.suppressionReason}</small>}
        </div>
      ))}
    </div>
  );
}

function SourceGroups({ groups, canManageEffects, removingIds, onRemove }) {
  return (groups || []).map((group) => (
    <section key={group.id} className="actor-effects-group">
      <h3>{group.label}</h3>
      <div className="actor-effects-group__rows">
        {group.sources.map((source) => (
          <div key={source.id} className="actor-effect-source" data-tone={source.tone}>
            <div className="actor-effect-source__header">
              <div>
                <strong>{source.label}</strong>
                <span>{buildSourceMeta(source)}</span>
              </div>
              {canManageEffects && source.removable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${source.label}`}
                  disabled={removingIds.has(source.id)}
                  onClick={() => onRemove(source)}
                >
                  <X />
                </Button>
              )}
            </div>
            <div className="actor-effect-source__modifiers">
              {source.modifiers.length === 0 && <span className="actor-effect-source__empty">Tracking effect without numerical modifiers</span>}
              {source.modifiers.map((modifier) => (
                <div key={modifier.modifierId} data-suppressed={!modifier.applied}>
                  <span>[{capitalize(modifier.bonusType || modifier.mode || 'effect')}] {modifier.selectorLabel}</span>
                  <b data-negative={Number(modifier.value) < 0}>{formatModifierValue(modifier)}</b>
                  {modifier.suppressionReason && <small>{modifier.suppressionReason}</small>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  ));
}

function formatSourceLabel(contribution) {
  return contribution.sourceActorName
    ? `${contribution.sourceName} (${contribution.sourceActorName})`
    : contribution.sourceName;
}

function buildSourceMeta(source) {
  const actor = source.sourceActorName ? ` by ${source.sourceActorName}` : '';
  return `${source.durationLabel}${actor}`;
}

function formatModifierValue(modifier) {
  if (modifier.mode === 'cap') return `cap ${modifier.value}`;
  if (modifier.mode === 'set') return `set ${modifier.value}`;
  if (modifier.mode === 'resistance') return `resist ${modifier.value}`;
  if (modifier.mode === 'weakness') return `weak ${modifier.value}`;
  if (modifier.mode === 'persistent_damage') return modifier.formula || formatSigned(modifier.value);
  return formatSigned(modifier.value);
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return number > 0 ? `+${number}` : String(number);
}

function capitalize(value) {
  const text = String(value || '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
