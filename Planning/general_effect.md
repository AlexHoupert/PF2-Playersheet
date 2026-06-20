# Multi Purpose Effect System

## Premise
Currently we have a number of mechanics that influence values and rolls in the app, conditions manipulate the character stats, some items aplly bonuses or maluses, some feats change stats and values,runes apply permanent bonuses. And we havent even implemented spells yet, that will also make changes to character values.

Thus it should be considered tu inify all mechanics that change character or creature values temporarily or permanently into a combined framework that can then be assigned to those singular mechanics. This way, conflicts for example effects apllying multiple buffs as item bonus mistakenly stacking, can be caught more easily by just comparing applied effects and stat changes dont need to be injected in multiple different ways.

This would also make it possible to more easily implement new effects and conditions, like diseases and poisons that sometimes use existing conditions but can also have a more direct influence. we could also include persitant damage effects in this making sure, that multiple pers.dmg effects of the same type dont stack but just apply the strongest.

## Plan
- Unify all mechanics, that dynamically apply changes to character or creature values to "status_effect" 
- unify all effects that apply persistant damage or healing to "damage_effect"
- unify all effects that apply resistance or weakness to "resistance_effect"


have all existing conditions, items, runes, spells, diseases, poisons etc use
effects to aplly their changes. 

compare status_effects against each other to calculate effective change according to stacking rules. (item bonus/malus, circumstance bonus/malus, status bonus/malus, Off-Guard (which is technically a circumstace malus but stacks with other bonuses))

compare"resistance_effects against each other according to rules that only the highest resistance/weaknes against one damage type gets applied. higest weakness and highest resistance cancel each other (eg weakness 4 + resistance 5 result in resistance 1)

compare "damage_effects against each other and only apply highest of one damage type

## further automation
the system comparing the status effects should be smart enough to regognize dependencies of status values and rolls: If one effect applies -1 staus penalty to dex and another a -1 status penalty to attack rolls it should not stack if the creature uses dex for the attack roll but since attack roll alredy gets implicitly affected by dex.

Quote:
"
Ja: für einen konkreten Wurf stacken sie nicht, wenn beide als Statusbonus auf denselben Wurf wirksam werden — auch wenn einer „indirekt“ über Dexterity kommt und der andere direkt „attack rolls“ nennt.

Für dein Beispiel:

+1 status bonus to Dexterity
+1 status bonus to all attack rolls

Bei einem Dex-basierten Angriff wäre das effektiv:

Attack roll = d20 + Dex modifier + proficiency + other bonuses + penalties

Ranged attack rolls verwenden Dexterity, und Finesse-Melee-Attacken können Dexterity verwenden. Die Regeln sagen außerdem: Wenn mehrere Boni desselben Typs auf denselben Wurf anwendbar wären, nimmst du nur den höchsten; sie sind nicht kumulativ.

Also:

Dex-basierter Attack Roll:
+1 status über Dex
+1 status auf attack rolls
=> beide würden denselben Angriffswurf erhöhen
=> nur höchster Statusbonus zählt
=> insgesamt +1, nicht +2

Dass die Boni unterschiedliche Targets/Formulierungen haben, ist nicht entscheidend. Entscheidend ist, ob sie am Ende auf denselben Roll / dieselbe statistic angewendet werden. Pathfinder 2E Remaster formuliert die Stacking-Regel als „on a given roll“, nicht als „nur wenn der Bonus exakt dieselbe Zielzeile nennt“.
"

## Condition Expansion
Based on this it will be easier to imlement an expended system for additional conditions, that allows creating conditions "on the fly" if i want to depict a creature having -1 circumstance penalty to all dex rolls due to being on slippery ground i can quickly add a "slippery" byclicking new effect and typing it in and assign it status_effect with information dex, circumstance and -1. and apply this to the creature.

we also want to be able to create and save diseases and poisons and assign those effects to their various stages and automatically apply them by applying the new "spider poison" condition and changing them dynamically by increasing the stage of the poison.

if the disease uses existing conditions these should be used and have the poison aplly the condition and the condition the effect. this way we should be able to catch every potential stacking conflict.

these custom conditions should not be selectable in the conditions menu by default, to not overload it.