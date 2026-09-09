import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import ambienceM4a from "@/audio/ambience.m4a";
import ambienceOgg from "@/audio/ambience.ogg";

const STORAGE_KEY = "ambience-muted";

/**
 * The track is mastered to -24 LUFS, which leaves headroom but is far too
 * present as a page background. 0.25 is -12 dB, putting playback at roughly
 * -36 LUFS -- just under the -34.5 LUFS the original file was recorded at, so
 * it reads as room tone behind the scene rather than a track playing over it.
 *
 * This is the one knob: raise toward 0.4 for more presence, drop to 0.15 for
 * near-subliminal.
 */
const VOLUME = 0.25;
const FADE_IN_MS = 1400;
const FADE_OUT_MS = 350;

/** Gestures that count as "the visitor touched the page" for autoplay purposes. */
const GESTURES = ["pointerdown", "keydown", "touchstart", "wheel"] as const;

/**
 * Ramp volume rather than cutting it. Starting a two-minute ambience at full
 * level the instant it unblocks is startling; arriving over a second is not.
 * Returns a canceller so a toggle mid-fade doesn't leave two ramps fighting.
 */
function fadeTo(el: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const from = el.volume;
  const t0 = performance.now();
  let raf = 0;

  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / ms);
    el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) raf = requestAnimationFrame(step);
    else done?.();
  };
  raf = requestAnimationFrame(step);

  return () => cancelAnimationFrame(raf);
}

export function Ambience() {
  const ref = useRef<HTMLAudioElement>(null);
  const cancelFade = useRef<(() => void) | null>(null);

  // Read synchronously: an effect would let one frame of unmuted audio through
  // for someone who already chose silence.
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    try {
      localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    } catch {
      // Private mode. The preference is a convenience, not a requirement.
    }

    cancelFade.current?.();

    if (muted) {
      cancelFade.current = fadeTo(el, 0, FADE_OUT_MS, () => el.pause());
      return;
    }

    let cancelled = false;

    const rampUp = () => {
      if (!cancelled) cancelFade.current = fadeTo(el, VOLUME, FADE_IN_MS);
    };

    const onGesture = () => {
      detach();
      if (!cancelled) el.play().then(rampUp).catch(() => {});
    };
    const detach = () =>
      GESTURES.forEach((g) => window.removeEventListener(g, onGesture));

    el.volume = 0;
    el.play()
      .then(rampUp)
      .catch(() => {
        // Autoplay with sound is blocked until the visitor has interacted with
        // this origin -- a browser policy no page can opt out of. So arm the
        // first gesture instead: still no prompt and nothing to approve, it
        // just begins the moment they touch anything.
        GESTURES.forEach((g) =>
          window.addEventListener(g, onGesture, { once: true, passive: true }),
        );
      });

    return () => {
      cancelled = true;
      detach();
    };
  }, [muted]);

  return (
    <>
      {/* preload="auto": the whole point is that it is ready to start on load,
          so this is one case where eager fetching is the correct call. */}
      <audio ref={ref} loop preload="auto">
        <source src={ambienceOgg} type="audio/ogg; codecs=opus" />
        <source src={ambienceM4a} type="audio/mp4; codecs=mp4a.40.2" />
      </audio>

      <Button
        variant="ghost"
        size="icon"
        aria-label={muted ? "Turn ambience on" : "Turn ambience off"}
        aria-pressed={!muted}
        onClick={() => setMuted((m) => !m)}
        className="on-scene absolute top-6 right-6 text-white/80 hover:bg-white/10 hover:text-white sm:top-8 sm:right-8"
      >
        {muted ? <VolumeX /> : <Volume2 />}
      </Button>
    </>
  );
}
