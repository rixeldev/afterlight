/** Rendered-frame performance counters shared with the HUD overlay. */
export const renderStats = {
  fps: 0,
  drawCalls: 0,
  triangles: 0,
};

export function resetRenderStats(): void {
  renderStats.fps = 0;
  renderStats.drawCalls = 0;
  renderStats.triangles = 0;
}
