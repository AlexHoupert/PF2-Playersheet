import { useMemo } from 'react';
import ActionEditor from './editors/ActionEditor';
import CatalogAdminTableView from './catalog/CatalogAdminTableView';
import { ACTION_INDEX_FILTER_OPTIONS, fetchActionDetailBySourceFile, getAllActionIndexItems } from '../shared/catalog/actionIndex';

const COLUMNS = Object.freeze([
    { key: 'name', label: 'Name' },
    { key: 'typeCode', label: 'Cost' },
    { key: 'userType', label: 'Type' },
    { key: 'userSubtype', label: 'Subtype' },
    { key: 'feat', label: 'Feat Prereq' },
    { key: 'catalogEntryStatus', label: 'Status' },
]);

const FILTERS = Object.freeze([
    { id: 'userType', label: 'Type', field: 'userType', options: ACTION_INDEX_FILTER_OPTIONS.types },
    { id: 'userSubtype', label: 'Subtype', field: 'userSubtype', options: ACTION_INDEX_FILTER_OPTIONS.subtypes },
    { id: 'typeCode', label: 'Cost', field: 'typeCode', options: ['1', '2', '3', 'R', 'F', 'P'] },
]);

export default function ActionsView() {
    const staticActions = useMemo(() => getAllActionIndexItems(), []);
    return (
        <CatalogAdminTableView
            catalogType="action"
            entityType="action"
            title="Action"
            staticItems={staticActions}
            columns={COLUMNS}
            defaultColumns={['name', 'typeCode', 'userType', 'userSubtype', 'feat']}
            filters={FILTERS}
            EditorComponent={ActionEditor}
            fetchDetailBySourceFile={fetchActionDetailBySourceFile}
            searchPlaceholder="Search Actions..."
            newLabel="+ New Action"
        />
    );
}
