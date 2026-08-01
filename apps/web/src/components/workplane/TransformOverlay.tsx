import type { CSSProperties } from "react";
import {
  measureKeyForHandle,
  rotationWheelLocalRadius,
  rotationWheelPoint,
  type TransformOverlayProps,
  type TransformOverlayState,
} from "@/components/workplane/transformOverlayTypes";

export {
  getElevationMeasureKey,
  measureKeyForHandle,
  projectedMoveHandle,
  projectedRotationWheel,
  rotationWheelLocalRadius,
  rotationWheelPoint,
  screenRotationWheel,
  separatedLiftHandlePoint,
  type DimensionMark,
  type EditingDimension,
  type EditingRotation,
  type PinnedRotationWheelView,
  type RotationAxis,
  type RotationReadout,
  type RotationWheelView,
  type TransformHandleKind,
  type TransformOverlayState,
} from "@/components/workplane/transformOverlayTypes";

function annularSectorPath(startRadians: number, endRadians: number, innerRadius: number, outerRadius: number) {
  const delta = endRadians - startRadians;
  const magnitude = Math.min(Math.abs(delta), Math.PI * 2 - 0.0001);
  if (magnitude < 0.0001) {
    return "";
  }
  const direction = delta >= 0 ? 1 : -1;
  const end = startRadians + direction * magnitude;
  const largeArc = magnitude > Math.PI ? 1 : 0;
  const sweep = direction > 0 ? 1 : 0;
  const outerStart = { x: Math.cos(startRadians) * outerRadius, y: Math.sin(startRadians) * outerRadius };
  const outerEnd = { x: Math.cos(end) * outerRadius, y: Math.sin(end) * outerRadius };
  const innerEnd = { x: Math.cos(end) * innerRadius, y: Math.sin(end) * innerRadius };
  const innerStart = { x: Math.cos(startRadians) * innerRadius, y: Math.sin(startRadians) * innerRadius };
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} ${sweep} ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} ${sweep ? 0 : 1} ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

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
  onHoverRotationHandle,
  onLeaveRotationHandle,
  onEditingRotationChange,
  onCommitRotationEdit,
  onCancelRotationEdit,
}: TransformOverlayProps) {
  const marks = measureKey ? (box.dimensions[measureKey] ?? []) : [];
  const visibleMarks = (hideDimensionMarks ? [] : marks).filter((mark) => mark.key !== editingDimension?.key);
  const handleMeasureKey = (handle: TransformOverlayState["handles"][number]) => measureKeyForHandle(handle.kind, handle.key, box);
  const pinnedWheel = pinnedRotationWheelView?.axis === rotationWheelAxis ? pinnedRotationWheelView : null;
  const wheel = pinnedWheel?.wheel ?? box.rotationWheels[rotationWheelAxis] ?? box.rotationWheel;
  const protractorRadius = wheel?.radius ?? 76;
  const protractorInnerRadius = Math.max(18, protractorRadius - 18);
  const zeroRadians = wheel?.zeroRadians ?? -Math.PI / 2;
  const protractorTicks = Array.from({ length: 16 }, (_, index) => {
    const radians = zeroRadians + index * 22.5 * Math.PI / 180;
    const major = index % 2 === 0;
    const outer = protractorRadius;
    const inner = protractorRadius - (major ? 12 : 7);
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
  const activeRadians = zeroRadians + activeAngle * Math.PI / 180;
  const activeLineRadius = Math.max(12, protractorRadius - 5);
  const activeLine = {
    x: Math.cos(activeRadians) * activeLineRadius,
    y: Math.sin(activeRadians) * activeLineRadius,
  };
  const activeSectorPath = wheel && Math.abs(activeAngle) > 0.001
    ? annularSectorPath(zeroRadians, zeroRadians + activeAngle * Math.PI / 180, protractorInnerRadius, protractorRadius)
    : "";
  const zeroLine = {
    x: Math.cos(zeroRadians) * activeLineRadius,
    y: Math.sin(zeroRadians) * activeLineRadius,
  };
  const wheelTransform = wheel?.matrix
    ? `matrix(${wheel.matrix[0]} ${wheel.matrix[1]} ${wheel.matrix[2]} ${wheel.matrix[3]} ${wheel.x} ${wheel.y})`
    : `translate(${wheel?.x ?? 0} ${wheel?.y ?? 0})`;
  const zeroLabelPoint = wheel ? rotationWheelPoint(wheel, 0, protractorRadius + 17) : { x: 0, y: 0 };
  return (
    <div className={`transform-overlay ${hideSelectionChrome ? "hide-selection-chrome" : ""}`} aria-hidden="true">
      {showRotationWheel && wheel ? (
        <svg
          className={`rotation-protractor-plane axis-${rotationWheelAxis}`}
          viewBox={`0 0 ${box.width} ${box.height}`}
          preserveAspectRatio="none"
        >
          <g transform={wheelTransform}>
            <circle className="rotation-protractor-outer" cx="0" cy="0" r={protractorRadius} />
            {Array.from({ length: 16 }, (_, index) => {
              const start = zeroRadians + (index * 22.5 + 0.7) * Math.PI / 180;
              const end = zeroRadians + ((index + 1) * 22.5 - 0.7) * Math.PI / 180;
              return (
                <path
                  key={`segment-${index}`}
                  className={`rotation-protractor-segment ${index % 2 === 0 ? "major" : ""}`}
                  d={annularSectorPath(start, end, protractorInnerRadius, protractorRadius - 1)}
                />
              );
            })}
            {activeSectorPath ? <path className="rotation-active-sector" d={activeSectorPath} /> : null}
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
            <circle className="rotation-protractor-center" cx="0" cy="0" r="3" />
            <line className="rotation-zero-line" x1="0" y1="0" x2={zeroLine.x} y2={zeroLine.y} />
            <line className="rotation-current-line" x1="0" y1="0" x2={activeLine.x} y2={activeLine.y} />
          </g>
          <text className="rotation-zero-label" x={zeroLabelPoint.x} y={zeroLabelPoint.y}>
            0&deg;
          </text>
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
      {box.handles.map((handle) => (
        <button
          key={handle.key}
          className={`transform-handle ${handle.className}`}
          style={{
            "--overlay-x": `${handle.x}px`,
            "--overlay-y": `${handle.y}px`,
            "--move-handle-angle": `${handle.angle ?? 0}deg`,
          } as CSSProperties}
          title={handle.title}
          onPointerEnter={() => onHoverMeasure(handle.kind === "lift" ? null : handleMeasureKey(handle))}
          onPointerLeave={() => onHoverMeasure(null)}
          onPointerDown={(event) => {
            onPinMeasure(handleMeasureKey(handle));
            onBeginTransform(handle.kind, handle.key, event);
          }}
          onPointerMove={(event) => onMoveTransform(event.clientX, event.clientY, event.shiftKey, event.altKey)}
          onPointerUp={onFinishTransform}
          onPointerCancel={onFinishTransform}
          onClick={(event) => {
            if (handle.kind === "lift") {
              event.stopPropagation();
              onBeginLiftEdit(handle.key, handle.x + 42, handle.y - 32);
            }
          }}
        >
          {handle.kind === "move" ? (
            <svg viewBox="0 0 36 18" aria-hidden="true" focusable="false">
              <path d="M5 9h26M25 3l6 6-6 6M11 3 5 9l6 6" />
            </svg>
          ) : null}
        </button>
      ))}
      {box.rotateHandles.map((handle) => (
        <button
          key={handle.key}
          className={`rotate-handle ${handle.className}`}
          style={{
            "--overlay-x": `${handle.x}px`,
            "--overlay-y": `${handle.y}px`,
            "--rotate-handle-angle": `${handle.angle}deg`,
          } as CSSProperties}
          title={`Rotate around ${handle.axis.toUpperCase()} axis`}
          onPointerEnter={() => onHoverRotationHandle(handle.axis)}
          onPointerLeave={onLeaveRotationHandle}
          onPointerDown={(event) => onBeginTransform("rotate", handle.key, event)}
          onPointerMove={(event) => onMoveTransform(event.clientX, event.clientY, event.shiftKey, event.altKey)}
          onPointerUp={onFinishTransform}
          onPointerCancel={onFinishTransform}
          onClick={(event) => {
            event.stopPropagation();
            onBeginRotationEdit(handle.key, handle.editX, handle.editY);
          }}
        >
          <span className="rotate-handle-icon" aria-hidden="true">
            <svg viewBox="0 0 44 44" focusable="false">
              <path className="rotate-arc" d="M8 27 A16 16 0 0 1 30 9" />
              <path className="rotate-arrow" d="M7 18 L7 28 L15 23 Z" />
            </svg>
          </span>
        </button>
      ))}
      {rotationReadout && (!hideDimensionMarks || rotationReadout.text.startsWith("Δ")) ? (
        <div className="rotation-readout" style={{ "--overlay-x": `${rotationReadout.x}px`, "--overlay-y": `${rotationReadout.y}px` } as CSSProperties}>
          {rotationReadout.text}
        </div>
      ) : null}
    </div>
  );
}
