import React from "react";
import { getShopItemRowMeta } from "../catalog/shopRowMeta.js";

export function buildItemRowViewModel(item = {}, options = {}) {
  const { row1, row2 } = getShopItemRowMeta(item);
  const traits = Array.isArray(item?.traits?.value)
    ? item.traits.value
    : Array.isArray(item?.system?.traits?.value)
      ? item.system.traits.value
      : [];

  return {
    icon: item.img || item.image || item.system?.image || null,
    name: item.name || "Unknown Item",
    level: item.level ?? item.system?.level?.value ?? null,
    rank: item.rank ?? null,
    type: item.type || item.system?.type || "",
    category: item.category || item.system?.category || "",
    traits,
    qty: item.qty ?? item.quantity ?? null,
    price: item.price ?? item.system?.price?.value?.gp ?? null,
    equipped: Boolean(item.equipped),
    prepared: Boolean(item.prepared),
    row1,
    row2,
    ...options,
  };
}

export default function ItemRow({
  item,
  className = "",
  icon,
  meta1,
  meta2,
  nameAddon = null,
  right = null,
  children = null,
  ...rest
}) {
  const view = buildItemRowViewModel(item);
  const resolvedIcon = icon ?? view.icon;

  return (
    <div className={`item-row ${className}`.trim()} {...rest}>
      {resolvedIcon && <img className="item-icon" src={normalizeIconPath(resolvedIcon)} alt="" />}
      <div className="item-row-main">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="item-name">
            {view.name}
            {nameAddon}
          </div>
          {right}
        </div>
        {children}
        {(meta1 ?? view.row1) && <div className="item-row-meta item-row-meta-1">{meta1 ?? view.row1}</div>}
        {(meta2 ?? view.row2) && <div className="item-row-meta item-row-meta-2">{meta2 ?? view.row2}</div>}
      </div>
    </div>
  );
}

function normalizeIconPath(path) {
  const raw = String(path || "");
  if (!raw) return raw;
  if (/^(https?:|data:|\/)/i.test(raw)) return raw;
  return raw.startsWith("ressources/") ? raw : `ressources/${raw}`;
}
