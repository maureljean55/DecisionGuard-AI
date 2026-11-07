"use client";

/**
 * The emblem's arrival, on every visit:
 * 1. the owl comes out of the depth along a straight line, right behind its resting place,
 *    wings half folded, and settles where it belongs;
 * 2. its eyes light up in a deep blue and send out rays of light;
 * 3. then it blinks like a real owl (upper lid coming down), at irregular intervals.
 * Web Animations API. With prefers-reduced-motion: no approach, no blinking, only the glow.
 */
import Image from "next/image";
import { useEffect, useRef } from "react";

const W = 1063;
const H = 718;
// Measured on the emblem (percent of its box).
const LEFT_PIVOT = "33% 42%";
const RIGHT_PIVOT = "67% 42%";
const EYES = [
  { left: "42.71%", top: "41.36%" },
  { left: "57.76%", top: "41.64%" },
];

const ARRIVAL_MS = 1900;
const GLOW_MS = 3200;
const BLINK_MS = 170;

const easeOut = "cubic-bezier(0.16, 0.84, 0.3, 1)";

function wings(sign: 1 | -1): Keyframe[] {
  // Half folded (tips down) far away, opening as it comes close, a small overshoot, rest.
  return [
    { transform: `rotate(${sign * -22}deg) scaleX(0.82)` },
    { transform: `rotate(${sign * -10}deg) scaleX(0.92)`, offset: 0.45 },
    { transform: `rotate(${sign * 5}deg) scaleX(1)`, offset: 0.82 },
    { transform: "rotate(0deg) scaleX(1)" },
  ];
}

export function OwlArrival({ sizes }: { sizes: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const raysRef = useRef<HTMLDivElement>(null);
  const lidsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const glow = glowRef.current;
    const rays = raysRef.current;
    const lids = lidsRef.current;
    if (!root || !glow || !rays || !lids || typeof root.animate !== "function")
      return;

    const timers: number[] = [];
    const later = (fn: () => void, ms: number) =>
      timers.push(window.setTimeout(fn, ms));
    const anims: Animation[] = [];
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const lightUp = () => {
      anims.push(
        glow.animate(
          [
            { opacity: 0, transform: "scale(0.5)" },
            { opacity: 1, transform: "scale(1.12)", offset: 0.14 },
            { opacity: 0.9, transform: "scale(1)", offset: 0.3 },
            { opacity: 1, transform: "scale(1.06)", offset: 0.55 },
            { opacity: 0 },
          ],
          { duration: GLOW_MS, easing: "ease-out" },
        ),
      );
      if (reduced) return;
      // Rays: thin beams radiating from each eye, slowly turning, then fading out.
      for (const beam of rays.querySelectorAll<HTMLElement>("[data-rays]")) {
        const dir = beam.dataset.rays === "left" ? -1 : 1;
        anims.push(
          beam.animate(
            [
              {
                opacity: 0,
                transform: "translate(-50%, -50%) scale(0.4) rotate(0deg)",
              },
              {
                opacity: 0.95,
                transform: `translate(-50%, -50%) scale(1) rotate(${dir * 8}deg)`,
                offset: 0.2,
              },
              {
                opacity: 0.7,
                transform: `translate(-50%, -50%) scale(1.15) rotate(${dir * 22}deg)`,
                offset: 0.6,
              },
              {
                opacity: 0,
                transform: `translate(-50%, -50%) scale(1.3) rotate(${dir * 34}deg)`,
              },
            ],
            { duration: GLOW_MS, easing: "ease-out" },
          ),
        );
      }
    };

    const blinkOnce = (delay = 0) => {
      lids.querySelectorAll<HTMLElement>("[data-lid]").forEach((lid, i) => {
        anims.push(
          lid.animate(
            [
              {
                transform: "translateY(-102%)",
                easing: "cubic-bezier(0.5, 0, 0.9, 0.6)",
              },
              { transform: "translateY(0%)", offset: 0.42 },
              {
                transform: "translateY(0%)",
                offset: 0.56,
                easing: "cubic-bezier(0.2, 0.5, 0.4, 1)",
              },
              { transform: "translateY(-102%)" },
            ],
            // The two eyes are a few milliseconds apart, as in real blinks.
            { duration: BLINK_MS, delay: delay + i * 12 },
          ),
        );
      });
    };

    const scheduleBlinks = () => {
      const next = 2600 + Math.random() * 3800;
      later(() => {
        if (!document.hidden) {
          blinkOnce();
          if (Math.random() < 0.22) blinkOnce(BLINK_MS + 110); // occasional double blink
        }
        scheduleBlinks();
      }, next);
    };

    root.classList.remove("owl-pending");

    if (reduced) {
      later(lightUp, 300);
      return () => timers.forEach(clearTimeout);
    }

    // 1. Straight out of the depth, on the axis of its resting place.
    anims.push(
      root.animate(
        [
          {
            transform: "perspective(1000px) translateZ(-2200px)",
            opacity: 0,
            filter: "blur(8px)",
          },
          { opacity: 1, offset: 0.25 },
          {
            transform: "perspective(1000px) translateZ(-900px)",
            filter: "blur(2px)",
            offset: 0.45,
          },
          {
            transform: "perspective(1000px) translateZ(45px)",
            filter: "blur(0px)",
            offset: 0.84,
          },
          {
            transform: "perspective(1000px) translateZ(0px)",
            opacity: 1,
            filter: "blur(0px)",
          },
        ],
        { duration: ARRIVAL_MS, easing: easeOut },
      ),
    );
    if (leftRef.current)
      anims.push(
        leftRef.current.animate(wings(1), {
          duration: ARRIVAL_MS,
          easing: easeOut,
        }),
      );
    if (rightRef.current)
      anims.push(
        rightRef.current.animate(wings(-1), {
          duration: ARRIVAL_MS,
          easing: easeOut,
        }),
      );

    // 2. Eyes light up once it has settled; 3. then natural blinking.
    later(lightUp, ARRIVAL_MS + 150);
    later(
      () => {
        blinkOnce();
        scheduleBlinks();
      },
      ARRIVAL_MS + GLOW_MS + 500,
    );

    return () => {
      timers.forEach(clearTimeout);
      anims.forEach((a) => a.cancel());
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="owl-pending relative"
      style={{ willChange: "transform" }}
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

        {/* Eyelids: upper lids textured with the owl's own facial feathers, curved edge and
            lash line; parked above the eye (clipped away) until a blink. */}
        <div
          ref={lidsRef}
          className="pointer-events-none absolute inset-0"
          aria-hidden
        >
          {EYES.map((pos, i) => (
            <span
              key={pos.left}
              className="absolute block aspect-square w-[5.5%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
              style={pos}
            >
              <span
                data-lid
                className="absolute inset-0 block bg-cover"
                style={{
                  transform: "translateY(-102%)",
                  backgroundImage: `url(/brand/owl-lid-${i === 0 ? "left" : "right"}.png)`,
                }}
              />
            </span>
          ))}
        </div>

        {/* Deep-blue glow at the eyes. */}
        <div
          ref={glowRef}
          className="pointer-events-none absolute inset-0 opacity-0"
          aria-hidden
        >
          {EYES.map((pos) => (
            <span
              key={pos.left}
              className="absolute block aspect-square w-[8%] -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-screen"
              style={{
                ...pos,
                background:
                  "radial-gradient(circle, rgba(170,205,255,1) 0%, rgba(60,120,255,0.95) 24%, rgba(28,72,235,0.6) 50%, rgba(20,50,200,0) 72%)",
                boxShadow: "0 0 14px 4px rgba(30,90,255,0.55)",
              }}
            />
          ))}
        </div>

        {/* Rays of light emitted by the eyes. */}
        <div
          ref={raysRef}
          className="pointer-events-none absolute inset-0"
          aria-hidden
        >
          {EYES.map((pos, i) => (
            <span
              key={pos.left}
              data-rays={i === 0 ? "left" : "right"}
              className="absolute block aspect-square w-[62%] rounded-full opacity-0 mix-blend-screen"
              style={{
                ...pos,
                transform: "translate(-50%, -50%)",
                background:
                  "repeating-conic-gradient(from 0deg, rgba(30,85,255,0) 0deg 8deg, rgba(50,110,255,0.8) 10.5deg, rgba(30,85,255,0) 13deg 22deg)",
                WebkitMaskImage:
                  "radial-gradient(circle, transparent 7%, #000 11%, rgba(0,0,0,0.6) 30%, transparent 62%)",
                maskImage:
                  "radial-gradient(circle, transparent 7%, #000 11%, rgba(0,0,0,0.6) 30%, transparent 62%)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
