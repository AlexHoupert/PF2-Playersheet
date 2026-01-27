// Game Rules and Calculation Logic

import { getMutagenEffects } from './rules/mutagens';

export const STAT_MAP = {
    "Fortitude": "Constitution", "Reflex": "Dexterity", "Will": "Wisdom", "Perception": "Wisdom",
    "Acrobatics": "Dexterity", "Arcana": "Intelligence", "Athletics": "Strength", "Crafting": "Intelligence",
    "Deception": "Charisma", "Diplomacy": "Charisma", "Intimidation": "Charisma", "Medicine": "Wisdom",
    "Nature": "Wisdom", "Occultism": "Intelligence", "Performance": "Charisma", "Religion": "Wisdom",
    "Society": "Intelligence", "Stealth": "Dexterity", "Survival": "Wisdom", "Thievery": "Dexterity",
    "Perform": "Charisma", "perform": "Charisma"
};

export const PROF_NAMES = { 0: "Untrained", 2: "Trained", 4: "Expert", 6: "Master", 8: "Legendary" };

export const ACTION_ICONS = {
    "[one-action]": `<svg class="pf-icon" viewBox="0 0 74 74" style="height:1.1em;width:auto;vertical-align:middle;fill:var(--text-gold);"><g transform="translate(0,74) scale(0.1,-0.1)" fill="var(--text-gold)" stroke="none"><path d="M277 653 l-87 -88 97 -97 98 -98 -98 -98 -97 -97 87 -87 88 -87 188 186 c103 102 186 187 184 187 -1 1 -86 83 -187 183 l-185 183 -88 -87z"/><path d="M61 434 l-63 -66 66 -66 67 -65 67 66 67 67 -65 65 c-35 36 -67 65 -70 65 -3 0 -34 -30 -69 -66z"/></g></svg>`,
    "[two-actions]": `<svg class="pf-icon" viewBox="0 20 115 75" style="height:1.1em;width:auto;vertical-align:middle;fill:var(--text-gold);"><g transform="translate(0,115) scale(0.1,-0.1)" fill="var(--text-gold)" stroke="none"><path d="M273 852 l-82 -87 94 -95 95 -95 -94 -95 -95 -95 86 -89 85 -89 184 184 184 184 -182 182 c-101 101 -185 183 -188 183 -3 0 -42 -39 -87 -88z"/><path d="M750 825 l-74 -75 64 -67 c83 -85 90 -93 90 -101 0 -4 -34 -41 -75 -82 -41 -41 -75 -79 -75 -85 0 -6 34 -44 76 -85 l76 -75 159 165 159 165 -158 158 c-86 86 -159 157 -162 157 -3 0 -39 -34 -80 -75z"/><path d="M62 637 l-62 -63 65 -64 65 -64 65 64 65 64 -62 63 c-34 35 -65 63 -68 63 -3 0 -34 -28 -68 -63z"/></g></svg>`,
    "[three-actions]": `<svg class="pf-icon" viewBox="0 39 152 74" style="height:1.1em;width:auto;vertical-align:middle;fill:var(--text-gold);"><g transform="translate(0,152) scale(0.1,-0.1)" fill="var(--text-gold)" stroke="none"><path d="M270 1035 l-85 -85 95 -95 95 -95 -95 -95 -95 -95 85 -85 c47 -47 88 -85 92 -85 4 0 90 81 190 180 l183 180 -182 180 c-100 99 -186 180 -190 180 -5 0 -46 -38 -93 -85z"/><path d="M750 1004 l-75 -76 84 -79 85 -80 -84 -84 -85 -85 78 -78 77 -77 163 163 162 162 -160 155 c-88 85 -162 154 -165 155 -3 0 -39 -34 -80 -76z"/><path d="M1195 960 l-59 -60 67 -68 67 -67 -67 -67 -67 -67 65 -60 64 -60 128 127 127 127 -127 127 c-70 71 -130 128 -133 128 -3 0 -32 -27 -65 -60z"/><path d="M72 828 c-35 -33 -62 -66 -60 -72 2 -6 30 -37 64 -68 l60 -57 64 64 65 65 -65 65 -65 64 -63 -61z"/></g></svg>`,
    "[free-action]": `<svg class="pf-icon" viewBox="0 0 73 73" style="height:1.1em;width:auto;vertical-align:middle;fill:var(--text-gold);"><g transform="translate(0,73) scale(0.1,-0.1)" fill="var(--text-gold)" stroke="none"><path d="M182 547 l-182 -182 183 -183 182 -182 183 183 182 182 -183 183 -182 182 -183 -183z m310 -309 l-133 -132 -42 42 -42 42 87 87 86 88 -83 90 -84 90 42 43 42 42 130 -130 130 -130 -133 -132z m-239 174 l37 -38 -38 -37 c-40 -39 -42 -39 -86 11 l-30 32 34 35 c19 19 37 35 40 35 3 0 23 -17 43 -38z"/></g></svg>`,
    "[reaction]": `<svg class="pf-icon" viewBox="0 0 73 73" style="height:1.1em;width:auto;vertical-align:middle;fill:var(--text-gold);"><g transform="translate(0,73) scale(0.1,-0.1)" fill="var(--text-gold)" stroke="none"><path d="M235 647 c-75 -20 -147 -61 -189 -107 -44 -49 -41 -62 6 -28 59 44 96 53 213 53 91 0 118 -4 156 -21 92 -43 148 -126 134 -200 -10 -55 -85 -128 -152 -148 l-22 -7 19 66 c10 36 15 65 11 65 -4 0 -74 -40 -155 -89 l-148 -89 59 -12 c32 -7 107 -23 168 -35 60 -13 111 -23 112 -21 1 1 -9 19 -23 40 -14 21 -24 39 -22 40 1 1 30 8 63 15 314 67 356 351 68 461 -72 28 -223 36 -298 17z"/></g></svg>`
};

export function formatText(text, context = {}) {
    if (!text) return "";
    let formatted = text;

    // Replace internal specific markdown-like syntax
    Object.entries(ACTION_ICONS).forEach(([key, svg]) => {
        // Escape brackets for regex
        const escapedKey = key.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
        const regex = new RegExp(escapedKey, "gi");
        formatted = formatted.replace(regex, svg);
    });

    // Replace HTML Action Glyphs (e.g. <span class="action-glyph">1</span>)
    formatted = formatted.replace(/<span class="action-glyph">(\d+)<\/span>/gi, (match, digit) => {
        if (digit === '1') return ACTION_ICONS["[one-action]"];
        if (digit === '2') return ACTION_ICONS["[two-actions]"];
        if (digit === '3') return ACTION_ICONS["[three-actions]"];
        return match;
    });

    // Replace Templates (e.g. @Template[emanation|distance:30])
    formatted = formatted.replace(/@Template\[(.*?)\|(.*?)\]/gi, (match, type, params) => {
        // params might be "distance:30"
        const distMatch = params.match(/distance:(\d+)/);
        const dist = distMatch ? distMatch[1] : "?";
        return `${dist}-foot ${type}`;
    });

    // Replace Checks (e.g. @Check[reflex|...])
    formatted = formatted.replace(/@Check\[(reflex|fortitude|will)[^\]]*\]/gi, (match, type) => {
        return `${type.charAt(0).toUpperCase() + type.slice(1)} Saving Throw`;
    });

    // Replace @UUID links
    formatted = formatted.replace(/@UUID\[Compendium\.pf2e\.([a-zA-Z0-9-]+)\.(?:Item|JournalEntry|Macro)\.([^\]]+)\](?:{(.*?)})?/gi, (match, pack, name, label) => {
        // Handle "spell-effects", "feat-effects", "other-effects" -> Remove or just show name? 
        // User said: "ignore and not display" for spell effects.
        if (pack.includes('effects')) return "";

        let type = 'unknown';
        if (pack === 'equipment-srd') type = 'item';
        else if (pack === 'actionspf2e') type = 'action';
        else if (pack === 'conditionitems') type = 'condition';
        else if (pack === 'spells-srd') type = 'spell';
        else if (pack === 'feats-srd') type = 'feat';

        const displayName = label || name;

        // If it's a known type, make it clickable
        if (['item', 'action', 'condition', 'spell', 'feat'].includes(type)) {
            return `<span class="content-link gold-link" data-type="${type}" data-name="${name.replace(/"/g, '&quot;')}">${displayName}</span>`;
        }

        // Fallback for unknown types (e.g. journals), just text
        return displayName;
    });

    // Replace Inline Macros
    formatted = formatted.replace(/\[\[\/act ([^\]]+)\]\](?:{(.*?)})?/gi, (match, cmd, label) => {
        return label || cmd.split(' ')[0]; // Return label or just the action slug
    });

    // Replace Inline Rolls
    formatted = formatted.replace(/\[\[\/r ([^\]]+)\]\](?:{(.*?)})?/gi, (match, formula, label) => {
        if (label) return label;
        // Clean up formula if no label
        let clean = formula.replace(/\[.*?\]/g, '').replace(/#.*/, '').trim();
        clean = clean.replace(/^{|}$/g, '');
        return clean;
    });

    // Replace Damage
    formatted = formatted.replace(/@Damage\[((?:[^\[\]]|\[[^\[\]]*\])+)\]/gi, (match, content) => {
        let parsed = content;
        if (context.actor) {
            parsed = parsed.replace(/@actor\.level/g, (context.actor.level || 0));
        }

        const parts = parsed.match(/^([\d\s\(\)\+\-\*\/\.Mathfloorceil]+)(d\d+)(?:\[([^\]]+)\])?.*$/);

        if (parts) {
            let formula = parts[1];
            const die = parts[2];
            const type = parts[3] || "";
            formula = formula.replace(/floor/g, 'Math.floor')
                .replace(/ceil/g, 'Math.ceil')
                .replace(/round/g, 'Math.round')
                .replace(/abs/g, 'Math.abs')
                .replace(/min/g, 'Math.min')
                .replace(/max/g, 'Math.max');

            try {
                if (/^[0-9\s\(\)\+\-\*\/\.Mathfloorceil]+$/.test(formula.replace(/Math\.(floor|ceil|round|abs|min|max)/g, ''))) {
                    const result = new Function(`return ${formula}`)();
                    let out = `<span style="color:var(--text-gold)">${result}${die}</span>`;
                    if (type) out += ` ${type}`;
                    return out;
                }
            } catch (e) {
                console.warn("Failed to eval damage formula:", formula, e);
            }
        }
        return parsed.replace(/\[/g, ' ').replace(/\]/g, '').replace(/\|.*/, '');
    });

    // Replace Hidden Text ||text||
    formatted = formatted.replace(/\|\|(.*?)\|\|/g, (match, content) => {
        if (context.secretMode === 'reveal') {
            return `<span class="gm-secret-revealable" title="Hidden to players">${content}</span>`;
        }
        // Player view: Hidden completely
        return ``;
    });

    formatted = formatted.replace(/<strong>(Critical\s+Success|Success|Critical\s+Failure|Failure)<\/strong>/gi, '<strong style="color:var(--text-gold)">$1</strong>');
    formatted = formatted.replace(/^(\*{3,}|-{3,}|_{3,})$/gm, '<hr />');
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/\[gold\](.*?)\[\/gold\]/gi, '<span style="color:var(--text-gold)">$1</span>');
    formatted = formatted.replace(/\n/g, '<br />');

    return formatted;
}

export function getCondLevel(condName, character) {
    if (!character || !character.conditions) return 0;
    const target = String(condName).toLowerCase();
    const found = character.conditions.find(cond => {
        if (typeof cond === 'string') return cond.toLowerCase() === target;
        return String(cond?.name || '').toLowerCase() === target;
    });

    if (!found) return 0;
    if (typeof found === 'string') return 1;

    const lvl = Number(found.level);
    if (Number.isFinite(lvl)) return lvl;
    return 1;
}

export function getConditionEffects(character, statName, attributeName) {
    const conds = character.conditions || [];
    const modifiers = [];

    // 1. Collect all modifiers (Standard + Mutagens)
    conds.forEach(c => {
        if (!c) return;
        const name = (typeof c === 'string') ? c : c.name;
        if (!name) return;
        const lowerName = name.toLowerCase();

        const rawLevel = (typeof c === 'string') ? 1 : c.level;
        const level = Number.isFinite(Number(rawLevel)) ? Number(rawLevel) : 1;
        const val = level; // Magnitude usually equals level for things like Frightened

        // --- Standard Conditions (Status / Circumstance) ---
        if (lowerName === "frightened") { modifiers.push({ type: 'status', value: -val, source: `Frightened ${val}` }); }
        if (lowerName === "sickened") { modifiers.push({ type: 'status', value: -val, source: `Sickened ${val}` }); }

        // Attribute Penalties
        if (attributeName) {
            if (attributeName === "Strength" && lowerName === "enfeebled") modifiers.push({ type: 'status', value: -val, source: `Enfeebled ${val}` });
            if (attributeName === "Dexterity") {
                if (lowerName === "clumsy") modifiers.push({ type: 'status', value: -val, source: `Clumsy ${val}` });
                if (lowerName === "encumbered") modifiers.push({ type: 'status', value: -1, source: "Encumbered" }); // Clumsy is status, Encumbered is also status usually? Actually Encumbered is Clumsy 1 + Speed penalty.
            }
            if (attributeName === "Constitution" && lowerName === "drained") modifiers.push({ type: 'status', value: -val, source: `Drained ${val}` });
            if (["Intelligence", "Wisdom", "Charisma"].includes(attributeName) && lowerName === "stupefied") modifiers.push({ type: 'status', value: -val, source: `Stupefied ${val}` });
        }

        // AC/Save Penalties
        if (["AC", "Fortitude", "Reflex", "Will"].includes(statName)) {
            if (lowerName === "fatigued") modifiers.push({ type: 'status', value: -1, source: "Fatigued" });
        }

        // Perception Penalties
        if (statName === "Perception") {
            if (lowerName === "blinded") modifiers.push({ type: 'status', value: -4, source: "Blinded" });
            if (lowerName === "deafened") modifiers.push({ type: 'status', value: -2, source: "Deafened" });
            if (lowerName === "unconscious") modifiers.push({ type: 'status', value: -4, source: "Unconscious" });
        }

        // AC Circumstance
        if (statName === "AC") {
            if (["off-guard", "blinded", "grabbed", "paralyzed", "prone", "restrained", "unconscious"].includes(lowerName)) {
                modifiers.push({ type: 'circumstance', value: -2, source: "Off-Guard (or similar)" });
            }
        }

        // --- Mutagen Effects (Item) ---
        // Check if condition name matches a known mutagen
        const mutagen = getMutagenEffects(name, level);
        if (mutagen) {
            // Check Bonuses
            mutagen.bonuses.forEach(eff => {
                // lenient match: "Athletics", "Unarmed Attack", "Attack", "Specific Skill"
                const match = eff.stat === statName || eff.stat === attributeName ||
                    (eff.stat === "Attack" && statName.includes("Attack")) || // e.g. "Melee Attack"
                    (eff.stat === "Damage" && statName.includes("Damage")) ||
                    // Quicksilver Mutagen: "Dexterity Actions" applies to all Dex-based checks (Skills, Attacks) but NOT AC.
                    (eff.stat === "Dexterity Actions" && attributeName === "Dexterity" && statName !== "AC");

                if (match) {
                    modifiers.push({ type: eff.type || 'item', value: eff.value, source: name });
                }
            });
            // Check Penalties
            mutagen.penalties.forEach(eff => {
                const match = eff.stat === statName || eff.stat === attributeName ||
                    (eff.stat === "Attack" && statName.includes("Attack"));
                if (match) {
                    modifiers.push({ type: eff.type || 'item', value: eff.value, source: name });
                }
            });
        }
    });

    // 2. Stacking Logic (Group by Type)
    const grouped = { status: [], item: [], circumstance: [], untyped: [] };
    modifiers.forEach(m => {
        const t = m.type || 'untyped';
        if (grouped[t]) grouped[t].push(m);
        else grouped.untyped.push(m);
    });

    const breakdown = {};
    const meta = { statusSource: [], itemSource: [], circSource: [] };
    let finalTotal = 0;

    // Process Types
    ['status', 'item', 'circumstance'].forEach(type => {
        const mods = grouped[type];
        if (mods.length === 0) return;

        // Max Positive
        const bonuses = mods.filter(m => m.value > 0).map(m => m.value);
        const maxBonus = bonuses.length ? Math.max(...bonuses) : 0;

        // Min Negative (Worst Penalty) -> Min of { -1, -2 } is -2 (the smallest number)
        const penalties = mods.filter(m => m.value < 0).map(m => m.value);
        const minPenalty = penalties.length ? Math.min(...penalties) : 0;

        const net = maxBonus + minPenalty;
        if (net !== 0) {
            breakdown[type] = net;
            finalTotal += net;
        }

        // Metadata for tooltip
        mods.forEach(m => {
            if ((m.value > 0 && m.value === maxBonus) || (m.value < 0 && m.value === minPenalty)) {
                if (type === 'status') meta.statusSource.push(`${m.source} ${m.value > 0 ? '+' : ''}${m.value}`);
                if (type === 'item') meta.itemSource.push(`${m.source} ${m.value > 0 ? '+' : ''}${m.value}`);
                if (type === 'circumstance') meta.circSource.push(`${m.source} ${m.value > 0 ? '+' : ''}${m.value}`);
            }
        });
    });

    // Untyped (Stacking)
    grouped.untyped.forEach(m => {
        finalTotal += m.value;
        // Add to breakdown? Untyped usually merge into Base or Misc
        if (!breakdown.misc) breakdown.misc = 0;
        breakdown.misc += m.value;
    });

    return {
        total: finalTotal,
        breakdown,
        meta: {
            statusSource: [...new Set(meta.statusSource)], // Dedupe
            itemSource: [...new Set(meta.itemSource)],
            circSource: [...new Set(meta.circSource)]
        }
    };
}

export function calculateStat(character, statName, profValue) {
    const level = parseInt(character.level) || 1;
    const prof = parseInt(profValue) || 0;
    let attrKey = "Intelligence";

    if (!statName.startsWith("Lore")) attrKey = STAT_MAP[statName] || "Strength";
    if (statName === "AC") attrKey = "Dexterity";

    const attrVal = parseInt(character.stats.attributes[attrKey.toLowerCase()]) || 0;
    const cond = getConditionEffects(character, statName, attrKey);

    let total = (prof > 0) ? prof + level + attrVal : attrVal;
    total += cond.total; // Add net condition modifiers

    const breakdown = {
        attribute: attrVal,
        ...cond.breakdown
    };

    if (prof > 0) {
        breakdown.proficiency = prof;
        breakdown.level = level;
    }

    const source = {
        attrName: attrKey.substr(0, 3),
        profName: PROF_NAMES[prof] || "Unknown",
        levelVal: level
    };

    return {
        total,
        breakdown,
        source,
        rank: PROF_NAMES[prof] || "Unknown",
        penalty: cond.total < 0 ? cond.total : 0,
        bonus: cond.total > 0 ? cond.total : 0 // Expose pure bonus for Green text
    };
}

export function calculateSpellAttackAndDC(character) {
    if (!character) {
        return {
            attack: { total: 0, breakdown: {}, source: {}, penalty: 0 },
            dc: { total: 10, base: 10, breakdown: {}, source: {}, penalty: 0 }
        };
    }

    const magic = character.magic || {};
    const attrName = magic.attribute || "Intelligence";
    const attrMod = parseInt(character.stats?.attributes?.[(attrName || "").toLowerCase()]) || 0;
    const prof = parseInt(magic.proficiency) || 0;
    const level = parseInt(character.level) || 0;

    const baseAttack = Math.floor(attrMod + prof + (prof > 0 ? level : 0));
    const cond = getConditionEffects(character, "Spell", attrName);
    const totalAttack = baseAttack + cond.total;

    const breakdown = {
        attribute: attrMod,
        proficiency: prof,
        ...(prof > 0 ? { level } : {}),
        ...cond.breakdown
    };

    const source = {
        attrName: attrName.substr(0, 3),
        attrFull: attrName,
        profName: PROF_NAMES[prof] || "Unknown",
        levelVal: level
    };

    return {
        attack: { total: totalAttack, breakdown, source, penalty: cond.total },
        dc: { total: 10 + totalAttack, base: 10, breakdown, source, penalty: cond.total }
    };
}

export function calculateImpulseAttackAndClassDC(character) {
    if (!character) {
        return {
            attack: { total: 0, breakdown: {}, source: {}, penalty: 0 },
            classDC: { total: 10, base: 10, breakdown: {}, source: {}, penalty: 0 }
        };
    }

    const prof = parseInt(character.stats?.impulse_proficiency) || 0;
    const level = Math.max(1, parseInt(character.level) || 1);
    const conMod = parseInt(character.stats?.attributes?.constitution) || 0;

    const baseAttack = conMod + (prof > 0 ? (level + prof) : 0);
    const cond = getConditionEffects(character, "Impulse", "Constitution");
    const totalAttack = baseAttack + cond.total;

    const breakdown = {
        attribute: conMod,
        proficiency: prof,
        ...(prof > 0 ? { level } : {}),
        ...cond.breakdown
    };

    const source = {
        attrName: "Con",
        attrFull: "Constitution",
        profName: PROF_NAMES[prof] || "Unknown",
        levelVal: level
    };

    return {
        attack: { total: totalAttack, breakdown, source, penalty: cond.total },
        classDC: { total: 10 + totalAttack, base: 10, breakdown, source, penalty: cond.total }
    };
}
