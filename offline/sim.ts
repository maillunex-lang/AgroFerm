export const SAVE_KEY = "agroferm.offline.v1";
export const SAVE_VERSION = 1;

export const WORLD_W = 100;
export const WORLD_H = 78;

export const YIELD_TONS = 6;
export const SEED_COST = 400;
export const PRICE = 900;
export const BARN_COST = 4500;
export const CAPACITY = [8, 24] as const;
export const GROW_SECONDS = 36;
export const OFFLINE_CAP_SECONDS = 2 * 60 * 60;

export const FIELD_RECTS = [
  { x: 34, y: 14, w: 22, h: 14 },
  { x: 60, y: 14, w: 22, h: 14 },
  { x: 42, y: 34, w: 26, h: 15 },
] as const;

export const BLOCKS = [
  { x: 6, y: 16, w: 16, h: 12 },
  { x: 6, y: 36, w: 18, h: 14 },
] as const;

export const TREES: { x: number; y: number; r: number; pine: boolean }[] = [
  { x: 28, y: 10, r: 1.3, pine: false },
  { x: 31, y: 8, r: 1.1, pine: true },
  { x: 86, y: 12, r: 1.4, pine: true },
  { x: 90, y: 20, r: 1.2, pine: false },
  { x: 18, y: 62, r: 1.3, pine: false },
  { x: 24, y: 66, r: 1.1, pine: true },
  { x: 78, y: 58, r: 1.5, pine: true },
  { x: 84, y: 64, r: 1.2, pine: false },
  { x: 56, y: 62, r: 1.2, pine: false },
  { x: 14, y: 12, r: 1.1, pine: true },
];

export type Stage = "fallow" | "plowed" | "sown" | "growing" | "ripe";
export type JobKind = "plow" | "sow" | "harvest";
export type TimeScale = 1 | 3 | 8;

export type Field = { stage: Stage; growth: number };

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: "dust" | "chaff" | "gold";
};

export type FloatText = { x: number; y: number; text: string; life: number; max: number };

export type SaveData = {
  version: number;
  name: string;
  coins: number;
  wheat: number;
  barn: 0 | 1;
  fields: Field[];
  x: number;
  y: number;
  yaw: number;
  tutorial: number;
  savedAt: number;
  timeScale: TimeScale;
  dayMinutes: number;
};

export type Input = { throttle: number; steer: number };

const JOB_SECONDS: Record<JobKind, number> = { plow: 7, sow: 5.5, harvest: 7.5 };
const MAX_SPEED = 9;
const ACCEL = 16;
const BRAKE = 22;
const TURN = 2.4;

export function stageLabel(field: Field): string {
  if (field.stage === "fallow") return "залежь";
  if (field.stage === "plowed") return "вспахано";
  if (field.stage === "sown") return "посеяно";
  if (field.stage === "ripe") return "спелая";
  if (field.growth < 0.35) return "всходы";
  if (field.growth < 0.7) return "в росте";
  return "наливается";
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    name: "Наследие",
    coins: 6000,
    wheat: 0,
    barn: 0,
    fields: FIELD_RECTS.map(() => ({ stage: "fallow" as Stage, growth: 0 })),
    x: 24,
    y: 56,
    yaw: -0.4,
    tutorial: 0,
    savedAt: Date.now(),
    timeScale: 1,
    dayMinutes: 8 * 60,
  };
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (!parsed || parsed.version !== SAVE_VERSION || !Array.isArray(parsed.fields)) return null;
    const base = defaultSave();
    const save: SaveData = {
      ...base,
      ...parsed,
      fields: base.fields.map((field, i) => ({ ...field, ...(parsed.fields?.[i] ?? {}) })),
      version: SAVE_VERSION,
    };
    const elapsed = Math.min(
      OFFLINE_CAP_SECONDS,
      Math.max(0, (Date.now() - (save.savedAt || Date.now())) / 1000),
    );
    const scaled = elapsed * save.timeScale;
    for (const field of save.fields) {
      if (field.stage === "sown") {
        field.stage = "growing";
        field.growth = 0;
      }
      if (field.stage === "growing") {
        field.growth = Math.min(1, field.growth + scaled / GROW_SECONDS);
        if (field.growth >= 1) {
          field.stage = "ripe";
          field.growth = 1;
        }
      }
    }
    save.dayMinutes = (save.dayMinutes + scaled * 10) % (24 * 60);
    return save;
  } catch {
    return null;
  }
}

export function writeSave(save: SaveData) {
  try {
    const payload = JSON.stringify({ ...save, savedAt: Date.now() });
    localStorage.setItem(SAVE_KEY + ".bak", localStorage.getItem(SAVE_KEY) ?? payload);
    localStorage.setItem(SAVE_KEY, payload);
  } catch {
    /* private mode or quota: keep playing in memory */
  }
}

export class Session {
  name = "Наследие";
  coins = 6000;
  wheat = 0;
  barn: 0 | 1 = 0;
  fields: Field[] = FIELD_RECTS.map(() => ({ stage: "fallow" as Stage, growth: 0 }));
  x = 24;
  y = 56;
  yaw = -0.4;
  speed = 0;
  tutorial = 0;
  timeScale: TimeScale = 1;
  dayMinutes = 8 * 60;
  job: { kind: JobKind; field: number; progress: number } | null = null;
  preferAuto = true;
  manualDrive = false;
  selected = 0;
  notice = "Поле ждёт первой вспашки.";
  log: string[] = [];
  hitstop = 0;
  trauma = 0;
  wheel = 0;
  particles: Particle[] = [];
  floats: FloatText[] = [];
  pending: string[] = [];
  reducedMotion = false;

  static fresh() {
    return new Session();
  }

  static fromSave(save: SaveData) {
    const s = new Session();
    s.name = save.name || "Наследие";
    s.coins = save.coins;
    s.wheat = save.wheat;
    s.barn = save.barn;
    s.fields = save.fields.map((f) => ({ stage: f.stage, growth: f.growth }));
    s.x = save.x;
    s.y = save.y;
    s.yaw = save.yaw;
    s.tutorial = save.tutorial;
    s.timeScale = save.timeScale === 3 || save.timeScale === 8 ? save.timeScale : 1;
    s.dayMinutes = save.dayMinutes;
    s.notice = "Хозяйство на месте. Урожай, который поспел без вас, уже на поле.";
    return s;
  }

  toSave(): SaveData {
    return {
      version: SAVE_VERSION,
      name: this.name,
      coins: this.coins,
      wheat: this.wheat,
      barn: this.barn,
      fields: this.fields.map((f) => ({ ...f })),
      x: this.x,
      y: this.y,
      yaw: this.yaw,
      tutorial: this.tutorial,
      savedAt: Date.now(),
      timeScale: this.timeScale,
      dayMinutes: this.dayMinutes,
    };
  }

  capacity() {
    return CAPACITY[this.barn];
  }

  forward() {
    return { x: -Math.sin(this.yaw), y: -Math.cos(this.yaw) };
  }

  actionFor(index: number): { kind: JobKind; label: string } | null {
    const field = this.fields[index];
    if (!field || this.job) return null;
    if (field.stage === "fallow") return { kind: "plow", label: "Вспахать" };
    if (field.stage === "plowed") return { kind: "sow", label: `Посеять · ${SEED_COST}` };
    if (field.stage === "ripe") return { kind: "harvest", label: "Убрать урожай" };
    return null;
  }

  startJob(index: number) {
    const action = this.actionFor(index);
    if (!action) return;
    if (action.kind === "sow" && this.coins < SEED_COST) {
      this.notice = "На семена не хватает монет.";
      return;
    }
    if (action.kind === "harvest" && this.wheat + YIELD_TONS > this.capacity()) {
      this.notice = "Амбар не примет ещё 6 т. Продайте зерно или почините крышу.";
      return;
    }
    if (action.kind === "sow") this.coins -= SEED_COST;
    this.selected = index;
    this.job = { kind: action.kind, field: index, progress: 0 };
    this.manualDrive = false;
    const names = ["первое", "второе", "третье"];
    this.notice =
      action.kind === "plow"
        ? `Трактор вышел на ${names[index]} поле.`
        : action.kind === "sow"
          ? "Семена в сеялке. Пшеница, не выдуманный сорт с биржи."
          : "Жатка опущена. Зерно посчитает хозяйство, не спидометр.";
    if (this.tutorial === 0 && action.kind === "plow") this.tutorial = 1;
    this.pending.push("engine");
  }

  sell() {
    if (this.wheat <= 0) {
      this.notice = "В амбаре пусто.";
      return;
    }
    const tons = this.wheat;
    const money = tons * PRICE;
    this.coins += money;
    this.wheat = 0;
    this.note(`Продано ${tons} т за ${money}`);
    this.notice = "Закупщик у амбара забрал зерно по твёрдой цене.";
    this.burst(this.x, this.y, "gold");
    this.pending.push("sell");
    if (this.tutorial < 6) this.tutorial = 6;
  }

  repairBarn() {
    if (this.barn === 1) return;
    if (this.coins < BARN_COST) {
      this.notice = `Крыша стоит ${BARN_COST}. Сейчас ${this.coins}.`;
      return;
    }
    this.coins -= BARN_COST;
    this.barn = 1;
    this.note("Амбар крыт, вмещает 24 т");
    this.notice = "Теперь можно держать урожай с трёх полей.";
    this.pending.push("buy");
    this.trauma = Math.min(1, this.trauma + 0.25);
  }

  step(input: Input, dt: number) {
    const stepDt = Math.min(dt, 0.05);
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - stepDt);
      this.decayFx(stepDt);
      return;
    }

    const growDt = stepDt * this.timeScale;
    this.dayMinutes = (this.dayMinutes + growDt * 12) % (24 * 60);
    for (const field of this.fields) {
      if (field.stage !== "growing") continue;
      field.growth = Math.min(1, field.growth + growDt / GROW_SECONDS);
      if (field.growth >= 1) {
        field.stage = "ripe";
        field.growth = 1;
        this.notice = "Пшеница поспела. Можно убирать.";
        if (this.tutorial < 4) this.tutorial = 4;
        this.pending.push("ripe");
      }
    }

    let throttle = input.throttle;
    let steer = input.steer;
    const playerDriving = Math.abs(throttle) > 0.05 || Math.abs(steer) > 0.05;
    if (playerDriving) this.manualDrive = true;

    if (this.job && this.preferAuto && !playerDriving) {
      const aim = this.autopilot();
      throttle = aim.throttle;
      steer = aim.steer;
    }

    const speedFactor = Math.max(0.42, Math.min(1, Math.abs(this.speed) / MAX_SPEED));
    const reverse = this.speed >= 0 ? 1 : -1;
    if (Math.abs(this.speed) > 0.15 || Math.abs(throttle) > 0) {
      this.yaw += steer * TURN * speedFactor * reverse * stepDt;
    }

    if (throttle > 0) this.speed = Math.min(MAX_SPEED, this.speed + ACCEL * throttle * stepDt);
    else if (throttle < 0) this.speed = Math.max(-MAX_SPEED * 0.45, this.speed + BRAKE * throttle * stepDt);
    else this.speed *= Math.max(0, 1 - 1.8 * stepDt);

    if (Math.abs(this.speed) < 0.04) this.speed = 0;

    const fwd = this.forward();
    const next = collide(this.x + fwd.x * this.speed * stepDt, this.y + fwd.y * this.speed * stepDt, 1.15);
    if (Math.hypot(next.x - this.x, next.y - this.y) < Math.abs(this.speed) * stepDt * 0.35) {
      this.speed *= 0.4;
    }
    this.x = next.x;
    this.y = next.y;
    this.wheel += Math.abs(this.speed) * stepDt;

    if (Math.abs(this.speed) > 2.2 && Math.random() < stepDt * 18) {
      this.spawn(this.x - fwd.x * 1.4, this.y - fwd.y * 1.4, "dust");
    }

    if (this.job) {
      const rect = FIELD_RECTS[this.job.field];
      const inside = pointInRect(this.x, this.y, rect, 0.4);
      let rate = 0;
      if (this.preferAuto && !playerDriving) rate = 1;
      else if (inside && Math.abs(this.speed) > 0.8) rate = 1.05;
      this.job.progress = Math.min(1, this.job.progress + (stepDt * rate) / JOB_SECONDS[this.job.kind]);
      if (this.job.progress >= 1) this.finishJob();
    }

    this.trauma = Math.max(0, this.trauma - stepDt * 0.8);
    this.decayFx(stepDt);
  }

  private autopilot(): Input {
    if (!this.job) return { throttle: 0, steer: 0 };
    const rect = FIELD_RECTS[this.job.field];
    const lanes = 5;
    const t = this.job.progress;
    const lane = Math.min(lanes - 1, Math.floor(t * lanes));
    const along = (t * lanes) % 1;
    const dir = lane % 2 === 0 ? along : 1 - along;
    const tx = rect.x + 1.6 + dir * (rect.w - 3.2);
    const ty = rect.y + ((lane + 0.5) / lanes) * rect.h;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const desired = Math.atan2(-dx, -dy);
    let diff = desired - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff / 0.7));
    return { throttle: 1, steer };
  }

  private finishJob() {
    if (!this.job) return;
    const field = this.fields[this.job.field];
    const kind = this.job.kind;
    this.job = null;
    this.manualDrive = false;
    if (kind === "plow") {
      field.stage = "plowed";
      this.notice = "Пашня готова. Теперь семена.";
      this.note("Поле вспахано");
      if (this.tutorial < 2) this.tutorial = 2;
    } else if (kind === "sow") {
      field.stage = "growing";
      field.growth = 0;
      this.notice = "Пшеница в земле. Ход времени можно ускорить — это офлайн, не чит магазина.";
      this.note("Пшеница посеяна");
      if (this.tutorial < 3) this.tutorial = 3;
    } else {
      field.stage = "fallow";
      field.growth = 0;
      this.wheat += YIELD_TONS;
      this.hitstop = this.reducedMotion ? 0 : 0.07;
      this.trauma = this.reducedMotion ? 0 : 0.55;
      this.burst(this.x, this.y, "chaff");
      this.float(`+${YIELD_TONS} т`);
      this.notice = `${YIELD_TONS} т в амбаре. Можно продать по ${PRICE} за тонну.`;
      this.note(`Убрано ${YIELD_TONS} т`);
      if (this.tutorial < 5) this.tutorial = 5;
      this.pending.push("harvest");
    }
    this.pending.push("done");
  }

  private note(line: string) {
    this.log = [line, ...this.log].slice(0, 4);
  }

  private float(text: string) {
    this.floats.push({ x: this.x, y: this.y, text, life: 1.3, max: 1.3 });
  }

  private burst(x: number, y: number, kind: Particle["kind"]) {
    for (let i = 0; i < 16; i++) this.spawn(x, y, kind, true);
  }

  private spawn(x: number, y: number, kind: Particle["kind"], burst = false) {
    const a = Math.random() * Math.PI * 2;
    const s = burst ? 2 + Math.random() * 4 : 0.4 + Math.random();
    const p = this.particles.find((item) => item.life <= 0);
    const slot: Particle = p ?? {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      max: 1,
      kind: "dust",
    };
    slot.x = x;
    slot.y = y;
    slot.vx = Math.cos(a) * s;
    slot.vy = Math.sin(a) * s;
    slot.life = slot.max = burst ? 0.7 + Math.random() * 0.4 : 0.45;
    slot.kind = kind;
    if (!p) {
      if (this.particles.length < 90) this.particles.push(slot);
    }
  }

  private decayFx(dt: number) {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (const f of this.floats) {
      if (f.life <= 0) continue;
      f.life -= dt;
      f.y -= dt * 1.5;
    }
  }
}

function pointInRect(
  x: number,
  y: number,
  rect: { x: number; y: number; w: number; h: number },
  pad: number,
) {
  return x >= rect.x - pad && y >= rect.y - pad && x <= rect.x + rect.w + pad && y <= rect.y + rect.h + pad;
}

function collide(x: number, y: number, r: number) {
  let px = Math.max(r + 1, Math.min(WORLD_W - r - 1, x));
  let py = Math.max(r + 1, Math.min(WORLD_H - r - 1, y));
  const solids: { x: number; y: number; w: number; h: number }[] = [...BLOCKS];
  for (const tree of TREES) {
    solids.push({ x: tree.x - tree.r, y: tree.y - tree.r, w: tree.r * 2, h: tree.r * 2 });
  }
  for (const b of solids) {
    const cx = Math.max(b.x, Math.min(px, b.x + b.w));
    const cy = Math.max(b.y, Math.min(py, b.y + b.h));
    let dx = px - cx;
    let dy = py - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 < 1e-6) {
      const left = px - b.x;
      const right = b.x + b.w - px;
      const top = py - b.y;
      const bottom = b.y + b.h - py;
      const min = Math.min(left, right, top, bottom);
      if (min === left) px = b.x - r;
      else if (min === right) px = b.x + b.w + r;
      else if (min === top) py = b.y - r;
      else py = b.y + b.h + r;
      continue;
    }
    const d = Math.sqrt(d2);
    px += (dx / d) * (r - d);
    py += (dy / d) * (r - d);
  }
  return { x: px, y: py };
}

export function clockLabel(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const part = h < 5 ? "ночь" : h < 11 ? "утро" : h < 17 ? "день" : h < 21 ? "вечер" : "ночь";
  return `${hh}:${mm} · ${part}`;
}

export function fieldAt(x: number, y: number) {
  for (let i = FIELD_RECTS.length - 1; i >= 0; i--) {
    const rect = FIELD_RECTS[i];
    if (pointInRect(x, y, rect, 0)) return i;
  }
  return -1;
}
