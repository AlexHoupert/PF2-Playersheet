import FeatEditor from './editors/FeatEditor';
import CatalogAdminTableView from './catalog/CatalogAdminTableView';
import { FEAT_INDEX_FILTER_OPTIONS, FEAT_INDEX_ITEMS, fetchFeatDetailBySourceFile } from '../shared/catalog/featIndex';

const COLUMNS = Object.freeze([
    { key: 'name', label: 'Name' },
    { key: 'level', label: 'Level' },
    { key: 'rarity', label: 'Rarity' },
    { key: 'traits', label: 'Traits' },
    { key: 'category', label: 'Category' },
]);

const FILTERS = Object.freeze([
    { id: 'rarity', label: 'Rarity', field: 'rarity', options: FEAT_INDEX_FILTER_OPTIONS.rarities },
    { id: 'category', label: 'Category', field: 'category', options: FEAT_INDEX_FILTER_OPTIONS.categories },
    { id: 'traits', label: 'Traits', field: 'traits', options: FEAT_INDEX_FILTER_OPTIONS.traits, matchAll: true },
]);

export default function FeatsView() {
    return (
        <CatalogAdminTableView
            catalogType="feat"
            entityType="feat"
            title="Feat"
            staticItems={FEAT_INDEX_ITEMS}
            columns={COLUMNS}
            defaultColumns={['name', 'level', 'rarity', 'category']}
            filters={FILTERS}
            EditorComponent={FeatEditor}
            fetchDetailBySourceFile={fetchFeatDetailBySourceFile}
            searchPlaceholder="Search Feats..."
            newLabel="+ New Feat"
        />
    );
}
