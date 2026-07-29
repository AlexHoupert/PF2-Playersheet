export function actorHasMagic(actor) {
  if (!actor) return false;
  if (actor.isCaster) return true;
  if ((actor.magic?.list || []).length > 0) return true;
  if (Number(actor.stats?.spell_proficiency || 0) > 0) return true;

  const slots = actor.magic?.slots || {};
  return Object.entries(slots).some(([key, value]) => (
    String(key).endsWith('_max') && Number(value || 0) > 0
  ));
}

export function actorHasImpulses(actor) {
  if (!actor) return false;
  if (actor.isKineticist) return true;
  if ((actor.impulses || []).length > 0) return true;
  return Number(actor.stats?.impulse_proficiency || 0) > 0;
}
