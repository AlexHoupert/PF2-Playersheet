/**
 * Default camping activities for the Kingmaker-inspired camping system.
 * GMs can override or extend these via the admin panel (stored in activeCampaign.camping.activities).
 * dcType: 'zone' | 'foraging' | 'encounter' | 'custom'
 */
export const DEFAULT_CAMPING_ACTIVITIES = [
    {
        id: 'prepare_campsite',
        name: 'Prepare Campsite',
        skills: ['Survival'],
        requirements: null,
        dcType: 'zone',
        customDC: null,
        effectCrit: '',
        effectSuccess: '',
        effectFail: '',
        effectCritFail: '',
        description: ''
    },
    {
        id: 'camp_management',
        name: 'Camp Management',
        skills: ['Survival', 'Society'],
        requirements: 'Expert in Survival or Society',
        dcType: 'zone',
        customDC: null,
        effectCrit: '',
        effectSuccess: '',
        effectFail: '',
        effectCritFail: '',
        description: ''
    },
    {
        id: 'provide_aid',
        name: 'Provide Aid',
        skills: ['Various'],
        requirements: null,
        dcType: 'zone',
        customDC: null,
        effectCrit: '',
        effectSuccess: '',
        effectFail: '',
        effectCritFail: '',
        description: ''
    },
    {
        id: 'camouflage_campsite',
        name: 'Camouflage Campsite',
        skills: ['Stealth'],
        requirements: 'Trained in Stealth',
        dcType: 'zone',
        customDC: null,
        effectCrit: '',
        effectSuccess: '',
        effectFail: '',
        effectCritFail: '',
        description: ''
    },
    {
        id: 'organize_watch',
        name: 'Organize Watch',
        skills: ['Perception'],
        requirements: null,
        dcType: 'zone',
        customDC: null,
        effectCrit: '',
        effectSuccess: '',
        effectFail: '',
        effectCritFail: '',
        description: ''
    },
    {
        id: 'cook_basic_meal',
        name: 'Cook Basic Meal',
        skills: ['Survival', 'Cooking Lore'],
        requirements: null,
        dcType: 'zone',
        customDC: null,
        effectCrit: '',
        effectSuccess: '',
        effectFail: '',
        effectCritFail: '',
        description: ''
    },
    {
        id: 'cook_special_meal',
        name: 'Cook Special Meal',
        skills: ['Survival', 'Cooking Lore'],
        requirements: 'Trained in Survival or Cooking Lore',
        dcType: 'zone',
        customDC: null,
        effectCrit: '',
        effectSuccess: '',
        effectFail: '',
        effectCritFail: '',
        description: ''
    },
    {
        id: 'discover_special_meal',
        name: 'Discover Special Meal',
        skills: ['Cooking Lore'],
        requirements: 'Trained in Cooking Lore',
        dcType: 'zone',
        customDC: null,
        effectCrit: '',
        effectSuccess: '',
        effectFail: '',
        effectCritFail: '',
        description: ''
    },
    {
        id: 'hunt_and_gather',
        name: 'Hunt and Gather',
        skills: ['Survival', 'Nature'],
        requirements: 'Trained in Survival or Nature',
        dcType: 'foraging',
        customDC: null,
        effectCrit: '',
        effectSuccess: '',
        effectFail: '',
        effectCritFail: '',
        description: ''
    },
    {
        id: 'enhance_weapons',
        name: 'Enhance Weapons',
        skills: ['Crafting'],
        requirements: 'Expert in Crafting',
        dcType: 'zone',
        customDC: null,
        effectCrit: '',
        effectSuccess: '',
        effectFail: '',
        effectCritFail: '',
        description: ''
    },
    {
        id: 'maintain_armor',
        name: 'Maintain Armor',
        skills: ['Crafting'],
        requirements: 'Expert in Crafting',
        dcType: 'zone',
        customDC: null,
        effectCrit: '',
        effectSuccess: '',
        effectFail: '',
        effectCritFail: '',
        description: ''
    },
    {
        id: 'set_traps',
        name: 'Set Traps',
        skills: ['Thievery', 'Crafting'],
        requirements: 'Trained in Thievery or Crafting',
        dcType: 'zone',
        customDC: null,
        effectCrit: '',
        effectSuccess: '',
        effectFail: '',
        effectCritFail: '',
        description: ''
    }
];

/**
 * Merge default activities with GM overrides from the campaign.
 * Campaign activities override matching defaults by id; new ids are appended.
 */
export function getMergedActivities(campaignActivities = []) {
    const overrides = new Map(campaignActivities.map(a => [a.id, a]));
    const merged = DEFAULT_CAMPING_ACTIVITIES.map(def => overrides.has(def.id) ? { ...def, ...overrides.get(def.id) } : def);
    campaignActivities.forEach(a => {
        if (!DEFAULT_CAMPING_ACTIVITIES.find(d => d.id === a.id)) merged.push(a);
    });
    return merged;
}

/**
 * Resolve the effective DC for an activity from campaign camping settings.
 */
export function getActivityDC(activity, campingSettings = {}) {
    if (activity.dcType === 'foraging') return campingSettings.foragingDC ?? 15;
    if (activity.dcType === 'encounter') return campingSettings.encounterDC ?? 15;
    if (activity.dcType === 'custom') return activity.customDC ?? 15;
    return campingSettings.zoneDC ?? 15; // default: zone
}

/**
 * Determine degree of success (4-tier PF2: critSuccess, success, fail, critFail).
 */
export function getDegreeOfSuccess(roll, dc) {
    if (roll >= dc + 10) return 'crit';
    if (roll >= dc)      return 'success';
    if (roll <= dc - 10) return 'critFail';
    return 'fail';
}

export function getEffectText(activity, degree) {
    if (degree === 'crit')     return activity.effectCrit     || '(No critical success effect defined)';
    if (degree === 'success')  return activity.effectSuccess  || '(No success effect defined)';
    if (degree === 'fail')     return activity.effectFail     || '(No failure effect defined)';
    if (degree === 'critFail') return activity.effectCritFail || '(No critical failure effect defined)';
    return '';
}

export const DC_TYPE_LABELS = {
    zone: 'Zone DC',
    foraging: 'Foraging DC',
    encounter: 'Encounter DC',
    custom: 'Custom DC'
};
