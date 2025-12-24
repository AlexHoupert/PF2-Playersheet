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

export function formatText(text) {
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
        return content.replace(/\[/g, ' ').replace(/\]/g, '');
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
    let statusPenalties = [];

    if (has("frightened")) statusPenalties.push(-val("frightened"));
    if (has("sickened")) statusPenalties.push(-val("sickened"));

    if (attributeName === "Strength") { if (has("enfeebled")) statusPenalties.push(-val("enfeebled")); }
    else if (attributeName === "Dexterity") { if (has("clumsy")) statusPenalties.push(-val("clumsy")); if (has("encumbered")) statusPenalties.push(-1); }
    else if (attributeName === "Constitution") { if (has("drained")) statusPenalties.push(-val("drained")); }
    else if (["Intelligence", "Wisdom", "Charisma"].includes(attributeName)) { if (has("stupefied")) statusPenalties.push(-val("stupefied")); }

    if (statName === "AC" || statName === "Fortitude" || statName === "Reflex" || statName === "Will") { if (has("fatigued")) statusPenalties.push(-1); }
    if (statName === "Perception") { if (has("blinded")) statusPenalties.push(-4); if (has("deafened")) statusPenalties.push(-2); if (has("unconscious")) statusPenalties.push(-4); }

    let circPenalties = [];
    if (statName === "AC") { if (has("off-guard") || has("blinded") || has("grabbed") || has("paralyzed") || has("prone") || has("restrained") || has("unconscious")) circPenalties.push(-2); }

    const bestStatus = statusPenalties.length ? Math.min(...statusPenalties) : 0;
    const bestCirc = circPenalties.length ? Math.min(...circPenalties) : 0;
    return { total: bestStatus + bestCirc, breakdown: (bestStatus ? `Status Penalty: ${bestStatus}\n` : "") + (bestCirc ? `Circumstance Penalty: ${bestCirc}\n` : "") };
}

export function calculateStat(character, statName, profValue) {
    const level = parseInt(character.level) || 1;
    const prof = parseInt(profValue) || 0;
    let attrKey = "Intelligence";

    // Map stat name to attribute
    if (!statName.startsWith("Lore")) attrKey = STAT_MAP[statName] || "Strength";
    if (statName === "AC") attrKey = "Dexterity";

    // Get attribute value from character stats
    // Note: new_db.json uses lowercase keys for attributes (strength, dexterity)
    const attrVal = parseInt(character.stats.attributes[attrKey.toLowerCase()]) || 0;

    let total = (prof > 0) ? prof + level + attrVal : attrVal;
    const cond = getConditionEffects(character, statName, attrKey);
    total += cond.total;

    const breakdown = (prof > 0) ? `${prof} (${PROF_NAMES[prof]})\n+ ${level} (Lvl)\n+ ${attrVal} (${attrKey.substr(0, 3)})` : `0 (Untrained)\n+ ${attrVal} (${attrKey.substr(0, 3)})`;

    return {
        total,
        breakdown: breakdown + (cond.total !== 0 ? `\n\nConditions:\n${cond.breakdown}` : ""),
        rank: PROF_NAMES[prof] || "Unknown",
        penalty: cond.total
    };
}
