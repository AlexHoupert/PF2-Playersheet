/**
 * foundryParser.js
 *
 * Unified translator for Foundry VTT / PF2e markup found in compendium JSON data.
 * Replaces the two separate implementations (parseAbilityText + formatText) with a
 * single function that handles every known Foundry token consistently.
 *
 * Usage:
 *   import { parseFoundry, ACTION_ICONS } from '../shared/utils/foundryParser';
 *   <div dangerouslySetInnerHTML={{ __html: parseFoundry(text, { actor, secretMode }) }} />
 *
 * Context object (all fields optional):
 *   actor      – { level: number }  used to evaluate @actor.level in damage formulas
 *   secretMode – 'reveal' | 'hide'  controls ||hidden text|| visibility (default: hide)
 */

// ---------------------------------------------------------------------------
// Action icon SVGs
// ---------------------------------------------------------------------------

export const ACTION_ICONS = {
    '[one-action]': `<svg class="pf-icon" viewBox="0 0 74 74" style="height:1.1em;width:auto;vertical-align:middle;fill:var(--text-gold);"><g transform="translate(0,74) scale(0.1,-0.1)" fill="var(--text-gold)" stroke="none"><path d="M277 653 l-87 -88 97 -97 98 -98 -98 -98 -97 -97 87 -87 88 -87 188 186 c103 102 186 187 184 187 -1 1 -86 83 -187 183 l-185 183 -88 -87z"/><path d="M61 434 l-63 -66 66 -66 67 -65 67 66 67 67 -65 65 c-35 36 -67 65 -70 65 -3 0 -34 -30 -69 -66z"/></g></svg>`,
    '[two-actions]': `<svg class="pf-icon" viewBox="0 20 115 75" style="height:1.1em;width:auto;vertical-align:middle;fill:var(--text-gold);"><g transform="translate(0,115) scale(0.1,-0.1)" fill="var(--text-gold)" stroke="none"><path d="M273 852 l-82 -87 94 -95 95 -95 -94 -95 -95 -95 86 -89 85 -89 184 184 184 184 -182 182 c-101 101 -185 183 -188 183 -3 0 -42 -39 -87 -88z"/><path d="M750 825 l-74 -75 64 -67 c83 -85 90 -93 90 -101 0 -4 -34 -41 -75 -82 -41 -41 -75 -79 -75 -85 0 -6 34 -44 76 -85 l76 -75 159 165 159 165 -158 158 c-86 86 -159 157 -162 157 -3 0 -39 -34 -80 -75z"/><path d="M62 637 l-62 -63 65 -64 65 -64 65 64 65 64 -62 63 c-34 35 -65 63 -68 63 -3 0 -34 -28 -68 -63z"/></g></svg>`,
    '[three-actions]': `<svg class="pf-icon" viewBox="0 39 152 74" style="height:1.1em;width:auto;vertical-align:middle;fill:var(--text-gold);"><g transform="translate(0,152) scale(0.1,-0.1)" fill="var(--text-gold)" stroke="none"><path d="M270 1035 l-85 -85 95 -95 95 -95 -95 -95 -95 -95 85 -85 c47 -47 88 -85 92 -85 4 0 90 81 190 180 l183 180 -182 180 c-100 99 -186 180 -190 180 -5 0 -46 -38 -93 -85z"/><path d="M750 1004 l-75 -76 84 -79 85 -80 -84 -84 -85 -85 78 -78 77 -77 163 163 162 162 -160 155 c-88 85 -162 154 -165 155 -3 0 -39 -34 -80 -76z"/><path d="M1195 960 l-59 -60 67 -68 67 -67 -67 -67 -67 -67 65 -60 64 -60 128 127 127 127 -127 127 c-70 71 -130 128 -133 128 -3 0 -32 -27 -65 -60z"/><path d="M72 828 c-35 -33 -62 -66 -60 -72 2 -6 30 -37 64 -68 l60 -57 64 64 65 65 -65 65 -65 64 -63 -61z"/></g></svg>`,
    '[free-action]': `<svg class="pf-icon" viewBox="0 0 73 73" style="height:1.1em;width:auto;vertical-align:middle;fill:var(--text-gold);"><g transform="translate(0,73) scale(0.1,-0.1)" fill="var(--text-gold)" stroke="none"><path d="M182 547 l-182 -182 183 -183 182 -182 183 183 182 182 -183 183 -182 182 -183 -183z m310 -309 l-133 -132 -42 42 -42 42 87 87 86 88 -83 90 -84 90 42 43 42 42 130 -130 130 -130 -133 -132z m-239 174 l37 -38 -38 -37 c-40 -39 -42 -39 -86 11 l-30 32 34 35 c19 19 37 35 40 35 3 0 23 -17 43 -38z"/></g></svg>`,
    '[reaction]': `<svg class="pf-icon" viewBox="0 0 73 73" style="height:1.1em;width:auto;vertical-align:middle;fill:var(--text-gold);"><g transform="translate(0,73) scale(0.1,-0.1)" fill="var(--text-gold)" stroke="none"><path d="M235 647 c-75 -20 -147 -61 -189 -107 -44 -49 -41 -62 6 -28 59 44 96 53 213 53 91 0 118 -4 156 -21 92 -43 148 -126 134 -200 -10 -55 -85 -128 -152 -148 l-22 -7 19 66 c10 36 15 65 11 65 -4 0 -74 -40 -155 -89 l-148 -89 59 -12 c32 -7 107 -23 168 -35 60 -13 111 -23 112 -21 1 1 -9 19 -23 40 -14 21 -24 39 -22 40 1 1 30 8 63 15 314 67 356 351 68 461 -72 28 -223 36 -298 17z"/></g></svg>`,
};

// ---------------------------------------------------------------------------
// @Localize glossary — sourced from bestiary-ability-glossary-srd + pf2e lang/en.json
// Keys follow the pattern PF2E.NPC.Abilities.Glossary.<PascalCaseName>
// ---------------------------------------------------------------------------

const LOCALIZE_GLOSSARY = {
    'PF2E.NPC.Abilities.Glossary.AllAroundVision':
        'This monster can see in all directions simultaneously. It cannot be flanked.',

    'PF2E.NPC.Abilities.Glossary.AquaticAmbush':
        'The monster Strides up to its swim Speed + 10 feet, moving through water and up to 5 feet onto land. Once the monster ends this movement, it can make a melee Strike against a creature that is in water, or it can make a Strike against a creature on land. The creature is off-guard against this Strike.',

    'PF2E.NPC.Abilities.Glossary.AtWillSpells':
        'The monster can cast its at-will spells any number of times without using any spell slots.',

    'PF2E.NPC.Abilities.Glossary.AttackOfOpportunity':
        '<strong>Trigger</strong> A creature within the monster\'s reach uses a manipulate action or a move action, makes a ranged attack, or leaves a square during a move action it\'s using.<hr /><p>The monster attempts a melee Strike against the triggering creature. If the attack is a critical hit and the trigger was a manipulate action, the monster disrupts the action.</p>',

    'PF2E.NPC.Abilities.Glossary.Aura':
        'An aura is a persistent effect that radiates from the monster, affecting the area around it. The aura\'s size and its effects are described in the ability. Auras are dismissed when the monster is incapacitated or dead.',

    'PF2E.NPC.Abilities.Glossary.Buck':
        '<strong>Trigger</strong> A creature attempts to Ride the monster.<hr /><p>The monster attempts to throw off the rider. The rider must succeed at a Reflex saving throw against the monster\'s Reflex DC or fall off the monster and land prone.</p>',

    'PF2E.NPC.Abilities.Glossary.CatchRock':
        '<strong>Trigger</strong> The monster is targeted with a thrown rock ability or a rock is thrown at the monster.<hr /><p>The monster gains a +4 circumstance bonus to its AC against the triggering attack. If the attack still hits, the monster can spend a reaction to catch the rock, taking no damage from it.</p>',

    'PF2E.NPC.Abilities.Glossary.ChangeShape':
        'The monster changes its shape. It can revert to its true form as a free action.',

    'PF2E.NPC.Abilities.Glossary.Constrict':
        'The monster automatically deals bludgeoning damage and potentially other damage types to all creatures it has grabbed or restrained. This is not a Strike and doesn\'t trigger effects that occur on Strikes.',

    'PF2E.NPC.Abilities.Glossary.Coven':
        'This hag can form a coven with two other hags. When the hag is part of a coven, she gains access to the spells listed in the coven\'s entry and can cast them using her own spell slots. All hags in a coven must be within 300 feet of each other to use the coven abilities.',

    'PF2E.NPC.Abilities.Glossary.Darkvision':
        'The monster can see perfectly well in areas of darkness and dim light, though such vision is in black and white only.',

    'PF2E.NPC.Abilities.Glossary.Disease':
        'A disease is a long-term affliction with multiple stages. At the end of each day, the afflicted creature must attempt a Fortitude save against the disease\'s DC. On a failure, the disease advances to the next stage; on a critical failure, it advances two stages. On a success, the disease remains at the same stage. On a critical success, the disease regresses to the previous stage.',

    'PF2E.NPC.Abilities.Glossary.Engulf':
        'The monster attempts to engulf all creatures in its space. Each creature in the monster\'s space must attempt a Reflex save. On a failed save, it is swallowed and takes the listed damage. The engulfed creature must successfully Escape (DC equal to the monster\'s Fortitude DC) to exit. An engulfed creature is off-guard and has the grabbed condition. The engulfed creature can attempt to Escape using Athletics against the monster\'s Fortitude DC. If a creature inside deals the listed Rupture damage with a single Strike, it tears a hole and exits.',

    'PF2E.NPC.Abilities.Glossary.FastHealing':
        'The monster regains the listed amount of Hit Points at the start of each of its turns.',

    'PF2E.NPC.Abilities.Glossary.Ferocity':
        '<strong>Trigger</strong> The monster is reduced to 0 HP.<hr /><p>The monster avoids being knocked out and remains at 1 HP, but its wounded value increases by 1. When it is reduced to 0 HP again, it remains at 1 HP only if its wounded value is less than 3; otherwise, it is knocked out.</p>',

    'PF2E.NPC.Abilities.Glossary.FormUp':
        'The troop moves up to half its Speed. All members of the troop must remain within 10 feet of each other throughout this movement.',

    'PF2E.NPC.Abilities.Glossary.FrightfulPresence':
        'A creature that first enters the emanation or begins its turn there must attempt a Will save. On a failure, the creature is frightened. On a critical failure, the creature is frightened and fleeing. Regardless of the result, the creature is immune to this monster\'s frightful presence for 1 minute.',

    'PF2E.NPC.Abilities.Glossary.Grab':
        'The monster attempts to Grapple the creature using the body part it attacked with. This attempt neither applies nor counts toward the creature\'s multiple attack penalty.',

    'PF2E.NPC.Abilities.Glossary.GreaterConstrict':
        'The monster automatically deals the listed damage to all creatures it has grabbed or restrained, and the target must succeed at a Fortitude save or be slowed 1 until the start of the monster\'s next turn.',

    'PF2E.NPC.Abilities.Glossary.GreaterDarkvision':
        'The monster can see perfectly well in any darkness, including magical darkness.',

    'PF2E.NPC.Abilities.Glossary.ImprovedGrab':
        'When the monster succeeds with its Strike, it automatically applies a free Grab against the target.',

    'PF2E.NPC.Abilities.Glossary.ImprovedKnockdown':
        'When the monster succeeds with its Strike, it automatically applies a free Trip against the target.',

    'PF2E.NPC.Abilities.Glossary.ImprovedPush':
        'When the monster succeeds with its Strike, it automatically applies a free Shove against the target.',

    'PF2E.NPC.Abilities.Glossary.Knockdown':
        'The monster attempts to Trip the creature it just hit using the body part it attacked with. This attempt neither applies nor counts toward the creature\'s multiple attack penalty.',

    'PF2E.NPC.Abilities.Glossary.Lifesense':
        'The monster can sense the life force of living creatures within range. This is a precise sense against living creatures and an imprecise sense against undead. It cannot detect unliving constructs.',

    'PF2E.NPC.Abilities.Glossary.LightBlindness':
        'When first exposed to bright light, the monster is blinded until the end of its next turn. After this initial exposure, the monster is dazzled as long as it remains in bright light.',

    'PF2E.NPC.Abilities.Glossary.LowLightVision':
        'The monster can see in dim light as though it were bright light, so it ignores the concealed condition from dim light.',

    'PF2E.NPC.Abilities.Glossary.NegativeHealing':
        'A creature with void healing draws health from void energy rather than vitality energy. It is damaged by vitality damage and is not healed by vitality healing effects.',

    'PF2E.NPC.Abilities.Glossary.Poison':
        'A poison is an affliction delivered by contact, ingestion, or injury. Poisons have stages and impose conditions at each stage. At the end of each round, the creature must succeed at a Fortitude save or advance to the next stage of the poison.',

    'PF2E.NPC.Abilities.Glossary.PowerAttack':
        'The monster makes a powerful melee Strike. This Strike deals an extra die of damage on a hit. As normal, the extra damage from the deadly weapon trait on the monster\'s weapon is only added on a critical hit. This action has the flourish trait.',

    'PF2E.NPC.Abilities.Glossary.Pull':
        'The monster attempts to pull the creature it just hit using the body part it attacked with, moving it closer to the monster. This attempt neither applies nor counts toward the creature\'s multiple attack penalty.',

    'PF2E.NPC.Abilities.Glossary.Push':
        'The monster attempts to push the creature it just hit using the body part it attacked with, moving it away from the monster. This attempt neither applies nor counts toward the creature\'s multiple attack penalty.',

    'PF2E.NPC.Abilities.Glossary.ReactiveStrike':
        '<strong>Trigger</strong> A creature within the monster\'s reach uses a manipulate action or a move action, makes a ranged attack, or leaves a square during a move action it\'s using.<hr /><p>The monster attempts a melee Strike against the triggering creature. If the attack is a critical hit and the trigger was a manipulate action, the monster disrupts the action.</p>',

    'PF2E.NPC.Abilities.Glossary.Regeneration':
        'The monster regains the listed amount of HP at the start of each of its turns. Its dying condition can\'t increase to dead while the monster\'s regeneration is active. The regeneration stops working if the monster takes the listed damage type, until the start of the monster\'s next turn.',

    'PF2E.NPC.Abilities.Glossary.Rend':
        'A monster with Rend can use it as a free action when it hits a single creature with two consecutive hits from the listed Strike, dealing the listed damage. This damage is in addition to the normal Strike damage.',

    'PF2E.NPC.Abilities.Glossary.RetributiveStrike':
        '<strong>Trigger</strong> An ally within 15 feet of the monster takes damage from an enemy within the monster\'s melee reach.<hr /><p>The monster makes a melee Strike against the triggering enemy. If the Strike hits, the ally takes half the damage or no damage on a critical hit.</p>',

    'PF2E.NPC.Abilities.Glossary.Scent':
        'Scent involves detecting creatures with the monster\'s sense of smell. The distance given in parentheses indicates the range of the precise or imprecise scent. The monster can usually detect a creature within double the listed range, but not pinpoint it.',

    'PF2E.NPC.Abilities.Glossary.ShieldBlock':
        '<strong>Trigger</strong> The monster is hit by an attack while it has its shield raised.<hr /><p>The monster puts its shield in the way. The monster gains the shield\'s circumstance bonus to AC. Its shield takes the listed damage, and the damage dealt to the monster is reduced by the same amount.</p>',

    'PF2E.NPC.Abilities.Glossary.Slow':
        'A slowed creature regains only 2 actions at the start of its turn. It can\'t use reactions.',

    'PF2E.NPC.Abilities.Glossary.SneakAttack':
        'The monster deals extra precision damage to off-guard creatures.',

    'PF2E.NPC.Abilities.Glossary.Stench':
        'The monster\'s stench is so powerful that any creature that enters or begins its turn in the aura must succeed at a Fortitude save or become sickened. On a critical failure, it also becomes slowed 1 for as long as it\'s sickened. While in the aura, the creature must continue to succeed at saves against the stench each turn or the sickened condition value increases.',

    'PF2E.NPC.Abilities.Glossary.SwallowWhole':
        'The monster attempts to swallow a creature of the listed size or smaller that is grabbed in its jaws. If the monster\'s Fortitude save result against the target creature\'s Escape DC is a success, the creature is swallowed. The swallowed creature is off-guard, has the grabbed condition, and is exposed to any other effects noted in the statblock. If the swallowed creature deals the listed Rupture damage with a single Strike, it tears a hole and exits.',

    'PF2E.NPC.Abilities.Glossary.SwarmMind':
        'The monster is immune to mental effects that target only a specific number of creatures. It is still subject to mental effects that affect all creatures in an area.',

    'PF2E.NPC.Abilities.Glossary.Telepathy':
        'The monster can mentally communicate with creatures within range using the listed languages. This doesn\'t require line of effect.',

    'PF2E.NPC.Abilities.Glossary.ThrowRock':
        'The monster picks up a rock within reach or retrieves a stored rock and throws it, making a ranged Strike. This thrown rock has the listed range increment and damage.',

    'PF2E.NPC.Abilities.Glossary.Thoughtsense':
        'The monster senses the presence of thinking creatures within range as an imprecise sense. It cannot detect mindless or non-intelligent creatures.',

    'PF2E.NPC.Abilities.Glossary.Trample':
        'The monster Strides up to double its Speed and can move through the spaces of creatures of the listed size or smaller. The monster\'s movement doesn\'t trigger reactions from creatures of that size or smaller. Each creature of the listed size or smaller whose space the monster moves through must attempt a Reflex saving throw. A creature hit by the trample takes the listed damage; on a critical failure, it is also knocked prone.',

    'PF2E.NPC.Abilities.Glossary.Tremorsense':
        'Tremorsense allows a monster to feel vibrations through the ground to detect creatures. It is a precise sense against creatures on the same surface and an imprecise sense against flying creatures.',

    'PF2E.NPC.Abilities.Glossary.TroopDefenses':
        'The troop has its normal HP, AC, and saves while it consists of 9 or more creatures. It gains the broken condition when reduced to 3–8 creatures and is destroyed at 0 HP. The troop\'s resistances and immunities apply to any individual creature in the troop\'s area.',

    'PF2E.NPC.Abilities.Glossary.TroopMovement':
        'Whenever the troop Strides, some or all of its members can leap over obstacles. The troop ignores difficult terrain and doesn\'t trigger reactions based on movement.',

    'PF2E.NPC.Abilities.Glossary.ChangeFormation':
        'The troop shifts into a different tactical formation, gaining the effects of the chosen formation until it changes formation again.',

    'PF2E.NPC.Abilities.Glossary.Wavesense':
        'Wavesense allows a monster to feel vibrations through water to detect creatures. It is a precise sense against creatures in the same body of water and an imprecise sense against creatures on water\'s surface.',
};

// ---------------------------------------------------------------------------
// UUID pack → entity type map
// ---------------------------------------------------------------------------

const PACK_TYPE_MAP = {
    'equipment-srd':    'item',
    'actionspf2e':      'action',
    'conditionitems':   'condition',
    'spells-srd':       'spell',
    'feats-srd':        'feat',
    'classfeatures':    'feat',
    'ancestryfeatures': 'feat',
    'backgrounds':      'background',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

/**
 * Evaluate a numeric formula string safely. Only allows digits, arithmetic
 * operators, parentheses, decimal points, and whitelisted Math functions.
 * Returns null if evaluation fails or the formula contains unsafe characters.
 */
function evalFormula(formula) {
    const sanitized = formula
        .replace(/\bfloor\b/g,  'Math.floor')
        .replace(/\bceil\b/g,   'Math.ceil')
        .replace(/\bround\b/g,  'Math.round')
        .replace(/\babs\b/g,    'Math.abs')
        .replace(/\bmin\b/g,    'Math.min')
        .replace(/\bmax\b/g,    'Math.max');
    // Only allow safe characters after substitution
    if (!/^[0-9\s()+\-*/.Math,floorceilroundabsminmax]+$/.test(sanitized.replace(/Math\.(floor|ceil|round|abs|min|max)/g, ''))) {
        return null;
    }
    try {
        // eslint-disable-next-line no-new-func
        return new Function(`return ${sanitized}`)();
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Translate all Foundry VTT / PF2e markup tokens into display HTML.
 *
 * @param {string} text - Raw description text (may contain HTML + Foundry tokens)
 * @param {object} [context]
 * @param {object} [context.actor]       - Actor context; used for @actor.level substitution
 * @param {number} [context.actor.level] - Actor level
 * @param {string} [context.secretMode]  - 'reveal' shows ||hidden|| text; otherwise hidden
 * @returns {string} HTML string
 */
export function parseFoundry(text, context = {}) {
    if (!text) return '';

    let out = text;

    // ------------------------------------------------------------------
    // 1. @Localize[key] — glossary lookup
    // ------------------------------------------------------------------
    out = out.replace(/@Localize\[([^\]]+)\]/g, (match, key) => {
        const resolved = LOCALIZE_GLOSSARY[key.trim()];
        // Recurse in case the glossary text itself contains Foundry tokens
        return resolved ? parseFoundry(resolved, context) : `<em>[${key}]</em>`;
    });

    // ------------------------------------------------------------------
    // 2. @UUID[Compendium.pf2e.<pack>.<Type>.<name>]{label}
    //    Spell/item effect packs are intentionally stripped (no display value).
    // ------------------------------------------------------------------
    out = out.replace(
        /@UUID\[Compendium\.pf2e\.([a-zA-Z0-9-]+)\.(?:Item|JournalEntry|Macro)\.([^\]]+)\](?:\{([^}]*)\})?/gi,
        (match, pack, name, label) => {
            if (pack.includes('effect') || pack.includes('Effect')) return '';
            const type = PACK_TYPE_MAP[pack] ?? 'reference';
            const display = (label || name).trim();
            return `<span class="content-link" data-type="${type}" data-name="${name.replace(/"/g, '&quot;')}">${display}</span>`;
        }
    );

    // ------------------------------------------------------------------
    // 3. @Check[type|dc:N|options] — save/skill check reference
    //    dc: may be blank (creature-derived); show placeholder in that case.
    // ------------------------------------------------------------------
    out = out.replace(/@Check\[([^\]]+)\]/gi, (match, inner) => {
        const parts = inner.split('|');
        const type  = parts[0]?.trim() ?? '';
        const dcPart = parts.find(p => p.startsWith('dc:'));
        const dc    = dcPart ? dcPart.slice(3).trim() : '';
        const isBasic = parts.some(p => p === 'basic');
        const saveLabel = `${capitalize(type)} DC${dc ? ' ' + dc : ''}`;
        return `<strong class="pf-check">${saveLabel}${isBasic ? ' (basic)' : ''}</strong>`;
    });

    // ------------------------------------------------------------------
    // 4. @Damage[formula[type]|options] — damage expression
    //    Substitutes @actor.level if context is provided, evaluates
    //    constant multipliers (e.g. floor(@actor.level / 2)d6), then
    //    renders as gold-coloured text.
    // ------------------------------------------------------------------
    out = out.replace(/@Damage\[((?:[^\[\]]|\[[^\[\]]*\])+)\]/gi, (match, content) => {
        let parsed = content;

        // Substitute actor level if available
        if (context.actor?.level != null) {
            parsed = parsed.replace(/@actor\.level/g, String(context.actor.level));
        }

        // Extract leading numeric/formula coefficient, die size, and damage type
        // Examples: "3d6[fire]", "floor(5/2)d8[bludgeoning|options:area-damage]", "1d4[persistent,acid]"
        const m = parsed.match(/^([\d\s()+\-*/.,Mathfloorceilroundabsminmax]+)(d\d+)(?:\[([^\]|]+))?/i);
        if (m) {
            const coeffStr = m[1].trim();
            const die      = m[2];
            const typeRaw  = m[3] ?? '';
            // Remove "persistent," prefix for display; keep damage type words
            const typeDisplay = typeRaw.replace(/\bpersistent,?\s*/gi, 'persistent ').trim();
            const isPersistent = /persistent/i.test(typeRaw);

            const coeff = evalFormula(coeffStr);
            const numStr = coeff != null ? String(coeff) : coeffStr;
            const label  = `${numStr}${die}${typeDisplay ? ' ' + typeDisplay : ''}${isPersistent && !typeDisplay.startsWith('persistent') ? ' (persistent)' : ''}`;
            return `<span class="pf-damage" style="color:var(--text-gold)">${label}</span>`;
        }

        // Fallback: strip brackets and pipe options
        return `<span class="pf-damage" style="color:var(--text-gold)">${parsed.replace(/\[[^\]]*\]/g, '').replace(/\|.*/,'').trim()}</span>`;
    });

    // ------------------------------------------------------------------
    // 5. @Template[shape|distance:N] — area template reference
    // ------------------------------------------------------------------
    out = out.replace(/@Template\[([^\]]+)\]/gi, (match, inner) => {
        const parts    = inner.split('|');
        // shape may be "emanation" or "type:emanation"
        const shapePart = parts[0]?.replace(/^type:/i, '').trim() ?? '';
        const distPart  = parts.find(p => p.startsWith('distance:'));
        const dist      = distPart ? distPart.slice(9).trim() : '';
        const label     = dist ? `${dist}-foot ${shapePart}` : shapePart;
        return `<strong class="pf-template">${label}</strong>`;
    });

    // ------------------------------------------------------------------
    // 6. [[/cmd formula #comment]]{display}  — inline roll / action macros
    //    Renders the display label if present, otherwise the clean formula.
    // ------------------------------------------------------------------
    out = out.replace(/\[\[\/([a-z]+)\s+([^\]]+)\]\](?:\{([^}]+)\})?/gi, (match, cmd, formula, label) => {
        if (label) return `<strong>${label}</strong>`;
        // Strip bracket type-tags and #comments from formula for clean display
        const clean = formula.replace(/\[.*?\]/g, '').replace(/#[^\s]*/g, '').trim();
        return `<strong>${clean || formula}</strong>`;
    });

    // ------------------------------------------------------------------
    // 7. ||hidden text|| — GM-only content
    // ------------------------------------------------------------------
    out = out.replace(/\|\|(.*?)\|\|/gs, (match, content) => {
        if (context.secretMode === 'reveal') {
            return `<span class="gm-secret-revealable" title="Hidden from players">${content}</span>`;
        }
        return '';
    });

    // ------------------------------------------------------------------
    // 8. Action icons — [one-action], [two-actions], etc.
    //    Also handles Foundry's <span class="action-glyph">N</span> variant.
    // ------------------------------------------------------------------
    for (const [key, svg] of Object.entries(ACTION_ICONS)) {
        const escaped = key.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
        out = out.replace(new RegExp(escaped, 'gi'), svg);
    }
    out = out.replace(/<span class="action-glyph">(\d+)<\/span>/gi, (match, digit) => {
        if (digit === '1') return ACTION_ICONS['[one-action]'];
        if (digit === '2') return ACTION_ICONS['[two-actions]'];
        if (digit === '3') return ACTION_ICONS['[three-actions]'];
        return match;
    });

    // ------------------------------------------------------------------
    // 9. Outcome labels — colour Critical Success / Success / Failure etc.
    // ------------------------------------------------------------------
    out = out.replace(
        /<strong>(Critical\s+Success|Success|Critical\s+Failure|Failure)<\/strong>/gi,
        '<strong style="color:var(--text-gold)">$1</strong>'
    );

    // ------------------------------------------------------------------
    // 10. Lightweight Markdown — **bold**, *italic*, [gold]...[/gold]
    // ------------------------------------------------------------------
    out = out.replace(/\*\*(.*?)\*\*/g,                        '<strong>$1</strong>');
    out = out.replace(/\*(.*?)\*/g,                            '<em>$1</em>');
    out = out.replace(/\[gold\](.*?)\[\/gold\]/gi,             '<span style="color:var(--text-gold)">$1</span>');
    out = out.replace(/^(\*{3,}|-{3,}|_{3,})$/gm,             '<hr />');

    // ------------------------------------------------------------------
    // 11. Newlines → <br />
    // ------------------------------------------------------------------
    out = out.replace(/\n/g, '<br />');

    return out;
}
