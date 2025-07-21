export default function layoutTooltips(ellipses, maxWidth, maxHeight) {
  const rectPositions = new Array(ellipses.length).fill(0).map(() => [])
  const circleSegments = 32;
  const slideSegments = 8;
  const step = Math.PI * 2 / circleSegments;
  const quarterSize = circleSegments / 4;

  for (let i = 0; i < ellipses.length; ++i) {
    const { cx: cx, cy: cy, rx, ry, rectWidth, rectHeight } = ellipses[i];
    const rectHalfWidth = rectWidth / 2;
    const rectHalfHeight = rectHeight / 2;

    const addRectIfValid = (cx, cy, color) => {
      const l = cx - rectHalfWidth;
      const r = cx + rectHalfWidth;
      const t = cy - rectHalfHeight;
      const b = cy + rectHalfHeight;
      if (l >= 0 && r < maxWidth && b >= 0 && t < maxHeight) {
        const rect = { x: cx, y: cy, w: rectWidth, h: rectHeight, l: l, t: t, color: color };
        let valid = true;
        for (let j = 0; j < ellipses.length; j++) {
          if (i == j) continue;
          if (ellipseRectOverlap(ellipses[j], rect)) {
            valid = false;
            break;
          }
        }

        if (valid) rectPositions[i].push(rect)
      }
    }

    for (let seg = 0; seg < circleSegments; ++seg) {
      if (seg % quarterSize == 0) {
        const quarter = seg / quarterSize;
        if (quarter == 0) {
          // Slide along the top of the ellipse
          for (let slide = 0; slide < slideSegments; ++slide) {
            const dx = slide * rectWidth / slideSegments - (rectHalfWidth);
            addRectIfValid(cx + dx, cy - ry - rectHalfHeight, 0);
          }
        } else if (quarter == 1) {
          // Slide along the right of the ellipse
          for (let slide = 0; slide < slideSegments; ++slide) {
            const dy = slide * rectHeight / slideSegments - (rectHalfHeight);
            addRectIfValid(cx + rx + rectHalfWidth, cy + dy, 1);
          }
        } else if (quarter == 2) {
          // Slide along the bottom of the ellipse
          for (let slide = 0; slide < slideSegments; ++slide) {
            const dx = slide * rectWidth / slideSegments - (rectHalfWidth);
            addRectIfValid(cx + dx, cy + ry + rectHalfHeight, 2);
          }
        } else {
          // Slide along the left of the ellipse
          for (let slide = 0; slide < slideSegments; ++slide) {
            const dy = slide * rectHeight / slideSegments - (rectHalfHeight);
            addRectIfValid(cx - rx - rectHalfWidth, cy + dy, 3);
          }
        }
      } else {
        const a = rx;
        const b = ry;
        const theta = seg * step;
        const cosTheta = Math.cos(theta)
        const sinTheta = Math.sin(theta)
        const r = a * b / Math.sqrt(Math.pow(b * cosTheta, 2) + Math.pow(a * sinTheta, 2))

        const x = cx + r * cosTheta;
        const y = cy + r * sinTheta;

        if (x > cx) {
          if (y > cy) {
            // Anchor is top left of rect, bottom right of ellipse
            addRectIfValid(x + rectHalfWidth, y + rectHalfHeight, 4)
          } else {
            // Anchor is bottom left of rect, bottom right of ellipse
            addRectIfValid(x + rectHalfWidth, y - rectHalfHeight, 5)
          }
        } else {
          if (y > cy) {
            // Anchor is top left of rect, bottom right of ellipse
            addRectIfValid(x - rectHalfWidth, y + rectHalfHeight, 6)
          } else {
            // Anchor is bottom left of rect, bottom right of ellipse
            addRectIfValid(x - rectHalfWidth, y - rectHalfHeight, 7)
          }
        }
      }
    }
  }

  const stack = [{ rects: [] }]

  while (stack.length != 0) {
    const curr = stack.pop();

    if (curr.rects.length == rectPositions.length) {
      return curr.rects;
    }

    for (let i = 0; i < rectPositions[curr.rects.length].length; ++i) {
      const candidate = rectPositions[curr.rects.length][i]

      let valid = true;
      for (let iExisting = 0; iExisting < curr.rects.length; ++iExisting) {
        const existing = curr.rects[iExisting]
        if (rectsOverlap(candidate, existing)) {
          valid = false;
          break;
        }
      }

      if (valid) {
        stack.push({ rects: [...curr.rects, candidate] })
      }
    }
  }

  return [];
}

function ellipseRectOverlap(ellipse, rect) {
  // Ellipse params
  const ex = ellipse.cx;
  const ey = ellipse.cy;
  const rx = ellipse.rx;
  const ry = ellipse.ry;

  // Rectangle params (center-based)
  const cx = rect.x;
  const cy = rect.y;
  const w = rect.w;
  const h = rect.h;

  // Half sizes for rect
  const halfW = w / 2;
  const halfH = h / 2;

  // Find closest point on rect to ellipse center
  const closestX = Math.max(cx - halfW, Math.min(ex, cx + halfW));
  const closestY = Math.max(cy - halfH, Math.min(ey, cy + halfH));

  // Compute normalized distances from ellipse center
  const normX = (closestX - ex) / rx;
  const normY = (closestY - ey) / ry;

  // Check ellipse equation: (x^2 / rx^2) + (y^2 / ry^2) <= 1
  return (normX * normX + normY * normY) <= 1;
}

function rectsOverlap(rectA, rectB) {
  const halfWidthA = rectA.w / 2;
  const halfHeightA = rectA.h / 2;
  const halfWidthB = rectB.w / 2;
  const halfHeightB = rectB.h / 2;

  const leftA = rectA.x - halfWidthA;
  const rightA = rectA.x + halfWidthA;
  const topA = rectA.y - halfHeightA;
  const bottomA = rectA.y + halfHeightA;

  const leftB = rectB.x - halfWidthB;
  const rightB = rectB.x + halfWidthB;
  const topB = rectB.y - halfHeightB;
  const bottomB = rectB.y + halfHeightB;

  // If one rectangle is to the left of the other
  if (rightA < leftB || rightB < leftA) {
    return false;
  }

  // If one rectangle is above the other
  if (bottomA < topB || bottomB < topA) {
    return false;
  }

  // Otherwise, they overlap
  return true;
}

const ellipses = [
  {
    cx: 100,
    cy: 150,
    rx: 50,
    ry: 30,
    rectWidth: 100,
    rectHeight: 50,
  },
  {
    cx: 300,
    cy: 200,
    rx: 80,
    ry: 40,
    rectWidth: 100,
    rectHeight: 50,
  },
];

layoutTooltips(ellipses)
