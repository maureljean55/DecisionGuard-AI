"use client";

/**
 * The emblem's arrival: on every visit the owl takes off, circles over the page like a
 * bird of prey, comes back to perch on the decision file, its eyes light up, then it
 * returns to the still emblem.
 *
 * Realism comes from three layers cut from the logo (body, left wing, right wing) so the
 * wings really beat from the shoulders, a flap / glide / flap rhythm, depth (smaller when
 * far), banking in turns, and a braking flare before touchdown.
 * Uses the Web Animations API; with prefers-reduced-motion the owl stays perched and only
 * the eyes light up.
 */
import Image from "next/image";
import { useEffect, useRef } from "react";

const W = 1063;
const H = 718;
// Shoulder pivots and eye centres, measured on the emblem (percent of its box).
const LEFT_PIVOT = "33% 42%";
const RIGHT_PIVOT = "67% 42%";
const EYES = [
  { left: "43.1%", top: "39.7%" },
  { left: "57.0%", top: "40.0%" },
];

const FLIGHT_MS = 5600;
const EYES_MS = 3400;

type Frame = Keyframe & { offset: number };

/** Wing angle over the flight (degrees; positive = tip up for the left wing). */
function wingFrames(sign: 1 | -1): Frame[] {
  const frames: Frame[] = [];
  const add = (offset: number, deg: number, easing = "ease-in-out") =>
    frames.push({
      offset,
      // Downstroke: the wing sweeps forward, so it looks slightly shorter from the front.
      transform: `rotate(${sign * deg}deg) scaleX(${deg < 0 ? 0.9 : 1})`,
      easing,
    });
  const flaps = (
    from: number,
    to: number,
    count: number,
    up: number,
    down: number,
  ) => {
    const step = (to - from) / count;
    for (let i = 0; i < count; i++) {
      add(from + i * step, up);
      add(from + i * step + step * 0.5, down);
    }
  };
  flaps(0, 0.18, 6, 32, -34); // take-off: fast, wide beats
  add(0.18, 10);
  add(0.33, 6); // gliding, wings in a slight dihedral
  add(0.47, 9);
  flaps(0.48, 0.6, 3, 26, -28); // regain height on the far side of the circle
  add(0.6, 8);
  add(0.74, 5); // second glide
  flaps(0.76, 0.9, 4, 38, -18); // braking beats, wings held high
  add(0.92, 44, "ease-out"); // flare
  add(0.96, -6, "ease-out"); // wings drop on touchdown
  add(1, 0);
  return frames;
}

/** Flight path, in pixels relative to the perched position. */
function flightFrames(rest: DOMRect): Frame[] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = rest.left + rest.width / 2;
  const cy = rest.top + rest.height / 2;
  const frame = (
    offset: number,
    x: number,
    y: number,
    s: number,
    rz: number,
    ry: number,
    extra: { opacity?: number; easing?: string } = {},
  ): Frame => ({
    ...extra,
    offset,
    transform: `perspective(1200px) translate3d(${(x - cx).toFixed(1)}px, ${(y - cy).toFixed(1)}px, 0) rotateZ(${rz}deg) rotateY(${ry}deg) scale(${s})`,
  });

  const frames: Frame[] = [
    frame(0, vw * 1.08, vh * 0.04, 0.2, -16, -30, { opacity: 0 }),
  ];
  frames.push(frame(0.04, vw * 0.96, vh * 0.1, 0.24, -18, -25, { opacity: 1 }));

  // Counter-clockwise circle over the page: far (small) at the top, near (larger) below.
  const centerX = vw * 0.5;
  const centerY = vh * 0.34;
  const rx = vw * 0.34;
  const ry = vh * 0.17;
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const theta = ((10 - (340 * i) / steps) * Math.PI) / 180;
    const x = centerX + rx * Math.cos(theta);
    const y = centerY + ry * Math.sin(theta);
    const scale = 0.4 + 0.15 * Math.sin(theta);
    const heading = Math.sin(theta); // -1 while flying left (top of the circle), +1 flying right
    frames.push(
      frame(
        0.08 + (0.62 * i) / steps,
        x,
        y,
        +scale.toFixed(3),
        -16,
        Math.round(heading * 34),
      ),
    );
  }

  // Approach from above, flare, touch down with a small settle.
  frames.push(
    frame(0.78, cx + vw * 0.07, cy - vh * 0.2, 0.78, 6, -12, {
      easing: "ease-out",
    }),
  );
  frames.push(
    frame(0.9, cx, cy - vh * 0.035, 1.04, -2, 0, { easing: "ease-out" }),
  );
  frames.push(frame(0.95, cx, cy + 6, 0.98, 0, 0, { easing: "ease-in-out" }));
  frames.push(frame(1, cx, cy, 1, 0, 0));
  return frames;
}

export function OwlFlight({ sizes }: { sizes: string }) {
  const flightRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const eyesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const flight = flightRef.current;
    const eyes = eyesRef.current;
    if (!flight || !eyes || typeof flight.animate !== "function") return;

    const lightEyes = () =>
      eyes.animate(
        [
          { opacity: 0, transform: "scale(0.5)" },
          { opacity: 1, transform: "scale(1.15)", offset: 0.12 },
          { opacity: 0.95, transform: "scale(1)", offset: 0.22 },
          { opacity: 1, transform: "scale(1.08)", offset: 0.45 },
          { opacity: 0.8, transform: "scale(1)", offset: 0.65 },
          { opacity: 0, transform: "scale(0.9)" },
        ],
        { duration: EYES_MS, easing: "ease-out" },
      );

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      flight.classList.remove("owl-pending");
      const t = window.setTimeout(lightEyes, 400);
      return () => window.clearTimeout(t);
    }

    // The perched position is the reference; measure it with no transform applied.
    const rest = flight.getBoundingClientRect();
    flight.classList.remove("owl-pending");
    flight.style.zIndex = "30"; // fly above the card and the page content
    const anims = [
      flight.animate(flightFrames(rest), {
        duration: FLIGHT_MS,
        easing: "linear",
        fill: "backwards",
      }),
      leftRef.current?.animate(wingFrames(1), { duration: FLIGHT_MS }),
      rightRef.current?.animate(wingFrames(-1), { duration: FLIGHT_MS }),
    ];
    // Slip behind the card's edge just before touchdown, so it perches *on* it.
    const perch = window.setTimeout(() => {
      flight.style.zIndex = "0";
    }, FLIGHT_MS * 0.88);
    const glow = window.setTimeout(lightEyes, FLIGHT_MS * 0.95);
    return () => {
      window.clearTimeout(perch);
      window.clearTimeout(glow);
      anims.forEach((a) => a?.cancel());
    };
  }, []);

  return (
    <div
      ref={flightRef}
      className="owl-pending relative z-0"
      style={{ transformStyle: "preserve-3d", willChange: "transform" }}
    >
      <div className="relative drop-shadow-[0_20px_60px_rgba(91,108,255,0.3)]">
        <Image
          src="/brand/owl-body.png"
          alt=""
          width={W}
          height={H}
          priority
          sizes={sizes}
          className="h-auto w-full"
        />
        <div
          ref={leftRef}
          className="absolute inset-0"
          style={{ transformOrigin: LEFT_PIVOT }}
        >
          <Image
            src="/brand/owl-wing-left.png"
            alt=""
            width={W}
            height={H}
            priority
            sizes={sizes}
            className="h-auto w-full"
          />
        </div>
        <div
          ref={rightRef}
          className="absolute inset-0"
          style={{ transformOrigin: RIGHT_PIVOT }}
        >
          <Image
            src="/brand/owl-wing-right.png"
            alt=""
            width={W}
            height={H}
            priority
            sizes={sizes}
            className="h-auto w-full"
          />
        </div>
        {/* Eye glow: lit on landing, then fades back to the normal emblem. */}
        <div
          ref={eyesRef}
          className="pointer-events-none absolute inset-0 opacity-0"
          aria-hidden
        >
          {EYES.map((pos) => (
            <span
              key={pos.left}
              className="absolute block aspect-square w-[10%] -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-screen"
              style={{
                ...pos,
                background:
                  "radial-gradient(circle, rgba(235,252,255,1) 0%, rgba(110,220,255,0.95) 22%, rgba(53,160,255,0.55) 48%, rgba(53,120,255,0) 72%)",
                filter: "blur(1px)",
                boxShadow: "0 0 22px 6px rgba(70,190,255,0.6)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
