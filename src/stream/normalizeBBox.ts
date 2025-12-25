type RawBBox = [number, number, number, number];

type NormalizedBBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function normalizeBBox(
  bbox: RawBBox,
  frameWidth: number,
  frameHeight: number
): NormalizedBBox | null {
  if(!bbox || !Array.isArray(bbox) || bbox.length < 4) {
    return null;
  }
  if (bbox.length < 4 || frameWidth <= 0 || frameHeight <= 0) {
    return null;
  }

  let [x1, y1, x2, y2] = bbox;

  if (x2 < x1) [x1, x2] = [x2, x1];
  if (y2 < y1) [y1, y2] = [y2, y1];

  const scaleX = 100 / frameWidth;
  const scaleY = 100 / frameHeight;

  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  const round = (v: number) => Math.round(v * 100) / 100;

  return {
    x: round(clamp(x1 * scaleX)),
    y: round(clamp(y1 * scaleY)),
    width: round((x2 - x1) * scaleX),
    height: round((y2 - y1) * scaleY),
  };
}

export default normalizeBBox;

