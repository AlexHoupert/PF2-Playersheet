import { useMemo, useState } from 'react';
import { ShieldQuestion, X } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Switch } from '@/components/ui/switch';
import { useWindowSize } from '../hooks/useWindowSize';
import { ModalLayerMount } from '../overlays/ModalLayerProvider';
import { buildActorEffectOverview } from '../rules/actorEffectOverview';

const BONUS_TYPES = ['item', 'status', 'circumstance', 'untyped'];

export function ActorEffectsDrawer({
  open,
  onOpenChange,
  trigger,
  actorRules,
  campaign,
  canManageEffects = false,
  onRemoveEffect,
}) {
  const { isMobile } = useWindowSize();
  const [view, setView] = useState('effects');
  const [includePassive, setIncludePassive] = useState(false);
  const [removingIds, setRemovingIds] = useState(() => new Set());
  const scope = includePassive ? 'all' : 'temporary';
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
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        direction={isMobile ? 'left' : 'right'}
        autoFocus
      >
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
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
              <label className="actor-effects-drawer__scope" htmlFor="actor-effects-include-passive">
                <Switch
                  id="actor-effects-include-passive"
                  checked={includePassive}
                  onCheckedChange={setIncludePassive}
                  data-testid="actor-effects-scope-all"
                />
                <span>Include passive effects</span>
              </label>
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
      <Accordion type="multiple" className="actor-effects-group__rows">
        {group.rows.map((row) => <EffectRow key={row.id} row={row} />)}
      </Accordion>
    </section>
  ));
}

function EffectRow({ row }) {
  return (
    <AccordionItem value={row.id} className="actor-effect-row" data-tone={row.tone}>
      <AccordionTrigger className="actor-effect-row__trigger" data-testid={`actor-effect-row-${row.id}`}>
        <strong>{row.label}</strong>
        <SummaryValue row={row} />
      </AccordionTrigger>
      <AccordionContent className="actor-effect-row__content">
        {row.kind === 'persistent_damage' && row.sourceActorName && (
          <div className="actor-effect-row__meta">Applied by {row.sourceActorName}</div>
        )}
        {row.kind !== 'persistent_damage' && <TypedBreakdown breakdown={row.breakdown} />}
        {(row.cap != null || row.set != null) && (
          <div className="actor-effect-row__constraints">
            {row.cap != null && <span>Cap {row.cap}</span>}
            {row.set != null && <span>Set {row.set}</span>}
          </div>
        )}
        {row.kind === 'persistent_damage' && <TypedBreakdown breakdown={row.breakdown} />}
        {row.contributions.map((contribution) => (
          <ContributionRow key={`${contribution.effectId}:${contribution.modifierId}`} contribution={contribution} />
        ))}
      </AccordionContent>
    </AccordionItem>
  );
}

function SummaryValue({ row }) {
  if (row.kind === 'persistent_damage') {
    return <b className="actor-effect-row__value" data-negative="true">{row.formula}</b>;
  }
  const value = row.set != null ? `set ${row.set}` : formatSigned(row.total);
  return <b className="actor-effect-row__value" data-negative={Number(row.total) < 0}>{value}</b>;
}

function TypedBreakdown({ breakdown }) {
  const values = BONUS_TYPES.filter((type) => Number(breakdown?.[type]) !== 0);
  if (values.length === 0) return null;
  return (
    <div className="actor-effect-row__totals" aria-label="Typed modifier totals">
      {values.map((type) => (
        <span key={type} data-tone={type} title={`${capitalize(type)} total`}>
          {capitalize(type)} {formatSigned(breakdown[type])}
        </span>
      ))}
    </div>
  );
}

function ContributionRow({ contribution }) {
  return (
    <div className="actor-effect-contribution" data-suppressed={!contribution.applied}>
      <span data-tone={contribution.tone}>{formatSourceLabel(contribution)}</span>
      <span data-negative={Number(contribution.value) < 0}>{formatModifierValue(contribution)}</span>
      {contribution.suppressionReason && <small>{contribution.suppressionReason}</small>}
    </div>
  );
}

function SourceGroups({ groups, canManageEffects, removingIds, onRemove }) {
  return (groups || []).map((group) => (
    <section key={group.id} className="actor-effects-group">
      <h3>{group.label}</h3>
      <Accordion type="multiple" className="actor-effects-group__rows">
        {group.sources.map((source) => (
          <SourceRow
            key={source.id}
            source={source}
            canManageEffects={canManageEffects}
            removingIds={removingIds}
            onRemove={onRemove}
          />
        ))}
      </Accordion>
    </section>
  ));
}

function SourceRow({ source, canManageEffects, removingIds, onRemove, nested = false }) {
  return (
    <AccordionItem
      value={source.id}
      className="actor-effect-source"
      data-tone={source.tone}
      data-nested={nested || undefined}
      data-removable={canManageEffects && source.removable || undefined}
    >
      <AccordionTrigger className="actor-effect-source__trigger" data-testid={`actor-effect-source-${source.id}`}>
        <strong>{source.label}</strong>
        {source.summaryValue && <b className="actor-effect-source__value" data-negative="true">{source.summaryValue}</b>}
      </AccordionTrigger>
      {canManageEffects && source.removable && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="actor-effect-source__remove"
          aria-label={`Remove ${source.label}`}
          disabled={removingIds.has(source.id)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove(source);
          }}
        >
          <X />
        </Button>
      )}
      <AccordionContent className="actor-effect-source__content">
        <SourceMeta source={source} />
        <ModifierList modifiers={source.modifiers} />
        {source.children?.length > 0 && <RuleNodeList nodes={source.children} />}
        {source.childSources?.length > 0 && (
          <Accordion type="multiple" className="actor-effect-source__children">
            {source.childSources.map((child) => (
              <SourceRow
                key={child.id}
                source={child}
                canManageEffects={canManageEffects}
                removingIds={removingIds}
                onRemove={onRemove}
                nested
              />
            ))}
          </Accordion>
        )}
        {source.modifiers.length === 0 && source.children.length === 0 && source.childSources.length === 0 && (
          <span className="actor-effect-source__empty">Tracking effect without numerical modifiers</span>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function SourceMeta({ source }) {
  const values = [];
  if (source.sourceActorName) values.push(`Applied by ${source.sourceActorName}`);
  if (source.durationLabel && source.durationLabel !== 'Manual') values.push(source.durationLabel);
  if (source.sourceName && source.sourceName !== source.label && source.kind !== 'persistent_damage') {
    values.push(`Source: ${source.sourceName}`);
  }
  if (values.length === 0) return null;
  return <div className="actor-effect-source__meta">{values.join(' / ')}</div>;
}

function RuleNodeList({ nodes }) {
  return (
    <Accordion type="multiple" className="actor-effect-rule-tree">
      {nodes.map((node) => (
        <AccordionItem key={node.id} value={node.id} className="actor-effect-rule-node">
          <AccordionTrigger className="actor-effect-rule-node__trigger">
            <span>{node.label}</span>
          </AccordionTrigger>
          <AccordionContent className="actor-effect-rule-node__content">
            <ModifierList modifiers={node.modifiers} />
            {node.children?.length > 0 && <RuleNodeList nodes={node.children} />}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function ModifierList({ modifiers }) {
  if (!modifiers?.length) return null;
  return (
    <div className="actor-effect-source__modifiers">
      {modifiers.filter((modifier) => modifier.mode !== 'persistent_damage').map((modifier) => (
        <div key={modifier.modifierId} data-suppressed={!modifier.applied}>
          <span>[{capitalize(modifier.bonusType || modifier.mode || 'effect')}] {modifier.selectorLabel}</span>
          <b data-negative={Number(modifier.value) < 0}>{formatModifierValue(modifier)}</b>
          {modifier.suppressionReason && <small>{modifier.suppressionReason}</small>}
        </div>
      ))}
    </div>
  );
}

function formatSourceLabel(contribution) {
  return contribution.sourceActorName
    ? `${contribution.sourceName} (${contribution.sourceActorName})`
    : contribution.sourceName;
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
