import React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getConditionImgSrc } from '../constants/conditionsCatalog';
import { getConditionIcon } from '../constants/conditions';

const CATEGORY_ICONS = {
  damage_effect: 'DMG',
  affliction: 'AFF',
  custom: 'NOTE',
  item: 'ITEM',
  spell: 'MAG',
  impulse: 'IMP',
  feat: 'FEAT',
};

export function ClosableEffectChip({ effect, removable = false, removing = false, onOpen, onRemove }) {
  const image = effect.category === 'condition' ? getConditionImgSrc(effect.name) : null;
  const icon = effect.category === 'condition'
    ? getConditionIcon(effect.name) || 'FX'
    : CATEGORY_ICONS[effect.category] || 'FX';
  const testId = String(effect.id || effect.name || 'effect').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <Badge
      variant="outline"
      data-testid={`condition-badge-${testId}`}
      data-tone={effect.tone || effect.variant || 'untyped'}
      className="effect-chip"
    >
      <button type="button" className="effect-chip__main" onClick={() => onOpen?.(effect)}>
        {image
          ? <img src={image} alt="" className="effect-chip__image" />
          : <span className="effect-chip__icon">{icon}</span>}
        <span className="effect-chip__label">{effect.label}</span>
      </button>
      {removable && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="effect-chip__remove"
          aria-label={`Remove ${effect.label}`}
          disabled={removing}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove?.(effect);
          }}
        >
          <X />
        </Button>
      )}
    </Badge>
  );
}
