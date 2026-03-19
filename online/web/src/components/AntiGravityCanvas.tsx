/**
 * AntiGravityCanvas — Interactive floating math-themed particle system
 * with background grid, floating Gaussian bell curve, and mouse repulsion.
 *
 * Matches the dark-teal "chalkboard" aesthetic from the reference design.
 */
import { useEffect, useRef, useCallback, useState } from "react";

/* ── Mathematical & Scheduling snippets ── */
const MATH_FORMULAS = [
  // Optimization
  "min ∑cᵢⱼxᵢⱼ",
  "∇f(x*)=0",
  "∂L/∂λ=0",
  "argmin J(θ)",
  "σ²→min",
  // Set theory
  "T∩S=∅",
  "∀i,j: Aᵢⱼ≤1",
  "x ∈ ℝⁿ",
  "∪ Cₖ = S",
  "P(A|B)",
  // Scheduling notation
  "(T₁,r₁)→(A101, P3)",
  "(T₂,r₂)→(B205, P1)",
  "Σ xᵢⱼ = 1",
  "f: S→T",
  // Symbols
  "∈", "∉", "∩", "∅", "∀", "∃", "⊕", "≡", "∞", "∏",
  // Short formulas
  "det(A)≠0",
  "O(n log n)",
  "λ₁ ≥ λ₂",
  "∫₀ᵗ f(x)dx",
  "P(x)=Σλᵢφᵢ",
];

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  text: string;
  size: number;
  opacity: number;
  baseOpacity: number;
  rotation: number;
  rotSpeed: number;
  glow: number; // extra glow factor
}

function createParticle(w: number, h: number): Particle {
  const text = MATH_FORMULAS[Math.floor(Math.random() * MATH_FORMULAS.length)];
  const isSymbol = text.length <= 2;
  const size = isSymbol ? (14 + Math.random() * 10) : (9 + Math.random() * 10);
  const opacity = 0.06 + Math.random() * 0.18;
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.12,
    vy: -(0.08 + Math.random() * 0.22),
    text, size, opacity,
    baseOpacity: opacity,
    rotation: (Math.random() - 0.5) * 12,
    rotSpeed: (Math.random() - 0.5) * 0.15,
    glow: 0.3 + Math.random() * 0.7,
  };
}

/* ── Gaussian bell curve points ── */
function gaussianY(x: number, mu: number, sigma: number, amp: number): number {
  return amp * Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

export default function AntiGravityCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);
  const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });

  const PARTICLE_COUNT = 50;
  const MOUSE_RADIUS = 140;
  const MOUSE_FORCE = 3;

  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    setDims({ w, h });
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => createParticle(w, h));
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setDims({ w, h });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = dims.w;
    const h = dims.h;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    frameRef.current++;
    const frame = frameRef.current;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;

    // ── 1. Background grid ──
    ctx.strokeStyle = "rgba(0, 206, 200, 0.025)";
    ctx.lineWidth = 0.5;
    const gridSize = 60;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // ── 2. Floating Gaussian bell curve ──
    const bellY = h * 0.35 + Math.sin(frame * 0.005) * 20; // gentle float
    const bellMu = w * 0.28;
    const bellSigma = w * 0.08;
    const bellAmp = h * 0.15;
    const bellAlpha = 0.06 + Math.sin(frame * 0.008) * 0.02;

    ctx.beginPath();
    ctx.moveTo(0, bellY);
    for (let px = 0; px < w * 0.56; px += 2) {
      const gy = gaussianY(px, bellMu, bellSigma, bellAmp);
      ctx.lineTo(px, bellY - gy);
    }
    ctx.strokeStyle = `rgba(0, 206, 200, ${bellAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fill under curve (very subtle)
    ctx.lineTo(w * 0.56, bellY);
    ctx.lineTo(0, bellY);
    ctx.closePath();
    ctx.fillStyle = `rgba(0, 206, 200, ${bellAlpha * 0.15})`;
    ctx.fill();

    // Second bell curve (offset, different sigma)
    const bell2Y = h * 0.6 + Math.cos(frame * 0.004) * 15;
    const bell2Mu = w * 0.18;
    const bell2Sigma = w * 0.05;
    const bell2Amp = h * 0.1;
    ctx.beginPath();
    ctx.moveTo(0, bell2Y);
    for (let px = 0; px < w * 0.4; px += 2) {
      const gy = gaussianY(px, bell2Mu, bell2Sigma, bell2Amp);
      ctx.lineTo(px, bell2Y - gy);
    }
    ctx.strokeStyle = `rgba(0, 206, 200, ${bellAlpha * 0.6})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── 3. Axis lines (decorative) ──
    // Horizontal axis for main bell
    ctx.beginPath();
    ctx.moveTo(w * 0.05, bellY);
    ctx.lineTo(w * 0.52, bellY);
    ctx.strokeStyle = "rgba(0, 206, 200, 0.03)";
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Small tick marks
    for (let t = 0; t < 6; t++) {
      const tx = w * 0.1 + t * (w * 0.07);
      ctx.beginPath();
      ctx.moveTo(tx, bellY - 3);
      ctx.lineTo(tx, bellY + 3);
      ctx.stroke();
    }

    // ── 4. Floating math particles ──
    for (const p of particlesRef.current) {
      const dx = p.x - mx;
      const dy = p.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_RADIUS && dist > 0) {
        const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
        p.vx += (dx / dist) * force * 0.25;
        p.vy += (dy / dist) * force * 0.25;
        p.opacity = Math.min(p.baseOpacity * 3, 0.5);
      } else {
        p.opacity += (p.baseOpacity - p.opacity) * 0.015;
      }

      p.vx *= 0.988;
      p.vy *= 0.988;
      p.vy -= 0.002; // anti-gravity
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotSpeed;

      // Wrap
      if (p.y < -40) { p.y = h + 40; p.x = Math.random() * w; }
      if (p.y > h + 40) { p.y = -40; }
      if (p.x < -80) { p.x = w + 80; }
      if (p.x > w + 80) { p.x = -80; }

      // Draw with glow
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);

      // Glow layer
      if (p.glow > 0.5) {
        ctx.shadowColor = "rgba(0, 206, 200, 0.4)";
        ctx.shadowBlur = 8 * p.glow;
      }

      ctx.font = `${p.size}px 'Sora', 'SF Mono', 'Courier New', monospace`;
      ctx.fillStyle = `rgba(0, 206, 200, ${p.opacity})`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }

    // ── 5. Scan line effect (horizontal line that sweeps down) ──
    const scanY = (frame * 0.4) % (h + 100) - 50;
    const scanGrad = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 20);
    scanGrad.addColorStop(0, "rgba(0, 206, 200, 0)");
    scanGrad.addColorStop(0.5, "rgba(0, 206, 200, 0.015)");
    scanGrad.addColorStop(1, "rgba(0, 206, 200, 0)");
    ctx.fillStyle = scanGrad;
    ctx.fillRect(0, scanY - 20, w * 0.55, 40);

    rafRef.current = requestAnimationFrame(animate);
  }, [dims]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  );
}
