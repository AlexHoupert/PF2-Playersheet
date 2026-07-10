export const CONDITION_ICONS = {
    Blinded: '👁️‍🗨️',
    Clumsy: '🤸',
    Concealed: '🌫️',
    Confused: '😵',
    Controlled: '🎮',
    Dazzled: '✨',
    Deafened: '🙉',
    Doomed: '💀',
    Drained: '🩸',
    Dying: '☠️',
    Encumbered: '🎒',
    Enfeebled: '💪',
    Fascinated: '🤩',
    Fatigued: '😫',
    Fleeing: '🏃',
    Frightened: '😱',
    Grabbed: '✊',
    Hidden: '👻',
    Immobilized: '🕸️',
    Invisible: '🫥',
    Observed: '👀',
    'Off-Guard': '🛡️',
    Paralyzed: '🥶',
    Petrified: '🗿',
    Prone: '🛌',
    Quickened: '⚡',
    Restrained: '⛓️',
    Sickened: '🤢',
    Slowed: '🐌',
    Stunned: '💫',
    Stupefied: '🥴',
    Unconscious: '💤',
    Undetected: '🕵️',
    Unnoticed: '🥷',
    Wounded: '🩹',
    Blessed: '🙏',
};

export const BINARY_CONDS = [
    'Blinded',
    'Clumsy',
    'Concealed',
    'Confused',
    'Controlled',
    'Dazzled',
    'Deafened',
    'Encumbered',
    'Fascinated',
    'Fleeing',
    'Grabbed',
    'Hidden',
    'Immobilized',
    'Invisible',
    'Observed',
    'Off-Guard',
    'Paralyzed',
    'Petrified',
    'Prone',
    'Quickened',
    'Restrained',
    'Stunned',
    'Unconscious',
    'Undetected',
    'Unnoticed'
].map(s => s.toLowerCase());

export const NEG_CONDS = [
    'blinded',
    'clumsy',
    'confused',
    'controlled',
    'dazzled',
    'deafened',
    'doomed',
    'drained',
    'dying',
    'encumbered',
    'enfeebled',
    'fascinated',
    'fatigued',
    'fleeing',
    'frightened',
    'grabbed',
    'immobilized',
    'off-guard',
    'paralyzed',
    'petrified',
    'prone',
    'restrained',
    'sickened',
    'slowed',
    'stunned',
    'stupefied',
    'unconscious',
    'wounded'
];

export const POS_CONDS = ['quickened', 'blessed'];

export const VIS_CONDS = ['concealed', 'hidden', 'invisible', 'observed', 'undetected', 'unnoticed'];

const CONDITION_ICON_BY_LOWER = new Map(
    Object.entries(CONDITION_ICONS).map(([name, icon]) => [name.toLowerCase(), icon])
);

export function getConditionIcon(conditionName) {
    if (!conditionName) return undefined;
    return CONDITION_ICONS[conditionName] || CONDITION_ICON_BY_LOWER.get(String(conditionName).toLowerCase());
}
