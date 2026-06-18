import { getProgress } from '../domain/progressReducers.js';

export function selectProgress(campaign, options = {}) {
    return getProgress(campaign || {}, options);
}
