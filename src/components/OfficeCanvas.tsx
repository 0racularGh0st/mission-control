"use client";

import { useEffect, useRef } from "react";
import type { AgentPosition } from "@/src/viewmodels/useOfficeViewModel";

interface OfficeCanvasProps {
  jarvis: AgentPosition;
  cody: AgentPosition;
  claudius: AgentPosition;
}

/* ── Palette — warm / earthy / minimalist ─────────────── */

const C = {
  // environment
  bg: "#1c1a17",
  wall: "#e8e0d4",
  wallUpper: "#ede6db",
  wallLower: "#ddd4c6",
  wallTrim: "#c4b9a8",
  wallBaseboard: "#8c7e6d",
  floor: "#c9ad8a",
  floorA: "#c4a882",
  floorB: "#b89c76",
  floorGrain: "rgba(0,0,0,0.03)",
  floorHighlight: "rgba(255,255,255,0.04)",
  shadow: "rgba(60,45,30,0.12)",
  shadowDeep: "rgba(40,30,18,0.22)",
  // furniture — walnut/oak
  desk: "#6b4d3a",
  deskTop: "#7d5e48",
  deskLeg: "#5c4033",
  monitorFrame: "#2a2520",
  monitorScreen: "#1a1816",
  monitorGlow: "#8ab4a0",
  monitorCode: "#a3c9b8",
  keyboard: "#3a3430",
  keyboardKey: "#4a4440",
  chairSeat: "#3a3430",
  chairBack: "#4a4440",
  // break room
  sofa: "#b5a48e",
  sofaLight: "#c4b5a0",
  sofaDark: "#9e8e78",
  sofaCushion: "#bfb09a",
  rug: "#c17456",
  rugPattern: "#b86a4e",
  rugBorder: "#a55e42",
  coffeeBody: "#5c4033",
  coffeeAccent: "#7d5e48",
  // decoration
  plant: "#7a9a6b",
  plantDark: "#5e7e50",
  plantPot: "#c4a882",
  plantPotRim: "#b89c76",
  lampPole: "#b8956a",
  lampShade: "#e8e0d4",
  lampGlow: "rgba(245,230,200,0.10)",
  windowFrame: "#8c7e6d",
  windowSky: "#c8d8e8",
  skyGradTop: "#a8c0d8",
  skyGradBot: "#d8e4ee",
  cloud: "rgba(255,255,255,0.6)",
  // wall art
  artFrame: "#5c4033",
  artFrameLight: "#7d5e48",
  artBg: "#e8e0d4",
  // agents
  skin: "#d4a574",
  skinShadow: "#b8895a",
  hair: {
    jarvis: "#2a2520",
    cody: "#5c4033",
    claudius: "#8c5a3a",
  },
  shirt: {
    jarvis: "#6b5b8a",
    jarvisDark: "#564872",
    jarvisAccent: "#8a7aa8",
    cody: "#5a8a6b",
    codyDark: "#4a7258",
    codyAccent: "#7aaa8b",
    claudius: "#c17456",
    claudiusDark: "#a55e42",
    claudiusAccent: "#d8906e",
  },
  pants: "#3a3430",
  pantsDark: "#2a2520",
  shoe: "#1c1a17",
  // UI labels
  labelBg: "rgba(28,26,23,0.82)",
  labelBorder: "rgba(255,255,255,0.06)",
  bubbleBg: "rgba(28,26,23,0.85)",
  bubbleThinking: "#e8c86a",
  bubbleTyping: "#8ab4a0",
  // hallway
  hallFloor: "#b89c76",
  doorLight: "#b8956a",
  doorLightAlt: "#8a7aa8",
};

/* ── Drawing helpers ────────────────────────────────────── */

function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function softShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();
  ctx.shadowColor = "rgba(40,30,18,0.18)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  blur: number,
) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
  ctx.restore();
}

/* ── Scene elements ─────────────────────────────────────── */

function drawFloor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  // Herringbone-style wood floor
  const tile = 18;
  for (let row = 0; row * tile < h; row++) {
    for (let col = 0; col * tile < w; col++) {
      const alt = (row + col) % 2 === 0;
      px(ctx, x + col * tile, y + row * tile, tile, tile, alt ? C.floorA : C.floorB);
      // Wood grain hint
      if (alt) {
        px(ctx, x + col * tile + 4, y + row * tile + 2, 10, 1, C.floorGrain);
        px(ctx, x + col * tile + 2, y + row * tile + 8, 12, 1, C.floorGrain);
        px(ctx, x + col * tile + 6, y + row * tile + 14, 8, 1, C.floorGrain);
      } else {
        px(ctx, x + col * tile + 2, y + row * tile + 4, 1, 10, C.floorGrain);
        px(ctx, x + col * tile + 8, y + row * tile + 2, 1, 12, C.floorGrain);
        px(ctx, x + col * tile + 14, y + row * tile + 6, 1, 8, C.floorGrain);
      }
      // Subtle edge highlight
      px(ctx, x + col * tile, y + row * tile, tile, 1, C.floorHighlight);
    }
  }
}

function drawWalls(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  // Upper wall — lighter
  px(ctx, x, y, w, h, C.wallUpper);
  // Lower wainscoting zone
  const wainscotY = y + Math.round(h * 0.55);
  px(ctx, x, wainscotY, w, h - (wainscotY - y), C.wallLower);
  // Chair rail / trim line
  px(ctx, x, wainscotY, w, 2, C.wallTrim);
  px(ctx, x, wainscotY + 2, w, 1, "rgba(255,255,255,0.3)");
  // Wainscot panels (subtle vertical lines)
  const panelW = 60;
  for (let px2 = x + 30; px2 < x + w - 30; px2 += panelW) {
    ctx.globalAlpha = 0.08;
    px(ctx, px2, wainscotY + 8, 1, h - (wainscotY - y) - 20, "#8c7e6d");
    ctx.globalAlpha = 1;
  }
  // Baseboard
  px(ctx, x, y + h - 4, w, 4, C.wallBaseboard);
  px(ctx, x, y + h - 5, w, 1, C.wallTrim);
  // Crown molding at top
  px(ctx, x, y, w, 3, C.wallTrim);
  px(ctx, x, y + 3, w, 1, "rgba(255,255,255,0.2)");
  // Floor shadow along baseboard
  ctx.globalAlpha = 0.08;
  px(ctx, x, y + h, w, 6, "#000");
  ctx.globalAlpha = 1;
}

function drawWindow(ctx: CanvasRenderingContext2D, wx: number, wy: number) {
  // Shadow behind frame
  softShadow(ctx, wx - 1, wy - 1, 82, 52);
  // Frame
  px(ctx, wx, wy, 80, 50, C.windowFrame);
  px(ctx, wx + 3, wy + 3, 74, 44, C.skyGradBot);
  // Sky gradient hint
  px(ctx, wx + 3, wy + 3, 74, 16, C.skyGradTop);
  // Cross bar
  px(ctx, wx + 39, wy + 3, 2, 44, C.windowFrame);
  px(ctx, wx + 3, wy + 24, 74, 2, C.windowFrame);
  // Clouds
  ctx.globalAlpha = 0.5;
  px(ctx, wx + 10, wy + 10, 16, 6, C.cloud);
  px(ctx, wx + 8, wy + 12, 8, 4, C.cloud);
  px(ctx, wx + 50, wy + 14, 12, 5, C.cloud);
  px(ctx, wx + 48, wy + 16, 6, 3, C.cloud);
  ctx.globalAlpha = 1;
  // Window sill
  px(ctx, wx - 4, wy + 50, 88, 5, C.wallTrim);
  px(ctx, wx - 4, wy + 50, 88, 1, "rgba(255,255,255,0.2)");
  // Light cast on floor below (warm sunlight)
  ctx.save();
  const sunGrad = ctx.createRadialGradient(wx + 40, wy + 120, 10, wx + 40, wy + 120, 80);
  sunGrad.addColorStop(0, "rgba(255,240,200,0.08)");
  sunGrad.addColorStop(1, "rgba(255,240,200,0)");
  ctx.fillStyle = sunGrad;
  ctx.fillRect(wx - 20, wy + 60, 120, 120);
  ctx.restore();
}

function drawFramedArt(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  variant: number,
) {
  // Shadow
  softShadow(ctx, ax, ay, 48, 36);
  // Frame
  px(ctx, ax, ay, 48, 36, C.artFrame);
  px(ctx, ax + 1, ay + 1, 46, 34, C.artFrameLight);
  // Mat
  px(ctx, ax + 3, ay + 3, 42, 30, "#f0e8dc");
  // Canvas/content
  px(ctx, ax + 5, ay + 5, 38, 26, C.artBg);

  if (variant === 0) {
    // Abstract landscape — terracotta horizon
    px(ctx, ax + 5, ay + 18, 38, 13, "#c17456");
    px(ctx, ax + 5, ay + 14, 38, 6, "#d8a888");
    // Sun circle
    ctx.globalAlpha = 0.6;
    px(ctx, ax + 20, ay + 8, 8, 8, "#e8c86a");
    ctx.globalAlpha = 1;
  } else if (variant === 1) {
    // Minimalist arcs — sage and cream
    ctx.globalAlpha = 0.4;
    px(ctx, ax + 12, ay + 12, 24, 12, "#7a9a6b");
    ctx.globalAlpha = 0.25;
    px(ctx, ax + 16, ay + 8, 16, 16, "#b8956a");
    ctx.globalAlpha = 1;
    // Line accent
    px(ctx, ax + 10, ay + 26, 28, 1, "#5c4033");
  } else {
    // Color blocks — earthy Rothko-esque
    px(ctx, ax + 8, ay + 7, 32, 8, "#b89c76");
    px(ctx, ax + 8, ay + 17, 32, 4, "#c17456");
    px(ctx, ax + 8, ay + 23, 32, 6, "#8c7e6d");
  }
}

function drawDesk(
  ctx: CanvasRenderingContext2D,
  dx: number,
  dy: number,
  monitorOn: boolean,
) {
  // Desk shadow on floor
  ctx.globalAlpha = 0.1;
  px(ctx, dx - 2, dy + 66, 104, 6, "#000");
  ctx.globalAlpha = 1;

  // Chair (behind desk)
  px(ctx, dx + 30, dy + 56, 40, 4, C.chairBack);
  px(ctx, dx + 34, dy + 60, 32, 12, C.chairSeat);
  px(ctx, dx + 46, dy + 72, 8, 8, C.chairSeat);
  // Desk legs
  px(ctx, dx + 4, dy + 48, 6, 20, C.deskLeg);
  px(ctx, dx + 90, dy + 48, 6, 20, C.deskLeg);
  // Desk surface — warm walnut
  px(ctx, dx, dy + 40, 100, 10, C.deskTop);
  px(ctx, dx + 2, dy + 42, 96, 6, C.desk);
  // Desk edge highlight
  px(ctx, dx, dy + 40, 100, 1, "rgba(255,255,255,0.12)");
  // Monitor
  px(ctx, dx + 28, dy + 8, 44, 32, C.monitorFrame);
  px(ctx, dx + 31, dy + 11, 38, 26, monitorOn ? C.monitorScreen : "#2a2520");
  if (monitorOn) {
    const lines = [14, 20, 26, 32];
    for (const ly of lines) {
      const w = 8 + ((ly * 7) % 20);
      px(ctx, dx + 34, dy + ly, w, 2, C.monitorCode);
      ctx.globalAlpha = 0.3;
      px(ctx, dx + 34 + w + 3, dy + ly, 10, 2, C.monitorCode);
      ctx.globalAlpha = 1;
    }
    // Subtle screen glow
    glow(ctx, dx + 31, dy + 11, 38, 26, C.monitorGlow, 10);
    ctx.globalAlpha = 0.04;
    px(ctx, dx + 20, dy + 40, 60, 10, C.monitorGlow);
    ctx.globalAlpha = 1;
  }
  // Monitor stand
  px(ctx, dx + 46, dy + 38, 8, 4, C.monitorFrame);
  px(ctx, dx + 40, dy + 40, 20, 3, C.monitorFrame);
  // Keyboard
  px(ctx, dx + 34, dy + 44, 32, 6, C.keyboard);
  for (let i = 0; i < 6; i++) {
    px(ctx, dx + 36 + i * 5, dy + 45, 4, 2, C.keyboardKey);
    px(ctx, dx + 36 + i * 5, dy + 48, 4, 1, C.keyboardKey);
  }
  // Small plant/item on desk
  px(ctx, dx + 76, dy + 34, 6, 8, C.plantPot);
  px(ctx, dx + 74, dy + 30, 10, 6, C.plant);
  px(ctx, dx + 76, dy + 28, 6, 4, C.plantDark);
}

function drawPlant(ctx: CanvasRenderingContext2D, ppx: number, py: number) {
  // Shadow
  ctx.globalAlpha = 0.08;
  px(ctx, ppx, py + 32, 20, 4, "#000");
  ctx.globalAlpha = 1;
  // Pot — ceramic warm tone
  px(ctx, ppx + 2, py + 20, 16, 12, C.plantPot);
  px(ctx, ppx + 4, py + 18, 12, 4, C.plantPotRim);
  // Pot rim highlight
  px(ctx, ppx + 4, py + 18, 12, 1, "rgba(255,255,255,0.15)");
  // Trunk
  px(ctx, ppx + 8, py + 6, 4, 14, "#5e7e50");
  // Leaves
  const leaves = [
    [4, 0, 12, 8],
    [0, 4, 8, 10],
    [12, 2, 8, 10],
    [6, -4, 8, 6],
    [2, -2, 6, 8],
    [12, -2, 6, 8],
  ];
  for (const [lx, ly, lw, lh] of leaves) {
    px(ctx, ppx + lx, py + ly, lw, lh, (lx + ly) % 3 === 0 ? C.plantDark : C.plant);
  }
}

function drawLamp(ctx: CanvasRenderingContext2D, lx: number, ly: number) {
  // Base — brass
  px(ctx, lx + 2, ly + 36, 8, 4, "#8c7e6d");
  // Pole — brass
  px(ctx, lx + 4, ly + 12, 4, 24, C.lampPole);
  // Shade — cream linen
  px(ctx, lx - 1, ly, 14, 14, C.lampShade);
  px(ctx, lx + 1, ly + 2, 10, 10, "#f0e8dc");
  // Shade highlight
  px(ctx, lx + 1, ly + 2, 10, 1, "rgba(255,255,255,0.3)");
  // Warm glow pool
  ctx.save();
  const grad = ctx.createRadialGradient(lx + 6, ly + 44, 2, lx + 6, ly + 44, 40);
  grad.addColorStop(0, "rgba(245,230,200,0.06)");
  grad.addColorStop(1, "rgba(245,230,200,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(lx - 34, ly + 10, 80, 70);
  ctx.restore();
}

function drawSofa(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
  // Shadow
  ctx.globalAlpha = 0.12;
  px(ctx, sx - 4, sy + 44, 96, 6, "#000");
  ctx.globalAlpha = 1;
  // Base
  px(ctx, sx, sy + 28, 80, 18, C.sofaDark);
  // Backrest
  px(ctx, sx, sy + 4, 80, 26, C.sofa);
  px(ctx, sx + 4, sy + 8, 72, 18, C.sofaLight);
  // Cushion divider
  px(ctx, sx + 38, sy + 8, 4, 18, C.sofa);
  // Seat cushions
  px(ctx, sx + 4, sy + 28, 34, 8, C.sofaCushion);
  px(ctx, sx + 42, sy + 28, 34, 8, C.sofaCushion);
  // Armrests
  px(ctx, sx - 8, sy + 10, 12, 36, C.sofaDark);
  px(ctx, sx - 6, sy + 12, 8, 8, C.sofa);
  px(ctx, sx + 76, sy + 10, 12, 36, C.sofaDark);
  px(ctx, sx + 78, sy + 12, 8, 8, C.sofa);
  // Throw pillow — terracotta
  px(ctx, sx + 6, sy + 10, 14, 12, C.rug);
  px(ctx, sx + 8, sy + 12, 10, 8, C.rugPattern);
  // Highlight on top edge
  px(ctx, sx, sy + 4, 80, 1, "rgba(255,255,255,0.08)");
}

function drawCoffeeMachine(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  // Counter shadow
  ctx.globalAlpha = 0.08;
  px(ctx, cx - 8, cy + 60, 48, 4, "#000");
  ctx.globalAlpha = 1;
  // Counter — walnut
  px(ctx, cx - 8, cy + 44, 48, 16, C.desk);
  px(ctx, cx - 6, cy + 42, 44, 4, C.deskTop);
  px(ctx, cx - 6, cy + 42, 44, 1, "rgba(255,255,255,0.1)");
  // Machine body
  px(ctx, cx, cy, 32, 44, C.coffeeBody);
  px(ctx, cx + 2, cy + 2, 28, 6, C.coffeeAccent);
  // Screen
  px(ctx, cx + 6, cy + 12, 20, 10, "#1a1816");
  px(ctx, cx + 8, cy + 14, 16, 2, "#7a9a6b");
  px(ctx, cx + 8, cy + 18, 10, 2, "#7a9a6b");
  // Buttons
  px(ctx, cx + 8, cy + 28, 6, 6, "#b8956a");
  px(ctx, cx + 18, cy + 28, 6, 6, "#c17456");
  // Drip
  px(ctx, cx + 6, cy + 38, 20, 6, C.deskLeg);
  // Cup — ceramic
  px(ctx, cx + 12, cy + 40, 8, 8, "#e8e0d4");
  px(ctx, cx + 13, cy + 41, 6, 3, "#8c5a3a");
  // Steam
  ctx.globalAlpha = 0.15;
  px(ctx, cx + 14, cy + 36, 2, 4, "#e8e0d4");
  px(ctx, cx + 17, cy + 34, 2, 6, "#e8e0d4");
  ctx.globalAlpha = 1;
}

function drawSnackTable(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
  // Shadow
  ctx.globalAlpha = 0.08;
  px(ctx, tx - 2, ty + 34, 44, 4, "#000");
  ctx.globalAlpha = 1;
  // Table surface — walnut
  px(ctx, tx, ty + 10, 40, 6, C.deskTop);
  px(ctx, tx + 2, ty + 8, 36, 4, C.desk);
  px(ctx, tx, ty + 10, 40, 1, "rgba(255,255,255,0.08)");
  // Legs
  px(ctx, tx + 3, ty + 16, 4, 18, C.deskLeg);
  px(ctx, tx + 33, ty + 16, 4, 18, C.deskLeg);
  // Items — muted
  px(ctx, tx + 8, ty + 2, 8, 8, "#b8956a");
  px(ctx, tx + 8, ty + 4, 8, 2, "#a07e58");
  px(ctx, tx + 20, ty + 4, 6, 6, "#7a9a6b");
  px(ctx, tx + 28, ty + 2, 8, 8, "#c17456");
  px(ctx, tx + 28, ty + 4, 8, 2, "#a55e42");
}

/* ── Shelf decoration ─────────────────────────────────── */

function drawShelf(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
  // Shelf bracket + board
  px(ctx, sx, sy, 50, 3, C.deskTop);
  px(ctx, sx, sy, 50, 1, "rgba(255,255,255,0.1)");
  // Brackets
  px(ctx, sx + 6, sy + 3, 2, 8, C.deskLeg);
  px(ctx, sx + 42, sy + 3, 2, 8, C.deskLeg);
  // Books
  px(ctx, sx + 4, sy - 12, 6, 12, "#c17456");
  px(ctx, sx + 11, sy - 14, 5, 14, "#5e7e50");
  px(ctx, sx + 17, sy - 10, 6, 10, "#b8956a");
  px(ctx, sx + 24, sy - 13, 5, 13, "#8c7e6d");
  // Small ceramic vase
  px(ctx, sx + 34, sy - 8, 8, 8, "#e8e0d4");
  px(ctx, sx + 35, sy - 10, 6, 4, "#ddd4c6");
}

/* ── Characters ─────────────────────────────────────────── */

interface CharColors {
  hair: string;
  shirt: string;
  shirtDark: string;
  shirtAccent: string;
}

function drawHumanoid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colors: CharColors,
  state: "idle" | "busy" | "thinking",
  animFrame: number,
) {
  const breathe = state === "idle" ? Math.sin(animFrame * 0.5) * 1.5 : 0;
  const by = -breathe;

  // Shadow on floor
  ctx.globalAlpha = 0.15;
  const shadowW = state === "busy" ? 22 : 20;
  px(ctx, x + 6, y + 42, shadowW, 4, "#000");
  ctx.globalAlpha = 1;

  // Legs
  const legSwing = state === "busy" ? Math.sin(animFrame * 2) * 1.5 : 0;
  px(ctx, x + 9 + legSwing, y + 32 + by, 6, 10, C.pants);
  px(ctx, x + 10 + legSwing, y + 33 + by, 4, 8, C.pantsDark);
  px(ctx, x + 17 - legSwing, y + 32 + by, 6, 10, C.pants);
  px(ctx, x + 18 - legSwing, y + 33 + by, 4, 8, C.pantsDark);
  // Shoes
  px(ctx, x + 8 + legSwing, y + 41 + by, 8, 3, C.shoe);
  px(ctx, x + 16 - legSwing, y + 41 + by, 8, 3, C.shoe);

  // Torso
  px(ctx, x + 6, y + 16 + by, 20, 18, colors.shirt);
  px(ctx, x + 12, y + 16 + by, 8, 3, colors.shirtAccent);
  px(ctx, x + 6, y + 16 + by, 4, 16, colors.shirtDark);
  px(ctx, x + 22, y + 16 + by, 4, 16, colors.shirtDark);
  px(ctx, x + 8, y + 31 + by, 16, 2, C.pantsDark);

  // Arms
  const armSwing = state === "busy" ? Math.sin(animFrame * 3) * 2 : 0;
  px(ctx, x + 2, y + 17 + by, 6, 14, colors.shirtDark);
  px(ctx, x + 3, y + 18 + by, 4, 12, colors.shirt);
  px(ctx, x + 3, y + 30 + by + armSwing, 4, 4, C.skin);
  px(ctx, x + 24, y + 17 + by, 6, 14, colors.shirtDark);
  px(ctx, x + 25, y + 18 + by, 4, 12, colors.shirt);
  px(ctx, x + 25, y + 30 + by - armSwing, 4, 4, C.skin);

  // Head
  px(ctx, x + 13, y + 13 + by, 6, 5, C.skinShadow);
  px(ctx, x + 8, y + 2 + by, 16, 14, C.skin);
  px(ctx, x + 7, y + 4 + by, 18, 10, C.skin);
  px(ctx, x + 7, y + 8 + by, 3, 4, C.skinShadow);
  px(ctx, x + 22, y + 8 + by, 3, 4, C.skinShadow);

  // Hair
  px(ctx, x + 7, y + by, 18, 6, colors.hair);
  px(ctx, x + 8, y - 1 + by, 16, 4, colors.hair);
  px(ctx, x + 6, y + 2 + by, 3, 8, colors.hair);
  px(ctx, x + 23, y + 2 + by, 3, 8, colors.hair);

  // Face
  const blinkCycle = animFrame % 30;
  const isBlinking = blinkCycle === 0 || blinkCycle === 1;
  const eyeH = isBlinking ? 1 : 3;
  const eyeY = y + 6 + by + (isBlinking ? 1 : 0);

  if (state === "busy") {
    glow(ctx, x + 11, eyeY, 3, eyeH, "#8ab4a0", 4);
    glow(ctx, x + 18, eyeY, 3, eyeH, "#8ab4a0", 4);
  } else {
    px(ctx, x + 11, eyeY, 3, eyeH, "#1c1a17");
    px(ctx, x + 18, eyeY, 3, eyeH, "#1c1a17");
    if (!isBlinking) {
      px(ctx, x + 12, eyeY, 1, 1, "#e8e0d4");
      px(ctx, x + 19, eyeY, 1, 1, "#e8e0d4");
    }
  }

  // Eyebrows
  px(ctx, x + 10, y + 4 + by, 4, 1, colors.hair);
  px(ctx, x + 18, y + 4 + by, 4, 1, colors.hair);

  // Mouth
  if (state === "thinking") {
    px(ctx, x + 13, y + 11 + by, 6, 1, C.skinShadow);
  } else if (state === "busy") {
    px(ctx, x + 13, y + 11 + by, 6, 1, C.skinShadow);
    px(ctx, x + 14, y + 12 + by, 4, 1, C.skinShadow);
  } else {
    px(ctx, x + 13, y + 11 + by, 6, 1, C.skinShadow);
    px(ctx, x + 12, y + 11 + by, 1, 1, C.skinShadow);
    px(ctx, x + 19, y + 11 + by, 1, 1, C.skinShadow);
  }

  // Status indicators
  if (state === "thinking") {
    const bobble = Math.sin(animFrame * 0.6) * 2;
    ctx.globalAlpha = 0.6;
    px(ctx, x + 28, y + 4 + bobble, 3, 3, C.bubbleThinking);
    ctx.globalAlpha = 0.4;
    px(ctx, x + 32, y - 1 + bobble * 0.7, 4, 4, C.bubbleThinking);
    ctx.globalAlpha = 0.85;
    px(ctx, x + 30, y - 14 + bobble * 0.4, 28, 14, C.bubbleBg);
    px(ctx, x + 31, y - 13 + bobble * 0.4, 26, 12, "rgba(28,26,23,0.9)");
    const dotPhase = animFrame % 12;
    for (let i = 0; i < 3; i++) {
      const on = dotPhase > i * 3;
      ctx.globalAlpha = on ? 0.9 : 0.2;
      px(ctx, x + 36 + i * 6, y - 10 + bobble * 0.4, 3, 3, C.bubbleThinking);
    }
    ctx.globalAlpha = 1;
  }

  if (state === "busy") {
    const typeDot = animFrame % 4;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) {
      const active = typeDot === i;
      px(ctx, x + 10 + i * 4, y + 36 + by, 2, active ? 3 : 2, C.monitorGlow);
    }
    ctx.globalAlpha = 1;
  }
}

/* ── Agent-specific character wrappers ──────────────────── */

const JARVIS_COLORS: CharColors = {
  hair: C.hair.jarvis,
  shirt: C.shirt.jarvis,
  shirtDark: C.shirt.jarvisDark,
  shirtAccent: C.shirt.jarvisAccent,
};

const CODY_COLORS: CharColors = {
  hair: C.hair.cody,
  shirt: C.shirt.cody,
  shirtDark: C.shirt.codyDark,
  shirtAccent: C.shirt.codyAccent,
};

const CLAUDIUS_COLORS: CharColors = {
  hair: C.hair.claudius,
  shirt: C.shirt.claudius,
  shirtDark: C.shirt.claudiusDark,
  shirtAccent: C.shirt.claudiusAccent,
};

function drawAgentLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  state: AgentPosition["state"],
  accentColor: string,
) {
  const stateLabel =
    state === "busy" ? "WORKING" : state === "thinking" ? "THINKING" : "IDLE";
  const text = `${name}  ${stateLabel}`;
  ctx.font = "bold 8px monospace";
  const textW = ctx.measureText(text).width;
  const padX = 6;
  const padY = 3;
  const labelW = textW + padX * 2;
  const labelH = 12 + padY;
  const lx = Math.round(x + 16 - labelW / 2);
  const ly = y - 18;

  // Background pill
  px(ctx, lx, ly, labelW, labelH, C.labelBg);
  px(ctx, lx, ly, labelW, 1, C.labelBorder);
  // Accent bar
  px(ctx, lx, ly + labelH - 1, labelW, 1, accentColor);

  // Name
  ctx.fillStyle = accentColor;
  ctx.font = "bold 8px monospace";
  ctx.fillText(name, lx + padX, ly + 10);

  // State
  const nameW = ctx.measureText(name + "  ").width;
  ctx.fillStyle =
    state === "busy" ? "#8ab4a0" : state === "thinking" ? "#e8c86a" : "#8c7e6d";
  ctx.fillText(stateLabel, lx + padX + nameW, ly + 10);
}

/* ── Room compositions ──────────────────────────────────── */

function drawMainOffice(ctx: CanvasRenderingContext2D) {
  const ox = 20;
  const oy = 20;
  const ow = 460;
  const oh = 460;

  drawFloor(ctx, ox, oy, ow, oh);
  drawWalls(ctx, ox, oy, ow, oh);

  // Window on top wall
  drawWindow(ctx, ox + 190, oy + 18);

  // Wall art
  drawFramedArt(ctx, ox + 30, oy + 30, 0);
  drawFramedArt(ctx, ox + 370, oy + 30, 1);

  // Shelf
  drawShelf(ctx, ox + 100, oy + 55);

  // Rug under desks — warm terracotta
  px(ctx, ox + 44, oy + 310, 372, 120, C.rug);
  px(ctx, ox + 48, oy + 314, 364, 112, C.rugPattern);
  // Rug border lines
  px(ctx, ox + 50, oy + 316, 360, 2, C.rugBorder);
  px(ctx, ox + 50, oy + 422, 360, 2, C.rugBorder);
  // Inner rug pattern
  for (let i = 0; i < 6; i++) {
    ctx.globalAlpha = 0.15;
    px(ctx, ox + 60 + i * 60, oy + 318, 1, 104, C.rugBorder);
    ctx.globalAlpha = 1;
  }

  // Desks — row 1
  drawDesk(ctx, ox + 60, oy + 90, false);
  drawDesk(ctx, ox + 200, oy + 90, true);
  drawDesk(ctx, ox + 340, oy + 90, false);

  // Desks — row 2
  drawDesk(ctx, ox + 60, oy + 240, false);
  drawDesk(ctx, ox + 200, oy + 240, false);
  drawDesk(ctx, ox + 340, oy + 240, true);

  // Plants
  drawPlant(ctx, ox + 30, oy + 180);
  drawPlant(ctx, ox + 410, oy + 180);
  drawPlant(ctx, ox + 30, oy + 340);
  drawPlant(ctx, ox + 410, oy + 340);

  // Lamps
  drawLamp(ctx, ox + 30, oy + 65);
  drawLamp(ctx, ox + 420, oy + 65);
  drawLamp(ctx, ox + 30, oy + 225);
  drawLamp(ctx, ox + 420, oy + 225);

  // Room label
  ctx.fillStyle = "#8c7e6d";
  ctx.font = "bold 9px monospace";
  ctx.letterSpacing = "2px";
  ctx.fillText("MAIN OFFICE", ox + 340, oy + 12);
  ctx.letterSpacing = "0px";
}

function drawBreakRoom(ctx: CanvasRenderingContext2D) {
  const ox = 510;
  const oy = 20;
  const ow = 280;
  const oh = 460;

  drawFloor(ctx, ox, oy, ow, oh);
  drawWalls(ctx, ox, oy, ow, oh);

  // Wall art in break room
  drawFramedArt(ctx, ox + 30, oy + 30, 2);
  drawFramedArt(ctx, ox + 190, oy + 30, 0);

  // Rug — warm cream/beige
  px(ctx, ox + 40, oy + 340, 200, 100, "#d4cbbf");
  px(ctx, ox + 44, oy + 344, 192, 92, "#c4b5a0");
  // Rug border
  px(ctx, ox + 46, oy + 346, 188, 2, "#b8956a");
  px(ctx, ox + 46, oy + 432, 188, 2, "#b8956a");

  drawSofa(ctx, ox + 30, oy + 280);
  drawCoffeeMachine(ctx, ox + 200, oy + 150);
  drawSnackTable(ctx, ox + 150, oy + 290);
  drawPlant(ctx, ox + 40, oy + 150);
  drawPlant(ctx, ox + 220, oy + 240);
  drawLamp(ctx, ox + 220, oy + 100);

  // Shelf in break room
  drawShelf(ctx, ox + 100, oy + 90);

  // Room label
  ctx.fillStyle = "#b8956a";
  ctx.font = "bold 9px monospace";
  ctx.letterSpacing = "2px";
  ctx.fillText("BREAK ROOM", ox + 80, oy + 12);
  ctx.letterSpacing = "0px";
}

function drawHallway(ctx: CanvasRenderingContext2D, time: number) {
  const hx = 480;
  const hy = 20;
  const hw = 30;
  const hh = 460;

  drawFloor(ctx, hx, hy, hw, hh);

  // Walls
  px(ctx, hx, hy, 4, hh, C.wallTrim);
  px(ctx, hx + hw - 4, hy, 4, hh, C.wallTrim);
  px(ctx, hx, hy, hw, 3, C.wallTrim);
  px(ctx, hx, hy + hh - 4, hw, 4, C.wallBaseboard);

  // Animated door lights — warm
  const pulse1 = Math.sin(time * 1.2) * 0.3 + 0.7;
  const pulse2 = Math.sin(time * 0.9 + 1) * 0.3 + 0.7;
  ctx.globalAlpha = pulse1 * 0.6;
  glow(ctx, hx + hw / 2 - 6, hy + 100, 12, 3, C.doorLight, 6);
  ctx.globalAlpha = pulse2 * 0.6;
  glow(ctx, hx + hw / 2 - 6, hy + 280, 12, 3, C.doorLightAlt, 6);
  ctx.globalAlpha = 1;
}

/* ── Vignette overlay — warm tint ──────────────────────── */

function drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(20,16,10,0.30)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

/* ── Main export ────────────────────────────────────────── */

export function OfficeCanvas({ jarvis, cody, claudius }: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const c = ctx as CanvasRenderingContext2D;

    c.imageSmoothingEnabled = false;

    let frameId: number;
    let lastTime = 0;
    let globalTime = 0;

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }

    function render() {
      const W = 800;
      const H = 500;
      globalTime += 0.05;

      c.fillStyle = C.bg;
      c.fillRect(0, 0, W, H);

      drawMainOffice(c);
      drawHallway(c, globalTime);
      drawBreakRoom(c);

      const t = 0.05;

      // Jarvis
      const jx = lerp(jarvis.x, jarvis.targetX, t);
      const jy = lerp(jarvis.y, jarvis.targetY, t);
      drawHumanoid(c, jx, jy, JARVIS_COLORS, jarvis.state, jarvis.animFrame);
      drawAgentLabel(c, jx, jy, "JARVIS", jarvis.state, "#8a7aa8");

      // Cody
      const cx = lerp(cody.x, cody.targetX, t);
      const cy = lerp(cody.y, cody.targetY, t);
      drawHumanoid(c, cx, cy, CODY_COLORS, cody.state, cody.animFrame);
      drawAgentLabel(c, cx, cy, "CODY", cody.state, "#7aaa8b");

      // Claudius
      const clx = lerp(claudius.x, claudius.targetX, t);
      const cly = lerp(claudius.y, claudius.targetY, t);
      drawHumanoid(c, clx, cly, CLAUDIUS_COLORS, claudius.state, claudius.animFrame);
      drawAgentLabel(c, clx, cly, "CLAUDIUS", claudius.state, "#d8906e");

      // Vignette
      drawVignette(c, W, H);

      // Timestamp
      c.fillStyle = "#8c7e6d";
      c.font = "8px monospace";
      c.fillText(
        `LIVE  ${new Date().toLocaleTimeString("en-US", { hour12: false })}`,
        10,
        H - 8,
      );
    }

    function loop(time: number) {
      if (time - lastTime > 16) {
        lastTime = time;
        render();
      }
      frameId = requestAnimationFrame(loop);
    }

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [jarvis, cody, claudius]);

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
