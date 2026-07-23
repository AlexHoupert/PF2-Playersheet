import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import bloodMagicEffects from '../../../ressources/classfeatures/bloodmagic-effects.json';
import { inferCatalogEntityType } from '../../shared/catalog/catalogDetailCore';
import { CatalogDetailDialog, RichDescription } from '../../shared/components/catalog-detail';
import { useAppFeedback } from '../../shared/feedback/AppFeedback';
import { isEquipableInventoryItem } from '../../shared/utils/combatUtils';
import { getItemIdentityKey, resolveInventoryItemIdentity } from '../../shared/utils/itemIdentity';
import { consumeWandCharge, getWandCharges, getWandMaxCharges, getWandSpell, isWandItem, writeWandCharges } from '../../shared/utils/wandUtils';
import { calculateWeaponDamage } from '../../utils/rules/damage';
import { applyRune, getRunes, removeRune } from '../../utils/rules/runes';
import SourceEffectActivationPanel from '../components/SourceEffectActivationPanel';

export function ItemDetailModal({
    character,
    updateCharacter,
    modalData,
    toggleInventoryEquipped,
    onBack,
    onClose,
    hasHistory,
    isLoadingShopDetail,
    shopDetailError,
    onContentLinkClick,
}) {
    const [showRunePicker, setShowRunePicker] = useState(false);
    const { notifyError } = useAppFeedback();
    const catalogType = inferCatalogEntityType(modalData);

    const inventoryResolution = useMemo(() => {
        if (catalogType !== 'item' || !modalData?.name || !character?.inventory) return { item: null, index: -1 };
        return resolveInventoryItemIdentity(character.inventory, modalData);
    }, [catalogType, character?.inventory, modalData]);

    if (!modalData) return null;

    const inventoryMatch = inventoryResolution.item;
    const inventoryIndex = inventoryResolution.index;
    const canToggleEquip = Boolean(inventoryMatch && isEquipableInventoryItem(inventoryMatch));
    const isEquipped = Boolean(inventoryMatch?.equipped);
    const typeLower = String(modalData.type || '').toLowerCase();
    const isWeapon = typeLower === 'weapon';
    const isArmor = typeLower === 'armor' || typeLower === 'shield';
    const canModifyRunes = Boolean((isWeapon || isArmor) && inventoryMatch && updateCharacter);
    const availableRunes = canModifyRunes ? selectAvailableRunes(character?.inventory, { isWeapon, isArmor }) : [];
    const traits = Array.isArray(modalData.traits?.value)
        ? modalData.traits.value
        : Array.isArray(modalData.traits)
            ? modalData.traits
            : [];
    const traitsLower = traits.map((trait) => String(trait).toLowerCase());
    const isStaff = traitsLower.includes('staff') || String(modalData.name || '').toLowerCase().includes('staff');
    const staffMaxCharges = isStaff ? findStaffMaxCharges(character) : 0;
    const currentStaffCharges = inventoryMatch?.system?.staff?.charges || 0;
    const wandSource = inventoryMatch || modalData;
    const isWand = isWandItem(wandSource) || traitsLower.includes('wand');
    const wandCharges = isWand ? getWandCharges(wandSource) : 0;
    const wandMax = isWand ? getWandMaxCharges(wandSource) : 1;
    const imbuedSpell = getWandSpell(inventoryMatch) || getWandSpell(modalData);
    const isWeaponItem = modalData.type === 'Weapon'
        || (modalData.group && !['Armor', 'Shield', 'Equipment', 'Consumable', 'Treasure'].includes(modalData.type));
    const damageData = catalogType === 'item' && isWeaponItem && character
        ? calculateWeaponDamage(modalData, character)
        : null;

    const updateInventoryItem = (updater) => {
        if (!inventoryMatch || inventoryIndex < 0 || !updateCharacter) return;
        updateCharacter((draft) => updater(draft.inventory[inventoryIndex], draft));
    };

    const handlePrepareStaff = () => updateInventoryItem((item) => {
        item.system ||= {};
        item.system.staff ||= {};
        item.system.staff.charges = staffMaxCharges;
        item.system.staff.max = staffMaxCharges;
    });

    const setStaffCharges = (value) => updateInventoryItem((item) => {
        item.system ||= {};
        item.system.staff ||= {};
        item.system.staff.charges = currentStaffCharges === value ? value - 1 : value;
    });

    const setWandCharges = (value) => updateInventoryItem((item) => {
        writeWandCharges(item, wandCharges === value ? value - 1 : value);
    });

    const handleCastSpell = () => {
        if (!inventoryMatch) return;
        if (isWand) {
            if (wandCharges > 0) updateInventoryItem((item) => consumeWandCharge(item));
            return;
        }
        updateCharacter((draft) => {
            const item = draft.inventory[inventoryIndex];
            if (item.qty > 1) item.qty -= 1;
            else draft.inventory.splice(inventoryIndex, 1);
        });
        if ((inventoryMatch.qty || 1) <= 1) onClose?.();
    };

    const handleApplyRune = (runeItem) => {
        const { newItem, consumed, error } = applyRune(inventoryMatch, runeItem, { isWeapon, isArmor });
        if (error) {
            notifyError(error);
            return;
        }
        updateCharacter((draft) => {
            draft.inventory[inventoryIndex] = newItem;
            if (!consumed) return;
            const runeResolution = resolveInventoryItemIdentity(draft.inventory, runeItem);
            if (runeResolution.index < 0) return;
            const rune = draft.inventory[runeResolution.index];
            if ((rune.qty || 1) > 1) rune.qty -= 1;
            else draft.inventory.splice(runeResolution.index, 1);
        });
        setShowRunePicker(false);
        onClose?.();
    };

    const handleRemoveRune = (runeType, propertyName = null) => {
        const { newItem, runeRecovered } = removeRune(inventoryMatch, runeType, propertyName);
        updateCharacter((draft) => {
            draft.inventory[inventoryIndex] = newItem;
            if (runeRecovered) draft.inventory.push({ ...runeRecovered, qty: 1 });
        });
        onClose?.();
    };

    return (
        <CatalogDetailDialog
            open
            onOpenChange={(open) => { if (!open) onClose?.(); }}
            entry={modalData}
            catalogType={catalogType}
            actor={character}
            isLoading={isLoadingShopDetail}
            loadError={shopDetailError?.message || shopDetailError}
            onContentLinkClick={onContentLinkClick}
            onBack={onBack}
            hasHistory={hasHistory}
            footer={canToggleEquip ? (
                <Button
                    type="button"
                    variant={isEquipped ? 'secondary' : 'default'}
                    onClick={() => toggleInventoryEquipped?.(inventoryMatch)}
                >
                    {isEquipped ? 'Unequip' : 'Equip'}
                </Button>
            ) : null}
        >
            <div className="mt-5 flex flex-col gap-4">
                <WeaponDamagePanel damageData={damageData} />
                {canModifyRunes ? (
                    <RuneSection
                        item={inventoryMatch}
                        availableRunes={availableRunes}
                        expanded={showRunePicker}
                        onExpandedChange={setShowRunePicker}
                        onApply={handleApplyRune}
                        onRemove={handleRemoveRune}
                    />
                ) : null}
                {isStaff ? (
                    <ChargeSection
                        label="Staff charges"
                        current={currentStaffCharges}
                        max={staffMaxCharges}
                        onSet={setStaffCharges}
                        action={<Button type="button" size="sm" onClick={handlePrepareStaff}>Prepare</Button>}
                    />
                ) : null}
                {isWand ? <ChargeSection label="Wand charges" current={wandCharges} max={wandMax} onSet={setWandCharges} /> : null}
                {imbuedSpell ? (
                    <ImbuedSpellSection
                        spell={imbuedSpell}
                        canCast={Boolean(inventoryMatch)}
                        disabled={isWand && wandCharges <= 0}
                        buttonLabel={isWand ? (wandCharges <= 0 ? 'Wand empty' : 'Cast using wand charge') : 'Cast and consume scroll'}
                        onCast={handleCastSpell}
                    />
                ) : null}
                {catalogType === 'spell' && modalData.Bloodmagic ? <BloodMagicSection character={character} /> : null}
                <SourceEffectActivationPanel source={inventoryMatch || modalData} />
            </div>
        </CatalogDetailDialog>
    );
}

function WeaponDamagePanel({ damageData }) {
    if (!damageData) return null;
    return (
        <section className="grid gap-3 rounded-lg border border-primary/70 bg-muted/30 p-3 sm:grid-cols-2">
            <DamageValue label="Normal damage" value={damageData.normal} />
            <DamageValue label="Critical damage" value={damageData.crit} destructive />
        </section>
    );
}

function DamageValue({ label, value, destructive = false }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs uppercase text-muted-foreground">{label}</span>
            <strong className={destructive ? 'text-destructive' : 'text-primary'}>
                {value.parts
                    ? value.parts.map((part, index) => <span key={`${part.text}-${index}`}>{part.text}{index < value.parts.length - 1 ? ' ' : ''}</span>)
                    : value.text}
            </strong>
        </div>
    );
}

function RuneSection({ item, availableRunes, expanded, onExpandedChange, onApply, onRemove }) {
    const runes = getRunes(item);
    const entries = [
        runes.potency ? { id: 'potency', label: `Potency +${runes.potency}`, type: 'potency' } : null,
        runes.striking ? { id: 'striking', label: getStrikingRuneLabel(runes.striking), type: 'striking' } : null,
        runes.resilient ? { id: 'resilient', label: `Resilient +${runes.resilient}`, type: 'resilient' } : null,
        ...(runes.property || []).map((name) => ({ id: `property-${name}`, label: name, type: 'property', name })),
    ].filter(Boolean);

    return (
        <section className="flex flex-col gap-3 border-t border-border/70 pt-4">
            <div className="flex items-center justify-between gap-3">
                <h3 className="font-heading text-base text-primary">Runes</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => onExpandedChange(!expanded)}>
                    {expanded ? 'Cancel' : 'Add rune'}
                </Button>
            </div>
            <div className="flex flex-wrap gap-2">
                {entries.length ? entries.map((rune) => (
                    <Badge key={rune.id} variant="secondary" className="gap-2">
                        {rune.label}
                        <button type="button" aria-label={`Remove ${rune.label}`} onClick={() => onRemove(rune.type, rune.name)}>x</button>
                    </Badge>
                )) : <span className="text-sm italic text-muted-foreground">No runes applied.</span>}
            </div>
            {expanded ? (
                <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/30 p-3">
                    {availableRunes.length ? availableRunes.map((rune) => (
                        <Button key={getItemIdentityKey(rune)} type="button" variant="ghost" className="justify-between" onClick={() => onApply(rune)}>
                            {rune.name}<span className="text-muted-foreground">Apply</span>
                        </Button>
                    )) : <span className="text-sm italic text-muted-foreground">No compatible runes found in inventory.</span>}
                </div>
            ) : null}
        </section>
    );
}

function ChargeSection({ label, current, max, onSet, action }) {
    return (
        <section className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{label} ({current}/{max})</span>
                {action}
            </div>
            <div className="flex flex-wrap gap-2">
                {max > 0 ? Array.from({ length: max }, (_, index) => index + 1).map((value) => (
                    <Button
                        key={value}
                        type="button"
                        size="icon-sm"
                        variant={value <= current ? 'default' : 'outline'}
                        aria-label={`Set ${label.toLowerCase()} to ${value}`}
                        onClick={() => onSet(value)}
                    >
                        {value}
                    </Button>
                )) : <span className="text-sm italic text-muted-foreground">No charges available.</span>}
            </div>
        </section>
    );
}

function ImbuedSpellSection({ spell, canCast, disabled, buttonLabel, onCast }) {
    return (
        <section className="flex flex-col gap-3 rounded-lg border border-primary/60 bg-primary/5 p-3">
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="content-link font-heading text-lg text-primary underline" data-type="spell" data-name={spell.name}>
                    {spell.name}
                </button>
                <Badge variant="outline">Rank {spell.level}</Badge>
            </div>
            {spell.traditions?.length ? <p className="text-sm text-muted-foreground">Traditions: {spell.traditions.join(', ')}</p> : null}
            {canCast ? <Button type="button" disabled={disabled} onClick={onCast}>{buttonLabel}</Button> : null}
        </section>
    );
}

function BloodMagicSection({ character }) {
    const selected = character?.magic?.bloodmagic;
    const effect = selected ? bloodMagicEffects.Effects?.[selected] : null;
    return (
        <section className="flex flex-col gap-2 border-t border-border/70 pt-4">
            <h3 className="font-heading text-base text-destructive">Blood Magic</h3>
            {!selected ? <p className="text-sm italic text-muted-foreground">Character has no active Blood Magic.</p> : null}
            {selected && !effect ? <p className="text-sm text-destructive">Effect "{selected}" was not found in the library.</p> : null}
            {effect ? <><strong>{selected}</strong><RichDescription description={effect.description || ''} actor={character} /></> : null}
        </section>
    );
}

function selectAvailableRunes(inventory = [], { isWeapon, isArmor }) {
    return inventory.filter((item) => {
        const type = String(item.type || 'Equipment');
        const category = String(item.category || '').toLowerCase();
        const name = String(item.name || '').toLowerCase();
        const usage = String(item.system?.usage?.value || '').toLowerCase();
        const runeLike = type === 'Rune' || category.includes('rune') || usage.includes('etched')
            || ['potency', 'striking', 'resilient', 'rune'].some((part) => name.includes(part));
        if (!runeLike) return false;
        if (isWeapon && category === 'rune_weapon') return true;
        if (isArmor && category === 'rune_armor') return true;
        if (isWeapon && (usage.includes('weapon') || usage.includes('melee') || name.includes('weapon'))) return true;
        if (isArmor && (usage.includes('armor') || usage.includes('shield') || name.includes('armor'))) return true;
        return type === 'Rune';
    });
}

function findStaffMaxCharges(character) {
    const slots = character?.magic?.slots || {};
    for (let rank = 10; rank >= 1; rank -= 1) {
        if (Number(slots[`${rank}_max`] || 0) > 0) return rank;
    }
    return 0;
}

function titleCase(value) {
    return String(value || '').replace(/([A-Z])/g, ' $1').trim().replace(/^./, (letter) => letter.toUpperCase());
}

function getStrikingRuneLabel(value) {
    return ({ 1: 'Striking', 2: 'Greater Striking', 3: 'Major Striking' })[Number(value)] || titleCase(value);
}
