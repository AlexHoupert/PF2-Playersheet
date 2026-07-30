function normalizeIdentityValue(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

export function getCatalogRecordIdentity(record) {
    if (!record || typeof record !== 'object') return {};
    return {
        catalogEntryId: normalizeIdentityValue(record.catalogEntryId),
        catalogOverrideId: normalizeIdentityValue(record.catalogOverrideId),
        baseId: normalizeIdentityValue(record.baseId || record.catalogRef?.baseId),
        sourceFile: normalizeIdentityValue(
            record.sourceFile
            || record._sourceFile
            || record.catalogRef?.sourceFile
        ),
    };
}

export function catalogRecordsShareExplicitIdentity(left, right) {
    const leftIdentity = getCatalogRecordIdentity(left);
    const rightIdentity = getCatalogRecordIdentity(right);
    return ['catalogEntryId', 'catalogOverrideId', 'baseId', 'sourceFile'].some(key => (
        leftIdentity[key]
        && rightIdentity[key]
        && leftIdentity[key] === rightIdentity[key]
    ));
}

export function findLinkedCatalogRecordIndex(records = [], source = null) {
    if (!Array.isArray(records) || !source) return -1;

    const requestedIndex = Number(source?._actorRecordIndex);
    if (Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < records.length) {
        const requestedRecord = records[requestedIndex];
        const requestedName = normalizeIdentityValue(
            typeof requestedRecord === 'string' ? requestedRecord : requestedRecord?.name
        );
        const sourceName = normalizeIdentityValue(source?.name || (typeof source === 'string' ? source : ''));
        const requestedLevel = normalizeIdentityValue(requestedRecord?.level ?? requestedRecord?.rank);
        const sourceLevel = normalizeIdentityValue(source?.level ?? source?.rank);
        if (
            requestedRecord === source
            || catalogRecordsShareExplicitIdentity(requestedRecord, source)
            || (requestedName === sourceName && (!sourceLevel || !requestedLevel || requestedLevel === sourceLevel))
        ) {
            return requestedIndex;
        }
    }

    const referenceIndex = records.indexOf(source);
    if (referenceIndex >= 0) return referenceIndex;

    const explicitIdentityIndex = records.findIndex(record => (
        catalogRecordsShareExplicitIdentity(record, source)
    ));
    if (explicitIdentityIndex >= 0) return explicitIdentityIndex;

    const sourceName = normalizeIdentityValue(source?.name || (typeof source === 'string' ? source : ''));
    if (!sourceName) return -1;
    const sourceLevel = normalizeIdentityValue(source?.level ?? source?.rank);
    return records.findIndex(record => {
        const recordName = normalizeIdentityValue(
            typeof record === 'string' ? record : record?.name
        );
        if (recordName !== sourceName) return false;
        if (!sourceLevel || typeof record !== 'object') return true;
        const recordLevel = normalizeIdentityValue(record?.level ?? record?.rank);
        return !recordLevel || recordLevel === sourceLevel;
    });
}
