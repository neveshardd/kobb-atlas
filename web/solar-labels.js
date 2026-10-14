export function placeSolarLabels(points, width, height) {
  const occupied = [], placements = points.map(() => null);
  const ordered = points.map((point, index) => ({ point, index })).sort((a, b) => a.point.y - b.point.y || b.index - a.index);
  for (const { point, index } of ordered) {
    if (!point.visible) continue;
    const box = { left: point.x - 20, right: point.x + 20, top: point.y - 8, bottom: point.y + 8 };
    if (box.left < 4 || box.top < 4 || box.right > width - 4 || box.bottom > height - 4) continue;
    if (occupied.some(other => box.left < other.right + 3 && box.right > other.left - 3 && box.top < other.bottom + 3 && box.bottom > other.top - 3)) continue;
    occupied.push(box);
    placements[index] = { x: point.x, y: point.y, box };
  }
  return placements;
}
