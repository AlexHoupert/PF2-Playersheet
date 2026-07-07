import React from 'react';
import CatalogAdminTableView from './catalog/CatalogAdminTableView';
import { IMPULSE_INDEX_FILTER_OPTIONS, IMPULSE_INDEX_ITEMS, fetchImpulseDetailBySourceFile } from '../shared/catalog/impulseIndex';

const ImpulseEditor = React.lazy(() => import('./editors/ImpulseEditor'));

const COLUMNS = Object.freeze([
    { key: 'name', label: 'Name' },
    { key: 'level', label: 'Level' },
    { key: 'type', label: 'Type' },
    { key: 'traditions', label: 'Traditions' },
    { key: 'school', label: 'School/Element' },
    { key: 'rarity', label: 'Rarity' },
    { key: 'traits', label: 'Traits' },
]);

const FILTERS = Object.freeze([
    { id: 'rarity', label: 'Rarity', field: 'rarity', options: IMPULSE_INDEX_FILTER_OPTIONS.rarities },
    { id: 'traits', label: 'Traits', field: 'traits', options: IMPULSE_INDEX_FILTER_OPTIONS.traits, matchAll: true },
    { id: 'school', label: 'School/Element', field: 'school', options: IMPULSE_INDEX_FILTER_OPTIONS.schools },
]);

export default function ImpulsesView() {
    return (
        <CatalogAdminTableView
            catalogType="impulse"
            entityType="impulse"
            title="Impulse"
            staticItems={IMPULSE_INDEX_ITEMS}
            columns={COLUMNS}
            defaultColumns={['name', 'level', 'traits', 'rarity']}
            filters={FILTERS}
            EditorComponent={ImpulseEditor}
            fetchDetailBySourceFile={fetchImpulseDetailBySourceFile}
            searchPlaceholder="Search Impulses..."
            newLabel="+ New Impulse"
        />
    );
}
