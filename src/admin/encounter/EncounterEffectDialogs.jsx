import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { conditionsCatalog, isConditionValued } from '../../shared/constants/conditionsCatalog';
import { DAMAGE_TYPES } from '../../shared/rules/conditionEffectRules';

export default function EncounterEffectDialogs({
    mode,
    combatant,
    onClose,
    onAddCondition,
    onAddPersistentDamage,
    onAddCustomBadge,
}) {
    const [conditionValue, setConditionValue] = useState(1);
    const [customLabel, setCustomLabel] = useState('');
    const [damageMode, setDamageMode] = useState('dice');
    const [damageType, setDamageType] = useState('fire');
    const [diceCount, setDiceCount] = useState(1);
    const [dieSize, setDieSize] = useState(6);
    const [staticValue, setStaticValue] = useState(1);

    const conditionNames = useMemo(() =>
        Object.values(conditionsCatalog)
            .map(entry => entry?.name)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
    , []);

    const open = Boolean(mode);
    const targetName = combatant?.name || 'Combatant';

    const handleCondition = (conditionName) => {
        const value = isConditionValued(conditionName) ? conditionValue : 1;
        onAddCondition?.(conditionName, value);
        onClose?.();
    };

    const handlePersistentDamage = () => {
        onAddPersistentDamage?.({
            damageType,
            mode: damageMode,
            diceCount,
            dieSize,
            staticValue,
        });
        onClose?.();
    };

    const handleCustomBadge = () => {
        const label = customLabel.trim();
        if (!label) return;
        onAddCustomBadge?.(label);
        setCustomLabel('');
        onClose?.();
    };

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose?.(); }}>
            {mode === 'condition' && (
                <DialogContent className="enc-effect-dialog">
                    <DialogHeader>
                        <DialogTitle>Add Condition</DialogTitle>
                        <DialogDescription>Choose a standard condition for {targetName}.</DialogDescription>
                    </DialogHeader>
                    <div className="enc-effect-dialog__value-row">
                        <Badge variant="secondary">Value</Badge>
                        <Input
                            data-testid="encounter-condition-value"
                            type="number"
                            min="1"
                            value={conditionValue}
                            onChange={(e) => setConditionValue(Math.max(1, Number(e.target.value) || 1))}
                        />
                    </div>
                    <Command className="enc-effect-dialog__command">
                        <CommandInput placeholder="Search conditions..." />
                        <CommandList>
                            <CommandEmpty>No condition found.</CommandEmpty>
                            <CommandGroup heading="Standard Conditions">
                                {conditionNames.map(conditionName => (
                                    <CommandItem
                                        key={conditionName}
                                        value={conditionName}
                                        data-testid={`encounter-condition-option-${conditionName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                                        onSelect={() => handleCondition(conditionName)}
                                    >
                                        <span>{conditionName}</span>
                                        {!isConditionValued(conditionName) && <Badge variant="outline">binary</Badge>}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </DialogContent>
            )}

            {mode === 'persistent' && (
                <DialogContent className="enc-effect-dialog">
                    <DialogHeader>
                        <DialogTitle>Add Persistent Damage</DialogTitle>
                        <DialogDescription>Store a persistent damage badge for {targetName}.</DialogDescription>
                    </DialogHeader>
                    <div className="enc-effect-dialog__grid">
                        <label>
                            Damage Type
                            <Select value={damageType} onValueChange={setDamageType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Damage type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {DAMAGE_TYPES.map(type => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </label>
                        <label>
                            Mode
                            <Select value={damageMode} onValueChange={setDamageMode}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value="dice">Dice</SelectItem>
                                        <SelectItem value="static">Static</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </label>
                        {damageMode === 'dice' ? (
                            <>
                                <label>
                                    Dice
                                    <Input
                                        data-testid="encounter-persistent-dice-count"
                                        type="number"
                                        min="1"
                                        value={diceCount}
                                        onChange={(e) => setDiceCount(Math.max(1, Number(e.target.value) || 1))}
                                    />
                                </label>
                                <label>
                                    Die Size
                                    <Select value={String(dieSize)} onValueChange={(value) => setDieSize(Number(value))}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Die" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                {[4, 6, 8, 10, 12].map(size => (
                                                    <SelectItem key={size} value={String(size)}>d{size}</SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </label>
                            </>
                        ) : (
                            <label>
                                Static Value
                                <Input
                                    data-testid="encounter-persistent-static-value"
                                    type="number"
                                    min="1"
                                    value={staticValue}
                                    onChange={(e) => setStaticValue(Math.max(1, Number(e.target.value) || 1))}
                                />
                            </label>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button data-testid="encounter-persistent-add" onClick={handlePersistentDamage}>Add</Button>
                    </DialogFooter>
                </DialogContent>
            )}

            {mode === 'custom' && (
                <DialogContent className="enc-effect-dialog">
                    <DialogHeader>
                        <DialogTitle>Set Custom Condition</DialogTitle>
                        <DialogDescription>Add a visible badge without numerical rules.</DialogDescription>
                    </DialogHeader>
                    <Input
                        autoFocus
                        data-testid="encounter-custom-condition-input"
                        value={customLabel}
                        onChange={(e) => setCustomLabel(e.target.value)}
                        placeholder="Custom badge"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCustomBadge(); }}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button data-testid="encounter-custom-condition-add" onClick={handleCustomBadge} disabled={!customLabel.trim()}>Add</Button>
                    </DialogFooter>
                </DialogContent>
            )}

            {mode === 'affliction' && (
                <DialogContent className="enc-effect-dialog">
                    <DialogHeader>
                        <DialogTitle>Add Affliction</DialogTitle>
                        <DialogDescription>Diseases and poisons will use this slot in a later wave.</DialogDescription>
                    </DialogHeader>
                    <p className="enc-effect-dialog__note">Coming later. This menu is present so the combat workflow has a stable place for afflictions.</p>
                    <DialogFooter>
                        <Button onClick={onClose}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            )}
        </Dialog>
    );
}
