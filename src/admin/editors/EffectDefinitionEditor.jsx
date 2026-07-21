import { useMemo } from "react";
import { Plus, Trash2, Zap } from "lucide-react";

import {
  EFFECT_ACTIVATION_MODES,
  EFFECT_BONUS_TYPES,
  EFFECT_DURATION_UNITS,
  EFFECT_MODES,
  EFFECT_SELECTOR_REGISTRY,
  EFFECT_TICKS,
  EFFECT_TRIGGERS,
  normalizeEffectDefinitions,
  validateEffectDefinitions,
} from "../../shared/rules/effectDefinitions.js";
import "./EffectDefinitionEditor.css";

const PREDICATE_TYPES = [
  "actor_level", "source_level", "actor_kind", "actor_trait", "source_trait",
  "has_feat", "has_impulse", "has_effect", "equipped", "unarmored",
];
const PREDICATE_OPERATORS = ["eq", "neq", "gte", "lte", "includes", "not_includes"];
const APPLY_ACTIONS = ["adjust_hp", "ensure_temp_hp", "add_condition", "remove_condition"];
const VALUE_MODES = ["fixed", "actor_level_multiplier", "actor_level_tiers", "source_level_tiers"];

export default function EffectDefinitionEditor({ value = [], onChange, sourceType = "item", sourceSubtype = "" }) {
  const definitions = useMemo(() => normalizeEffectDefinitions(value), [value]);
  const validation = useMemo(() => validateEffectDefinitions(definitions), [definitions]);

  const commit = next => onChange?.(normalizeEffectDefinitions(next));
  const updateDefinition = (index, updater) => commit(definitions.map((definition, itemIndex) =>
    itemIndex === index ? updater(definition) : definition
  ));

  return (
    <section className="effect-definition-editor" aria-label="Actor effects">
      <div className="effect-definition-editor__header">
        <div>
          <h3><Zap size={17} /> Actor Effects</h3>
          <p>Declarative rules only. No custom code or arbitrary actor paths are stored.</p>
        </div>
        <button
          type="button"
          className="effect-definition-editor__add"
          onClick={() => commit([...definitions, createDefaultEffectDefinition(sourceType, sourceSubtype, definitions.length)])}
        >
          <Plus size={15} /> Add effect
        </button>
      </div>

      {definitions.length === 0 && (
        <div className="effect-definition-editor__empty">This source has no configured actor effect.</div>
      )}

      {definitions.map((definition, index) => (
        <EffectDefinitionForm
          key={definition.id || index}
          definition={definition}
          index={index}
          onChange={next => updateDefinition(index, () => next)}
          onRemove={() => commit(definitions.filter((_, itemIndex) => itemIndex !== index))}
        />
      ))}

      {!validation.valid && (
        <div className="effect-definition-editor__errors" role="alert">
          {validation.errors.map(error => <div key={error}>{error}</div>)}
        </div>
      )}
    </section>
  );
}

function EffectDefinitionForm({ definition, index, onChange, onRemove }) {
  const patch = update => onChange({ ...definition, ...update });
  const patchNested = (key, update) => patch({ [key]: { ...definition[key], ...update } });

  return (
    <article className="effect-definition">
      <div className="effect-definition__title">
        <input
          className="modal-input"
          value={definition.label}
          onChange={event => patch({ label: event.target.value })}
          aria-label={`Effect ${index + 1} label`}
        />
        <label className="effect-definition__enabled">
          <input type="checkbox" checked={definition.enabled} onChange={event => patch({ enabled: event.target.checked })} />
          Enabled
        </label>
        <button type="button" className="effect-definition__remove" onClick={onRemove} title="Remove effect">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="effect-definition__grid">
        <Field label="Activation">
          <select value={definition.activation.mode} onChange={event => patchActivationMode(definition, event.target.value, patchNested)}>
            {EFFECT_ACTIVATION_MODES.map(option => <option key={option} value={option}>{formatLabel(option)}</option>)}
          </select>
        </Field>
        <Field label="Trigger">
          <select value={definition.activation.trigger} onChange={event => patchNested("activation", { trigger: event.target.value })}>
            {EFFECT_TRIGGERS.filter(trigger => definition.activation.mode === "passive"
              ? ["owned", "equipped"].includes(trigger)
              : !["owned", "equipped"].includes(trigger))
              .map(option => <option key={option} value={option}>{formatLabel(option)}</option>)}
          </select>
        </Field>
        <Field label="Instance policy">
          <select value={definition.activation.instancePolicy} onChange={event => patchNested("activation", { instancePolicy: event.target.value })}>
            {['replace', 'refresh', 'stack'].map(option => <option key={option} value={option}>{formatLabel(option)}</option>)}
          </select>
        </Field>
        <Field label="Stacking group">
          <input value={definition.activation.stackingGroup} onChange={event => patchNested("activation", { stackingGroup: event.target.value })} />
        </Field>
        <Field label="Targets">
          <select value={definition.targeting.mode} onChange={event => patchNested("targeting", { mode: event.target.value })}>
            {['self', 'single', 'multiple'].map(option => <option key={option} value={option}>{formatLabel(option)}</option>)}
          </select>
        </Field>
        <Field label="Duration">
          <select value={definition.duration.unit} onChange={event => patchNested("duration", {
            unit: event.target.value,
            value: ['rounds', 'minutes'].includes(event.target.value) ? definition.duration.value || 1 : null,
          })}>
            {EFFECT_DURATION_UNITS.map(option => <option key={option} value={option}>{formatLabel(option)}</option>)}
          </select>
        </Field>
        {['rounds', 'minutes'].includes(definition.duration.unit) && (
          <>
            <Field label="Duration value">
              <input type="number" min="1" value={definition.duration.value || 1} onChange={event => patchNested("duration", { value: Number(event.target.value) || 1 })} />
            </Field>
            <Field label="Tick">
              <select value={definition.duration.tick} onChange={event => patchNested("duration", { tick: event.target.value })}>
                {EFFECT_TICKS.map(option => <option key={option} value={option}>{formatLabel(option)}</option>)}
              </select>
            </Field>
          </>
        )}
      </div>

      <EditorList
        title="Modifiers"
        items={definition.modifiers}
        createItem={indexValue => createModifier(indexValue)}
        onChange={modifiers => patch({ modifiers })}
        renderItem={(modifier, itemIndex, update) => (
          <ModifierEditor modifier={modifier} index={itemIndex} onChange={update} />
        )}
      />

      <PredicateSection definition={definition} onChange={predicates => patch({ predicates })} />

      <EditorList
        title="On apply"
        items={definition.onApply}
        createItem={indexValue => ({ id: `apply_${indexValue}`, type: "adjust_hp", value: fixedValue(0), conditionName: null })}
        onChange={onApply => patch({ onApply })}
        renderItem={(action, itemIndex, update) => (
          <div className="effect-definition__row effect-definition__row--apply">
            <Field label="Action">
              <select value={action.type} onChange={event => update({ ...action, type: event.target.value })}>
                {APPLY_ACTIONS.map(option => <option key={option} value={option}>{formatLabel(option)}</option>)}
              </select>
            </Field>
            {action.type.includes("condition") ? (
              <Field label="Condition"><input value={action.conditionName || ""} onChange={event => update({ ...action, conditionName: event.target.value })} /></Field>
            ) : (
              <ValueEditor value={action.value} onChange={value => update({ ...action, value })} compact />
            )}
          </div>
        )}
      />

      <div className="effect-definition__summary">{summarizeDefinition(definition)}</div>
    </article>
  );
}

function ModifierEditor({ modifier, onChange }) {
  return (
    <div className="effect-definition__row effect-definition__row--modifier">
      <Field label="Selector">
        <select value={modifier.selector} onChange={event => onChange({ ...modifier, selector: event.target.value })}>
          <option value="">Choose value</option>
          {EFFECT_SELECTOR_REGISTRY.filter(option => option.showInEditor !== false).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </Field>
      <Field label="Mode">
        <select value={modifier.mode} onChange={event => onChange({ ...modifier, mode: event.target.value })}>
          {EFFECT_MODES.map(option => <option key={option} value={option}>{formatLabel(option)}</option>)}
        </select>
      </Field>
      {['bonus', 'penalty'].includes(modifier.mode) && (
        <Field label="Type">
          <select value={modifier.bonusType} onChange={event => onChange({ ...modifier, bonusType: event.target.value })}>
            {EFFECT_BONUS_TYPES.map(option => <option key={option} value={option}>{formatLabel(option)}</option>)}
          </select>
        </Field>
      )}
      {['resistance', 'weakness', 'persistent_damage'].includes(modifier.mode) && (
        <Field label="Damage type"><input value={modifier.damageType || ""} onChange={event => onChange({ ...modifier, damageType: event.target.value })} /></Field>
      )}
      <ValueEditor value={modifier.value} onChange={value => onChange({ ...modifier, value })} />
      <Field label="Dependency"><input value={modifier.dependencyKey || ""} onChange={event => onChange({ ...modifier, dependencyKey: event.target.value })} /></Field>
    </div>
  );
}

function ValueEditor({ value = fixedValue(0), onChange, compact = false }) {
  const expression = typeof value === 'object' ? value : fixedValue(value);
  return (
    <div className={`effect-definition__value ${compact ? 'effect-definition__value--compact' : ''}`}>
      <Field label="Scaling">
        <select value={expression.mode || 'fixed'} onChange={event => onChange({ ...expression, mode: event.target.value })}>
          {VALUE_MODES.map(option => <option key={option} value={option}>{formatLabel(option)}</option>)}
        </select>
      </Field>
      <Field label={expression.mode === 'actor_level_multiplier' ? 'Base' : 'Value'}>
        <input type="number" value={expression.value ?? 0} onChange={event => onChange({ ...expression, value: Number(event.target.value) || 0 })} />
      </Field>
      {expression.mode === 'actor_level_multiplier' && (
        <Field label="Per actor level"><input type="number" step="0.1" value={expression.multiplier ?? 1} onChange={event => onChange({ ...expression, multiplier: Number(event.target.value) || 0 })} /></Field>
      )}
      {expression.mode?.includes('_tiers') && (
        <div className="effect-definition__tiers">
          {(expression.tiers || []).map((tier, index) => (
            <div key={`${tier.min}-${index}`}>
              <input type="number" min="0" value={tier.min} aria-label="Tier minimum level" onChange={event => onChange({ ...expression, tiers: expression.tiers.map((item, itemIndex) => itemIndex === index ? { ...item, min: Number(event.target.value) || 0 } : item) })} />
              <input type="number" value={tier.value} aria-label="Tier value" onChange={event => onChange({ ...expression, tiers: expression.tiers.map((item, itemIndex) => itemIndex === index ? { ...item, value: Number(event.target.value) || 0 } : item) })} />
              <button type="button" onClick={() => onChange({ ...expression, tiers: expression.tiers.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={13} /></button>
            </div>
          ))}
          <button type="button" onClick={() => onChange({ ...expression, tiers: [...(expression.tiers || []), { min: 1, value: 1 }] })}><Plus size={13} /> Tier</button>
        </div>
      )}
    </div>
  );
}

function PredicateSection({ definition, onChange }) {
  const updateGroup = (group, values) => onChange({ ...definition.predicates, [group]: values });
  return (
    <div className="effect-definition__predicates">
      {['all', 'any'].map(group => (
        <EditorList
          key={group}
          title={group === 'all' ? 'All predicates' : 'Any predicate'}
          items={definition.predicates[group]}
          createItem={index => ({ id: `${group}_${index}`, type: 'actor_level', operator: 'gte', value: 1 })}
          onChange={items => updateGroup(group, items)}
          renderItem={(predicate, _index, update) => (
            <div className="effect-definition__row effect-definition__row--predicate">
              <Field label="Predicate"><select value={predicate.type} onChange={event => update({ ...predicate, type: event.target.value })}>{PREDICATE_TYPES.map(option => <option key={option} value={option}>{formatLabel(option)}</option>)}</select></Field>
              <Field label="Operator"><select value={predicate.operator} onChange={event => update({ ...predicate, operator: event.target.value })}>{PREDICATE_OPERATORS.map(option => <option key={option} value={option}>{formatLabel(option)}</option>)}</select></Field>
              <Field label="Value"><input value={String(predicate.value ?? '')} onChange={event => update({ ...predicate, value: parsePredicateValue(event.target.value) })} /></Field>
            </div>
          )}
        />
      ))}
    </div>
  );
}

function EditorList({ title, items = [], createItem, onChange, renderItem }) {
  return (
    <section className="effect-definition__list">
      <div className="effect-definition__list-title">
        <strong>{title}</strong>
        <button type="button" onClick={() => onChange([...items, createItem(items.length)])}><Plus size={13} /> Add</button>
      </div>
      {items.map((item, index) => (
        <div className="effect-definition__list-item" key={item.id || index}>
          {renderItem(item, index, next => onChange(items.map((current, itemIndex) => itemIndex === index ? next : current)))}
          <button type="button" className="effect-definition__row-remove" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} title={`Remove ${title.toLowerCase()}`}><Trash2 size={14} /></button>
        </div>
      ))}
    </section>
  );
}

function Field({ label, children }) {
  return <label className="effect-definition__field"><span>{label}</span>{children}</label>;
}

export function createDefaultEffectDefinition(sourceType, sourceSubtype = "", index = 0) {
  const passive = sourceType === 'feat' || (sourceType === 'item' && !String(sourceSubtype).toLowerCase().includes('consum'));
  const trigger = sourceType === 'feat' ? 'owned'
    : sourceType === 'spell' ? 'cast'
      : sourceType === 'impulse' ? 'activate'
        : passive ? 'equipped' : 'consume';
  const duration = passive ? 'unlimited'
    : sourceType === 'item' && !String(sourceSubtype).toLowerCase().includes('consum') ? 'daily_preparation'
      : 'manual';
  return {
    id: `effect_definition_${Date.now()}_${index}`,
    label: 'New Effect',
    enabled: true,
    category: sourceType === 'impulse' ? 'spell' : sourceType,
    activation: {
      mode: passive ? 'passive' : 'usable',
      trigger,
      instancePolicy: 'replace',
      stackingGroup: `${sourceType}_effect_${index + 1}`,
      cost: sourceType === 'item' && trigger === 'consume'
        ? { type: 'inventory_item', quantity: 1, consumeSource: true }
        : null,
    },
    targeting: { mode: 'self', allowedActorKinds: ['pc', 'guest', 'npc'] },
    duration: { unit: duration, value: null, tick: 'turn_end' },
    predicates: { all: [], any: [] },
    modifiers: [createModifier(0)],
    onApply: [],
  };
}

function createModifier(index) {
  return {
    id: `modifier_${index}`,
    selector: 'ac',
    mode: 'bonus',
    bonusType: 'status',
    damageType: null,
    value: fixedValue(1),
    stackingKey: '',
    dependencyKey: '',
    source: '',
  };
}

function fixedValue(value) {
  return { mode: 'fixed', value: Number(value) || 0, multiplier: 0, tiers: [] };
}

function patchActivationMode(definition, mode, patchNested) {
  patchNested('activation', {
    mode,
    trigger: mode === 'passive' ? 'owned' : ['owned', 'equipped'].includes(definition.activation.trigger) ? 'activate' : definition.activation.trigger,
  });
}

function summarizeDefinition(definition) {
  const modifierCount = definition.modifiers.length;
  const target = definition.targeting.mode === 'self' ? 'self' : definition.targeting.mode;
  const duration = definition.duration.unit === 'unlimited'
    ? 'while source is available'
    : definition.duration.unit === 'daily_preparation'
      ? 'until daily preparation'
      : definition.duration.value ? `${definition.duration.value} ${definition.duration.unit}` : definition.duration.unit;
  return `${formatLabel(definition.activation.mode)} via ${formatLabel(definition.activation.trigger)}; ${target}; ${duration}; ${modifierCount} modifier${modifierCount === 1 ? '' : 's'}.`;
}

function parsePredicateValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value !== '' && Number.isFinite(Number(value))) return Number(value);
  return value;
}

function formatLabel(value) {
  return String(value || '').split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}
