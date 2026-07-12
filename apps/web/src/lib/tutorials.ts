import type { WorkplaneShape } from "@/types/sketchforge";

// Scalar aggregates of the current scene. Chosen so each tutorial step check is
// a simple delta against a baseline captured when the step began — this keeps the
// checks robust and lets them be unit-tested without the 3D editor.
export type TutorialSignals = {
  shapeCount: number;
  solidCount: number;
  holeCount: number;
  groupCount: number;
  rotatedCount: number;
  /** Summed width+depth+height across shapes; any resize changes it. */
  dimensionFingerprint: number;
};

function isRotated(shape: WorkplaneShape): boolean {
  return (shape.rotation ?? 0) !== 0 || (shape.rotationX ?? 0) !== 0 || (shape.rotationZ ?? 0) !== 0;
}

export function computeTutorialSignals(shapes: WorkplaneShape[]): TutorialSignals {
  let solidCount = 0;
  let holeCount = 0;
  let groupCount = 0;
  let rotatedCount = 0;
  let dimensionFingerprint = 0;
  for (const shape of shapes) {
    if (shape.hole) {
      holeCount += 1;
    } else {
      solidCount += 1;
    }
    if ((shape.groupedShapes?.length ?? 0) > 0) {
      groupCount += 1;
    }
    if (isRotated(shape)) {
      rotatedCount += 1;
    }
    dimensionFingerprint += (shape.width ?? 0) + (shape.depth ?? 0) + (shape.height ?? 0);
  }
  return {
    shapeCount: shapes.length,
    solidCount,
    holeCount,
    groupCount,
    rotatedCount,
    // Round to tame floating-point drift so equality comparisons are stable.
    dimensionFingerprint: Math.round(dimensionFingerprint * 1000) / 1000,
  };
}

export type TutorialStepCheck = (now: TutorialSignals, atStart: TutorialSignals) => boolean;

export type TutorialStep = {
  id: string;
  title: string;
  body: string;
  hint?: string;
  /** When present, the step auto-advances once this returns true. Absent = manual Next only. */
  check?: TutorialStepCheck;
};

export type Tutorial = {
  id: string;
  title: string;
  description: string;
  steps: TutorialStep[];
};

const learnTheBasics: Tutorial = {
  id: "learn-the-basics",
  title: "Learn the basics",
  description: "Place a shape, resize it, rotate it, turn one into a hole, and group them to cut. The five moves every design uses.",
  steps: [
    {
      id: "welcome",
      title: "Welcome to SketchForge",
      body: "This quick tutorial teaches the five core moves. Do each action in the workspace on the right — the panel moves on automatically when you get it. You can leave any time with the ✕.",
    },
    {
      id: "place",
      title: "Place a shape",
      body: "Open the Shapes menu in the toolbar and add a Box to the workplane.",
      hint: "Toolbar → Shapes (the shapes icon) → Box.",
      check: (now, atStart) => now.shapeCount > atStart.shapeCount,
    },
    {
      id: "resize",
      title: "Resize it",
      body: "Make the box a different size. Drag one of the white resize handles, or type a new dimension in the shape's fields.",
      hint: "Grab a corner or side handle and drag.",
      check: (now, atStart) => now.dimensionFingerprint !== atStart.dimensionFingerprint,
    },
    {
      id: "rotate",
      title: "Rotate it",
      body: "Spin the shape using a curved rotate handle so it sits at an angle.",
      hint: "The curved arrows around the shape rotate it.",
      check: (now, atStart) => now.rotatedCount > atStart.rotatedCount,
    },
    {
      id: "hole",
      title: "Make a hole",
      body: "Add a second shape, then mark it as a Hole. Holes carve material out of solids when grouped.",
      hint: "Add another shape, select it, then choose Hole.",
      check: (now, atStart) => now.holeCount > atStart.holeCount,
    },
    {
      id: "group",
      title: "Group to cut",
      body: "Select everything (Ctrl/Cmd+A) and press Group. The hole cuts through the solid to make one combined object.",
      hint: "Select all, then the Group button in the toolbar.",
      check: (now, atStart) => now.groupCount > atStart.groupCount,
    },
    {
      id: "done",
      title: "You've learned the moves!",
      body: "Place, resize, rotate, hole, and group are the foundation of every SketchForge model. Press Finish to keep exploring on your own — this design is saved for you.",
    },
  ],
};

export const tutorials: Tutorial[] = [learnTheBasics];

export function getTutorial(id: string | null | undefined): Tutorial | null {
  if (!id) return null;
  return tutorials.find((tutorial) => tutorial.id === id) ?? null;
}
