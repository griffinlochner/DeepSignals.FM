import { useEffect, useMemo, useRef, useState } from "react";
import "./publicBrandIdent.css";

type PublicBrandIdentProps = {
  className?: string;
  as?: "p" | "span";
};

type CellState = {
  glyph: string;
  resolved: boolean;
};

const TARGET_TEXT = "DEEPSIGNALS.FM";
const TARGET_CHARS = TARGET_TEXT.split("");

const GLYPH_POOL = [
  "A",
  "E",
  "H",
  "K",
  "M",
  "N",
  "R",
  "T",
  "X",
  "Z",
  "0",
  "1",
  "3",
  "4",
  "7",
  "8",
  "@",
  "#",
  "%",
  "&",
  "/",
  "\\",
  "|",
  "<",
  ">",
  "[",
  "]",
  "{",
  "}",
  "+",
  "=",
  "*",
  "?",
];

const GLYPH_TICK_MS = 86;
const DECODE_STEP_MS = 148;
const RESOLVED_HOLD_MS = 3000;
const SCRAMBLE_PHASE_MS = 920;

function randomInt(maxExclusive: number) {
  return Math.floor(Math.random() * maxExclusive);
}

function randomGlyph() {
  return GLYPH_POOL[randomInt(GLYPH_POOL.length)];
}

function shuffleIndices(length: number) {
  const indices = Array.from({ length }, (_, index) => index);

  for (let index = indices.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    const current = indices[index];
    indices[index] = indices[swapIndex];
    indices[swapIndex] = current;
  }

  return indices;
}

function buildCells(resolvedLookup: Set<number>) {
  return TARGET_CHARS.map((char, index) => {
    if (resolvedLookup.has(index)) {
      return { glyph: char, resolved: true };
    }

    return { glyph: randomGlyph(), resolved: false };
  });
}

function buildScrambledCells() {
  return buildCells(new Set<number>());
}

function getResolvedToneClass(index: number) {
  if (index <= 3) {
    return "public-brand-ident__cell--deep";
  }

  if (index <= 10) {
    return "public-brand-ident__cell--signals";
  }

  if (index === 11) {
    return "public-brand-ident__cell--dot";
  }

  return "public-brand-ident__cell--fm";
}

function getReducedMotionPreferred() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function PublicBrandIdent({
  className = "",
  as: Tag = "p",
}: PublicBrandIdentProps) {
  const [reducedMotion, setReducedMotion] = useState(() =>
    getReducedMotionPreferred(),
  );
  const [cells, setCells] = useState<CellState[]>(() => buildScrambledCells());

  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const runTokenRef = useRef(0);

  const resolvedClassName = useMemo(
    () => ["public-brand-ident", className].filter(Boolean).join(" "),
    [className],
  );

  const clearTimers = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleMotionChange = () => {
      setReducedMotion(mediaQuery.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMotionChange);
      return () => mediaQuery.removeEventListener("change", handleMotionChange);
    }

    mediaQuery.addListener(handleMotionChange);
    return () => mediaQuery.removeListener(handleMotionChange);
  }, []);

  useEffect(() => {
    runTokenRef.current += 1;
    const runToken = runTokenRef.current;
    clearTimers();

    if (reducedMotion) {
      return () => {
        clearTimers();
      };
    }

    let decodeOrder = shuffleIndices(TARGET_CHARS.length);
    let resolvedLookup = new Set<number>();
    let decodeCursor = 0;
    let phase: "decoding" | "holding" | "scrambling" = "decoding";

    const startDecodeCycle = () => {
      decodeOrder = shuffleIndices(TARGET_CHARS.length);
      resolvedLookup = new Set<number>();
      decodeCursor = 0;
      phase = "decoding";
      setCells(buildCells(resolvedLookup));
    };

    const beginScramblePhase = () => {
      phase = "scrambling";
      const scrambleStart = Date.now();

      clearTimers();
      intervalRef.current = window.setInterval(() => {
        if (runTokenRef.current !== runToken) {
          clearTimers();
          return;
        }

        const elapsed = Date.now() - scrambleStart;
        const scrambleProgress = Math.min(1, elapsed / SCRAMBLE_PHASE_MS);
        const keepCount = Math.max(
          0,
          Math.round((1 - scrambleProgress) * TARGET_CHARS.length),
        );
        const keepSet = new Set(decodeOrder.slice(0, keepCount));
        setCells(buildCells(keepSet));

        if (elapsed >= SCRAMBLE_PHASE_MS) {
          clearTimers();
          startDecodeCycle();
          timeoutRef.current = window.setTimeout(step, DECODE_STEP_MS);
        }
      }, GLYPH_TICK_MS);
    };

    const step = () => {
      if (runTokenRef.current !== runToken) {
        clearTimers();
        return;
      }

      if (phase === "decoding") {
        if (decodeCursor < decodeOrder.length) {
          resolvedLookup.add(decodeOrder[decodeCursor]);
          decodeCursor += 1;
          setCells(buildCells(resolvedLookup));
          timeoutRef.current = window.setTimeout(step, DECODE_STEP_MS);
          return;
        }

        phase = "holding";
        setCells(TARGET_CHARS.map((char) => ({ glyph: char, resolved: true })));
        timeoutRef.current = window.setTimeout(step, RESOLVED_HOLD_MS);
        return;
      }

      if (phase === "holding") {
        beginScramblePhase();
      }
    };

    timeoutRef.current = window.setTimeout(step, 440);

    return () => {
      clearTimers();
    };
  }, [reducedMotion]);

  return (
    <Tag className={resolvedClassName}>
      <span className="public-brand-ident__accessible">DeepSignals.FM</span>
      {(reducedMotion
        ? TARGET_CHARS.map((char) => ({ glyph: char, resolved: true }))
        : cells
      ).map((cell, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={[
            "public-brand-ident__cell",
            cell.resolved
              ? "public-brand-ident__cell--resolved"
              : "public-brand-ident__cell--scrambling",
            cell.resolved ? getResolvedToneClass(index) : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {cell.glyph}
        </span>
      ))}
    </Tag>
  );
}

export default PublicBrandIdent;
