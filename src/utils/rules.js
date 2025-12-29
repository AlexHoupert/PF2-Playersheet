// Game Rules and Calculation Logic

export const STAT_MAP = {
    "Fortitude": "Constitution", "Reflex": "Dexterity", "Will": "Wisdom", "Perception": "Wisdom",
    "Acrobatics": "Dexterity", "Arcana": "Intelligence", "Athletics": "Strength", "Crafting": "Intelligence",
    "Deception": "Charisma", "Diplomacy": "Charisma", "Intimidate": "Charisma", "Medicine": "Wisdom",
    "Nature": "Wisdom", "Occultism": "Intelligence", "Perform": "Charisma", "Religion": "Wisdom",
    "Society": "Intelligence", "Stealth": "Dexterity", "Survival": "Wisdom", "Thievery": "Dexterity",
    // Expanded mappings for user inputs
    "Intimidation": "Charisma", "Performance": "Charisma"
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
        // Content examples:
        // 1. (floor((@actor.level -1)/2)+1)d6
        // 2. (floor((@actor.level -1)/2)+1)d6[slashing]|options:area-damage

        let parsed = content;

        // 1. Replace Variables
        if (context.actor) {
            parsed = parsed.replace(/@actor\.level/g, (context.actor.level || 0));
        }

        // 2. Parse Components: Formula + Die + (Type)? + (Rest)?
        // Regex: (Formula)(Die)(Type)?(Rest)?
        // We assume Formula ends at the 'd' of the die.
        const parts = parsed.match(/^([\d\s\(\)\+\-\*\/\.Mathfloorceil]+)(d\d+)(?:\[([^\]]+)\])?.*$/);

        if (parts) {
            let formula = parts[1];
            const die = parts[2];
            const type = parts[3] || ""; // e.g. "slashing"

            // Replace math functions strings with JS Math
            formula = formula.replace(/floor/g, 'Math.floor')
                .replace(/ceil/g, 'Math.ceil')
                .replace(/round/g, 'Math.round')
                .replace(/abs/g, 'Math.abs')
                .replace(/min/g, 'Math.min')
                .replace(/max/g, 'Math.max');

            try {
                // Safe-ish Evaluation
                if (/^[0-9\s\(\)\+\-\*\/\.Mathfloorceil]+$/.test(formula.replace(/Math\.(floor|ceil|round|abs|min|max)/g, ''))) {
                    const result = new Function(`return ${formula}`)();
                    // Output: "2d6 slashing" (2d6 gold)
                    let out = `<span style="color:var(--text-gold)">${result}${die}</span>`;
                    if (type) out += ` ${type}`;
                    return out;
                }
            } catch (e) {
                console.warn("Failed to eval damage formula:", formula, e);
            }
        }

        // Fallback: Return cleanly stripped content if eval failed but looks like structure
        return parsed.replace(/\[/g, ' ').replace(/\]/g, '').replace(/\|.*/, '');
    });

    // Highlight Degrees of Success
    formatted = formatted.replace(/<strong>(Critical\s+Success|Success|Critical\s+Failure|Failure)<\/strong>/gi, '<strong style="color:var(--text-gold)">$1</strong>');

    // Replace Horizontal Rules (--- or *** or ___)
    formatted = formatted.replace(/^(\*{3,}|-{3,}|_{3,})$/gm, '<hr />');

    // Replace Markdown Bold **text**
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Replace Markdown Italic *text*
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Restore Gold Tag (Correctly Added Now)
    formatted = formatted.replace(/\[gold\](.*?)\[\/gold\]/gi, '<span style="color:var(--text-gold)">$1</span>');

    // Replace Newlines with <br>
    formatted = formatted.replace(/\n/g, '<br />');

    return formatted;
}

export function getConditionEffects(character, statName, attributeName) {
    const conds = character.conditions || [];
    const active = {};
    conds.forEach(c => { if (c.level > 0) active[c.name.toLowerCase()] = c.level; });
    const has = (key) => !!active[key];
    const val = (key) => active[key] || 0;

    // Calculate penalties
    let statusPenalties = [];
    let statusSource = [];

    if (has("frightened")) { const v = -val("frightened"); statusPenalties.push(v); statusSource.push(`Frightened ${v}`); }
    if (has("sickened")) { const v = -val("sickened"); statusPenalties.push(v); statusSource.push(`Sickened ${v}`); }

    if (attributeName === "Strength") { if (has("enfeebled")) { const v = -val("enfeebled"); statusPenalties.push(v); statusSource.push(`Enfeebled ${v}`); } }
    else if (attributeName === "Dexterity") { if (has("clumsy")) { const v = -val("clumsy"); statusPenalties.push(v); statusSource.push(`Clumsy ${v}`); } if (has("encumbered")) { statusPenalties.push(-1); statusSource.push("Encumbered -1"); } }
    else if (attributeName === "Constitution") { if (has("drained")) { const v = -val("drained"); statusPenalties.push(v); statusSource.push(`Drained ${v}`); } }
    else if (["Intelligence", "Wisdom", "Charisma"].includes(attributeName)) { if (has("stupefied")) { const v = -val("stupefied"); statusPenalties.push(v); statusSource.push(`Stupefied ${v}`); } }

    if (statName === "AC" || statName === "Fortitude" || statName === "Reflex" || statName === "Will") { if (has("fatigued")) { statusPenalties.push(-1); statusSource.push("Fatigued -1"); } }
    if (statName === "Perception") {
        if (has("blinded")) { statusPenalties.push(-4); statusSource.push("Blinded -4"); }
        if (has("deafened")) { statusPenalties.push(-2); statusSource.push("Deafened -2"); }
        if (has("unconscious")) { statusPenalties.push(-4); statusSource.push("Unconscious -4"); }
    }

    let circPenalties = [];
    let circSource = [];
    if (statName === "AC") {
        if (has("off-guard") || has("blinded") || has("grabbed") || has("paralyzed") || has("prone") || has("restrained") || has("unconscious")) {
            circPenalties.push(-2);
            // Just list one reason or generic
            circSource.push("Off-Guard (or similar) -2");
        }
    }

    const bestStatus = statusPenalties.length ? Math.min(...statusPenalties) : 0;
    const bestCirc = circPenalties.length ? Math.min(...circPenalties) : 0;

    // Construct breakdown object
    const breakdown = {};
    if (bestStatus !== 0) breakdown.status = bestStatus;
    if (bestCirc !== 0) breakdown.circumstance = bestCirc;

    return {
        total: bestStatus + bestCirc,
        breakdown,
        meta: { statusSource, circSource }
    };
}

export function calculateStat(character, statName, profValue) {
    const level = parseInt(character.level) || 1;
    const prof = parseInt(profValue) || 0;
    let attrKey = "Intelligence";

    // Map stat name to attribute
    if (!statName.startsWith("Lore")) attrKey = STAT_MAP[statName] || "Strength";
    if (statName === "AC") attrKey = "Dexterity";

    // Get attribute value from character stats
    const attrVal = parseInt(character.stats.attributes[attrKey.toLowerCase()]) || 0;

    let total = (prof > 0) ? prof + level + attrVal : attrVal;

    // Base 10 for AC/Class DC (if we ever use this handling class dc)
    // Actually AC base is 10. `calculateStat` is seemingly generic.
    // If statName is AC, we should probably include base 10? 
    // The previous code didn't explicitly add 10 here, implies 'total' is a modifier.
    // Wait, AC usually has base 10. Let's check if this is Modifier or Score.
    // Previous code: `total = (prof > 0) ? prof + level + attrVal : attrVal`. This is a modifier.
    // If this is used for Checks (Skills/Saves), modifier is correct.

    const cond = getConditionEffects(character, statName, attrKey);
    total += cond.total;

    // Construct Structured Breakdown
    const breakdown = {
        attribute: attrVal,
        ...cond.breakdown
    };

    // Add proficiency and level only if trained
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
        breakdown, // Object now
        source,    // Metadata for labels
        rank: PROF_NAMES[prof] || "Unknown",
        penalty: cond.total
    };
}
