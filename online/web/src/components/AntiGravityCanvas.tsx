/**
 * AntiGravityCanvas — Interactive floating math-themed particle system.
 *
 * Particles are mathematical symbols & scheduling formulas that:
 * - Drift slowly upward ("anti-gravity")
 * - Scatter away from the user's mouse cursor
 * - Have varying opacity, size, and rotation
 */
import { useEffect, useRef, useCallback, useState } from "react";

/* ── Mathematical snippets to float ── */
const MATH_ITEMS = [
  "T∩S=∅",          // No teacher-slot conflicts
  "∀i,j: Aᵢⱼ≤1",   // At most one class per slot
  "min ∑cᵢxᵢ",      // Objective function
  "∇f(x)=0",        // Optimal point
  "P(x)=Σλᵢφᵢ",    // Constraint satisfaction
  "Σ xᵢⱼ = 1",      // Assignment constraint
  "σ²→min",          // Variance minimization
  "∂L/∂λ=0",        // Lagrange condition
  "f: S→T",          // Mapping function
  "∪ Cₖ = S",        // Complete coverage
  "x ∈ ℝⁿ",          // Solution space
  "det(A)≠0",        // Non-singular matrix
  "∏ pᵢ",            // Product series
  "∫₀ᵗ f(x)dx",      // Continuous optimization
  "argmin",           // Optimization keyword
  "O(n log n)",       // Algorithmic complexity
  "λ₁ ≥ λ₂",         // Eigenvalue ordering
  "∞",                // Infinity
  "≡",                // Equivalence
  "⊕",                // XOR / Direct sum
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  size: number;
  opacity: number;
  baseOpacity: number;
  rotation: number;
  rotationSpeed: number;
}

function createParticle(w: number, h: number): Particle {
  const text = MATH_ITEMS[Math.floor(Math.random() * MATH_ITEMS.length)];
  const size = 10 + Math.random() * 14;
  const opacity = 0.04 + Math.random() * 0.12;
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.15,
    vy: -(0.1 + Math.random() * 0.25), // drift upward
    text,
    size,
    opacity,
    baseOpacity: opacity,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 0.3,
  };
}

export default function AntiGravityCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef<number>(0);
  const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });

  const PARTICLE_COUNT = 35;
  const MOUSE_RADIUS = 120;
  const MOUSE_FORCE = 2.5;

  // Initialize particles
  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    setDims({ w, h });
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => createParticle(w, h));
  }, []);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setDims({ w, h });
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = w * window.devicePixelRatio;
        canvas.height = h * window.devicePixelRatio;
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Mouse tracking
  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  // Animation loop
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

    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;

    for (const p of particlesRef.current) {
      // Mouse repulsion
      const dx = p.x - mx;
      const dy = p.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_RADIUS && dist > 0) {
        const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
        p.vx += (dx / dist) * force * 0.3;
        p.vy += (dy / dist) * force * 0.3;
        p.opacity = Math.min(p.baseOpacity * 2.5, 0.35);
      } else {
        p.opacity += (p.baseOpacity - p.opacity) * 0.02;
      }

      // Damping
      p.vx *= 0.985;
      p.vy *= 0.985;

      // Anti-gravity drift
      p.vy -= 0.002;

      // Update position
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;

      // Wrap around
      if (p.y < -30) { p.y = h + 30; p.x = Math.random() * w; }
      if (p.y > h + 30) { p.y = -30; }
      if (p.x < -50) { p.x = w + 50; }
      if (p.x > w + 50) { p.x = -50; }

      // Draw
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.font = `${p.size}px 'Sora', 'SF Mono', monospace`;
      ctx.fillStyle = `rgba(0, 206, 200, ${p.opacity})`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }

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
