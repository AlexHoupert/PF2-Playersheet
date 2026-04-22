/**
 * Static data for familiars and animal companions (PF2e).
 * Familiar abilities from the Rules (Archives of Nethys).
 */

export const COMPANION_TYPES = [
    { id: 'pet', label: 'Pet', icon: '🐾', description: 'Tiny animal companion. Cannot attack; follows you everywhere.' },
    { id: 'familiar', label: 'Familiar', icon: '✨', description: 'Magical familiar. Chooses 2 abilities per day.' },
    { id: 'advanced_familiar', label: 'Advanced Familiar', icon: '🌟', description: 'More capable familiar with additional ability choices.' },
    { id: 'young', label: 'Young Animal Companion', icon: '🐻', description: 'Beginning animal companion. Trained proficiency.' },
    { id: 'mature', label: 'Mature Animal Companion', icon: '🐻', description: 'Grown companion. Expert proficiency.' },
    { id: 'nimble', label: 'Nimble Animal Companion', icon: '🐻', description: 'Agile specialization. Expert Acrobatics.' },
    { id: 'savage', label: 'Savage Animal Companion', icon: '🐻', description: 'Powerful specialization. Expert Athletics.' },
    { id: 'specialized', label: 'Specialized Animal Companion', icon: '🐻', description: 'Peak companion. Master saves & Perception.' },
];

export const FAMILIAR_GROUPS = ['familiar', 'advanced_familiar', 'pet'];
export const COMPANION_GROUPS = ['young', 'mature', 'nimble', 'savage', 'specialized'];

export const SPECIALIZATIONS = [
    { id: 'ambusher', label: 'Ambusher', description: 'Can Sneak even when observed in natural environments.' },
    { id: 'bully', label: 'Bully', description: 'Expert Athletics and Intimidation; excels at forced movement.' },
    { id: 'daredevil', label: 'Daredevil', description: 'Denies advantage vs hidden/flanking; Master Acrobatics.' },
    { id: 'racer', label: 'Racer', description: '+10 ft to one Speed type; Legendary Fortitude.' },
    { id: 'tracker', label: 'Tracker', description: 'Full Speed while tracking; Master Survival.' },
    { id: 'wrecker', label: 'Wrecker', description: 'Unarmed attacks ignore half object Hardness; Master Athletics.' },
];

// Familiar abilities selectable each day
export const FAMILIAR_ABILITIES = [
    { name: 'Amphibious', source: 'familiar', description: 'Gains amphibious trait. Can breathe in air and water; has land Speed and swim Speed equal to its highest.' },
    { name: 'Burrower', source: 'familiar', description: 'Gains a burrow Speed of 5 feet, allowing it to dig Tiny holes.' },
    { name: 'Climber', source: 'familiar', description: 'Gains a climb Speed of 25 feet.' },
    { name: 'Darkvision', source: 'familiar', description: 'Can see in darkness and dim light just as well as in bright light.' },
    { name: 'Echolocation', source: 'familiar', description: 'Can use hearing as a precise sense within 20 feet.' },
    { name: 'Fast Movement', source: 'familiar', description: 'Increases one of its Speeds from 25 feet to 40 feet.' },
    { name: 'Flier', source: 'familiar', description: 'Gains a fly Speed of 25 feet.' },
    { name: 'Manual Dexterity', source: 'familiar', description: 'Can use up to two of its limbs as if they were hands to perform manipulate actions.' },
    { name: 'Scent', source: 'familiar', description: 'Can use scent as an imprecise sense within 30 feet.' },
    { name: 'Skilled', source: 'familiar', description: 'Gains training in one skill of your choice. You can select this ability multiple times, choosing a different skill each time.' },
    { name: 'Spell Delivery', source: 'familiar', description: 'If your familiar is in your space or an adjacent space, you can cast a spell with a range of touch and have the familiar deliver the spell instead of delivering it yourself.' },
    { name: 'Spellcasting', source: 'familiar', description: 'Your familiar gains a spellcasting type and can cast spells from your spell list at your direction. Once per day, you can have it cast one spell of the highest level you can cast.' },
    { name: 'Speech', source: 'familiar', description: 'Can speak one language you know. It still cannot use abilities that require a humanoid form.' },
    { name: 'Tough', source: 'familiar', description: 'Maximum HP increases by 2 per level.' },
    // Advanced familiar abilities
    { name: 'Dragon Familiar', source: 'advanced', description: 'Familiar gains the dragon trait (counts as one trait-changing ability).' },
    { name: 'Elemental Familiar', source: 'advanced', description: 'Familiar gains an elemental trait (fire, water, etc.).' },
    { name: 'Plant Familiar', source: 'advanced', description: 'Familiar gains the plant trait (counts as one trait-changing ability).' },
    { name: 'Construct Familiar', source: 'advanced', description: 'Familiar gains the construct trait (counts as one trait-changing ability).' },
];

// Master abilities (grant benefits to the master, some grant familiar reactions/actions)
export const MASTER_ABILITIES = [
    { name: 'Familiar Focus', description: 'Once per day, your familiar uses 2 actions to restore 1 Focus Point to you.' },
    { name: 'Ambassador', description: 'Familiar gains a reaction at the start of your turn to Aid your Diplomacy to Make an Impression. It automatically critically succeeds if you\'re a master of Diplomacy.' },
    { name: 'Partner in Crime', description: 'Familiar gains a reaction at the start of your turn to Aid your Deception or Thievery checks.' },
    { name: 'Second Opinion', description: 'Familiar gains a reaction to Aid your Recall Knowledge checks (requires Skilled: relevant skill). Auto-succeeds or critically succeeds at master rank.' },
    { name: 'Familiar of Flowing Script', description: 'Familiar can flank for you and adjacent allies as though it could attack with 5-foot reach.' },
    { name: 'Master\'s Form', description: 'Familiar can use a single action to change shape into a humanoid of your ancestry.' },
    { name: 'Lifelink', description: 'When your familiar would be reduced to 0 HP, you can spend 1 Focus Point to transfer the damage to yourself instead.' },
];

// Default companion stat blocks by type
export const COMPANION_DEFAULTS = {
    pet: {
        hp: { current: 5, max: 5 },  // actual max = 5 × level
        ac: 12,
        perception: 3,  // actual = 3 + level
        speeds: { land: 25, fly: 0, swim: 0, climb: 0, burrow: 0 },
        saves: { fortitude: 3, reflex: 5, will: 3 },
        attacks: [],
        abilities: [
            { name: 'Minion', actionCost: '', description: 'Gains 2 actions each round when you Command an Animal. No Nature check required.', traits: ['minion'] },
        ],
    },
    familiar: {
        hp: { current: 5, max: 5 },  // actual max = 5 × level
        ac: 12,
        perception: 3,  // 3 + level, or spellcasting mod + level if higher
        speeds: { land: 25, fly: 0, swim: 0, climb: 0, burrow: 0 },
        saves: { fortitude: 3, reflex: 5, will: 3 },
        attacks: [],
        abilities: [
            { name: 'Minion', actionCost: '', description: 'Gains 2 actions each round when you Command a Minion. No Nature check required.', traits: ['minion'] },
        ],
    },
    advanced_familiar: {
        hp: { current: 5, max: 5 },
        ac: 12,
        perception: 3,
        speeds: { land: 25, fly: 0, swim: 0, climb: 0, burrow: 0 },
        saves: { fortitude: 3, reflex: 5, will: 3 },
        attacks: [],
        abilities: [
            { name: 'Minion', actionCost: '', description: 'Gains 2 actions each round when you Command a Minion. No Nature check required.', traits: ['minion'] },
        ],
    },
    young: {
        hp: { current: 20, max: 20 },  // Ancestry HP + (6+Con) × level
        ac: 16,  // 10 + 2 (trained) + level + Dex (varies)
        perception: 5,
        speeds: { land: 25, fly: 0, swim: 0, climb: 0, burrow: 0 },
        saves: { fortitude: 5, reflex: 5, will: 3 },
        attacks: [
            { name: 'Jaws', bonus: 8, damage: '1d8', damageType: 'piercing', traits: [] },
        ],
        abilities: [
            { name: 'Support', actionCost: '2', description: 'Your companion supports you in battle, providing a special benefit while adjacent to a target you attack.', traits: [] },
            { name: 'Minion', actionCost: '', description: 'Gains 2 actions each round when you Command an Animal. No Nature check required.', traits: ['minion'] },
        ],
    },
    mature: {
        hp: { current: 30, max: 30 },
        ac: 18,
        perception: 7,
        speeds: { land: 30, fly: 0, swim: 0, climb: 0, burrow: 0 },
        saves: { fortitude: 7, reflex: 7, will: 5 },
        attacks: [
            { name: 'Jaws', bonus: 10, damage: '2d8', damageType: 'piercing', traits: [] },
            { name: 'Claws', bonus: 10, damage: '2d6', damageType: 'slashing', traits: ['agile'] },
        ],
        abilities: [
            { name: 'Support', actionCost: '2', description: 'Your companion supports you in battle, providing a special benefit while adjacent to a target you attack.', traits: [] },
            { name: 'Minion', actionCost: '', description: 'Gains 2 actions each round when you Command an Animal. No Nature check required.', traits: ['minion'] },
        ],
    },
    nimble: {
        hp: { current: 35, max: 35 },
        ac: 20,
        perception: 9,
        speeds: { land: 35, fly: 0, swim: 0, climb: 0, burrow: 0 },
        saves: { fortitude: 9, reflex: 11, will: 7 },
        attacks: [
            { name: 'Jaws', bonus: 13, damage: '2d8+2', damageType: 'piercing', traits: ['magical'] },
            { name: 'Claws', bonus: 13, damage: '2d6+2', damageType: 'slashing', traits: ['agile', 'magical'] },
        ],
        abilities: [
            { name: 'Support', actionCost: '2', description: 'Your companion supports you in battle, providing a special benefit while adjacent to a target you attack.', traits: [] },
            { name: 'Advanced Maneuver', actionCost: '1', description: 'A special combat maneuver specific to this companion type.', traits: [] },
            { name: 'Minion', actionCost: '', description: 'Gains 2 actions each round when you Command an Animal. No Nature check required.', traits: ['minion'] },
        ],
    },
    savage: {
        hp: { current: 40, max: 40 },
        ac: 19,
        perception: 9,
        speeds: { land: 35, fly: 0, swim: 0, climb: 0, burrow: 0 },
        saves: { fortitude: 11, reflex: 9, will: 7 },
        attacks: [
            { name: 'Jaws', bonus: 13, damage: '2d8+3', damageType: 'piercing', traits: ['magical'] },
            { name: 'Claws', bonus: 13, damage: '2d6+3', damageType: 'slashing', traits: ['agile', 'magical'] },
        ],
        abilities: [
            { name: 'Support', actionCost: '2', description: 'Your companion supports you in battle, providing a special benefit while adjacent to a target you attack.', traits: [] },
            { name: 'Advanced Maneuver', actionCost: '1', description: 'A special combat maneuver specific to this companion type.', traits: [] },
            { name: 'Minion', actionCost: '', description: 'Gains 2 actions each round when you Command an Animal. No Nature check required.', traits: ['minion'] },
        ],
    },
    specialized: {
        hp: { current: 45, max: 45 },
        ac: 21,
        perception: 11,
        speeds: { land: 35, fly: 0, swim: 0, climb: 0, burrow: 0 },
        saves: { fortitude: 13, reflex: 13, will: 9 },
        attacks: [
            { name: 'Jaws', bonus: 16, damage: '3d8+4', damageType: 'piercing', traits: ['magical'] },
            { name: 'Claws', bonus: 16, damage: '3d6+4', damageType: 'slashing', traits: ['agile', 'magical'] },
        ],
        abilities: [
            { name: 'Support', actionCost: '2', description: 'Your companion supports you in battle, providing a special benefit while adjacent to a target you attack.', traits: [] },
            { name: 'Advanced Maneuver', actionCost: '1', description: 'A special combat maneuver specific to this companion type.', traits: [] },
            { name: 'Minion', actionCost: '', description: 'Gains 2 actions each round when you Command an Animal. No Nature check required.', traits: ['minion'] },
        ],
    },
};

export const ACTION_COST_SYMBOLS = {
    '': '',
    'P': 'Passive',
    'F': '⟳',   // Free action
    'R': '⟲',   // Reaction
    '1': '◆',
    '2': '◆◆',
    '3': '◆◆◆',
};
