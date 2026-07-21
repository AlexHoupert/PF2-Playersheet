/**
 * ItemDetailContent - Reusable component for displaying item details
 * Can be used standalone in editor preview or wrapped in a modal
 */
import { parseFoundry } from '../utils/foundryParser';
import { isArmorOrShieldItem, readItemArmorStats } from '../catalog/itemArmorStats';

// Rarity colors for item names
const RARITY_COLORS = {
    common: '#e0e0e0',
    uncommon: '#66bb6a',
    rare: '#42a5f5',
    unique: '#ffca28'
};

export default function ItemDetailContent({
    item,
    isLoading = false,
    loadError = null,
    showImage = true,
    compact = false
}) {
    if (!item) return <div style={{ color: '#888', padding: 20 }}>No item selected</div>;

    const name = item.name || 'Unknown Item';
    const rarity = (item.rarity || item.traits?.rarity || 'common').toLowerCase();
    const rarityColor = RARITY_COLORS[rarity] || RARITY_COLORS.common;
    const level = item.level;
    const price = item.price;
    const bulk = item.bulk;
    const traits = item.traits?.value || item.traits || [];
    const description = item.description || item.system?.description?.value || '';
    const type = item.type || '';
    const category = item.category || '';
    const group = item.group || '';
    const range = item.range;
    const damage = item.damage;
    const extraDamage = item.extraDamage || item.system?.extraDamage || [];
    const img = item.img;
    const armorStats = readItemArmorStats(item);

    // Format damage string
    const formatDamage = (dmg) => {
        if (!dmg || !dmg.die) return null;
        let result = `${dmg.dice || 1}${dmg.die}`;
        if (dmg.damageType) result += ` ${dmg.damageType}`;
        if (dmg.persistent) {
            result += ` plus ${dmg.persistent.number || 1}${dmg.persistent.faces ? `d${dmg.persistent.faces}` : ''} persistent ${dmg.persistent.type}`;
        }
        return result;
    };

    // Format all damages (primary + extras)
    const formatAllDamages = () => {
        const parts = [];
        if (damage && damage.die) {
            parts.push(formatDamage(damage));
        }
        if (Array.isArray(extraDamage)) {
            extraDamage.forEach(ed => {
                const formatted = formatDamage(ed);
                if (formatted) parts.push(formatted);
            });
        }
        return parts.length > 0 ? parts.join(' + ') : null;
    };

    // Get image URL
    const getImageUrl = (imgPath) => {
        if (!imgPath) return null;
        const baseUrl = import.meta.env.PROD ? '' : '/api/static';
        const cleanPath = imgPath.replace('systems/pf2e/', '').replace(/^\//, '');
        return `${baseUrl}/${cleanPath}`;
    };

    const metaItems = [];
    if (level !== undefined && level !== null) metaItems.push({ label: 'Level', value: level });
    if (rarity && rarity !== 'common') metaItems.push({ label: 'Rarity', value: rarity, color: rarityColor, capitalize: true });
    if (price) metaItems.push({ label: 'Price', value: `${price} gp` });
    if (bulk !== undefined && bulk !== null && bulk !== '') metaItems.push({ label: 'Bulk', value: bulk });
    if (range) metaItems.push({ label: 'Range', value: `${range} ft` });
    if (isArmorOrShieldItem(item) && armorStats.acBonus !== null) {
        metaItems.push({ label: 'AC Bonus', value: formatSigned(armorStats.acBonus) });
    }
    if (isArmorOrShieldItem(item) && armorStats.dexCap !== null) {
        metaItems.push({ label: 'Dex Cap', value: String(armorStats.dexCap) });
    }

    const allDamagesStr = formatAllDamages();
    if (allDamagesStr) metaItems.push({ label: 'Damage', value: allDamagesStr });

    return (
        <div className="item-detail-content" style={{ color: '#e0e0e0' }}>
            <style>{`
                .item-detail-content .trait-badge {
                    display: inline-block;
                    background: #000;
                    border: 1px solid #444;
                    padding: 1px 6px;
                    font-size: 0.75em;
                    text-transform: uppercase;
                    margin-right: 5px;
                    margin-bottom: 5px;
                    border-radius: 3px;
                    color: #ccc;
                }
                .item-detail-content .meta-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
                    gap: 10px;
                    margin-bottom: 15px;
                    padding: 10px 0;
                    border-bottom: 1px solid #444;
                }
                .item-detail-content .meta-item {
                    display: flex;
                    flex-direction: column;
                }
                .item-detail-content .meta-label {
                    font-size: 0.7em;
                    color: #888;
                    text-transform: uppercase;
                    margin-bottom: 2px;
                }
                .item-detail-content .meta-val {
                    font-size: 0.95em;
                    color: #e0e0e0;
                    font-weight: bold;
                }
                .item-detail-content .formatted-content p { margin: 0.5em 0; }
                .item-detail-content .formatted-content ul, 
                .item-detail-content .formatted-content ol { margin: 0.5em 0; padding-left: 20px; }
                .item-detail-content .formatted-content { line-height: 1.5; font-size: 0.9em; }
            `}</style>

            {/* Header with optional image */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                {showImage && img && (
                    <img
                        src={getImageUrl(img)}
                        alt=""
                        style={{
                            width: compact ? 40 : 48,
                            height: compact ? 40 : 48,
                            borderRadius: 4,
                            objectFit: 'contain',
                            background: '#111',
                            flexShrink: 0
                        }}
                        onError={e => e.target.style.display = 'none'}
                    />
                )}
                <div style={{ flex: 1 }}>
                    <h3 style={{
                        margin: 0,
                        color: rarityColor,
                        fontSize: compact ? '1em' : '1.2em'
                    }}>
                        {name}
                    </h3>
                    {type && (
                        <div style={{ color: '#888', fontSize: '0.8em', marginTop: 2 }}>
                            {type}{category ? ` • ${category}` : ''}{group ? ` • ${group}` : ''}
                        </div>
                    )}
                </div>
            </div>

            {/* Traits */}
            {traits.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                    {traits.map(t => <span key={t} className="trait-badge">{t}</span>)}
                </div>
            )}

            {/* Meta Grid */}
            {metaItems.length > 0 && (
                <div className="meta-grid">
                    {metaItems.map((m, i) => (
                        <div key={i} className="meta-item">
                            <span className="meta-label">{m.label}</span>
                            <span className="meta-val" style={{
                                color: m.color || '#e0e0e0',
                                textTransform: m.capitalize ? 'capitalize' : 'none'
                            }}>
                                {m.value}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Description */}
            {isLoading ? (
                <div style={{ color: '#888', fontStyle: 'italic' }}>Loading item details…</div>
            ) : loadError ? (
                <div style={{ color: '#f44336' }}>Failed to load: {loadError}</div>
            ) : description ? (
                <div
                    className="formatted-content"
                    dangerouslySetInnerHTML={{ __html: parseFoundry(description) }}
                />
            ) : (
                <div style={{ color: '#666', fontStyle: 'italic' }}>No description available.</div>
            )}
        </div>
    );
}

function formatSigned(value) {
    return Number(value) >= 0 ? `+${value}` : String(value);
}
