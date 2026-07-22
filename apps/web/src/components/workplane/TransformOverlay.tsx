import { useState, type CSSProperties } from "react";
import * as THREE from "three";
import {
  measureKeyForHandle,
  type GizmoAxis,
  type TransformOverlayProps,
  type TransformOverlayState,
} from "@/components/workplane/transformOverlayTypes";

function gizmoAxisForHandle(handle: TransformOverlayState["handles"][number]): GizmoAxis | null {
  if (handle.kind === "lift") return "y";
  if (handle.key === "move-x") return "x";
  if (handle.key === "move-z") return "z";
  return null;
}

export {
  getElevationMeasureKey,
  measureKeyForHandle,
  projectedMoveHandle,
  separatedLiftHandlePoint,
  type DimensionMark,
  type EditingDimension,
  type EditingRotation,
  type GizmoAxis,
  type PinnedRotationWheelView,
  type RotationAxis,
  type RotationPlaneView,
  type RotationReadout,
  type RotationWheelView,
  type TransformHandleKind,
  type TransformOverlayState,
} from "@/components/workplane/transformOverlayTypes";

export function TransformOverlay({
  box,
  measureKey,
  editingDimension,
  editingRotation,
  rotationReadout,
  showRotationWheel,
  hideSelectionChrome,
  hideDimensionMarks,
  rotationWheelAxis,
  pinnedRotationWheelView,
  onBeginTransform,
  onMoveTransform,
  onFinishTransform,
  onHoverMeasure,
  onPinMeasure,
  onBeginDimensionEdit,
  onBeginLiftEdit,
  onEditingDimensionChange,
  onCommitDimensionEdit,
  onCancelDimensionEdit,
  onBeginRotationEdit,
  onEditingRotationChange,
  onCommitRotationEdit,
  onCancelRotationEdit,
}: TransformOverlayProps) {
  const [hoveredGizmoAxis, setHoveredGizmoAxis] = useState<GizmoAxis | null>(null);
  const [hoveredRotateKey, setHoveredRotateKey] = useState<string | null>(null);
  const marks = measureKey ? (box.dimensions[measureKey] ?? []) : [];
  const visibleMarks = (hideDimensionMarks ? [] : marks).filter((mark) => mark.key !== editingDimension?.key);
  const handleMeasureKey = (handle: TransformOverlayState["handles"][number]) => measureKeyForHandle(handle.kind, handle.key, box);
  const protractorTicks = Array.from({ length: 16 }, (_, index) => {
    const degrees = index * 22.5 - 90;
    const radians = THREE.MathUtils.degToRad(degrees);
    const major = index % 2 === 0;
    const outer = 94;
    const inner = major ? 80 : 86;
    return {
      key: `tick-${index}`,
      major,
      x1: Math.cos(radians) * inner,
      y1: Math.sin(radians) * inner,
      x2: Math.cos(radians) * outer,
      y2: Math.sin(radians) * outer,
    };
  });
  const activeAngle = rotationReadout?.angle ?? 0;
  const activeRadians = THREE.MathUtils.degToRad(activeAngle - 90);
  const activeLine = {
    x: Math.cos(activeRadians) * 92,
    y: Math.sin(activeRadians) * 92,
  };
  const pinnedWheel = pinnedRotationWheelView?.axis === rotationWheelAxis ? pinnedRotationWheelView : null;
  const plane = pinnedWheel?.plane ?? box.rotationPlanes[rotationWheelAxis];
  const wheel = pinnedWheel?.wheel ?? box.rotationWheels[rotationWheelAxis] ?? box.rotationWheel;
  return (
    <div className={`transform-overlay ${hideSelectionChrome ? "hide-selection-chrome" : ""}`} aria-hidden="true">
      {showRotationWheel && wheel && plane ? (
        <svg
          className={`rotation-protractor-plane axis-${rotationWheelAxis}`}
          viewBox={`0 0 ${box.width} ${box.height}`}
          preserveAspectRatio="none"
          onPointerDown={(event) => onBeginTransform("rotate", `rotate-wheel-${rotationWheelAxis}`, event)}
          onPointerMove={(event) => onMoveTransform(event.clientX, event.clientY, event.shiftKey, event.altKey)}
          onPointerUp={onFinishTransform}
          onPointerCancel={onFinishTransform}
        >
          <g transform={`matrix(${plane.a} ${plane.b} ${plane.c} ${plane.d} ${plane.x} ${plane.y})`}>
            <circle className="rotation-protractor-outer" cx="0" cy="0" r="94" />
            <circle className="rotation-protractor-inner" cx="0" cy="0" r="68" />
            {protractorTicks.map((tick) => (
              <line
                key={tick.key}
                className={tick.major ? "rotation-tick major" : "rotation-tick"}
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
              />
            ))}
            <line className="rotation-zero-line" x1="0" y1="0" x2="0" y2="-92" />
            <line className="rotation-current-line" x1="0" y1="0" x2={activeLine.x} y2={activeLine.y} />
            <text className="rotation-zero-label" x="0" y="-75">
              0&deg;
            </text>
          </g>
        </svg>
      ) : null}
      <svg className="transform-guides" viewBox={`0 0 ${box.width} ${box.height}`} preserveAspectRatio="none">
        <defs>
          <marker id="dimension-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M0 4 L8 0 L5.2 4 L8 8 Z" />
          </marker>
        </defs>
        {box.guides.map((line, index) => (
          <line key={`guide-${index}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
        ))}
        {visibleMarks.map((mark) => (
          <g key={mark.key} className="dimension-mark">
            <line className="dimension-extension" x1={mark.e1x1} y1={mark.e1y1} x2={mark.e1x2} y2={mark.e1y2} />
            <line className="dimension-extension" x1={mark.e2x1} y1={mark.e2y1} x2={mark.e2x2} y2={mark.e2y2} />
            <line className="dimension-line" x1={mark.x1} y1={mark.y1} x2={mark.x2} y2={mark.y2} />
          </g>
        ))}
        {(box.axisShafts ?? []).map((shaft) => (
          <g key={`gizmo-shaft-${shaft.axis}`}>
            <line className="gizmo-shaft-casing" x1={shaft.x1} y1={shaft.y1} x2={shaft.x2} y2={shaft.y2} />
            <line
              className={`gizmo-shaft gizmo-axis-${shaft.axis} ${hoveredGizmoAxis === shaft.axis ? "hovered" : ""}`}
              x1={shaft.x1}
              y1={shaft.y1}
              x2={shaft.x2}
              y2={shaft.y2}
            />
          </g>
        ))}
        {(box.rotateArcs ?? []).map((arc) => (
          <g key={`rotate-arc-${arc.key}`} className={`rotate-gizmo-arc ${hoveredRotateKey === arc.key ? "hovered" : ""}`}>
            <path className="rotate-gizmo-arc-casing" d={arc.d} />
            <path className="rotate-gizmo-head-casing" d={arc.arrow1} />
            <path className="rotate-gizmo-head-casing" d={arc.arrow2} />
            <path className="rotate-gizmo-arc-fg" d={arc.d} />
            <path className="rotate-gizmo-head-fg" d={arc.arrow1} />
            <path className="rotate-gizmo-head-fg" d={arc.arrow2} />
          </g>
        ))}
      </svg>
      {visibleMarks.map((mark) => (
        <button
          key={`${mark.key}-label`}
          className="dimension-label"
          type="button"
          style={{ "--overlay-x": `${mark.labelX}px`, "--overlay-y": `${mark.labelY}px` } as CSSProperties}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onBeginDimensionEdit(mark)}
        >
          {mark.label}
        </button>
      ))}
      {editingDimension ? (
        <input
          className="dimension-input"
          style={{ "--overlay-x": `${editingDimension.x}px`, "--overlay-y": `${editingDimension.y}px` } as CSSProperties}
          value={editingDimension.value}
          autoFocus
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => onEditingDimensionChange(event.target.value)}
          onBlur={onCommitDimensionEdit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onCommitDimensionEdit();
            }
            if (event.key === "Escape") {
              onCancelDimensionEdit();
            }
          }}
        />
      ) : null}
      {editingRotation ? (
        <label className="rotation-edit" style={{ "--overlay-x": `${editingRotation.x}px`, "--overlay-y": `${editingRotation.y}px` } as CSSProperties}>
          <input
            value={editingRotation.value}
            autoFocus
            inputMode="decimal"
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => onEditingRotationChange(event.target.value)}
            onBlur={onCommitRotationEdit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onCommitRotationEdit();
              }
              if (event.key === "Escape") {
                onCancelRotationEdit();
              }
            }}
          />
          <span>&deg;</span>
        </label>
      ) : null}
      {box.handles.map((handle) => {
        const gizmoAxis = gizmoAxisForHandle(handle);
        return (
          <button
            key={handle.key}
            className={`transform-handle ${handle.className} ${gizmoAxis && hoveredGizmoAxis === gizmoAxis ? "gizmo-hovered" : ""}`}
            style={{
              "--overlay-x": `${handle.x}px`,
              "--overlay-y": `${handle.y}px`,
              "--move-handle-angle": `${handle.angle ?? 0}deg`,
            } as CSSProperties}
            title={handle.title}
            onPointerEnter={() => {
              setHoveredGizmoAxis(gizmoAxis);
              onHoverMeasure(handle.kind === "lift" ? null : handleMeasureKey(handle));
            }}
            onPointerLeave={() => {
              setHoveredGizmoAxis(null);
              onHoverMeasure(null);
            }}
            onPointerDown={(event) => {
              setHoveredGizmoAxis(gizmoAxis);
              onPinMeasure(handleMeasureKey(handle));
              onBeginTransform(handle.kind, handle.key, event);
            }}
            onPointerMove={(event) => onMoveTransform(event.clientX, event.clientY, event.shiftKey, event.altKey)}
            onPointerUp={(event) => {
              setHoveredGizmoAxis(null);
              onFinishTransform(event);
            }}
            onPointerCancel={(event) => {
              setHoveredGizmoAxis(null);
              onFinishTransform(event);
            }}
            onClick={(event) => {
              if (handle.kind === "lift") {
                event.stopPropagation();
                onBeginLiftEdit(handle.key, handle.x + 42, handle.y - 32);
              }
            }}
          >
            {handle.kind === "move" || handle.kind === "lift" ? (
              <svg className="gizmo-cone" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4 5.5 21 12 4 18.5 Z" />
              </svg>
            ) : null}
          </button>
        );
      })}
      {box.rotateHandles.map((handle) => (
        <button
          key={handle.key}
          className={`rotate-handle ${handle.className}`}
          style={{ "--overlay-x": `${handle.x}px`, "--overlay-y": `${handle.y}px`, "--rotate-handle-angle": `${handle.angle}deg` } as CSSProperties}
          title="Rotate"
          onPointerEnter={() => setHoveredRotateKey(handle.key)}
          onPointerLeave={() => setHoveredRotateKey(null)}
          onPointerDown={(event) => {
            setHoveredRotateKey(handle.key);
            onBeginTransform("rotate", handle.key, event);
          }}
          onPointerMove={(event) => onMoveTransform(event.clientX, event.clientY, event.shiftKey, event.altKey)}
          onPointerUp={(event) => {
            setHoveredRotateKey(null);
            onFinishTransform(event);
          }}
          onPointerCancel={(event) => {
            setHoveredRotateKey(null);
            onFinishTransform(event);
          }}
          onClick={(event) => {
            event.stopPropagation();
            onBeginRotationEdit(handle.key, handle.x + 34, handle.y - 28);
          }}
        />
      ))}
      {!hideDimensionMarks && rotationReadout ? (
        <div className="rotation-readout" style={{ "--overlay-x": `${rotationReadout.x}px`, "--overlay-y": `${rotationReadout.y}px` } as CSSProperties}>
          {rotationReadout.text}
        </div>
      ) : null}
    </div>
  );
}
