import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACTIONS_DIR = path.join(__dirname, '../../ressources/actions');

// Format: Name | Type | Subtype | Skill
// Using a more structured array to avoid parsing ambiguity
// Parsing user input carefully
const rawData = `
Strike, Combat, Attack, ToHit
Feint, Combat, Attack, Deception
Grapple, Combat, Attack, Athletics
Reposition, Combat, Other, Athletics
Shove, Combat, Attack, Athletics
Trip, Combat, Attack, Athletics
Disarm, Combat, Attack, Athletics
Escape, Combat, Defense, ["Athletics", "Acrobatics"]
"Raise a Shield", Combat, Defense
"Take Cover", Combat, Defense
"Avert Gaze", Combat, Defense
"Drop Prone", Combat, Defense
Demoralize, Combat, Social, Intimidation
"Create a Diversion", Combat, Social, Deception
"Administer First Aid", Combat, Assist
Aid, Combat, Assist
"Point Out", Combat, Assist
"Recall Knowledge", ["Combat", "Skills"], Other
Seek, Combat, Other, Perception
Sustain, Combat, Other
Ready, Combat, Other
Delay, Combat, Other
Dismiss, Combat, Other
Stride, Movement, Ground
Step, Movement, Ground
Stand, Movement, Ground
Crawl, Movement, Ground
Sneak, [Movement, Skills], [Ground, "Cloak & Dagger"], Stealth
Balance, Movement, Ground, Acrobatics
Climb, Movement, Other, Athletics
"Arrest a Fall", Movement, "Jumping & Falling", Acrobatics
"Grab an Edge", Movement, "Jumping & Falling", ["Acrobatics", "Reflex"]
"Tumble Through",["Combat","Movement"], Other, Acrobatics
Leap, Movement, "Jumping & Falling"
"Long Jump", Movement, "Jumping & Falling", Athletics
"High Jump", Movement, "Jumping & Falling", Athletics
Swim, Movement, Other, Athletics
Fly, Movement, Other
"Maneuver in Flight", Movement, Other, Acrobatics
Burrow, Movement, Other
Squeeze, Movement, Other
"Borrow an Arcane Spell", Skills, Other, Arcana
Coerce, Skills, Social, Intimidation
"Cover Tracks", Skills, Other, Survival
Track, Skills, Other, Survival
"Decipher Writing", Skills, Other
"Gather Information", Skills, Social, Diplomacy
"Sense Motive", Skills, Social, Perception
"Identify Alchemy", Skills, Other, Crafting
"Identify Magic",Skills, Other
Impersonate, Skills, Social, Deception
Lie, Skills, Social, Deception
"Learn a Spell", Skills, General
"Make an Impression", Skills, Social, Diplomacy
Repair, Skills, Other, Crafting
Perform, Skills, Social, Performance
"Sense Direction", Skills, Other, Survival
"Treat Wounds", Skills, Other, Medicine
"Force Open", Skills, Other, Athletics
Craft, Skills, Downtime, Crafting
"Create Forgery", Skills, Downtime, Society
"Earn Income", Skills, Downtime
Subsist, Skills, Downtime
"Conceal an Object", Skills, "Cloak & Dagger", Thievery
"Hide", Skills, "Cloak & Dagger", Stealth
"Pick a Lock", Skills, "Cloak & Dagger", Thievery
"Palm an Object", Skills, "Cloak & Dagger", Thievery
"Steal", Skills, "Cloak & Dagger", Thievery
"Command an Animal", Skills, Social, Nature
"Request", Skills, Social, Diplomacy
"Interact", Combat, Other
"Release", Combat, Other
"Mount", Movement, Other
"Treat Disease", Skills, Other, Medicine
"Treat Poison", Skills, Other, Medicine
`;

// Helper to parse the CSV-like lines
function parseLine(line) {
    if (!line || !line.trim()) return null;

    // Naive CSV split respects quotes? user input style inconsistent
    // We can regex for: (?: "([^"]+)" | ([^,]+) )
    // But since it's hardcoded, let's normalize the string first

    let temp = line.trim();

    // Extract Name
    let name = "";
    if (temp.startsWith('"')) {
        const end = temp.indexOf('"', 1);
        name = temp.substring(1, end);
        temp = temp.substring(end + 1).trim();
    } else {
        const end = temp.indexOf(',');
        if (end === -1) { // Only name?
            name = temp;
            temp = "";
        } else {
            name = temp.substring(0, end).trim();
            temp = temp.substring(end).trim();
        }
    }

    if (temp.startsWith(',')) temp = temp.substring(1).trim();

    // The rest is comma separated details "Type, Subtype, Skill"
    // CAUTION: Array syntax like ["Combat", "Other"] which contains comma
    // We'll simplisticly handle arrays if they start with [

    const parts = [];
    while (temp.length > 0) {
        if (temp.startsWith('[')) {
            const end = temp.indexOf(']');
            const content = temp.substring(1, end);

            // Custom array parser to allow unquoted strings
            // e.g. "Movement, Skills" -> ["Movement", "Skills"]
            // e.g. "Ground, "Cloak & Dagger"" -> ["Ground", "Cloak & Dagger"]

            const arrParts = [];
            let innerTemp = content.trim();

            while (innerTemp.length > 0) {
                let val = "";
                if (innerTemp.startsWith('"')) {
                    const qs = innerTemp.indexOf('"', 1);
                    val = innerTemp.substring(1, qs);
                    innerTemp = innerTemp.substring(qs + 1).trim();
                } else {
                    const comma = innerTemp.indexOf(',');
                    if (comma === -1) {
                        val = innerTemp;
                        innerTemp = "";
                    } else {
                        val = innerTemp.substring(0, comma).trim();
                        innerTemp = innerTemp.substring(comma).trim();
                    }
                }
                arrParts.push(val);
                if (innerTemp.startsWith(',')) innerTemp = innerTemp.substring(1).trim();
            }

            parts.push(arrParts);
            temp = temp.substring(end + 1).trim();
        } else if (temp.startsWith('"')) {
            const end = temp.indexOf('"', 1);
            parts.push(temp.substring(1, end));
            temp = temp.substring(end + 1).trim();
        } else {
            const end = temp.indexOf(',');
            if (end === -1) {
                parts.push(temp.trim());
                temp = "";
            } else {
                parts.push(temp.substring(0, end).trim());
                temp = temp.substring(end).trim();
            }
        }

        if (temp.startsWith(',')) temp = temp.substring(1).trim();
    }

    // Determine mapping based on index
    // parts[0] = Type
    // parts[1] = Subtype
    // parts[2] = Skill

    // Clean up "lorem" to "General" if I hadn't already fixed it in rawData
    // I fixed rawData to use General instead of lorem

    return {
        name,
        type: parts[0] || "Other",
        subtype: parts[1] || "Other",
        skill: parts[2] || null
    };
}

const lines = rawData.split('\n');
const updates = new Map();

lines.forEach(l => {
    const p = parseLine(l);
    if (p) {
        updates.set(p.name, p);
    }
});

const files = fs.readdirSync(ACTIONS_DIR).filter(f => f.endsWith('.json'));

let updatedCount = 0;

files.forEach(file => {
    const filePath = path.join(ACTIONS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);

    // Match by name
    let entry = updates.get(json.name);

    // Fuzzy match try (e.g. Strike [one-action] vs Strike)
    if (!entry) {
        // Try stripping actions from json name
        // json.name might be "Strike" or "Strike [one-action]"?
        // Actually usually "Strike" in json.name field, checking previous file views
        // Ah, new_db.json had "[one-action]", individual files usually just "Strike"
        // Let's check updates keys
    }

    if (!entry) {
        // Fallback: Check if we have a partial match in our updates map
        for (const [key, val] of updates.entries()) {
            if (json.name === key || json.name.startsWith(key)) {
                entry = val;
                break;
            }
        }
    }

    const sys = json.system || {};
    let newClassification;

    if (entry) {
        newClassification = {
            type: entry.type,
            subtype: entry.subtype,
            skill: entry.skill
        };
    } else {
        // "All others get Other, Other for now"
        newClassification = {
            type: "Other",
            subtype: "Other",
            skill: null
        };
    }

    // Only write if changed
    const currentClass = sys.classification || {};
    if (JSON.stringify(currentClass) !== JSON.stringify(newClassification)) {
        sys.classification = newClassification;
        json.system = sys;
        fs.writeFileSync(filePath, JSON.stringify(json, null, 4));
        updatedCount++;
    }
});

console.log(`Updated ${updatedCount} action files.`);
