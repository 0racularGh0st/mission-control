"use client";

import { useEffect, useRef } from "react";
import type { AgentPosition } from "@/src/viewmodels/useOfficeViewModel";

interface OfficeCanvasProps {
  jarvis: AgentPosition;
  cody: AgentPosition;
}

// Color palette
const COLORS = {
  bg: "#0a0d14",
  wall: "#111827",
  wallLight: "#1e293b",
  floor: "#0f172a",
  floorTile: "#1a2332",
  floorTileAlt: "#0f1a2e",
  desk: "#2d3748",
  deskTop: "#3d4a5c",
  monitor: "#0ea5e9",
  monitorGlow: "#38bdf8",
  monitorFrame: "#1e293b",
  plant: "#16a34a",
  plantDark: "#15803d",
  sofa: "#7c3aed",
  sofaLight: "#8b5cf6",
  sofaDark: "#5b21b6",
  coffeeMachine: "#78350f",
  coffeeMachineLight: "#92400e",
  rug: "#312e81",
  rugLight: "#3730a3",
  lamp: "#fbbf24",
  lampGlow: "#fde68a",
  hallway: "#0c1220",
  jarvis: "#a78bfa",
  jarvisDark: "#7c3aed",
  jarvisLight: "#c4b5fd",
  cody: "#34d399",
  codyDark: "#059669",
  codyLight: "#6ee7b7",
  labelBg: "rgba(0,0,0,0.7)",
  bubbleThinking: "#fde68a",
  bubbleTyping: "#38bdf8",
  // room dividers / doors
  doorFrame: "#334155",
  doorLight: "#1e3a5f",
};

// Pixel art drawn procedurally at 1:1

function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function drawFloor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const tileSize = 20;
  for (let row = 0; row * tileSize < h; row++) {
    for (let col = 0; col * tileSize < w; col++) {
      const isAlt = (row + col) % 2 === 0;
      drawPixelRect(ctx, x + col * tileSize, y + row * tileSize, tileSize, tileSize, isAlt ? COLORS.floorTile : COLORS.floorTileAlt);
    }
  }
}

function drawWalls(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Outer wall
  drawPixelRect(ctx, x, y, w, 12, COLORS.wallLight);
  drawPixelRect(ctx, x, y, 12, h, COLORS.wallLight);
  drawPixelRect(ctx, x + w - 12, y, 12, h, COLORS.wallLight);
  drawPixelRect(ctx, x, y + h - 12, w, 12, COLORS.wallLight);
  // Inner wall shade
  drawPixelRect(ctx, x + 12, y + 12, w - 24, 4, COLORS.wall);
  drawPixelRect(ctx, x + 12, y + 12, 4, h - 28, COLORS.wall);
  drawPixelRect(ctx, x + w - 16, y + 12, 4, h - 28, COLORS.wall);
}

function drawDesk(ctx: CanvasRenderingContext2D, dx: number, dy: number, monitorGlow = false) {
  // Desk surface
  drawPixelRect(ctx, dx, dy + 24, 100, 36, COLORS.deskTop);
  // Desk body
  drawPixelRect(ctx, dx, dy + 56, 100, 12, COLORS.desk);
  // Monitor frame
  drawPixelRect(ctx, dx + 28, dy, 44, 32, COLORS.monitorFrame);
  // Monitor screen
  const screenColor = monitorGlow ? COLORS.monitorGlow : COLORS.monitor;
  drawPixelRect(ctx, dx + 32, dy + 4, 36, 24, screenColor);
  // Monitor glow effect
  if (monitorGlow) {
    ctx.save();
    ctx.shadowColor = COLORS.monitorGlow;
    ctx.shadowBlur = 12;
    drawPixelRect(ctx, dx + 32, dy + 4, 36, 24, COLORS.monitorGlow);
    ctx.restore();
  }
  // Monitor stand
  drawPixelRect(ctx, dx + 46, dy + 32, 8, 8, COLORS.monitorFrame);
  drawPixelRect(ctx, dx + 38, dy + 38, 24, 4, COLORS.monitorFrame);
  // Keyboard
  drawPixelRect(ctx, dx + 34, dy + 48, 32, 8, "#374151");
}

function drawPlant(ctx: CanvasRenderingContext2D, px: number, py: number) {
  // Pot
  drawPixelRect(ctx, px, py + 16, 20, 16, "#78350f");
  drawPixelRect(ctx, px + 2, py + 14, 16, 4, "#92400e");
  // Leaves
  drawPixelRect(ctx, px + 8, py, 4, 16, COLORS.plant);
  drawPixelRect(ctx, px + 2, py + 4, 6, 12, COLORS.plantDark);
  drawPixelRect(ctx, px + 12, py + 4, 6, 12, COLORS.plantDark);
  drawPixelRect(ctx, px + 4, py - 4, 4, 8, COLORS.plant);
  drawPixelRect(ctx, px + 12, py - 4, 4, 8, COLORS.plant);
}

function drawLamp(ctx: CanvasRenderingContext2D, lx: number, ly: number) {
  // Pole
  drawPixelRect(ctx, lx + 4, ly + 12, 4, 24, "#6b7280");
  // Shade
  drawPixelRect(ctx, lx, ly, 12, 14, "#d97706");
  drawPixelRect(ctx, lx + 2, ly + 14, 8, 4, "#fbbf24");
  // Glow
  ctx.save();
  ctx.shadowColor = COLORS.lampGlow;
  ctx.shadowBlur = 20;
  drawPixelRect(ctx, lx + 2, ly + 14, 8, 4, COLORS.lampGlow);
  ctx.restore();
}

function drawSofa(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
  // Sofa base
  drawPixelRect(ctx, sx, sy + 24, 80, 24, COLORS.sofaDark);
  // Sofa back
  drawPixelRect(ctx, sx, sy, 80, 28, COLORS.sofa);
  drawPixelRect(ctx, sx + 4, sy + 4, 72, 20, COLORS.sofaLight);
  // Armrests
  drawPixelRect(ctx, sx - 8, sy + 8, 12, 40, COLORS.sofaDark);
  drawPixelRect(ctx, sx + 76, sy + 8, 12, 40, COLORS.sofaDark);
  // Cushion highlight
  drawPixelRect(ctx, sx + 4, sy + 4, 32, 8, COLORS.sofaLight);
  drawPixelRect(ctx, sx + 40, sy + 4, 32, 8, COLORS.sofaLight);
}

function drawCoffeeMachine(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  // Body
  drawPixelRect(ctx, cx, cy, 32, 48, COLORS.coffeeMachine);
  drawPixelRect(ctx, cx + 2, cy + 2, 28, 8, COLORS.coffeeMachineLight);
  // Screen
  drawPixelRect(ctx, cx + 8, cy + 14, 16, 12, "#0f172a");
  // Buttons
  drawPixelRect(ctx, cx + 8, cy + 30, 6, 6, "#fbbf24");
  drawPixelRect(ctx, cx + 18, cy + 30, 6, 6, "#ef4444");
  // Drip area
  drawPixelRect(ctx, cx + 4, cy + 42, 24, 6, "#1c1917");
  // Cup
  drawPixelRect(ctx, cx + 12, cy + 44, 10, 12, "#e5e7eb");
  drawPixelRect(ctx, cx + 14, cy + 46, 6, 4, "#78350f");
}

function drawSnackTable(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
  // Table top
  drawPixelRect(ctx, tx, ty + 8, 40, 8, "#4b5563");
  // Table legs
  drawPixelRect(ctx, tx + 2, ty + 16, 6, 20, "#374151");
  drawPixelRect(ctx, tx + 32, ty + 16, 6, 20, "#374151");
  // Snacks on table
  drawPixelRect(ctx, tx + 6, ty, 8, 10, "#f59e0b");
  drawPixelRect(ctx, tx + 18, ty + 2, 6, 8, "#84cc16");
  drawPixelRect(ctx, tx + 28, ty, 8, 10, "#ef4444");
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  darkColor: string,
  lightColor: string,
  state: "idle" | "busy" | "thinking",
  animFrame: number
) {
  // Character is a 32x32 pixel sprite made of rectangles

  // Body
  const breathe = state === "idle" ? Math.sin(animFrame * 0.5) * 2 : 0;
  drawPixelRect(ctx, x + 8, y + 12 - breathe, 16, 20, color);
  drawPixelRect(ctx, x + 10, y + 14 - breathe, 12, 16, darkColor);

  // Head
  drawPixelRect(ctx, x + 6, y, 20, 14, lightColor);
  drawPixelRect(ctx, x + 8, y + 2, 16, 10, color);

  // Eyes
  const eyeY = y + 4;
  drawPixelRect(ctx, x + 10, eyeY, 4, 4, "#0f172a");
  drawPixelRect(ctx, x + 18, eyeY, 4, 4, "#0f172a");
  // Eye glow when active
  if (state === "busy") {
    ctx.save();
    ctx.shadowColor = COLORS.monitorGlow;
    ctx.shadowBlur = 4;
    drawPixelRect(ctx, x + 10, eyeY, 4, 4, "#7dd3fc");
    drawPixelRect(ctx, x + 18, eyeY, 4, 4, "#7dd3fc");
    ctx.restore();
  }

  // Thinking bubble
  if (state === "thinking") {
    const bubbleFrames = ["...", "   ", "-  ", " - ", "  -"];
    const bubble = bubbleFrames[animFrame % 5];
    // Draw bubble
    drawPixelRect(ctx, x + 28, y - 12, 32, 14, COLORS.labelBg);
    ctx.fillStyle = COLORS.bubbleThinking;
    ctx.font = "bold 10px monospace";
    ctx.fillText(bubble, x + 30, y - 2);
  }

  // Busy typing indicator (rapid small movement)
  if (state === "busy") {
    const jitter = Math.abs(Math.sin(animFrame * 3)) * 2;
    drawPixelRect(ctx, x + 8 + jitter, y + 28, 16, 4, darkColor);
  }

  // Legs
  const legOffset = state === "busy" ? Math.sin(animFrame * 2) * 2 : 0;
  drawPixelRect(ctx, x + 10 + legOffset, y + 30, 5, 8, darkColor);
  drawPixelRect(ctx, x + 17 - legOffset, y + 30, 5, 8, darkColor);
}

function drawAgentLabel(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, state: AgentPosition["state"]) {
  const stateLabel = state === "busy" ? "busy" : state === "thinking" ? "thinking" : "idle";
  const labelW = 52;
  const labelH = 14;
  const lx = Math.round(x - labelW / 2 + 16);
  const ly = y - 20;

  drawPixelRect(ctx, lx, ly, labelW, labelH, COLORS.labelBg);
  ctx.fillStyle = state === "busy" ? "#38bdf8" : state === "thinking" ? "#fde68a" : "#9ca3af";
  ctx.font = "9px monospace";
  ctx.fillText(`${name} ${stateLabel}`, lx + 4, ly + 10);
}

function drawMainOffice(ctx: CanvasRenderingContext2D) {
  const ox = 20;
  const oy = 20;
  const ow = 460;
  const oh = 460;

  // Floor
  drawFloor(ctx, ox + 12, oy + 12, ow - 24, oh - 24);

  // Walls
  drawWalls(ctx, ox, oy, ow, oh);

  // Rug
  drawPixelRect(ctx, ox + 40, oy + 300, 380, 140, COLORS.rug);
  drawPixelRect(ctx, ox + 48, oy + 308, 364, 124, COLORS.rugLight);

  // Desks row 1 (top)
  drawDesk(ctx, ox + 60, oy + 80, false);
  drawDesk(ctx, ox + 200, oy + 80, true);
  drawDesk(ctx, ox + 340, oy + 80, false);

  // Desks row 2 (bottom)
  drawDesk(ctx, ox + 60, oy + 240, false);
  drawDesk(ctx, ox + 200, oy + 240, false);
  drawDesk(ctx, ox + 340, oy + 240, true);

  // Plants
  drawPlant(ctx, ox + 30, oy + 170);
  drawPlant(ctx, ox + 400, oy + 170);
  drawPlant(ctx, ox + 30, oy + 340);
  drawPlant(ctx, ox + 400, oy + 340);

  // Lamps
  drawLamp(ctx, ox + 30, oy + 60);
  drawLamp(ctx, ox + 400, oy + 60);
  drawLamp(ctx, ox + 30, oy + 220);
  drawLamp(ctx, ox + 400, oy + 220);

  // Office label
  ctx.fillStyle = "#475569";
  ctx.font = "bold 11px monospace";
  ctx.fillText("MAIN OFFICE", ox + 180, oy + 14);
}

function drawBreakRoom(ctx: CanvasRenderingContext2D) {
  const ox = 510;
  const oy = 20;
  const ow = 280;
  const oh = 460;

  // Floor
  drawFloor(ctx, ox + 12, oy + 12, ow - 24, oh - 24);

  // Walls
  drawWalls(ctx, ox, oy, ow, oh);

  // Rug
  drawPixelRect(ctx, ox + 50, oy + 340, 180, 100, "#581c87");
  drawPixelRect(ctx, ox + 58, oy + 348, 164, 84, "#7e22ce");

  // Sofa
  drawSofa(ctx, ox + 30, oy + 280);

  // Coffee machine
  drawCoffeeMachine(ctx, ox + 200, oy + 150);

  // Snack table
  drawSnackTable(ctx, ox + 160, oy + 290);

  // Plant
  drawPlant(ctx, ox + 40, oy + 150);

  // Lamp
  drawLamp(ctx, ox + 220, oy + 100);

  // Break room label
  ctx.fillStyle = "#7c3aed";
  ctx.font = "bold 11px monospace";
  ctx.fillText("BREAK ROOM", ox + 80, oy + 14);
}

function drawHallway(ctx: CanvasRenderingContext2D) {
  // Connecting hallway
  const hx = 480;
  const hy = 20;
  const hw = 30;
  const hh = 460;

  drawFloor(ctx, hx, hy, hw, hh);

  // Walls
  drawPixelRect(ctx, hx, hy, 4, hh, COLORS.wallLight);
  drawPixelRect(ctx, hx + hw - 4, hy, 4, hh, COLORS.wallLight);
  drawPixelRect(ctx, hx, hy, hw, 12, COLORS.wallLight);
  drawPixelRect(ctx, hx, hy + hh - 12, hw, 12, COLORS.wallLight);

  // Door lights
  ctx.save();
  ctx.shadowColor = "#60a5fa";
  ctx.shadowBlur = 8;
  drawPixelRect(ctx, hx + hw / 2 - 6, hy + 100, 12, 4, "#3b82f6");
  drawPixelRect(ctx, hx + hw / 2 - 6, hy + 280, 12, 4, "#8b5cf6");
  ctx.restore();
}

export function OfficeCanvas({ jarvis, cody }: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // ctx is non-null from here
    const c = ctx as CanvasRenderingContext2D;

    c.imageSmoothingEnabled = false;

    let animFrame: number;
    let lastTime = 0;

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }

    function render() {
      const W = 800;
      const H = 500;

      // Clear
      c.fillStyle = COLORS.bg;
      c.fillRect(0, 0, W, H);

      // Draw rooms
      drawMainOffice(c);
      drawHallway(c);
      drawBreakRoom(c);

      // Smooth movement
      const t = 0.05;

      // Update and draw Jarvis
      const jx = lerp(jarvis.x, jarvis.targetX, t);
      const jy = lerp(jarvis.y, jarvis.targetY, t);
      drawCharacter(c, jx, jy, COLORS.jarvis, COLORS.jarvisDark, COLORS.jarvisLight, jarvis.state, jarvis.animFrame);
      drawAgentLabel(c, jx, jy, "JARVIS", jarvis.state);

      // Update and draw Cody
      const cx = lerp(cody.x, cody.targetX, t);
      const cy = lerp(cody.y, cody.targetY, t);
      drawCharacter(c, cx, cy, COLORS.cody, COLORS.codyDark, COLORS.codyLight, cody.state, cody.animFrame);
      drawAgentLabel(c, cx, cy, "Cody", cody.state);

      // Draw timestamp
      c.fillStyle = "#475569";
      c.font = "9px monospace";
      c.fillText(`updated: ${new Date().toLocaleTimeString()}`, 10, H - 8);
    }

    function loop(time: number) {
      if (time - lastTime > 16) {
        lastTime = time;
        render();
      }
      animFrame = requestAnimationFrame(loop);
    }

    animFrame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [jarvis, cody]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={500}
      className="w-full rounded-lg border border-border/60"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
