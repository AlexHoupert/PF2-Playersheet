import SpellEditor, { buildSpellOverride } from './editors/SpellEditor';
import CatalogAdminTableView from './catalog/CatalogAdminTableView';
import { useCampaign } from '../shared/context/CampaignContext';
import { useAppFeedback } from '../shared/feedback/AppFeedback';
import {
    SPELL_INDEX_FILTER_OPTIONS,
    SPELL_INDEX_ITEMS,
    fetchSpellDetailBySourceFile,
    fetchSpellRawJsonBySourceFile,
} from '../shared/catalog/spellIndex';

const COLUMNS = Object.freeze([
    { key: 'name', label: 'Name' },
    { key: 'level', label: 'Rank' },
    { key: 'type', label: 'Type' },
    { key: 'traditions', label: 'Traditions' },
    { key: 'rarity', label: 'Rarity' },
    { key: 'traits', label: 'Traits' },
    { key: 'scroll', label: 'Scroll' },
    { key: 'wand', label: 'Wand' },
]);

const FILTERS = Object.freeze([
    { id: 'type', label: 'Type', field: 'type', options: SPELL_INDEX_FILTER_OPTIONS.types },
    { id: 'rarity', label: 'Rarity', field: 'rarity', options: SPELL_INDEX_FILTER_OPTIONS.rarities },
    { id: 'traditions', label: 'Traditions', field: 'traditions', options: SPELL_INDEX_FILTER_OPTIONS.traditions },
    { id: 'traits', label: 'Traits', field: 'traits', options: SPELL_INDEX_FILTER_OPTIONS.traits, matchAll: true },
]);

export default function SpellsView() {
    const { dataActions } = useCampaign();
    const { notifyError } = useAppFeedback();

    const toggleSpellAvailability = async (event, item, property) => {
        event.stopPropagation();
        const newValue = !item[property];
        try {
            const sourceFile = item.sourceFile || item.overrideSourceFile;
            const spellJson = sourceFile
                ? await fetchSpellRawJsonBySourceFile(sourceFile)
                : spellEntryToJson(item);
            if (!spellJson.system) spellJson.system = {};
            spellJson.system[property] = newValue;
            const formData = spellJsonToEditorFormData(spellJson, { ...item, [property]: newValue });
            await dataActions.catalog.saveCatalogOverride(
                buildSpellOverride(spellJson, formData, { ...item, [property]: newValue }, {
                    editorMode: 'edit',
                    catalogType: 'spell',
                    baseEntry: item,
                })
            );
        } catch (err) {
            console.error(err);
            notifyError(`Error updating spell: ${err.message}`);
        }
    };

    const renderCell = ({ entry, column }) => {
        if (column.key === 'scroll' || column.key === 'wand') {
            const property = column.key === 'scroll' ? 'scroll_available' : 'wand_available';
            return (
                <input
                    type="checkbox"
                    checked={Boolean(entry?.[property])}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => toggleSpellAvailability(event, entry, property)}
                    title={`Toggle ${column.key} availability`}
                />
            );
        }
        const value = entry?.[column.key];
        if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
        return value ?? '-';
    };

    return (
        <CatalogAdminTableView
            catalogType="spell"
            entityType="spell"
            title="Spell"
            staticItems={SPELL_INDEX_ITEMS}
            columns={COLUMNS}
            defaultColumns={['name', 'level', 'traditions', 'rarity', 'scroll', 'wand']}
            filters={FILTERS}
            EditorComponent={SpellEditor}
            fetchDetailBySourceFile={fetchSpellDetailBySourceFile}
            searchPlaceholder="Search Spells..."
            newLabel="+ New Spell"
            renderCell={renderCell}
        />
    );
}

function spellEntryToJson(item) {
    return {
        name: item?.name || '',
        type: 'spell',
        img: item?.img || 'systems/pf2e/icons/default-icons/spell.svg',
        system: {
            description: { value: item?.description || '' },
            level: { value: Number(item?.level) || 0 },
            traits: {
                value: item?.traits || [],
                rarity: item?.rarity || 'common',
                traditions: item?.traditions || [],
            },
            time: { value: item?.time || item?.cast || '' },
            range: { value: item?.range || '' },
            target: { value: item?.target || '' },
            area: { value: item?.area || '' },
            duration: { value: item?.duration || '' },
            defense: { save: { statistic: item?.defense || '' } },
        },
    };
}

function spellJsonToEditorFormData(spellJson, item) {
    const system = spellJson?.system || {};
    const traits = system.traits || {};
    return {
        name: spellJson?.name || item?.name || '',
        level: system.level?.value ?? item?.level ?? 0,
        traditions: traits.traditions || item?.traditions || [],
        traits: traits.value || item?.traits || [],
        rarity: traits.rarity || item?.rarity || 'common',
        time: system.time?.value || item?.time || item?.cast || '',
        range: system.range?.value || item?.range || '',
        target: system.target?.value || item?.target || '',
        area: system.area?.value || item?.area || '',
        duration: system.duration?.value || item?.duration || '',
        defense: system.defense?.save?.statistic || item?.defense || '',
        description: system.description?.value || item?.description || '',
        sourceFile: item?.sourceFile || item?.overrideSourceFile || null,
    };
}
