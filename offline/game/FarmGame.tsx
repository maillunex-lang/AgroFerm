import { useEffect, useRef, useState, type PointerEvent } from "react";
import { FarmAudio } from "./audio";
import { drawWorld, unproject, type Camera } from "./draw";
import "./game.css";
import {
  BARN_COST,
  PRICE,
  Session,
  clockLabel,
  fieldAt,
  loadSave,
  stageLabel,
  writeSave,
  type TimeScale,
} from "./sim";

type Held = { gas: boolean; back: boolean; left: boolean; right: boolean };

export function FarmGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<Session | null>(null);
  const heldRef = useRef<Held>({ gas: false, back: false, left: false, right: false });
  const keysRef = useRef<Set<string>>(new Set());
  const overrideRef = useRef<Set<string> | null>(null);
  const audioRef = useRef(new FarmAudio());
  const [phase, setPhase] = useState<"title" | "play">("title");
  const [hasSave, setHasSave] = useState(false);
  const [tick, setTick] = useState(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    setHasSave(loadSave() !== null);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const probe = {
      getYaw: () => sessionRef.current?.yaw ?? 0,
      getSpeed: () => sessionRef.current?.speed ?? 0,
      setKeys: (codes: string[]) => {
        overrideRef.current = new Set(codes);
      },
      setSteer: (v: number) => {
        const next = new Set<string>();
        if (v > 0.2) next.add("KeyA");
        if (v < -0.2) next.add("KeyD");
        overrideRef.current = next;
      },
    };
    window.__controlsTest = probe;

    const backdrop = Session.fresh();
    backdrop.fields[0] = { stage: "ripe", growth: 1 };
    backdrop.fields[1] = { stage: "growing", growth: 0.62 };
    backdrop.fields[2] = { stage: "plowed", growth: 0 };
    backdrop.x = 48;
    backdrop.y = 50;
    backdrop.yaw = -0.2;
    let raf = 0;
    let last = performance.now();
    let saveAcc = 0;
    let uiAcc = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const onKey = (event: KeyboardEvent) => {
      if (event.type === "keydown") keysRef.current.add(event.code);
      else keysRef.current.delete(event.code);
    };
    const clearKeys = () => keysRef.current.clear();
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && sessionRef.current && phaseRef.current === "play") {
        writeSave(sessionRef.current.toSave());
      }
    });

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const session = sessionRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (session && phaseRef.current === "play") {
        const keys = overrideRef.current ?? keysRef.current;
        const held = heldRef.current;
        let throttle = 0;
        let steer = 0;
        if (keys.has("KeyW") || keys.has("ArrowUp") || held.gas) throttle += 1;
        if (keys.has("KeyS") || keys.has("ArrowDown") || held.back) throttle -= 1;
        if (keys.has("KeyA") || keys.has("ArrowLeft") || held.left) steer += 1;
        if (keys.has("KeyD") || keys.has("ArrowRight") || held.right) steer -= 1;
        session.step(
          { throttle: Math.max(-1, Math.min(1, throttle)), steer: Math.max(-1, Math.min(1, steer)) },
          dt,
        );
        audioRef.current.engineAt(session.speed);
        for (const event of session.pending.splice(0)) {
          if (event === "sell" || event === "harvest" || event === "buy" || event === "ripe" || event === "done") {
            audioRef.current.blip(event);
          }
        }
        saveAcc += dt;
        if (saveAcc > 2.5) {
          saveAcc = 0;
          writeSave(session.toSave());
        }
        uiAcc += dt;
        if (uiAcc > 0.2) {
          uiAcc = 0;
          setTick((n) => (n + 1) % 100000);
        }
      }
      const drawn = session && phaseRef.current === "play" ? session : backdrop;
      const shake = drawn && phaseRef.current === "play" && !drawn.reducedMotion ? drawn.trauma * drawn.trauma * 8 : 0;
      const cam = makeCamera(phaseRef.current === "play" ? session : backdrop, w, h, shake, now);
      drawWorld(ctx, drawn, cam, w, h);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", clearKeys);
      if (window.__controlsTest === probe) delete window.__controlsTest;
      audioRef.current.stopEngine();
    };
  }, []);

  const session = sessionRef.current;
  const view = tick >= 0 ? session : session;
  const action = view?.actionFor(view.selected);

  const begin = (mode: "new" | "continue") => {
    audioRef.current.unlock();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next =
      mode === "continue" ? Session.fromSave(loadSave() ?? Session.fresh().toSave()) : Session.fresh();
    next.reducedMotion = reduced;
    sessionRef.current = next;
    setPhase("play");
    setTick((n) => n + 1);
  };

  const hold =
    (key: keyof Held, down: boolean) => (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      heldRef.current[key] = down;
      if (down) audioRef.current.unlock();
    };

  return (
    <div className="ag-root">
      <canvas
        ref={canvasRef}
        className="ag-canvas"
        onPointerDown={(event) => {
          const current = sessionRef.current;
          const canvas = canvasRef.current;
          if (!current || !canvas || phase !== "play") return;
          const rect = canvas.getBoundingClientRect();
          const cam = makeCamera(current, rect.width, rect.height, 0, performance.now());
          const world = unproject(event.clientX - rect.left, event.clientY - rect.top, cam);
          const index = fieldAt(world.x, world.y);
          if (index >= 0) {
            current.selected = index;
            setTick((n) => n + 1);
          }
        }}
      />
      {phase === "title" ? (
        <div className="ag-title">
          <div className="ag-title-card">
            <h1>АгроБашкирия</h1>
            <p>Наследие земли. Офлайн, одно хозяйство на этом устройстве.</p>
            <p className="ag-muted">
              Стилизованный двор в Уфимском районе. Виртуальная земля: это не кадастр и не право на
              настоящий участок. Техника вымышленная, марка «Яик-28».
            </p>
            <div className="ag-row">
              <button className="ag-btn ag-btn-primary" onClick={() => begin("new")}>
                Начать
              </button>
              {hasSave ? (
                <button className="ag-btn" onClick={() => begin("continue")}>
                  Продолжить
                </button>
              ) : null}
            </div>
            <p className="ag-muted">Руль: W газ, S тормоз, A влево, D вправо. Или кнопки справа.</p>
          </div>
        </div>
      ) : view ? (
        <>
          <header className="ag-hud">
            <div className="ag-chip">
              <span>хозяйство</span>
              <b>{view.name}</b>
            </div>
            <div className="ag-chip">
              <span>монеты</span>
              <b>{view.coins}</b>
            </div>
            <div className="ag-chip">
              <span>пшеница</span>
              <b>
                {view.wheat} / {view.capacity()} т
              </b>
            </div>
            <div className="ag-chip">
              <span>закупка</span>
              <b>{PRICE} / т</b>
            </div>
            <div className="ag-chip">
              <span>небо</span>
              <b>{clockLabel(view.dayMinutes)}</b>
            </div>
          </header>
          <div className="ag-toast">
            <div>{view.notice}</div>
            {view.job ? (
              <div className="ag-muted">
                Работа {Math.round(view.job.progress * 100)}%.{" "}
                {view.manualDrive ? "Руль у вас." : "Трактор идёт сам."}
              </div>
            ) : null}
            {view.log.length > 0 ? (
              <ul className="ag-log">
                {view.log.slice(0, 2).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <footer className="ag-dock">
            <div className="ag-actions">
              {[0, 1, 2].map((index) => (
                <button
                  key={index}
                  className={index === view.selected ? "ag-btn ag-btn-leaf" : "ag-btn"}
                  onClick={() => {
                    if (!sessionRef.current) return;
                    sessionRef.current.selected = index;
                    setTick((n) => n + 1);
                  }}
                >
                  Поле {index + 1}
                  <span className="ag-muted"> · {stageLabel(view.fields[index])}</span>
                </button>
              ))}
              <button
                className="ag-btn ag-btn-primary"
                disabled={!action}
                onClick={() => {
                  audioRef.current.unlock();
                  sessionRef.current?.startJob(sessionRef.current.selected);
                  setTick((n) => n + 1);
                }}
              >
                {action?.label ?? (view.fields[view.selected].stage === "growing" ? "Растёт" : "Ждём")}
              </button>
              <button
                className="ag-btn"
                disabled={view.wheat <= 0}
                onClick={() => {
                  sessionRef.current?.sell();
                  setTick((n) => n + 1);
                }}
              >
                Продать {view.wheat > 0 ? `${view.wheat * PRICE}` : ""}
              </button>
              <button
                className="ag-btn"
                disabled={view.barn === 1 || view.coins < BARN_COST}
                onClick={() => {
                  sessionRef.current?.repairBarn();
                  setTick((n) => n + 1);
                }}
              >
                {view.barn === 1 ? "Амбар крыт" : `Крыша амбара ${BARN_COST}`}
              </button>
              {([1, 3, 8] as TimeScale[]).map((scale) => (
                <button
                  key={scale}
                  className={view.timeScale === scale ? "ag-btn ag-btn-leaf" : "ag-btn"}
                  onClick={() => {
                    if (!sessionRef.current) return;
                    sessionRef.current.timeScale = scale;
                    setTick((n) => n + 1);
                  }}
                >
                  {scale}×
                </button>
              ))}
              <button
                className="ag-btn"
                onClick={() => {
                  if (!sessionRef.current) return;
                  sessionRef.current.preferAuto = !sessionRef.current.preferAuto;
                  sessionRef.current.manualDrive = !sessionRef.current.preferAuto;
                  setTick((n) => n + 1);
                }}
              >
                {view.preferAuto ? "Авто" : "Сам"}
              </button>
            </div>
            <div className="ag-steer">
              <button className="ag-btn ag-gas" onPointerDown={hold("gas", true)} onPointerUp={hold("gas", false)} onPointerLeave={hold("gas", false)}>
                Газ
              </button>
              <button className="ag-btn ag-left" onPointerDown={hold("left", true)} onPointerUp={hold("left", false)} onPointerLeave={hold("left", false)}>
                Л
              </button>
              <button className="ag-btn ag-back" onPointerDown={hold("back", true)} onPointerUp={hold("back", false)} onPointerLeave={hold("back", false)}>
                Наз
              </button>
              <button className="ag-btn ag-right" onPointerDown={hold("right", true)} onPointerUp={hold("right", false)} onPointerLeave={hold("right", false)}>
                П
              </button>
            </div>
          </footer>
        </>
      ) : null}
    </div>
  );
}

function makeCamera(session: Session | null, w: number, h: number, shake: number, now: number): Camera {
  const scale = Math.max(28, Math.min(w, h) / 15);
  const yaw = session?.yaw ?? 0;
  const fx = -Math.sin(yaw);
  const fy = -Math.cos(yaw);
  const lookX = (session?.x ?? 24) + fx * 4.5;
  const lookY = (session?.y ?? 56) + fy * 4.5;
  const n = Math.sin(now * 0.017) * shake;
  return {
    x: lookX,
    y: lookY,
    yaw,
    scale,
    sx: w / 2 + n,
    sy: h / 2 + Math.cos(now * 0.013) * shake,
  };
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
      setSteer?: (v: number) => void;
    };
  }
}
