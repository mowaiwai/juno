import { useEffect, useRef } from 'react';

/**
 * SciBackground — 马卡龙科幻动态背景
 * 缓慢漂移的星云光团 + 漂浮粒子 + 邻近粒子连线
 * 纯装饰：fixed 定位、pointer-events 无、置于内容之下
 */

// 马卡龙 RGB（莓粉 / 薰衣草紫 / 天空蓝 / 薄荷绿）
const PALETTE: [number, number, number][] = [
  [217, 106, 142],
  [183, 155, 216],
  [127, 181, 214],
  [127, 196, 155],
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  c: [number, number, number];
  tw: number;
}

interface Blob {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  c: [number, number, number];
  a: number;
}

export function SciBackground({ intensity = 1 }: { intensity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    let w = 0;
    let h = 0;
    let particles: Particle[] = [];
    let blobs: Blob[] = [];
    let raf = 0;
    let running = true;

    const setup = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      const count = Math.min(140, Math.round((w * h) / 13000)) * intensity;
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: Math.random() * 1.8 + 0.6,
        c: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        tw: Math.random() * Math.PI * 2,
      }));

      blobs = PALETTE.map((c, i) => ({
        x: w * (0.18 + i * 0.22) + Math.random() * w * 0.1,
        y: h * (0.25 + (i % 2) * 0.45),
        r: Math.max(w, h) * (0.26 + Math.random() * 0.1),
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.1,
        c,
        a: 0.15 + Math.random() * 0.06,
      }));
    };

    // 流星
    interface Star {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      max: number;
      len: number;
      c: [number, number, number];
    }
    let star: Star | null = null;
    let nextStarAt = performance.now() + 4000 + Math.random() * 5000;

    const spawnStar = (): Star => {
      const fromLeft = Math.random() > 0.4;
      const c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const speed = 6 + Math.random() * 3;
      return {
        x: fromLeft ? Math.random() * w * 0.6 : w + 50,
        y: Math.random() * h * 0.45,
        vx: fromLeft ? speed : -speed,
        vy: speed * 0.42,
        life: 0,
        max: 70 + Math.random() * 30,
        len: 90 + Math.random() * 70,
        c,
      };
    };

    const drawBlobs = () => {
      for (const b of blobs) {
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        const [r, gg, bl] = b.c;
        g.addColorStop(0, `rgba(${r},${gg},${bl},${b.a})`);
        g.addColorStop(1, `rgba(${r},${gg},${bl},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      }
    };

    const LINK_DIST = 130;

    const frame = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);

      drawBlobs();
      for (const b of blobs) {
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < -b.r * 0.4 || b.x > w + b.r * 0.4) b.vx *= -1;
        if (b.y < -b.r * 0.4 || b.y > h + b.r * 0.4) b.vy *= -1;
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.tw += 0.02;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            const alpha = (1 - Math.sqrt(d2) / LINK_DIST) * 0.16;
            ctx.strokeStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        const glow = 0.45 + Math.sin(p.tw) * 0.2;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${glow})`);
        g.addColorStop(1, `rgba(${p.c[0]},${p.c[1]},${p.c[2]},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${0.7 * glow + 0.2})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 流星更新与拖尾
      if (!star && performance.now() > nextStarAt) star = spawnStar();
      if (star) {
        const s = star;
        s.x += s.vx;
        s.y += s.vy;
        s.life++;
        const speed = Math.hypot(s.vx, s.vy);
        const tx = s.x - (s.vx / speed) * s.len;
        const ty = s.y - (s.vy / speed) * s.len;
        const fade = s.life < 12 ? s.life / 12 : Math.max(0, 1 - (s.life - 12) / (s.max - 12));
        const lg = ctx.createLinearGradient(s.x, s.y, tx, ty);
        lg.addColorStop(0, `rgba(255,255,255,${0.85 * fade})`);
        lg.addColorStop(0.25, `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${0.6 * fade})`);
        lg.addColorStop(1, `rgba(${s.c[0]},${s.c[1]},${s.c[2]},0)`);
        ctx.strokeStyle = lg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        if (s.life > s.max || s.x < -120 || s.x > w + 120 || s.y > h + 120) {
          star = null;
          nextStarAt = performance.now() + 5000 + Math.random() * 7000;
        }
      }

      raf = requestAnimationFrame(frame);
    };

    const staticFrame = () => {
      ctx.clearRect(0, 0, w, h);
      drawBlobs();
    };

    // 稳定引用，保证 add/remove 一致
    const handleResize = () => setup();
    const handleVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduced) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };

    setup();
    if (reduced) {
      staticFrame();
    } else {
      raf = requestAnimationFrame(frame);
    }

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
