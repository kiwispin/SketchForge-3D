import type { CSSProperties } from "react";
import type { AlignAxis, AlignHandleStatus, AlignTarget } from "@/types/sketchforge";
import type { SmartGuideAxis } from "@/lib/smartGuides";

export type SmartGuideOverlayState = {
  guides: Array<{
    key: string;
    axis: SmartGuideAxis;
    kind: "center" | "distance";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    labelX: number;
    labelY: number;
    label: string;
  }>;
};

export type AlignOverlayState = {
  guides: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }>;
  handles: Array<AlignHandleStatus & { key: string; x: number; y: number }>;
};

export type MirrorOverlayState = {
  guides: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }>;
  handles: Array<{ axis: AlignAxis; key: string; x: number; y: number; angle: number; title: string }>;
};

export function SmartGuideOverlay({ overlay }: { overlay: SmartGuideOverlayState }) {
  return (
    <div className="smart-guide-overlay" aria-label="Smart alignment guides">
      <svg className="smart-guide-guides" width="100%" height="100%" aria-hidden="true">
        {overlay.guides.map((guide) => (
          <line key={guide.key} className={`axis-${guide.axis} ${guide.kind}`} x1={guide.x1} y1={guide.y1} x2={guide.x2} y2={guide.y2} />
        ))}
      </svg>
      {overlay.guides.map((guide) => (
        <span key={`${guide.key}-label`} className={`smart-guide-label axis-${guide.axis} ${guide.kind}`} style={{ left: guide.labelX, top: guide.labelY }}>
          {guide.label}
        </span>
      ))}
    </div>
  );
}

export function AlignOverlay({
  overlay,
  onAlign,
  onPreview,
  onPreviewClear,
}: {
  overlay: AlignOverlayState;
  onAlign: (axis: AlignAxis, target: AlignTarget) => void;
  onPreview: (axis: AlignAxis, target: AlignTarget) => void;
  onPreviewClear: () => void;
}) {
  return (
    <div className="align-overlay" aria-label="Alignment handles">
      <svg className="align-guides" width="100%" height="100%" aria-hidden="true">
        {overlay.guides.map((guide) => (
          <line key={guide.key} x1={guide.x1} y1={guide.y1} x2={guide.x2} y2={guide.y2} />
        ))}
      </svg>
      {overlay.handles.map((handle) => (
        <button
          key={handle.key}
          className={`align-dot axis-${handle.axis} target-${handle.target} ${handle.disabled ? "disabled" : ""} ${handle.aligned ? "aligned" : ""}`}
          style={{ left: handle.x, top: handle.y }}
          aria-label={handle.title}
          title={handle.title}
          disabled={handle.disabled}
          onMouseEnter={() => {
            if (!handle.disabled) {
              onPreview(handle.axis, handle.target);
            }
          }}
          onMouseLeave={onPreviewClear}
          onFocus={() => {
            if (!handle.disabled) {
              onPreview(handle.axis, handle.target);
            }
          }}
          onBlur={onPreviewClear}
          onClick={(event) => {
            event.stopPropagation();
            onPreviewClear();
            onAlign(handle.axis, handle.target);
          }}
        />
      ))}
    </div>
  );
}

export function MirrorOverlay({
  overlay,
  onMirror,
  onPreview,
  onPreviewClear,
}: {
  overlay: MirrorOverlayState;
  onMirror: (axis: AlignAxis) => void;
  onPreview: (axis: AlignAxis) => void;
  onPreviewClear: () => void;
}) {
  return (
    <div className="mirror-overlay" aria-label="Mirror handles">
      <svg className="mirror-guides" width="100%" height="100%" aria-hidden="true">
        {overlay.guides.map((guide) => (
          <line key={guide.key} x1={guide.x1} y1={guide.y1} x2={guide.x2} y2={guide.y2} />
        ))}
      </svg>
      {overlay.handles.map((handle) => (
        <button
          key={handle.key}
          className={`mirror-handle axis-${handle.axis}`}
          style={{ left: handle.x, top: handle.y, "--mirror-angle": `${handle.angle}deg` } as CSSProperties}
          aria-label={handle.title}
          title={handle.title}
          onMouseEnter={() => onPreview(handle.axis)}
          onMouseLeave={onPreviewClear}
          onFocus={() => onPreview(handle.axis)}
          onBlur={onPreviewClear}
          onClick={(event) => {
            event.stopPropagation();
            onPreviewClear();
            onMirror(handle.axis);
          }}
        >
          <svg className="mirror-handle-icon" viewBox="0 0 64 24" aria-hidden="true">
            <path d="M11 12h42" />
            <path d="m19 4-8 8 8 8" />
            <path d="m45 4 8 8-8 8" />
          </svg>
        </button>
      ))}
    </div>
  );
}
