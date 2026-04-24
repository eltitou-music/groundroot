/**
 * Branching root system SVG used at the bottom of the GroundRoot welcome
 * page. Pure CSS animation: each root path animates its stroke-dashoffset
 * to "grow" from the trunk on first paint. Honors prefers-reduced-motion.
 *
 * No props — purely decorative. Fills its parent's width with
 * preserveAspectRatio="none" so the soil bed stretches edge-to-edge.
 */
export function RootSystem() {
  // Build the root paths once. Each path starts somewhere along the
  // surface line (y=20) and meanders down/sideways with one or two forks.
  const paths: { d: string; w: number; delay: number }[] = [
    // Center trunk
    { d: "M 600 20 C 600 80, 590 130, 600 200 S 580 280, 600 360", w: 2.6, delay: 0 },
    // Left major
    { d: "M 420 25 C 410 90, 360 140, 320 220 S 280 300, 250 360", w: 2.2, delay: 0.2 },
    { d: "M 250 360 C 220 320, 180 290, 140 250", w: 1.4, delay: 0.9 },
    // Right major
    { d: "M 780 25 C 790 90, 840 140, 880 220 S 920 300, 950 360", w: 2.2, delay: 0.25 },
    { d: "M 950 360 C 980 320, 1020 290, 1060 250", w: 1.4, delay: 0.95 },
    // Inner left fibers
    { d: "M 540 25 C 530 80, 490 120, 470 200", w: 1.4, delay: 0.4 },
    { d: "M 470 200 C 450 240, 420 270, 400 320", w: 1, delay: 1.0 },
    // Inner right fibers
    { d: "M 660 25 C 670 80, 710 120, 730 200", w: 1.4, delay: 0.45 },
    { d: "M 730 200 C 750 240, 780 270, 800 320", w: 1, delay: 1.05 },
    // Far edges
    { d: "M 180 22 C 160 80, 130 130, 100 200", w: 1.6, delay: 0.55 },
    { d: "M 1020 22 C 1040 80, 1070 130, 1100 200", w: 1.6, delay: 0.6 },
    // Hairlike tips
    { d: "M 600 360 C 600 380, 595 395, 590 410", w: 0.8, delay: 1.4 },
    { d: "M 600 360 C 605 380, 610 395, 615 410", w: 0.8, delay: 1.45 },
    { d: "M 250 360 C 245 380, 240 395, 232 410", w: 0.8, delay: 1.5 },
    { d: "M 950 360 C 955 380, 960 395, 968 410", w: 0.8, delay: 1.5 },
  ];

  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 420"
      preserveAspectRatio="none"
      className="block h-full w-full"
    >
      <defs>
        <linearGradient id="rootStroke" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.5 0.1 55)" stopOpacity="0.95" />
          <stop offset="60%" stopColor="oklch(0.4 0.08 50)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="oklch(0.3 0.06 50)" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill="none"
          stroke="url(#rootStroke)"
          strokeWidth={p.w}
          strokeLinecap="round"
          className="root-grow"
          style={{ animationDelay: `${p.delay}s` }}
        />
      ))}
    </svg>
  );
}