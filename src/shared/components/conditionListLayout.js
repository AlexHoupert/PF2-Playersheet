export function shouldUseCompactAddButton({ containerWidth, itemWidths, fullWidth, compactWidth, gap }) {
    if (!containerWidth || !itemWidths.length || !fullWidth || !compactWidth) return false;

    let lineWidth = 0;
    itemWidths.forEach((width) => {
        const nextWidth = lineWidth === 0 ? width : lineWidth + gap + width;
        lineWidth = nextWidth <= containerWidth ? nextWidth : width;
    });

    const widthWith = (buttonWidth) => lineWidth + gap + buttonWidth;
    return widthWith(fullWidth) > containerWidth && widthWith(compactWidth) <= containerWidth;
}
