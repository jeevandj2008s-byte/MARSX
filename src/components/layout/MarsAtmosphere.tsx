import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  baseOpacity: number;
  pulseSpeed: number;
  pulsePhase: number;
  color: string;
}

export const MarsAtmosphere: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Warm Martian atmospheric color palette for particles
    const particleColors = [
      'rgba(255, 244, 230, ', // Cream/white high-altitude dust
      'rgba(240, 148, 47, ',  // Amber glow
      'rgba(238, 88, 34, ',   // Burnt orange regolith speck
      'rgba(255, 215, 140, ', // Horizon highlight dust
    ];

    const particleCount = Math.min(48, Math.floor((width * height) / 32000));
    const particles: Particle[] = Array.from({ length: particleCount }, () => {
      const baseOpacity = 0.2 + Math.random() * 0.55;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        size: 0.8 + Math.random() * 2.2,
        speedX: 0.15 + Math.random() * 0.45,
        speedY: -(0.08 + Math.random() * 0.22),
        opacity: baseOpacity,
        baseOpacity,
        pulseSpeed: 0.015 + Math.random() * 0.03,
        pulsePhase: Math.random() * Math.PI * 2,
        color: particleColors[Math.floor(Math.random() * particleColors.length)],
      };
    });

    let lastTime = performance.now();

    const render = (currentTime: number) => {
      const dt = Math.min(50, currentTime - lastTime);
      lastTime = currentTime;

      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.speedX * (dt / 16);
        p.y += p.speedY * (dt / 16);
        p.pulsePhase += p.pulseSpeed;
        p.opacity = p.baseOpacity + Math.sin(p.pulsePhase) * 0.25;

        // Wrap around borders
        if (p.x > width + 20) p.x = -20;
        if (p.x < -20) p.x = width + 20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${Math.max(0.04, Math.min(0.65, p.opacity))})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
    >
      {/* High-res authentic Mars horizon background matching user attachment */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 ease-out"
        style={{
          backgroundImage: "url('/mars-horizon-bg.jpg')",
        }}
      />

      {/* Atmospheric depth vignette for contrast & visual depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0E0603]/60 via-transparent to-[#0E0603]/40 pointer-events-none" />

      {/* Drifting Martian dust particles canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none opacity-50"
      />
    </div>
  );
};
