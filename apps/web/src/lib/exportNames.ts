export type ProjectExportFormat = "stl" | "obj" | "step";

export function projectFileStem(projectName: string) {
  return projectName
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 120);
}

export function projectExportFileName(projectName: string, format: ProjectExportFormat) {
  const safeProjectName = projectFileStem(projectName);
  return `${safeProjectName || "SketchForge design"}.${format}`;
}