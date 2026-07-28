import React, { useEffect, useState } from 'react';
import FormDialog from '../../shared/components/dialogs/FormDialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
    normalizePlayerUserSettings,
    SKILL_PROFICIENCY_DISPLAY,
} from '../settings/playerUserSettings';

const FORM_ID = 'player-user-settings-form';

export default function UserSettingsDialog({ open, settings, onSave, onClose }) {
    const [form, setForm] = useState(() => normalizePlayerUserSettings(settings));
    const [pending, setPending] = useState(false);

    useEffect(() => {
        if (open) setForm(normalizePlayerUserSettings(settings));
    }, [open, settings]);

    const submit = async event => {
        event.preventDefault();
        setPending(true);
        try {
            await onSave?.(normalizePlayerUserSettings(form));
            onClose?.();
        } finally {
            setPending(false);
        }
    };

    return (
        <FormDialog
            open={open}
            onOpenChange={nextOpen => { if (!nextOpen) onClose?.(); }}
            layerId="player-user-settings"
            title="User Settings"
            description="Personal display and navigation preferences for this campaign."
            size="sm"
            formId={FORM_ID}
            submitLabel="Save Settings"
            pending={pending}
        >
            <form id={FORM_ID} onSubmit={submit} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="skill-proficiency-display">Show Proficiency on Skills</Label>
                    <Select
                        value={form.skillProficiencyDisplay}
                        onValueChange={value => setForm(current => ({ ...current, skillProficiencyDisplay: value }))}
                    >
                        <SelectTrigger id="skill-proficiency-display" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={SKILL_PROFICIENCY_DISPLAY.NONE}>No</SelectItem>
                            <SelectItem value={SKILL_PROFICIENCY_DISPLAY.SHORT}>Short</SelectItem>
                            <SelectItem value={SKILL_PROFICIENCY_DISPLAY.FULL}>Fulltext</SelectItem>
                            <SelectItem value={SKILL_PROFICIENCY_DISPLAY.STARS}>Stars</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">Show the skill proficiency between its attribute and total value.</p>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
                    <div className="space-y-1">
                        <Label htmlFor="loop-player-pages">Loop Pages</Label>
                        <p className="text-sm text-muted-foreground">Continue from the last page to the first page when swiping.</p>
                    </div>
                    <Switch
                        id="loop-player-pages"
                        checked={form.loopPages}
                        onCheckedChange={checked => setForm(current => ({ ...current, loopPages: checked }))}
                    />
                </div>
            </form>
        </FormDialog>
    );
}
