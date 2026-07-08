export function isFilterValueActive(value, defaultValue) {
    if (Array.isArray(value)) {
        return !arraysEqual(normalizeArray(value), normalizeArray(defaultValue || []));
    }
    if (typeof value === 'boolean') return value !== defaultValue;
    const text = String(value ?? '').trim();
    const defaultText = String(defaultValue ?? '').trim();
    return text !== defaultText && text.length > 0;
}

export function countActiveFilters(filters = [], values = {}) {
    return filters.filter((filter) => isFilterValueActive(values[filter.id], filter.defaultValue)).length;
}

export function buildActiveFilterChips(filters = [], values = {}, onRemove) {
    return filters
        .filter((filter) => isFilterValueActive(values[filter.id], filter.defaultValue))
        .map((filter) => ({
            key: filter.id,
            label: `${filter.label}: ${formatFilterValue(filter, values[filter.id])}`,
            onRemove: () => onRemove(filter.id),
        }));
}

export function removeFilterValue(filters = [], values = {}, filterId) {
    const filter = filters.find((item) => item.id === filterId);
    const next = { ...values };
    if (filter && filter.defaultValue !== undefined) {
        next[filterId] = cloneFilterValue(filter.defaultValue);
    } else {
        delete next[filterId];
    }
    return next;
}

export function resetFilterValues(filters = []) {
    return Object.fromEntries(
        filters
            .filter((filter) => filter.defaultValue !== undefined)
            .map((filter) => [filter.id, cloneFilterValue(filter.defaultValue)])
    );
}

export function normalizeFilterValues(filters = [], values = {}) {
    return filters.reduce((next, filter) => {
        const current = values[filter.id];
        if (current !== undefined) next[filter.id] = cloneFilterValue(current);
        else if (filter.defaultValue !== undefined) next[filter.id] = cloneFilterValue(filter.defaultValue);
        return next;
    }, {});
}

export function formatFilterValue(filter, value) {
    if (filter.valueLabel) return filter.valueLabel(value);
    if (Array.isArray(value)) {
        if (!value.length) return 'None';
        return value.map((item) => optionLabel(filter, item)).join(', ');
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value ?? '');
}

export function optionLabel(filter, value) {
    const option = (filter.options || []).find((item) => optionValue(item) === value);
    return option?.label ?? String(value);
}

export function optionValue(option) {
    return option && typeof option === 'object' ? option.value : option;
}

export function cloneFilterValue(value) {
    if (Array.isArray(value)) return [...value];
    if (value && typeof value === 'object') return { ...value };
    return value;
}

function normalizeArray(value) {
    return [...(Array.isArray(value) ? value : [])].map(String).sort();
}

function arraysEqual(left, right) {
    const a = normalizeArray(left);
    const b = normalizeArray(right);
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
}
