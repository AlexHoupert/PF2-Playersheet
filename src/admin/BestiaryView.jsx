/**
 * BestiaryView - Admin panel for managing creatures and hazards
 * Features: List/filter/sort, CRUD operations, JSON import, reveal state management
 *
 * Architecture: Creature DATA comes from catalog (static JSON files),
 * while db only stores METADATA (group, bestiary visibility, revealState, falseData)
 */
import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useCampaign } from '../shared/context/CampaignContext';
import { useAppFeedback } from '../shared/feedback/AppFeedback';
import BottomSheet from '../shared/components/BottomSheet';
import CreatureCard from '../shared/components/CreatureCard';
import CreatureAbilityModal from '../shared/components/CreatureAbilityModal';
import CreatureSkillDetailDialog from '../shared/components/CreatureSkillDetailDialog';
import { CatalogDetailDialog } from '../shared/components/catalog-detail';
import AppDialogShell from '../shared/components/dialogs/AppDialogShell';
import CreatureEditor from './editors/CreatureEditor';
import { useWindowSize } from '../shared/hooks/useWindowSize';
import { generateFalseData } from '../utils/bestiaryUtils';
import { deepClone } from '../shared/utils/deepClone';
import { getAllCreatures, fetchCreatureData } from '../shared/catalog/creatureIndex';
import { SPELL_INDEX_ITEMS } from '../shared/catalog/spellIndex';
import { mergeCreatureDetailIntoEntry } from '../shared/catalog/catalogDetailMerge';
import { selectCustomAbilityList } from '../shared/db/selectors/abilitySelectors';
import { selectBestiaryCreatureMetadata, selectCustomCreatures } from '../shared/db/selectors/bestiarySelectors';
import { DEFAULT_CREATURE_REVEAL_STATE, buildBestiaryCreatureEntries } from '../shared/bestiary/creaturePresentation';
import { buildHideOverride } from '../shared/catalog/catalogEntryModel';
import { selectCatalogEntryStates, selectVisibleCatalogEntries } from '../shared/db/selectors/catalogOverrideSelectors';
import {
    AdminPagination,
    AdminResourceWorkspace,
    AdminSubtable,
    AdminTableSurface,
    AdminTableToolbar,
} from './components/table';
import { matchesKeyedNumberRange, matchesNumberRange } from './components/table/adminTableFilters';
import {
    formatTypedCreatureValues,
    getCreatureSkillBonus,
} from '../shared/bestiary/creatureTableSummary';
import { selectCampaignLoreArticles } from '../shared/db/selectors/loreSelectors';
import { selectLoreBacklinks } from '../shared/lore/loreSelectors';
import { useLoreAdminStore } from '../shared/lore/useLoreStores';

export default function BestiaryView({ db, initialFilterType, onContentLinkClick }) {
    const { activeCampaign, activeCampaignId, dataActions, dbMode } = useCampaign();
    const { confirm, notifyError, notifySuccess, prompt } = useAppFeedback();
    const { isMobile } = useWindowSize();
    const loreStore = useLoreAdminStore({
        campaignId: activeCampaignId,
        enabled: dbMode === 'firestore-v2',
        fallbackArticles: selectCampaignLoreArticles(activeCampaign, db),
        fallbackGroups: activeCampaign?.loreGroups || [],
        fallbackDeliveries: activeCampaign?.loreDeliveries || [],
        fallbackNotes: activeCampaign?.knowledgeNotes || [],
    });

    // ── Filter / search state ────────────────────────────────────────────────
    const [search, setSearch] = useState('');
    const [activeFilters, setActiveFilters] = useState(
        initialFilterType?.length ? { type: initialFilterType } : {}
    );

    useEffect(() => {
        setActiveFilters(prev => {
            if (initialFilterType?.length) return { ...prev, type: initialFilterType };
            const n = { ...prev }; delete n.type; return n;
        });
        setPage(1);
    }, [JSON.stringify(initialFilterType)]);

    // ── Pagination / sort / column state ────────────────────────────────────
    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [visibleColumns, setVisibleColumns] = useState(['name', 'level', 'type', 'group', 'bestiary']);
    const [filterOpen, setFilterOpen] = useState(false);
    const [focusFilterId, setFocusFilterId] = useState(null);
    const [resourceMode, setResourceMode] = useState('creatures');
    const [selectedEncounterId, setSelectedEncounterId] = useState(null);
    const [mobileWorkspaceOpen, setMobileWorkspaceOpen] = useState(false);
    const [mobileWorkspaceMode, setMobileWorkspaceMode] = useState('upper');
    const [focusScope, setFocusScope] = useState(null);

    // ── Selection / context menu / toast ────────────────────────────────────
    const [, setContextMenu] = useState(null);
    const [toast, setToast] = useState(null);

    const showToast = (msg) => {
        const key = Date.now();
        setToast({ msg, key });
        setTimeout(() => setToast(t => t?.key === key ? null : t), 2200);
    };
    const runDataAction = (action) => {
        Promise.resolve(action).catch(err => {
            console.error(err);
            notifyError(err);
        });
    };

    const copyCreatureRef = async (creature) => {
        const { copyRef } = await import('../shared/clipboard/refClipboard');
        copyRef('creature', creature);
        showToast('Reference copied');
    };

    const pasteAbilityToCreature = async (creature) => {
        const { getInMemoryRef } = await import('../shared/clipboard/refClipboard');
        const ref = getInMemoryRef();
        if (!ref || ref.type !== 'ability') { showToast('No ability reference in clipboard'); return; }
        const ability = ref.data;
        const foundryItem = {
            _id: `ability-${Date.now()}`,
            name: ability.name,
            type: 'action',
            img: '',
            system: {
                actionType: { value: ability.typeCode === 'P' ? 'passive' : ability.typeCode === 'R' ? 'reaction' : ability.typeCode === 'F' ? 'free' : 'action' },
                actions: { value: ['1', '2', '3'].includes(ability.typeCode) ? parseInt(ability.typeCode) : null },
                description: { value: ability.description || '' },
                traits: { value: ability.traits || [] },
            },
        };
        runDataAction(dataActions.bestiary.updateCustomCreature(creature.id, entry => ({
            ...entry,
            data: { ...entry.data, items: [...(entry.data?.items || []), foundryItem] }
        })));
        showToast(`"${ability.name}" added to ${creature.name}`);
        setContextMenu(null);
    };

    // ── Editor / preview state ───────────────────────────────────────────────
    const [editingCreature, setEditingCreature] = useState(null);
    const [previewCreature, setPreviewCreature] = useState(null);
    const [loadedCreatureData, setLoadedCreatureData] = useState(null);
    const [selectedAbility, setSelectedAbility] = useState(null);
    const [selectedSkill, setSelectedSkill] = useState(null);
    const [selectedSpell, setSelectedSpell] = useState(null);
    const loreBacklinks = useMemo(() => previewCreature?.id
        ? selectLoreBacklinks(loreStore.articles, 'creature', previewCreature.id)
        : [], [loreStore.articles, previewCreature?.id]);

    // Fetch full creature data when preview creature changes
    useEffect(() => {
        if (!previewCreature?.id) { setLoadedCreatureData(null); return; }
        if (previewCreature.isCustom) {
            const customData = selectCustomCreatures(db)[previewCreature.id]?.data;
            if (customData) {
                setLoadedCreatureData(mergeCreatureDetailIntoEntry(customData, previewCreature).data);
                return;
            }
            if (previewCreature.data) {
                setLoadedCreatureData(mergeCreatureDetailIntoEntry(previewCreature.data, previewCreature).data);
                return;
            }
        }
        fetchCreatureData(previewCreature.id).then(data => {
            if (data) setLoadedCreatureData(mergeCreatureDetailIntoEntry(data, previewCreature).data);
        });
    }, [previewCreature?.id, db]);

    // Fetch full creature data when editing creature changes
    useEffect(() => {
        if (!editingCreature?.id || editingCreature.data) return;
        if (editingCreature.isCustom) {
            const customData = selectCustomCreatures(db)[editingCreature.id]?.data;
            if (customData) {
                setEditingCreature(prev => mergeCreatureDetailIntoEntry(customData, prev));
                return;
            }
        }
        fetchCreatureData(editingCreature.id).then(data => {
            if (data) setEditingCreature(prev => mergeCreatureDetailIntoEntry(data, prev));
        });
    }, [editingCreature?.id, db]);

    // ── Data: merge index + custom creatures ─────────────────────────────────
    const allCreatureEntries = useMemo(() => {
        return buildBestiaryCreatureEntries({
            entryStates: selectCatalogEntryStates(getAllCreatures(), db, 'creature'),
            metadata: selectBestiaryCreatureMetadata(db),
            includeUnpublished: true,
        });
    }, [db]);
    const creatures = useMemo(
        () => allCreatureEntries.filter(creature => !creature.linkedOnly),
        [allCreatureEntries]
    );
    const spellCatalog = useMemo(
        () => selectVisibleCatalogEntries(SPELL_INDEX_ITEMS, db, 'spell'),
        [db]
    );
    const encounters = useMemo(
        () => (activeCampaign?.encounters || []).filter(encounter => !encounter.deletedAt),
        [activeCampaign?.encounters]
    );
    const selectedEncounter = useMemo(
        () => encounters.find(encounter => encounter.id === selectedEncounterId)
            || encounters.find(encounter => encounter.isActive)
            || encounters[0]
            || null,
        [encounters, selectedEncounterId]
    );
    const encounterCreatureCombatants = useMemo(
        () => (selectedEncounter?.combatants || []).filter(combatant => combatant.type === 'creature'),
        [selectedEncounter]
    );
    const encounterRows = useMemo(() => encounters.map(encounter => ({
        ...encounter,
        creatureCount: (encounter.combatants || []).filter(combatant => combatant.type === 'creature').length,
        playerCount: (encounter.combatants || []).filter(combatant => combatant.type === 'player').length,
    })), [encounters]);
    const encounterCombatantRows = useMemo(() => encounterCreatureCombatants.map(combatant => {
        const creature = allCreatureEntries.find(entry => entry.id === combatant.creatureId)
            || allCreatureEntries.find(entry => entry.name === combatant.name);
        const maxHp = combatant.maxHp ?? combatant.hp?.max ?? combatant.hp ?? 0;
        const currentHp = combatant.currentHp ?? combatant.hp?.current ?? combatant.hp ?? maxHp;
        return {
            ...combatant,
            catalogCreature: creature || null,
            displayName: combatant.instanceLabel > 1 ? `${combatant.name} ${combatant.instanceLabel}` : combatant.name,
            level: creature?.level ?? '-',
            currentHp,
            maxHp,
            hpDisplay: `${currentHp}/${maxHp}`,
            defeated: Boolean(combatant.defeatedAt || currentHp <= 0),
        };
    }), [allCreatureEntries, encounterCreatureCombatants]);

    useEffect(() => {
        if (selectedEncounter && selectedEncounter.id !== selectedEncounterId) {
            setSelectedEncounterId(selectedEncounter.id);
        }
    }, [selectedEncounter, selectedEncounterId]);

    // ── Filter options ────────────────────────────────────────────────────────
    const uniqueTypes    = useMemo(() => [...new Set(creatures.map(creature => creature.type))].filter(Boolean).sort(), [creatures]);
    const uniqueRarities = useMemo(() => ['common', 'uncommon', 'rare', 'unique'], []);
    const uniqueTraits   = useMemo(() => {
        const s = new Set(); creatures.forEach(c => c.traits?.forEach(t => s.add(t))); return [...s].sort();
    }, [creatures]);
    const uniqueGroups   = useMemo(() => {
        const s = new Set(); creatures.forEach(c => s.add(c.group || 'Uncategorized')); return [...s].sort();
    }, [creatures]);
    const uniqueSizes = useMemo(() => [...new Set(creatures.map(creature => creature.size))].filter(Boolean).sort(), [creatures]);
    const uniqueDefenseTypes = useMemo(() => [...new Set(creatures.flatMap(creature => [
        ...(creature.resistances || []).map(entry => entry.type),
        ...(creature.weaknesses || []).map(entry => entry.type),
        ...(creature.immunities || []).map(entry => entry.type),
    ]))].filter(Boolean).sort(), [creatures]);
    const uniqueSkills = useMemo(() => [...new Set(creatures.flatMap(creature => (creature.skills || []).map(skill => skill.key)))].filter(Boolean).sort(), [creatures]);

    const tableFilters = useMemo(() => ([
        { id: 'type', label: 'Type', options: uniqueTypes },
        { id: 'rarity', label: 'Rarity', options: uniqueRarities },
        { id: 'traits', label: 'Traits', options: uniqueTraits },
        { id: 'group', label: 'Group', options: uniqueGroups },
        { id: 'size', label: 'Size', options: uniqueSizes },
        { id: 'levelRange', label: 'Level', type: 'number-range' },
        { id: 'acRange', label: 'AC', type: 'number-range' },
        { id: 'hpRange', label: 'HP', type: 'number-range' },
        { id: 'speedRange', label: 'Speed', type: 'number-range' },
        { id: 'perceptionRange', label: 'Perception', type: 'number-range' },
        { id: 'fortitudeRange', label: 'Fortitude', type: 'number-range' },
        { id: 'reflexRange', label: 'Reflex', type: 'number-range' },
        { id: 'willRange', label: 'Will', type: 'number-range' },
        { id: 'resistanceRange', label: 'Resistance', type: 'keyed-number-range', options: uniqueDefenseTypes },
        { id: 'weaknessRange', label: 'Weakness', type: 'keyed-number-range', options: uniqueDefenseTypes },
        { id: 'immunities', label: 'Immunities', options: uniqueDefenseTypes },
        { id: 'skillRange', label: 'Skill Bonus', type: 'keyed-number-range', options: uniqueSkills },
        { id: 'hasMelee', label: 'Has Melee', type: 'boolean' },
        { id: 'hasRanged', label: 'Has Ranged', type: 'boolean' },
        { id: 'hasMagic', label: 'Has Magic', type: 'boolean' },
        { id: 'hasShield', label: 'Has Shield', type: 'boolean' },
        { id: 'spellcastingModes', label: 'Spellcasting Mode', options: ['prepared', 'spontaneous', 'innate', 'focus'] },
        { id: 'CatalogStatus', label: 'Catalog Status', options: ['Original', 'Edited', 'Custom', 'Deleted'] },
        { id: 'bestiary', label: 'In Bestiary', type: 'boolean' },
    ]), [uniqueTypes, uniqueRarities, uniqueTraits, uniqueGroups, uniqueSizes, uniqueDefenseTypes, uniqueSkills]);

    // ── Filtering ────────────────────────────────────────────────────────────
    const filteredCreatures = useMemo(() => {
        const q = search.trim().toLowerCase();
        const scopedCreatures = focusScope?.entryIds?.length
            ? allCreatureEntries
                .filter(creature => focusScope.entryIds.includes(creature.id))
                .map(creature => ({ ...creature, instanceCount: focusScope.entryCounts?.[creature.id] || 1 }))
            : creatures;
        return scopedCreatures.filter(c => {
            const { type, rarity, traits, group, size, bestiary, CatalogStatus } = activeFilters;
            if (type?.length && !type.includes(c.type)) return false;
            if (rarity?.length && !rarity.includes(c.rarity)) return false;
            if (traits?.length && !traits.every(t => c.traits?.includes(t))) return false;
            if (group?.length && !group.includes(c.group)) return false;
            if (size?.length && !size.includes(c.size)) return false;
            if (activeFilters.levelRange && !matchesNumberRange(c.level, activeFilters.levelRange)) return false;
            if (activeFilters.acRange && !matchesNumberRange(c.ac, activeFilters.acRange)) return false;
            if (activeFilters.hpRange && !matchesNumberRange(c.hp, activeFilters.hpRange)) return false;
            if (activeFilters.speedRange && !matchesNumberRange(c.speed, activeFilters.speedRange)) return false;
            if (activeFilters.perceptionRange && !matchesNumberRange(c.perception, activeFilters.perceptionRange)) return false;
            if (activeFilters.fortitudeRange && !matchesNumberRange(c.fortitude, activeFilters.fortitudeRange)) return false;
            if (activeFilters.reflexRange && !matchesNumberRange(c.reflex, activeFilters.reflexRange)) return false;
            if (activeFilters.willRange && !matchesNumberRange(c.will, activeFilters.willRange)) return false;
            if (activeFilters.resistanceRange && !matchesKeyedNumberRange(c.resistances, activeFilters.resistanceRange)) return false;
            if (activeFilters.weaknessRange && !matchesKeyedNumberRange(c.weaknesses, activeFilters.weaknessRange)) return false;
            if (activeFilters.skillRange && !matchesKeyedNumberRange(c.skills, activeFilters.skillRange)) return false;
            if (activeFilters.immunities?.length && !activeFilters.immunities.every(typeValue => c.immunities?.some(entry => entry.type === typeValue))) return false;
            for (const flag of ['hasMelee', 'hasRanged', 'hasMagic', 'hasShield']) {
                if (typeof activeFilters[flag] === 'boolean' && Boolean(c[flag]) !== activeFilters[flag]) return false;
            }
            if (activeFilters.spellcastingModes?.length && !activeFilters.spellcastingModes.some(mode => c.spellcastingModes?.includes(mode))) return false;
            if (CatalogStatus?.length) {
                if (!CatalogStatus.includes(c.catalogStatusLabel)) return false;
            } else if (c.isDeleted) {
                return false;
            }
            if (bestiary === true && !c.bestiary) return false;
            if (bestiary === false && c.bestiary) return false;
            return !q || [
                c.name,
                ...(c.traits || []),
                ...(c.skills || []).map(skill => skill.label),
                ...(c.resistances || []).map(entry => entry.type),
                ...(c.weaknesses || []).map(entry => entry.type),
            ].some(value => String(value || '').toLowerCase().includes(q));
        });
    }, [allCreatureEntries, creatures, focusScope, search, activeFilters]);

    // ── Sorting ──────────────────────────────────────────────────────────────
    const sortedCreatures = useMemo(() => {
        const items = [...filteredCreatures];
        items.sort((a, b) => {
            let valA = getCreatureTableSortValue(a, sortConfig.key);
            let valB = getCreatureTableSortValue(b, sortConfig.key);
            if (Array.isArray(valA)) valA = valA.join(', ');
            if (Array.isArray(valB)) valB = valB.join(', ');
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return a.id.localeCompare(b.id);
        });
        return items;
    }, [filteredCreatures, sortConfig]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedCreatures.length / itemsPerPage)), [sortedCreatures.length, itemsPerPage]);
    const currentPage = Math.min(page, totalPages);
    const paginatedCreatures = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedCreatures.slice(start, start + itemsPerPage);
    }, [currentPage, itemsPerPage, sortedCreatures]);

    useEffect(() => { if (page !== currentPage) setPage(currentPage); }, [currentPage, page]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleSort = (key) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const handleHeaderFilter = (column) => {
        const directMap = {
            catalogStatusLabel: 'CatalogStatus',
            level: 'levelRange',
            ac: 'acRange',
            hp: 'hpRange',
            speed: 'speedRange',
            perception: 'perceptionRange',
            fortitude: 'fortitudeRange',
            reflex: 'reflexRange',
            will: 'willRange',
            resistances: 'resistanceRange',
            weaknesses: 'weaknessRange',
        };
        const filterId = column.key.startsWith('skill:') ? 'skillRange' : (directMap[column.key] || column.key);
        if (!tableFilters.some(filter => filter.id === filterId)) return;
        if (column.key.startsWith('skill:')) {
            setActiveFilters(current => ({
                ...current,
                skillRange: { ...(current.skillRange || {}), key: column.key.slice('skill:'.length) },
            }));
        }
        setFocusFilterId(filterId);
        setFilterOpen(true);
    };

    const resolveCreatureForCombatant = (combatant) => allCreatureEntries.find(creature => creature.id === combatant?.creatureId)
        || allCreatureEntries.find(creature => creature.name === combatant?.name)
        || null;

    const loadEffectiveCreatureData = async (creature) => {
        if (!creature) return null;
        if (creature.data) return mergeCreatureDetailIntoEntry(creature.data, creature).data;
        const fetched = await fetchCreatureData(creature.id);
        return fetched ? mergeCreatureDetailIntoEntry(fetched, creature).data : null;
    };

    const addCreatureToEncounter = async (creatureId, encounterId) => {
        if (!activeCampaignId || !encounterId) return;
        const creature = allCreatureEntries.find(entry => entry.id === creatureId);
        if (!creature) return notifyError('Creature not found');
        const data = await loadEffectiveCreatureData(creature);
        if (!data) return notifyError('Failed to load creature data');
        await dataActions.encounter.addCombatant(activeCampaignId, encounterId, 'creature', {
            ...data,
            id: creature.id,
            _catalogId: creature.id,
            name: creature.name,
        });
        setSelectedEncounterId(encounterId);
        notifySuccess(`${creature.name} added to encounter`);
    };

    const readDraggedCreatureId = (event) => event.dataTransfer.getData('application/x-pf2-creature')
        || event.dataTransfer.getData('text/plain');

    const handleCreateEncounter = async () => {
        const name = await prompt({
            title: 'Create encounter',
            message: 'Name the encounter.',
            inputLabel: 'Name',
            initialValue: 'New Encounter',
            confirmLabel: 'Create',
        });
        if (!name?.trim()) return;
        const id = await dataActions.encounter.createEncounter(activeCampaignId, name.trim());
        if (id) {
            setSelectedEncounterId(id);
            setResourceMode('encounters');
        }
    };

    const handleEditEncounter = async (encounter) => {
        const name = await prompt({
            title: 'Edit encounter',
            message: 'Update the encounter name.',
            inputLabel: 'Name',
            initialValue: encounter.name,
            confirmLabel: 'Save',
        });
        if (!name?.trim()) return;
        await dataActions.encounter.updateEncounter(activeCampaignId, encounter.id, current => ({ ...current, name: name.trim() }));
    };

    const handleDeleteEncounter = async (encounter) => {
        const accepted = await confirm({
            title: 'Delete encounter',
            message: `Delete "${encounter.name}"?`,
            confirmLabel: 'Delete',
            danger: true,
        });
        if (!accepted) return;
        await dataActions.encounter.softDeleteEncounter(activeCampaignId, encounter.id);
        if (selectedEncounterId === encounter.id) setSelectedEncounterId(null);
    };

    const showEncounterInMainTable = (encounter) => {
        const counts = (encounter.combatants || [])
            .filter(combatant => combatant.type === 'creature' && combatant.creatureId)
            .reduce((next, combatant) => ({
                ...next,
                [combatant.creatureId]: (next[combatant.creatureId] || 0) + 1,
            }), {});
        setFocusScope({
            type: 'encounter',
            id: encounter.id,
            label: encounter.name,
            entryIds: Object.keys(counts),
            entryCounts: counts,
        });
        setPage(1);
    };

    const handleViewCombatant = async (combatant) => {
        const creature = resolveCreatureForCombatant(combatant);
        if (!creature) return notifyError('Creature catalog entry not found');
        const data = await loadEffectiveCreatureData(creature);
        setPreviewCreature(creature);
        if (data) setLoadedCreatureData(data);
    };

    const handleCustomizeCombatant = async (combatant) => {
        const creature = resolveCreatureForCombatant(combatant);
        if (!creature) return notifyError('Creature catalog entry not found');
        const data = await loadEffectiveCreatureData(creature);
        if (!data) return notifyError('Failed to load creature data');
        const alreadyLinked = Boolean(creature.linkedOnly);
        const forkId = alreadyLinked ? creature.id : `encounter-creature-${combatant.id}`;
        setEditingCreature({
            ...creature,
            id: forkId,
            _id: forkId,
            catalogOverrideId: alreadyLinked ? creature.catalogOverrideId : null,
            sourceFile: alreadyLinked ? creature.sourceFile : null,
            editorMode: alreadyLinked ? 'edit' : 'clone',
            data: { ...deepClone(data), _id: forkId, id: forkId },
            _combatantContext: {
                campaignId: activeCampaignId,
                encounterId: selectedEncounter.id,
                combatantId: combatant.id,
                sourceCreatureId: combatant.sourceCreatureId || combatant.creatureId,
            },
        });
    };

    const saveEncounterCreatureFork = async (override, context) => {
        const payload = {
            ...(override.payload || {}),
            id: override.payload?.id || override.payload?._id,
            _id: override.payload?._id || override.payload?.id,
            linkedOnly: true,
            cleanupCandidateAt: null,
            originMetadata: {
                type: 'encounter_combatant',
                encounterId: context.encounterId,
                combatantId: context.combatantId,
                sourceCreatureId: context.sourceCreatureId,
            },
        };
        const catalogEntryId = await dataActions.catalog.saveCatalogEntry({
            ...override,
            catalogType: 'creature',
            mode: 'custom',
            baseId: context.sourceCreatureId,
            origin: 'fork',
            payload,
        }, { campaignId: context.campaignId });
        await dataActions.encounter.updateCombatant(context.campaignId, context.encounterId, context.combatantId, current => ({
            ...current,
            creatureId: payload.id,
            sourceCreatureId: context.sourceCreatureId,
            catalogEntryId,
            name: payload.name || current.name,
            maxHp: payload.system?.attributes?.hp?.max ?? current.maxHp ?? current.hp?.max ?? current.hp ?? 0,
            currentHp: Math.min(
                current.currentHp ?? current.hp?.current ?? current.hp ?? current.maxHp ?? 0,
                payload.system?.attributes?.hp?.max ?? current.maxHp ?? current.hp?.max ?? current.hp ?? 0
            ),
        }));
    };

    const handleRemoveCombatant = async (combatant) => {
        await dataActions.encounter.removeCombatant(activeCampaignId, selectedEncounter.id, combatant.id);
        const creature = resolveCreatureForCombatant(combatant);
        const rawEntry = creature?.catalogOverrideId
            ? activeCampaign?.catalogEntries?.[creature.catalogOverrideId]
            : null;
        if (rawEntry?.payload?.linkedOnly) {
            await dataActions.catalog.saveCatalogEntry({
                ...rawEntry,
                payload: {
                    ...rawEntry.payload,
                    cleanupCandidateAt: new Date().toISOString(),
                    cleanupReason: 'encounter_combatant_removed',
                },
            }, { campaignId: activeCampaignId });
        }
    };

    const handleRowClick = (creature) => {
        // Single click: open preview (desktop side panel)
        if (!isMobile) setPreviewCreature(creature);
    };

    const handleRowDoubleClick = (creature) => {
        if (isMobile) {
            // Mobile: double tap opens preview
            setPreviewCreature(creature);
        } else {
            // Desktop: double-click opens edit dialog
            handleEdit(creature);
        }
    };

    const handleDelete = async (creature) => {
        const confirmed = await confirm({
            title: 'Delete creature',
            message: creature?.isCustom
                ? `Delete custom creature "${creature.name}"?`
                : `Hide static creature "${creature?.name}" from default catalog lists?`,
            confirmLabel: 'Delete',
            danger: true,
        });
        if (!confirmed) return;
        const id = creature?.id;
        if (creature?.isCustom) {
            runDataAction(Promise.all([
                dataActions.bestiary.deleteCreature(id),
                creature.catalogOverrideId ? dataActions.catalog.deleteCatalogOverride(creature.catalogOverrideId) : Promise.resolve(),
            ]));
        } else {
            runDataAction(dataActions.catalog.saveCatalogOverride(buildHideOverride('creature', creature)));
        }
        setContextMenu(null);
        if (previewCreature?.id === id) setPreviewCreature(null);
    };

    const handleEdit = async (creature) => {
        if (creature.data) {
            setEditingCreature(mergeCreatureDetailIntoEntry(creature.data, { ...creature, editorMode: 'edit' }));
            setContextMenu(null);
            setPreviewCreature(null);
            return;
        }
        if (creature.isCustom) {
            const data = selectCustomCreatures(db)[creature.id]?.data;
            if (!data) {
                notifyError('Custom creature data not found in database');
                setContextMenu(null);
                return;
            }
            setEditingCreature(mergeCreatureDetailIntoEntry(data, { ...creature, editorMode: 'edit' }));
            setContextMenu(null);
            setPreviewCreature(null);
            return;
        }
        const data = await fetchCreatureData(creature.id);
        if (!data) {
            notifyError('Failed to load creature data');
            setContextMenu(null);
            return;
        }
        setEditingCreature(mergeCreatureDetailIntoEntry(data, { ...creature, editorMode: 'edit' }));
        setContextMenu(null);
        setPreviewCreature(null);
    };

    const handleClone = async (creature) => {
        const rawData = creature.data || (creature.isCustom
            ? selectCustomCreatures(db)[creature.id]?.data
            : await fetchCreatureData(creature.id));
        if (!rawData) {
            notifyError('Failed to load creature data');
            setContextMenu(null);
            return;
        }
        // Deep-copy so the clone shares no nested object references with the original
        const data = deepClone(mergeCreatureDetailIntoEntry(rawData, creature).data);
        setEditingCreature({
            ...creature, id: null, _id: null, catalogOverrideId: null, editorMode: 'clone',
            data: { ...data, _id: null, name: (data.name || creature.name) + ' (Copy)' }
        });
        setContextMenu(null);
        setPreviewCreature(null);
    };

    const toggleBestiary = (creature) => {
        const id = creature.id;
        runDataAction(dataActions.bestiary.updateCreatureMetadata(id, existing => {
            const hasMetadata = existing && (
                existing.group ||
                existing.revealState ||
                existing.falseData ||
                typeof existing.bestiary === 'boolean'
            );
            const newEntry = hasMetadata
                ? { ...existing, bestiary: !existing.bestiary }
                : {
                    id,
                    group: creature.group || 'Uncategorized',
                    bestiary: true,
                    revealState: { ...DEFAULT_CREATURE_REVEAL_STATE },
                    falseData: generateFalseData({ hp: 0, fortitude: 0, reflex: 0, will: 0, ac: 10, perception: 0 }, creature.level ?? 0)
                };
            return newEntry;
        }));
    };

    const handleSetGroup = async (creature) => {
        const newGroup = await prompt({
            title: 'Set creature group',
            message: 'Enter group name:',
            inputLabel: 'Group',
            initialValue: creature.group || 'Uncategorized',
            confirmLabel: 'Set group',
        });
        if (newGroup === null) return;
        const id = creature.id;
        runDataAction(dataActions.bestiary.updateCreatureMetadata(id, existing => {
            const hasMetadata = existing && (
                existing.group ||
                existing.revealState ||
                existing.falseData ||
                typeof existing.bestiary === 'boolean'
            );
            const newEntry = hasMetadata
                ? { ...existing, group: newGroup.trim() || 'Uncategorized' }
                : { id, group: newGroup.trim() || 'Uncategorized', bestiary: false, revealState: { ...DEFAULT_CREATURE_REVEAL_STATE } };
            return newEntry;
        }));
        setContextMenu(null);
    };

    const updateRevealState = (id, field, state) => {
        runDataAction(dataActions.bestiary.updateRevealState(id, field, state));
    };

    const [importingCatalog, setImportingCatalog] = useState(false);
    const handleInitMetadataFromCatalog = () => {
        setImportingCatalog(true);
        const catalogCreatures = getAllCreatures();
        const existingIds = new Set(Object.keys(selectBestiaryCreatureMetadata(db)));
        const metadataEntries = catalogCreatures.flatMap(creature => {
            if (existingIds.has(creature.id)) return [];
            const level = creature.data?.system?.details?.level?.value ?? 0;
            return [{
                id: creature.id, group: 'Uncategorized', bestiary: false,
                revealState: { ...DEFAULT_CREATURE_REVEAL_STATE },
                falseData: generateFalseData({ hp: 0, fortitude: 0, reflex: 0, will: 0, ac: 10, perception: 0 }, level)
            }];
        });
        runDataAction(dataActions.bestiary.initializeCreatureMetadata(metadataEntries));
        notifySuccess(`Initialized metadata for ${metadataEntries.length} creatures.`);
        setImportingCatalog(false);
    };

    const tableColumns = useMemo(() => ([
        { key: 'name', label: 'Name' },
        ...(focusScope ? [{ key: 'instanceCount', label: 'Instances' }] : []),
        { key: 'level', label: 'Level' },
        { key: 'type', label: 'Type' },
        { key: 'group', label: 'Group' },
        { key: 'rarity', label: 'Rarity' },
        { key: 'size', label: 'Size' },
        { key: 'ac', label: 'AC' },
        { key: 'hp', label: 'HP' },
        { key: 'speed', label: 'Speed' },
        { key: 'perception', label: 'Perception' },
        { key: 'fortitude', label: 'Fortitude' },
        { key: 'reflex', label: 'Reflex' },
        { key: 'will', label: 'Will' },
        { key: 'resistances', label: 'Resistances' },
        { key: 'weaknesses', label: 'Weaknesses' },
        { key: 'immunities', label: 'Immunities' },
        { key: 'skills', label: 'Skills' },
        ...uniqueSkills.map(skill => ({ key: `skill:${skill}`, label: skill.replace(/[-_]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase()) })),
        { key: 'hasMelee', label: 'Melee' },
        { key: 'hasRanged', label: 'Ranged' },
        { key: 'hasMagic', label: 'Magic' },
        { key: 'hasShield', label: 'Shield' },
        { key: 'spellcastingModes', label: 'Spellcasting' },
        { key: 'traits', label: 'Traits' },
        { key: 'catalogStatusLabel', label: 'Catalog Status' },
        { key: 'bestiary', label: 'Bestiary' },
    ]), [focusScope, uniqueSkills]);
    const visibleTableColumns = useMemo(
        () => tableColumns.filter(column => column.key === 'instanceCount' || visibleColumns.includes(column.key)),
        [tableColumns, visibleColumns]
    );
    const getCreatureRowActions = (creature) => ([
        { id: 'copy-reference', label: 'Copy Reference', onSelect: () => copyCreatureRef(creature) },
        { id: 'set-group', label: 'Set Group', onSelect: () => handleSetGroup(creature) },
        resourceMode === 'encounters' && encounters.length > 0 ? {
            id: 'add-to-encounter',
            label: 'Add to Encounter',
            children: encounters.map(encounter => ({
                id: `add-to-encounter-${encounter.id}`,
                label: encounter.name || 'Unnamed Encounter',
                onSelect: () => addCreatureToEncounter(creature.id, encounter.id).catch(notifyError),
            })),
        } : null,
        creature.isCustom ? {
            id: 'paste-ability',
            label: 'Paste Referenced Ability',
            onSelect: () => pasteAbilityToCreature(creature),
        } : null,
        { id: 'edit', label: 'Edit', onSelect: () => handleEdit(creature) },
        { id: 'clone', label: 'Clone', onSelect: () => handleClone(creature) },
        { id: 'preview', label: 'Preview', onSelect: () => setPreviewCreature(creature) },
        { id: 'delete', label: 'Delete', danger: true, onSelect: () => handleDelete(creature) },
    ].filter(Boolean));

    // ── Render editor ─────────────────────────────────────────────────────────
    if (editingCreature) {
        const combatantContext = editingCreature._combatantContext;
        return (
            <CreatureEditor
                initialCreature={editingCreature}
                catalogType="creature"
                editorMode={editingCreature.editorMode || (editingCreature.sourceFile || editingCreature.catalogOverrideId ? 'edit' : 'create')}
                baseEntry={editingCreature.editorMode === 'create' ? null : editingCreature}
                customAbilities={selectCustomAbilityList(db)}
                spellCatalog={spellCatalog}
                onSave={() => {
                    setEditingCreature(null);
                }}
                onCancel={() => setEditingCreature(null)}
                onSaveToDb={(creatureData) => {
                    return dataActions.bestiary.saveCustomCreature(creatureData);
                }}
                onSaveCatalogEntry={(override) => combatantContext
                    ? saveEncounterCreatureFork(override, combatantContext)
                    : dataActions.catalog.saveCatalogOverride(override)}
            />
        );
    }

    // ── Preview panel content (shared between side panel and BottomSheet) ─────
    const previewContent = previewCreature ? (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Action bar inside preview */}
            <div style={{ display: 'flex', gap: 8, padding: isMobile ? '8px 16px' : '8px 0', borderBottom: '1px solid #333', flexShrink: 0, flexWrap: 'wrap' }}>
                <button
                    className="nav-btn"
                    style={{ background: '#4caf50', color: '#fff' }}
                    onClick={() => handleEdit(previewCreature)}
                >
                    ✏️ Edit
                </button>
                <button
                    className="nav-btn"
                    onClick={() => handleClone(previewCreature)}
                >
                    📋 Clone
                </button>
                <button
                    className="nav-btn"
                    onClick={() => copyCreatureRef(previewCreature)}
                >
                    📎 Copy Ref
                </button>
                <button
                    className="nav-btn"
                    disabled={!activeCampaignId}
                    onClick={() => Promise.resolve(dataActions.lore.notifyBestiaryReveal(activeCampaignId, {
                        id: previewCreature.id,
                        name: previewCreature.name,
                    })).then(() => notifySuccess('Party notified about this Bestiary update')).catch(notifyError)}
                >
                    Notify party
                </button>
                <button
                    className="nav-btn"
                    style={{ color: '#e57373' }}
                    onClick={() => handleDelete(previewCreature)}
                >
                    🗑️ Delete
                </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '8px 16px' : 0 }}>
                {loadedCreatureData ? (
                    <CreatureCard
                        creature={{ ...previewCreature, data: loadedCreatureData }}
                        isGM={true}
                        revealState={previewCreature.revealState}
                        falseData={previewCreature.falseData}
                        onRevealChange={(field, state) => updateRevealState(previewCreature.id, field, state)}
                        onAbilityClick={(ability) => setSelectedAbility(ability)}
                        onSkillClick={(skill) => setSelectedSkill(skill)}
                        onSpellClick={(spell) => setSelectedSpell({ ...spell, _entityType: 'spell' })}
                    />
                ) : (
                    <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Loading creature data...</div>
                )}
                {loreBacklinks.length > 0 && (
                    <section style={{ margin: '14px 0', padding: 12, borderTop: '1px solid #4c4136' }}>
                        <h3 style={{ margin: '0 0 8px', color: 'var(--text-gold)' }}>Referenced by Knowledge</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {loreBacklinks.map((article) => <span key={article.id} style={{ border: '1px solid #514a40', padding: '4px 8px', borderRadius: 4 }}>{article.title}</span>)}
                        </div>
                    </section>
                )}
            </div>
        </div>
    ) : null;

    const mainTableContent = (
        <div className="flex h-full min-h-0 flex-col overflow-hidden p-2">
            <AdminTableSurface
                columns={visibleTableColumns}
                rows={paginatedCreatures}
                tableTestId="gm-bestiary-creatures-table"
                getRowKey={(creature) => creature.id}
                getRowTestId={(creature) => `gm-creature-row-${creature.id}`}
                sortConfig={sortConfig}
                onSort={handleSort}
                onHeaderFilter={handleHeaderFilter}
                isRowSelected={(creature) => previewCreature?.id === creature.id}
                onRowClick={(_event, creature) => handleRowClick(creature)}
                onRowDoubleClick={(_event, creature) => handleRowDoubleClick(creature)}
                getRowActions={getCreatureRowActions}
                getRowProps={(creature) => ({
                    draggable: resourceMode === 'encounters',
                    onDragStart: (event) => {
                        event.dataTransfer.effectAllowed = 'copy';
                        event.dataTransfer.setData('application/x-pf2-creature', creature.id);
                        event.dataTransfer.setData('text/plain', creature.id);
                    },
                })}
                renderCell={({ row, column }) => renderCreatureTableCell(row, column, toggleBestiary)}
                emptyLabel="No creatures found."
            />
            <AdminPagination
                page={currentPage}
                totalPages={totalPages}
                total={sortedCreatures.length}
                pageSize={itemsPerPage}
                pageSizeOptions={[25, 50, 100]}
                label="creatures"
                onPageChange={setPage}
                onPageSizeChange={(nextSize) => { setItemsPerPage(nextSize); setPage(1); }}
            />
        </div>
    );

    const encounterUpperContent = (
        <AdminSubtable
            title="Encounters"
            tableTestId="gm-bestiary-encounters-table"
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'isActive', label: 'Active' },
                { key: 'roundNumber', label: 'Round' },
                { key: 'creatureCount', label: 'Creatures' },
                { key: 'playerCount', label: 'Players' },
            ]}
            rows={encounterRows}
            getRowKey={encounter => encounter.id}
            getRowTestId={encounter => `gm-encounter-row-${encounter.id}`}
            actionTestIdPrefix="gm-encounter-action"
            isRowSelected={encounter => encounter.id === selectedEncounter?.id}
            onRowClick={(_event, encounter) => setSelectedEncounterId(encounter.id)}
            getRowProps={(encounter) => ({
                onDragOver: event => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'copy';
                },
                onDrop: event => {
                    event.preventDefault();
                    const creatureId = readDraggedCreatureId(event);
                    if (creatureId) addCreatureToEncounter(creatureId, encounter.id).catch(notifyError);
                },
            })}
            renderCell={({ row, column }) => {
                if (column.key === 'isActive') {
                    return (
                        <input
                            type="checkbox"
                            checked={row.isActive}
                            onClick={event => event.stopPropagation()}
                            onChange={event => {
                                const action = event.target.checked
                                    ? dataActions.encounter.activateEncounter(activeCampaignId, row.id)
                                    : dataActions.encounter.updateEncounter(activeCampaignId, row.id, current => ({ ...current, isActive: false }));
                                Promise.resolve(action).catch(notifyError);
                            }}
                        />
                    );
                }
                return row[column.key] ?? '-';
            }}
            getRowActions={encounter => [
                { id: 'delete', label: 'Delete', danger: true, onSelect: () => handleDeleteEncounter(encounter) },
                { id: 'edit', label: 'Edit', onSelect: () => handleEditEncounter(encounter) },
                { id: 'show-main', label: 'Show in Main table', onSelect: () => showEncounterInMainTable(encounter) },
            ]}
            actions={<Button type="button" size="sm" onClick={handleCreateEncounter}>+ Encounter</Button>}
            searchPlaceholder="Search encounters..."
            emptyLabel="No encounters."
        />
    );

    const encounterLowerContent = (
        <AdminSubtable
            title={selectedEncounter ? `${selectedEncounter.name} creatures` : 'Encounter creatures'}
            tableTestId="gm-bestiary-encounter-creatures-table"
            columns={[
                { key: 'displayName', label: 'Creature' },
                { key: 'level', label: 'Level' },
                { key: 'hpDisplay', label: 'HP' },
                { key: 'initiative', label: 'Initiative' },
                { key: 'visible', label: 'Visible' },
                { key: 'defeated', label: 'Defeated' },
            ]}
            rows={encounterCombatantRows}
            getRowKey={combatant => combatant.id}
            getRowTestId={combatant => `gm-encounter-combatant-row-${combatant.id}`}
            actionTestIdPrefix="gm-encounter-combatant-action"
            searchFields={['displayName', 'level', 'hpDisplay']}
            renderCell={({ row, column }) => {
                if (column.key === 'visible') {
                    return (
                        <input
                            type="checkbox"
                            checked={row.visible !== false}
                            onClick={event => event.stopPropagation()}
                            onChange={event => Promise.resolve(dataActions.encounter.updateCombatant(
                                activeCampaignId,
                                selectedEncounter.id,
                                row.id,
                                current => ({ ...current, visible: event.target.checked })
                            )).catch(notifyError)}
                        />
                    );
                }
                if (column.key === 'defeated') return row.defeated ? '✓' : '';
                return row[column.key] ?? '-';
            }}
            onRowDoubleClick={(_event, combatant) => handleViewCombatant(combatant)}
            getRowActions={combatant => [
                { id: 'view-detail', label: 'View Detail', onSelect: () => handleViewCombatant(combatant) },
                { id: 'customize', label: 'Customize', onSelect: () => handleCustomizeCombatant(combatant) },
                { id: 'remove', label: 'Remove', danger: true, onSelect: () => handleRemoveCombatant(combatant) },
            ]}
            onDragOver={event => {
                if (!selectedEncounter) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={event => {
                if (!selectedEncounter) return;
                event.preventDefault();
                const creatureId = readDraggedCreatureId(event);
                if (creatureId) addCreatureToEncounter(creatureId, selectedEncounter.id).catch(notifyError);
            }}
            searchPlaceholder="Search combatants..."
            emptyLabel={selectedEncounter ? 'Drop creatures here.' : 'Select an encounter.'}
        />
    );

    // ── Render list view ──────────────────────────────────────────────────────
    return (
        <div className="admin-layout" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <AdminTableToolbar
                search={search}
                onSearchChange={(value) => { setSearch(value); setPage(1); }}
                searchPlaceholder="Search creatures..."
                filters={tableFilters}
                filterValues={activeFilters}
                onFilterValuesChange={(values) => { setActiveFilters(values); setPage(1); }}
                filterOpen={filterOpen}
                onFilterOpenChange={setFilterOpen}
                focusFilterId={focusFilterId}
                columns={tableColumns}
                visibleColumns={visibleColumns}
                onVisibleColumnsChange={setVisibleColumns}
                resultMeta={`${sortedCreatures.length} creatures`}
                leftControls={(
                    <div className="flex rounded-md border border-border/70 p-0.5">
                        <Button data-testid="gm-bestiary-mode-creatures" type="button" size="sm" variant={resourceMode === 'creatures' ? 'default' : 'ghost'} onClick={() => setResourceMode('creatures')}>Creatures</Button>
                        <Button data-testid="gm-bestiary-mode-encounters" type="button" size="sm" variant={resourceMode === 'encounters' ? 'default' : 'ghost'} onClick={() => setResourceMode('encounters')}>Encounters</Button>
                    </div>
                )}
                secondaryActions={(
                    <>
                        {focusScope ? (
                            <Button type="button" variant="secondary" size="sm" onClick={() => { setFocusScope(null); setPage(1); }}>{focusScope.label} ×</Button>
                        ) : null}
                        {isMobile && resourceMode === 'encounters' ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => setMobileWorkspaceOpen(true)}>Encounter lists</Button>
                        ) : null}
                    </>
                )}
                primaryActions={(
                    <>
                        <Button
                            type="button"
                            onClick={() => setEditingCreature({ type: 'npc', data: {}, bestiary: false, revealState: { ...DEFAULT_CREATURE_REVEAL_STATE }, editorMode: 'create' })}
                        >
                            + New
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleInitMetadataFromCatalog}
                            disabled={importingCatalog}
                            title="Initialize metadata from catalog"
                        >
                            Import Metadata
                        </Button>
                    </>
                )}
            />

            {/* ── Table + Side panel ── */}
            {resourceMode === 'encounters' ? (
                <AdminResourceWorkspace
                    storageKey="gm-creature-encounter-workspace"
                    main={mainTableContent}
                    upper={encounterUpperContent}
                    lower={encounterLowerContent}
                    isMobile={isMobile}
                    mobileMode={mobileWorkspaceMode}
                    onMobileModeChange={setMobileWorkspaceMode}
                    mobileOpen={mobileWorkspaceOpen}
                    onMobileOpenChange={setMobileWorkspaceOpen}
                    upperLabel="Encounters"
                    lowerLabel="Creatures"
                />
            ) : (
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', minWidth: 0, flexDirection: 'column', overflow: 'hidden', padding: 10 }}>
                    <AdminTableSurface
                        columns={visibleTableColumns}
                        rows={paginatedCreatures}
                        getRowKey={(creature) => creature.id}
                        getRowTestId={(creature) => `gm-creature-row-${creature.id}`}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        onHeaderFilter={(column) => {
                            const filterId = column.key === 'catalogStatusLabel' ? 'CatalogStatus' : column.key;
                            if (tableFilters.some(filter => filter.id === filterId)) {
                                setFocusFilterId(filterId);
                                setFilterOpen(true);
                            }
                        }}
                        isRowSelected={(creature) => previewCreature?.id === creature.id}
                        onRowClick={(_event, creature) => handleRowClick(creature)}
                        onRowDoubleClick={(_event, creature) => handleRowDoubleClick(creature)}
                        getRowActions={getCreatureRowActions}
                        renderCell={({ row, column }) => renderCreatureTableCell(row, column, toggleBestiary)}
                        emptyLabel="No creatures found."
                    />
                    <AdminPagination
                        page={currentPage}
                        totalPages={totalPages}
                        total={sortedCreatures.length}
                        pageSize={itemsPerPage}
                        pageSizeOptions={[25, 50, 100]}
                        label="creatures"
                        onPageChange={setPage}
                        onPageSizeChange={(nextSize) => { setItemsPerPage(nextSize); setPage(1); }}
                    />
                </div>

                {/* ── Desktop side preview panel ── */}
                {!isMobile && previewCreature && (
                    <div style={{ width: 520, borderLeft: '1px solid #444', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <h4 style={{ margin: 0, color: '#aaa' }}>Preview</h4>
                            <button onClick={() => setPreviewCreature(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>✕</button>
                        </div>
                        {previewContent}
                    </div>
                )}
            </div>

            )}

            {/* ── Mobile preview BottomSheet ── */}
            {isMobile && (
                <BottomSheet
                    isOpen={!!previewCreature}
                    onClose={() => setPreviewCreature(null)}
                    title={previewCreature?.name || 'Preview'}
                    height="85vh"
                >
                    {previewContent}
                </BottomSheet>
            )}

            {!isMobile && resourceMode === 'encounters' && (
                <AppDialogShell
                    open={Boolean(previewCreature)}
                    onOpenChange={(open) => { if (!open) setPreviewCreature(null); }}
                    layerId={`encounter-creature-detail-${previewCreature?.id || 'closed'}`}
                    title={previewCreature?.name || 'Creature details'}
                    description="Encounter creature details"
                    size="viewport"
                    bodyClassName="overflow-hidden p-0"
                >
                    {previewContent}
                </AppDialogShell>
            )}

            {/* Ability Modal */}
            {selectedAbility && (
                <CreatureAbilityModal
                    ability={selectedAbility}
                    onClose={() => setSelectedAbility(null)}
                    onContentLinkClick={onContentLinkClick}
                />
            )}

            {selectedSkill && (
                <CreatureSkillDetailDialog
                    skill={selectedSkill}
                    onClose={() => setSelectedSkill(null)}
                />
            )}

            <CatalogDetailDialog
                open={Boolean(selectedSpell)}
                onOpenChange={(open) => { if (!open) setSelectedSpell(null); }}
                entry={selectedSpell}
                catalogType="spell"
                onContentLinkClick={onContentLinkClick}
            />

            {/* Toast */}
            {toast && (
                <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#2b2b2e', border: '1px solid #c9a86c', color: '#f5deb3', padding: '8px 20px', borderRadius: 6, zIndex: 4000, fontSize: '0.9em', pointerEvents: 'none' }}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}

function renderCreatureTableCell(creature, column, toggleBestiary) {
    if (column.key === 'bestiary') {
        return (
            <input
                type="checkbox"
                checked={creature.bestiary || false}
                onChange={() => toggleBestiary(creature)}
                onClick={event => event.stopPropagation()}
            />
        );
    }
    if (column.key === 'traits') {
        const traits = creature.traits || [];
        return <span className="text-muted-foreground">{traits.slice(0, 3).join(', ')}{traits.length > 3 ? '...' : ''}</span>;
    }
    if (column.key === 'resistances' || column.key === 'weaknesses' || column.key === 'immunities') {
        return <span className="text-muted-foreground">{formatTypedCreatureValues(creature[column.key]) || '-'}</span>;
    }
    if (column.key === 'skills') {
        const skills = creature.skills || [];
        return (
            <span className="text-muted-foreground">
                {skills.slice(0, 3).map(skill => `${skill.label} ${skill.bonus >= 0 ? '+' : ''}${skill.bonus}`).join(', ') || '-'}
                {skills.length > 3 ? '…' : ''}
            </span>
        );
    }
    if (column.key.startsWith('skill:')) {
        const bonus = getCreatureSkillBonus(creature, column.key.slice('skill:'.length));
        return bonus == null ? '-' : `${bonus >= 0 ? '+' : ''}${bonus}`;
    }
    if (['hasMelee', 'hasRanged', 'hasMagic', 'hasShield'].includes(column.key)) {
        return creature[column.key] ? '✓' : '';
    }
    if (column.key === 'spellcastingModes') {
        return (creature.spellcastingModes || []).join(', ') || '-';
    }
    if (column.key === 'catalogStatusLabel') {
        return <span className="text-muted-foreground">{creature.catalogStatusLabel || 'Original'}</span>;
    }
    return creature[column.key] ?? '-';
}

function getCreatureTableSortValue(creature, key) {
    if (key.startsWith('skill:')) {
        return getCreatureSkillBonus(creature, key.slice('skill:'.length)) ?? Number.NEGATIVE_INFINITY;
    }
    if (key === 'skills') return creature.highestSkillBonus ?? Number.NEGATIVE_INFINITY;
    if (['resistances', 'weaknesses', 'immunities'].includes(key)) {
        return formatTypedCreatureValues(creature[key]);
    }
    if (key === 'spellcastingModes') return (creature.spellcastingModes || []).join(', ');
    return creature[key] ?? '';
}
