import { BLOCKS, FIELD_RECTS, Session, TREES, WORLD_H, WORLD_W } from "./sim";

export type Camera = {
  x: number;
  y: number;
  yaw: number;
  scale: number;
  sx: number;
  sy: number;
};

export function project(x: number, y: number, cam: Camera) {
  const dx = x - cam.x;
  const dy = y - cam.y;
  const s = Math.sin(cam.yaw);
  const c = Math.cos(cam.yaw);
  const right = dx * c + dy * -s;
  const fwd = dx * -s + dy * -c;
  return { x: cam.sx + right * cam.scale, y: cam.sy - fwd * cam.scale };
}

export function unproject(sx: number, sy: number, cam: Camera) {
  const right = (sx - cam.sx) / cam.scale;
  const fwd = -(sy - cam.sy) / cam.scale;
  const s = Math.sin(cam.yaw);
  const c = Math.cos(cam.yaw);
  return {
    x: cam.x + c * right + -s * fwd,
    y: cam.y + -s * right + -c * fwd,
  };
}

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function drawWorld(ctx: CanvasRenderingContext2D, session: Session, cam: Camera, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  const hour = (session.dayMinutes / 60) % 24;
  const night = hour < 5 || hour >= 21;
  const dusk = (hour >= 17 && hour < 21) || (hour >= 5 && hour < 7);
  sky.addColorStop(0, night ? "#141822" : dusk ? "#e39a62" : "#8ec4e6");
  sky.addColorStop(0.45, night ? "#243044" : dusk ? "#f3c98a" : "#d7ecf6");
  sky.addColorStop(1, night ? "#1b2420" : "#c5d6a4");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  drawHills(ctx, cam, w);
  drawGround(ctx, cam);
  drawRiver(ctx, cam);
  drawRoad(ctx, cam);

  FIELD_RECTS.forEach((rect, index) => {
    drawField(ctx, cam, rect, session.fields[index], index === session.selected);
  });

  drawBlock(ctx, cam, BLOCKS[0], "house", session);
  drawBlock(ctx, cam, BLOCKS[1], "barn", session);
  for (const tree of TREES) drawTree(ctx, cam, tree.x, tree.y, tree.r, tree.pine);

  for (const p of session.particles) {
    if (p.life <= 0) continue;
    const s = project(p.x, p.y, cam);
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.kind === "gold" ? "#e2b657" : p.kind === "chaff" ? "#f4ecd8" : "#8a6a45";
    ctx.beginPath();
    ctx.arc(s.x, s.y, (p.kind === "dust" ? 3 : 4) * a, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawTractor(ctx, cam, session);

  ctx.font = `${Math.max(14, cam.scale * 0.7)}px Manrope, sans-serif`;
  ctx.textAlign = "center";
  for (const f of session.floats) {
    if (f.life <= 0) continue;
    const s = project(f.x, f.y, cam);
    ctx.globalAlpha = Math.max(0, f.life / f.max);
    ctx.fillStyle = "#1c1410";
    ctx.fillText(f.text, s.x + 1, s.y + 1);
    ctx.fillStyle = "#e2b657";
    ctx.fillText(f.text, s.x, s.y);
    ctx.globalAlpha = 1;
  }
}

function drawHills(ctx: CanvasRenderingContext2D, cam: Camera, w: number) {
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const p = project(-8 + i * 14, -8, cam);
    const p2 = project(-2 + i * 14, 2, cam);
    ctx.fillStyle = i % 2 ? "#6e8f78" : "#587863";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo((p.x + p2.x) / 2, p.y - cam.scale * 3.2);
    ctx.lineTo(p2.x, p2.y);
    ctx.fill();
  }
  ctx.restore();
  void w;
}

function drawGround(ctx: CanvasRenderingContext2D, cam: Camera) {
  const corners = [
    project(0, 0, cam),
    project(WORLD_W, 0, cam),
    project(WORLD_W, WORLD_H, cam),
    project(0, WORLD_H, cam),
  ];
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (const c of corners.slice(1)) ctx.lineTo(c.x, c.y);
  ctx.closePath();
  ctx.fillStyle = "#6a8f52";
  ctx.fill();

  for (let y = 4; y < WORLD_H; y += 7) {
    for (let x = 4; x < WORLD_W; x += 7) {
      const n = hash(x * 13 + y * 7);
      const p = project(x, y, cam);
      ctx.fillStyle = n > 0.5 ? "#7ea862" : "#62864c";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, cam.scale * 1.6, cam.scale * 0.7, cam.yaw, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRiver(ctx: CanvasRenderingContext2D, cam: Camera) {
  ctx.beginPath();
  const a = project(92, 0, cam);
  const b = project(WORLD_W, 0, cam);
  const c = project(WORLD_W, WORLD_H, cam);
  const d = project(90, WORLD_H, cam);
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fillStyle = "#3f7f96";
  ctx.fill();
}

function drawRoad(ctx: CanvasRenderingContext2D, cam: Camera) {
  tracePoly(ctx, cam, [
    [20, 52],
    [34, 52],
    [34, 48],
    [20, 48],
  ]);
  ctx.fillStyle = "#c4a574";
  ctx.fill();
  tracePoly(ctx, cam, [
    [24, 48],
    [30, 48],
    [40, 32],
    [34, 30],
  ]);
  ctx.fill();
}

function drawField(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  rect: { x: number; y: number; w: number; h: number },
  field: { stage: string; growth: number },
  selected: boolean,
) {
  tracePoly(ctx, cam, [
    [rect.x, rect.y],
    [rect.x + rect.w, rect.y],
    [rect.x + rect.w, rect.y + rect.h],
    [rect.x, rect.y + rect.h],
  ]);
  ctx.fillStyle =
    field.stage === "fallow"
      ? "#8b6a3e"
      : field.stage === "plowed"
        ? "#5c3b24"
        : field.stage === "ripe"
          ? "#d7b04a"
          : "#c4a15a";
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (field.stage === "plowed" || field.stage === "sown") {
    for (let i = 1; i < 8; i++) {
      const y = rect.y + (rect.h * i) / 8;
      const a = project(rect.x + 0.4, y, cam);
      const b = project(rect.x + rect.w - 0.4, y, cam);
      ctx.strokeStyle = "rgba(28,20,16,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  if (field.stage === "growing" || field.stage === "ripe") {
    const height = field.stage === "ripe" ? 1 : Math.max(0.15, field.growth);
    const step = 1.5;
    for (let y = rect.y + 1; y < rect.y + rect.h - 0.5; y += step) {
      for (let x = rect.x + 0.8; x < rect.x + rect.w - 0.5; x += step) {
        const base = project(x, y, cam);
        const tip = { x: base.x, y: base.y - cam.scale * 0.9 * height };
        ctx.strokeStyle = field.stage === "ripe" ? "#e6c35a" : field.growth < 0.45 ? "#7dbe63" : "#c6b15a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
  if (selected) {
    tracePoly(ctx, cam, [
      [rect.x, rect.y],
      [rect.x + rect.w, rect.y],
      [rect.x + rect.w, rect.y + rect.h],
      [rect.x, rect.y + rect.h],
    ]);
    ctx.strokeStyle = "#e2b657";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const mid = project(rect.x + rect.w / 2, rect.y + rect.h / 2, cam);
  ctx.fillStyle = "rgba(28,20,16,0.72)";
  ctx.font = `600 ${Math.max(12, cam.scale * 0.42)}px Manrope, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(field.stage === "ripe" ? "спелая" : field.stage === "growing" ? "пшеница" : "поле", mid.x, mid.y);
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  rect: { x: number; y: number; w: number; h: number },
  kind: "house" | "barn",
  session: Session,
) {
  const lift = kind === "house" ? cam.scale * 2.4 : cam.scale * 2.1;
  const corners = [
    project(rect.x, rect.y, cam),
    project(rect.x + rect.w, rect.y, cam),
    project(rect.x + rect.w, rect.y + rect.h, cam),
    project(rect.x, rect.y + rect.h, cam),
  ];
  ctx.beginPath();
  ctx.moveTo(corners[3].x, corners[3].y);
  ctx.lineTo(corners[2].x, corners[2].y);
  ctx.lineTo(corners[2].x, corners[2].y - lift);
  ctx.lineTo(corners[3].x, corners[3].y - lift);
  ctx.closePath();
  ctx.fillStyle = kind === "house" ? "#d8c3a0" : session.barn ? "#a8483a" : "#7c4a32";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y - lift * 0.15);
  for (const c of corners) ctx.lineTo(c.x, c.y - lift * 0.15);
  ctx.closePath();
  ctx.fillStyle = "rgba(28,20,16,0.18)";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y - lift);
  ctx.lineTo(corners[1].x, corners[1].y - lift);
  ctx.lineTo(corners[2].x, corners[2].y - lift);
  ctx.lineTo(corners[3].x, corners[3].y - lift);
  ctx.closePath();
  ctx.fillStyle = kind === "house" ? "#8c3a2f" : "#6b2e28";
  ctx.fill();

  const door = project(rect.x + rect.w * 0.5, rect.y + rect.h * 0.72, cam);
  ctx.fillStyle = "#2a2118";
  ctx.fillRect(door.x - cam.scale * 0.35, door.y - cam.scale * 0.9, cam.scale * 0.7, cam.scale * 0.9);

  if (kind === "house") {
    const win = project(rect.x + rect.w * 0.28, rect.y + rect.h * 0.4, cam);
    ctx.fillStyle = "#e2b657";
    ctx.fillRect(win.x, win.y - lift * 0.35, cam.scale * 0.55, cam.scale * 0.45);
  }
}

function drawTree(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, r: number, pine: boolean) {
  const p = project(x, y, cam);
  ctx.fillStyle = "rgba(28,20,16,0.2)";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r * cam.scale * 0.8, r * cam.scale * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pine ? "#3d5a3a" : "#f4ecd8";
  ctx.fillRect(p.x - cam.scale * 0.12, p.y - cam.scale * (pine ? 2.4 : 1.8), cam.scale * 0.24, cam.scale * (pine ? 2.4 : 1.8));
  ctx.fillStyle = pine ? "#2f6b45" : "#3f7a42";
  ctx.beginPath();
  if (pine) {
    ctx.moveTo(p.x, p.y - cam.scale * 3.4);
    ctx.lineTo(p.x + cam.scale * 1.1, p.y - cam.scale * 1.2);
    ctx.lineTo(p.x - cam.scale * 1.1, p.y - cam.scale * 1.2);
  } else {
    ctx.arc(p.x, p.y - cam.scale * 2.2, cam.scale * 1.15, 0, Math.PI * 2);
  }
  ctx.fill();
}

function drawTractor(ctx: CanvasRenderingContext2D, cam: Camera, session: Session) {
  const p = project(session.x, session.y, cam);
  const s = cam.scale;
  const bob = Math.sin(session.wheel * 2) * (session.reducedMotion ? 0 : 1.2);
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  ctx.fillStyle = "rgba(28,20,16,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, s * 0.55, s * 1.15, s * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  const spin = session.wheel;
  drawWheel(ctx, -s * 0.35, s * 0.22, s * 0.62, spin);
  drawWheel(ctx, s * 0.72, s * 0.32, s * 0.4, spin * 1.4);

  ctx.fillStyle = "#245c38";
  round(ctx, -s * 0.95, -s * 0.72, s * 1.55, s * 0.78, s * 0.16);
  ctx.fillStyle = "#1d4d30";
  round(ctx, -s * 0.2, -s * 0.95, s * 0.85, s * 0.55, s * 0.12);
  ctx.fillStyle = "#d7ecf6";
  round(ctx, s * 0.05, -s * 0.82, s * 0.48, s * 0.28, s * 0.06);
  ctx.fillStyle = "#e2b657";
  ctx.fillRect(s * 0.55, -s * 0.58, s * 0.55, s * 0.16);
  ctx.fillStyle = "#2a2118";
  ctx.fillRect(-s * 0.15, -s * 1.25, s * 0.12, s * 0.38);
  ctx.restore();
}

function drawWheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#1c1410";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e2b657";
  ctx.lineWidth = Math.max(2, r * 0.18);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, spin, spin + Math.PI);
  ctx.stroke();
  ctx.restore();
}

function tracePoly(ctx: CanvasRenderingContext2D, cam: Camera, pts: number[][]) {
  ctx.beginPath();
  pts.forEach((pt, i) => {
    const p = project(pt[0], pt[1], cam);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
