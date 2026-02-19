'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Block {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  pulse: number;
  pulseSpeed: number;
  color: string;
  rotY: number;       // Y-axis rotation for 3D look
  rotSpeed: number;   // rotation speed
}

interface Pulse {
  fromIdx: number;
  toIdx: number;
  progress: number;
  speed: number;
  color: string;
}

/**
 * Blockchain background with mini 3D isometric cubes.
 * - Cubes start scattered, then slowly gravitate toward center (logo area)
 * - Mouse moves push cubes away + subtle parallax
 * - Thin connection lines between nearby cubes
 * - Light pulses travel along connections
 */
export function BlockchainBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1, y: -1, active: false });
  const blocksRef = useRef<Block[]>([]);
  const pulsesRef = useRef<Pulse[]>([]);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const initBlocks = useCallback((w: number, h: number) => {
    const count = Math.min(35, Math.floor((w * h) / 30000));
    const colors = ['#8b5cf6', '#3b82f6', '#06b6d4'];
    const blocks: Block[] = [];

    for (let i = 0; i < count; i++) {
      blocks.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: 4 + Math.random() * 6,   // smaller blocks
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.01 + Math.random() * 0.015,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotY: Math.random() * Math.PI * 2,
        rotSpeed: 0.005 + Math.random() * 0.015,
      });
    }
    blocksRef.current = blocks;
    startTimeRef.current = performance.now();
  }, []);

  // Draw an isometric 3D mini-cube
  const drawIsoCube = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    s: number,       // size
    rotY: number,    // rotation angle
    color: string,
    alpha: number,
  ) => {
    // Isometric projection angles
    const cos30 = Math.cos(Math.PI / 6);
    const sin30 = 0.5;
    const rotFactor = Math.sin(rotY) * 0.3; // subtle rotation offset

    const dx = s * cos30;
    const dy = s * sin30;
    const h = s * 0.8;

    // Parse color for alpha blending
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };
    const c = hexToRgb(color);

    // Top face
    ctx.beginPath();
    ctx.moveTo(x + rotFactor, y - h);
    ctx.lineTo(x + dx + rotFactor, y - h + dy);
    ctx.lineTo(x + rotFactor, y - h + dy * 2);
    ctx.lineTo(x - dx + rotFactor, y - h + dy);
    ctx.closePath();
    ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha * 0.25})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha * 0.5})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Left face
    ctx.beginPath();
    ctx.moveTo(x - dx + rotFactor, y - h + dy);
    ctx.lineTo(x + rotFactor, y - h + dy * 2);
    ctx.lineTo(x + rotFactor, y + dy * 2 - h + h);
    ctx.lineTo(x - dx + rotFactor, y + dy - h + h);
    ctx.closePath();
    ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha * 0.12})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha * 0.35})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Right face
    ctx.beginPath();
    ctx.moveTo(x + dx + rotFactor, y - h + dy);
    ctx.lineTo(x + rotFactor, y - h + dy * 2);
    ctx.lineTo(x + rotFactor, y + dy * 2 - h + h);
    ctx.lineTo(x + dx + rotFactor, y + dy - h + h);
    ctx.closePath();
    ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha * 0.18})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha * 0.35})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initBlocks(window.innerWidth, window.innerHeight);
    };

    resize();
    window.addEventListener('resize', resize);

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const onMouseLeave = () => {
      mouseRef.current = { ...mouseRef.current, active: false };
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);

    let lastPulseTime = 0;

    const animate = (time: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const blocks = blocksRef.current;
      const pulses = pulsesRef.current;
      const mouse = mouseRef.current;
      const elapsed = (time - startTimeRef.current) / 1000; // seconds

      ctx.clearRect(0, 0, w, h);

      // Background grid (circuit pattern) — very subtle
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.025)';
      ctx.lineWidth = 0.5;
      const gridSize = 50;
      for (let gx = 0; gx < w; gx += gridSize) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // Center of the logo area (left 55% of screen on desktop, center on mobile)
      const centerX = w >= 1024 ? w * 0.275 : w * 0.5;
      const centerY = w >= 1024 ? h * 0.45 : h * 0.25;

      // Gravity ramps up over time (0 → full in ~15 seconds)
      const gravityStrength = Math.min(1, elapsed / 15) * 0.0004;

      // Update blocks
      for (const block of blocks) {
        block.pulse += block.pulseSpeed;
        block.rotY += block.rotSpeed;

        // Gravity toward center (increases over time)
        const dxCenter = centerX - block.x;
        const dyCenter = centerY - block.y;
        const distCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);
        if (distCenter > 80) {
          block.vx += (dxCenter / distCenter) * gravityStrength;
          block.vy += (dyCenter / distCenter) * gravityStrength;
        }

        // Mouse interaction — push blocks away from cursor
        if (mouse.active && mouse.x > 0) {
          const dxMouse = block.x - mouse.x;
          const dyMouse = block.y - mouse.y;
          const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
          if (distMouse < 150 && distMouse > 1) {
            const pushForce = (150 - distMouse) / 150 * 0.15;
            block.vx += (dxMouse / distMouse) * pushForce;
            block.vy += (dyMouse / distMouse) * pushForce;
          }

          // Subtle parallax from mouse position
          block.x += (mouse.x - w / 2) * 0.00015;
          block.y += (mouse.y - h / 2) * 0.00015;
        }

        // Damping
        block.vx *= 0.995;
        block.vy *= 0.995;

        // Apply velocity
        block.x += block.vx;
        block.y += block.vy;

        // Soft bounce off edges
        const margin = 20;
        if (block.x < margin) { block.x = margin; block.vx = Math.abs(block.vx) * 0.5; }
        if (block.x > w - margin) { block.x = w - margin; block.vx = -Math.abs(block.vx) * 0.5; }
        if (block.y < margin) { block.y = margin; block.vy = Math.abs(block.vy) * 0.5; }
        if (block.y > h - margin) { block.y = h - margin; block.vy = -Math.abs(block.vy) * 0.5; }
      }

      // Draw thin connection lines
      const maxDist = 180;
      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          const dx = blocks[i].x - blocks[j].x;
          const dy = blocks[i].y - blocks[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.12;
            ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(blocks[i].x, blocks[i].y);
            ctx.lineTo(blocks[j].x, blocks[j].y);
            ctx.stroke();
          }
        }
      }

      // Spawn light pulses
      if (time - lastPulseTime > 900 && blocks.length >= 2) {
        lastPulseTime = time;
        const fromIdx = Math.floor(Math.random() * blocks.length);
        let toIdx = Math.floor(Math.random() * blocks.length);
        let attempts = 0;
        while (toIdx === fromIdx && attempts < 5) { toIdx = Math.floor(Math.random() * blocks.length); attempts++; }
        const dx = blocks[fromIdx].x - blocks[toIdx].x;
        const dy = blocks[fromIdx].y - blocks[toIdx].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist * 1.3) {
          pulses.push({
            fromIdx,
            toIdx,
            progress: 0,
            speed: 0.008 + Math.random() * 0.012,
            color: ['#8b5cf6', '#3b82f6', '#06b6d4'][Math.floor(Math.random() * 3)],
          });
        }
      }

      // Draw & update pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.progress += p.speed;
        if (p.progress >= 1) { pulses.splice(i, 1); continue; }
        const from = blocks[p.fromIdx];
        const to = blocks[p.toIdx];
        if (!from || !to) { pulses.splice(i, 1); continue; }

        const px = from.x + (to.x - from.x) * p.progress;
        const py = from.y + (to.y - from.y) * p.progress;

        const gradient = ctx.createRadialGradient(px, py, 0, px, py, 6);
        gradient.addColorStop(0, p.color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw 3D isometric blocks
      for (const block of blocks) {
        const glow = 0.4 + Math.sin(block.pulse) * 0.2;
        const size = block.size + Math.sin(block.pulse) * 0.8;

        // Glow halo
        const glowGrad = ctx.createRadialGradient(block.x, block.y, 0, block.x, block.y, size * 2.5);
        glowGrad.addColorStop(0, `${block.color}${Math.floor(glow * 40).toString(16).padStart(2, '0')}`);
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(block.x, block.y, size * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // 3D isometric cube
        drawIsoCube(ctx, block.x, block.y, size, block.rotY, block.color, glow);
      }

      // Scan-line holographic sweep
      const scanY = (time * 0.025) % h;
      const scanGrad = ctx.createLinearGradient(0, scanY - 50, 0, scanY + 50);
      scanGrad.addColorStop(0, 'transparent');
      scanGrad.addColorStop(0.5, 'rgba(139, 92, 246, 0.025)');
      scanGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 50, w, 100);

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [initBlocks, drawIsoCube]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 0 }}
    />
  );
}
