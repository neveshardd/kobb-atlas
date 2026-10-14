const offsets = [[0, -10]];
for (const distance of [22, 38, 54, 72, 92]) {
  for (const [x, y] of [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) offsets.push([x * distance, y * distance]);
}
export function placeSolarLabels(points, width, height) {
  const occupied = [];
  return points.map(point => {
    if (!point.visible || point.x < -92 || point.x > width + 92 || point.y < -92 || point.y > height + 92) return null;
    for (const [dx, dy] of offsets) {
      const x = point.x + dx, y = point.y + dy;
      const box = { left: x - 21, right: x + 21, top: y - 14, bottom: y + 5 };
      if (box.left < 4 || box.top < 4 || box.right > width - 4 || box.bottom > height - 4) continue;
      if (occupied.some(other => box.left < other.right + 3 && box.right > other.left - 3 && box.top < other.bottom + 3 && box.bottom > other.top - 3)) continue;
      occupied.push(box);
      return { x, y, displaced: dx !== 0 || dy !== -10, box };
    }
    return null;
  });
}
