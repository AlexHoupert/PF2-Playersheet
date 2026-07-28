export function filterAndSortSubtableRows(rows, columns, search, sortConfig, searchFields) {
    const term = String(search || '').trim().toLowerCase();
    const fields = searchFields?.length ? searchFields : columns.map((column) => column.key);
    const filtered = term
        ? rows.filter((row) => fields.some((field) => searchableValue(row?.[field]).includes(term)))
        : [...rows];
    const column = columns.find((item) => item.key === sortConfig?.key);
    if (!column || column.sortable === false) return filtered;
    const direction = sortConfig.direction === 'desc' ? -1 : 1;
    return filtered.sort((left, right) => compareValues(
        column.sortValue ? column.sortValue(left) : left?.[column.key],
        column.sortValue ? column.sortValue(right) : right?.[column.key]
    ) * direction);
}

function searchableValue(value) {
    if (Array.isArray(value)) return value.join(' ').toLowerCase();
    if (value && typeof value === 'object') return Object.values(value).join(' ').toLowerCase();
    return String(value ?? '').toLowerCase();
}

function compareValues(left, right) {
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    return String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}
