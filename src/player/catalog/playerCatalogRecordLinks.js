import { findLinkedCatalogRecordIndex } from '../../shared/catalog/catalogRecordIdentity.js';

function recordsForCatalogType(character, catalogType) {
    if (catalogType === 'spell') return character.magic?.list || [];
    if (catalogType === 'feat') return character.feats || [];
    if (catalogType === 'impulse') return character.impulses || [];
    if (catalogType === 'action') return character.actions || [];
    return null;
}

function writeRecordsForCatalogType(character, catalogType, records) {
    if (catalogType === 'spell') {
        character.magic = { ...(character.magic || {}), list: records };
    } else if (catalogType === 'feat') {
        character.feats = records;
    } else if (catalogType === 'impulse') {
        character.impulses = records;
    } else if (catalogType === 'action') {
        character.actions = records;
    }
}

export function replaceLinkedCatalogRecord(character, catalogType, source, payload, entryId) {
    const records = recordsForCatalogType(character, catalogType);
    if (!records) return character;

    const recordIndex = findLinkedCatalogRecordIndex(records, source);
    if (recordIndex < 0) return character;

    const record = records[recordIndex];
    const recordName = typeof record === 'string' ? record : record?.name;
    const { _actorRecordIndex: ignoredActorRecordIndex, ...persistedPayload } = payload || {};
    void ignoredActorRecordIndex;

    const nextRecords = [...records];
    nextRecords[recordIndex] = {
        ...(typeof record === 'object' ? record : { name: recordName }),
        ...persistedPayload,
        name: persistedPayload.name || recordName,
        catalogEntryId: entryId,
        catalogOverrideId: entryId,
        isCustom: true,
    };
    writeRecordsForCatalogType(character, catalogType, nextRecords);
    return character;
}
