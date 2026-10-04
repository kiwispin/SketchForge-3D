export type SmartGuideAxis = "x" | "z";

export type SmartGuideDirection = "negative" | "positive";

export type SmartGuideCenter = {
  id: string;
  x: number;
  z: number;
};

export type SmartGuideMatch = {
  axis: SmartGuideAxis;
  referenceId: string;
  movingValue: number;
  referenceValue: number;
  delta: number;
};

export type SmartGuideBounds = SmartGuideCenter & {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type SmartGuideDistanceMatch = {
  axis: SmartGuideAxis;
  direction: SmartGuideDirection;
  referenceId: string;
  gap: number;
  movingEdge: number;
  referenceEdge: number;
};

/**
 * Converts a world-space drag delta into one dominant horizontal direction.
 * A perspective view can produce small movement on both world axes for a
 * visually horizontal pointer drag; reporting both axes makes the feedback
 * noisy and ambiguous, so the larger component wins.
 */
export function dominantSmartGuideDirection(
  deltaX: number,
  deltaZ: number,
  threshold = 0.25,
): Partial<Record<SmartGuideAxis, SmartGuideDirection>> {
  const magnitudeX = Math.abs(deltaX);
  const magnitudeZ = Math.abs(deltaZ);
  if (Math.max(magnitudeX, magnitudeZ) <= threshold) {
    return {};
  }
  if (magnitudeX >= magnitudeZ) {
    return { x: deltaX < 0 ? "negative" : "positive" };
  }
  return { z: deltaZ < 0 ? "negative" : "positive" };
}

/**
 * Finds the closest reference centre on each horizontal workplane axis.
 * `delta` is moving minus reference, so the label can explain which way the
 * dragged object still needs to travel. The caller decides how to draw the
 * match; this function deliberately has no screen or Three.js dependencies.
 */
export function findNearestCenterAlignments(
  moving: SmartGuideCenter,
  references: SmartGuideCenter[],
  tolerance = 1.5,
): SmartGuideMatch[] {
  const matches: SmartGuideMatch[] = [];
  (['x', 'z'] as const).forEach((axis) => {
    const movingValue = moving[axis];
    const candidate = references
      .map((reference) => ({
        reference,
        delta: movingValue - reference[axis],
      }))
      .filter(({ delta }) => Math.abs(delta) <= tolerance)
      .sort((a, b) => {
        const distance = Math.abs(a.delta) - Math.abs(b.delta);
        return distance !== 0 ? distance : a.reference.id.localeCompare(b.reference.id);
      })[0];
    if (!candidate) {
      return;
    }
    matches.push({
      axis,
      referenceId: candidate.reference.id,
      movingValue,
      referenceValue: candidate.reference[axis],
      delta: candidate.delta,
    });
  });
  return matches;
}

type DirectionalEdgeCandidate = SmartGuideDistanceMatch & {
  signedGap: number;
};

function edgeValues(axis: SmartGuideAxis, bounds: SmartGuideBounds) {
  return axis === "x"
    ? { min: bounds.minX, max: bounds.maxX }
    : { min: bounds.minZ, max: bounds.maxZ };
}

function rangesOverlap(first: { min: number; max: number }, second: { min: number; max: number }) {
  return first.max >= second.min && second.max >= first.min;
}

/**
 * Finds the closest reference side in the direction of an active drag.
 *
 * When the moving bounds overlap the reference bounds, the measurement uses
 * the matching outer sides (left-to-left/right-to-right, or front-to-
 * front/back-to-back). That is the important case for a shape being moved
 * inside a larger container. When bounds are separated, it falls back to the
 * opposing edges so the guide remains a useful ordinary gap measurement.
 * Negative signed distances are clamped to zero for display: reaching the
 * side is the useful milestone, and a confusing negative "gap" is avoided.
 */
export function findDirectionalEdgeDistances(
  moving: SmartGuideBounds,
  references: SmartGuideBounds[],
  directions: Partial<Record<SmartGuideAxis, SmartGuideDirection>>,
  maximumDistance = 60,
): SmartGuideDistanceMatch[] {
  const matches: SmartGuideDistanceMatch[] = [];
  (['x', 'z'] as const).forEach((axis) => {
    const direction = directions[axis];
    if (!direction) {
      return;
    }
    const movingEdges = edgeValues(axis, moving);
    const candidate = references
      .map((reference) => {
        const referenceEdges = edgeValues(axis, reference);
        const otherAxis: SmartGuideAxis = axis === "x" ? "z" : "x";
        if (!rangesOverlap(edgeValues(otherAxis, moving), edgeValues(otherAxis, reference))) {
          return null;
        }
        const overlaps = rangesOverlap(movingEdges, referenceEdges);
        let movingEdge: number;
        let referenceEdge: number;
        let signedGap: number;
        if (direction === "negative") {
          if (overlaps) {
            movingEdge = movingEdges.min;
            referenceEdge = referenceEdges.min;
            signedGap = movingEdge - referenceEdge;
          } else if (movingEdges.min > referenceEdges.max) {
            movingEdge = movingEdges.min;
            referenceEdge = referenceEdges.max;
            signedGap = movingEdge - referenceEdge;
          } else {
            movingEdge = movingEdges.max;
            referenceEdge = referenceEdges.min;
            signedGap = referenceEdge - movingEdge;
          }
        } else if (overlaps) {
          movingEdge = movingEdges.max;
          referenceEdge = referenceEdges.max;
          signedGap = referenceEdge - movingEdge;
        } else if (movingEdges.max < referenceEdges.min) {
          movingEdge = movingEdges.max;
          referenceEdge = referenceEdges.min;
          signedGap = referenceEdge - movingEdge;
        } else {
          movingEdge = movingEdges.min;
          referenceEdge = referenceEdges.max;
          signedGap = movingEdge - referenceEdge;
        }
        return {
          axis,
          direction,
          referenceId: reference.id,
          gap: Math.max(0, signedGap),
          movingEdge,
          referenceEdge,
          signedGap,
        } satisfies DirectionalEdgeCandidate;
      })
      .filter((value): value is DirectionalEdgeCandidate => Boolean(value && value.gap <= maximumDistance))
      .sort((a, b) => {
        const distance = a.gap - b.gap;
        if (distance !== 0) {
          return distance;
        }
        const signedDistance = Math.abs(a.signedGap) - Math.abs(b.signedGap);
        return signedDistance !== 0 ? signedDistance : a.referenceId.localeCompare(b.referenceId);
      })[0];
    if (!candidate) {
      return;
    }
    matches.push({
      axis,
      direction,
      referenceId: candidate.referenceId,
      gap: candidate.gap,
      movingEdge: candidate.movingEdge,
      referenceEdge: candidate.referenceEdge,
    });
  });
  return matches;
}

/**
 * Backwards-compatible helper for callers that need the old, non-directional
 * separated-gap behaviour. New drag feedback should use
 * `findDirectionalEdgeDistances` so overlapping/container cases are covered.
 */
export function findNearestEdgeDistances(
  moving: SmartGuideBounds,
  references: SmartGuideBounds[],
  maximumGap = 30,
): SmartGuideDistanceMatch[] {
  const matches: SmartGuideDistanceMatch[] = [];
  (['x', 'z'] as const).forEach((axis) => {
    const movingEdges = edgeValues(axis, moving);
    const candidate = references
      .map((reference) => {
        const referenceEdges = edgeValues(axis, reference);
        if (movingEdges.max < referenceEdges.min) {
          return {
            axis,
            direction: "positive" as const,
            referenceId: reference.id,
            gap: referenceEdges.min - movingEdges.max,
            movingEdge: movingEdges.max,
            referenceEdge: referenceEdges.min,
          };
        }
        if (referenceEdges.max < movingEdges.min) {
          return {
            axis,
            direction: "negative" as const,
            referenceId: reference.id,
            gap: movingEdges.min - referenceEdges.max,
            movingEdge: movingEdges.min,
            referenceEdge: referenceEdges.max,
          };
        }
        return null;
      })
      .filter((value): value is SmartGuideDistanceMatch => Boolean(value && value.gap > 0.000001 && value.gap <= maximumGap))
      .sort((a, b) => {
        const distance = a.gap - b.gap;
        return distance !== 0 ? distance : a.referenceId.localeCompare(b.referenceId);
      })[0];
    if (candidate) {
      matches.push(candidate);
    }
  });
  return matches;
}
