import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  ArrowLeft,
  Compass,
  Glasses,
  Info,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  Loader2,
  RotateCcw,
} from 'lucide-react';

export interface Viewpoint360 {
  id: string;
  name: string;
  sol: string;
  lat: number;
  lon: number;
  elevationM: number;
  imageUrl: string;
  description: string;
  feature: string;
}

interface PanoramaViewer360Props {
  viewpoint: Viewpoint360;
  onClose: () => void;
}

export const PanoramaViewer360: React.FC<PanoramaViewer360Props> = ({
  viewpoint,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showInfo, setShowInfo] = useState<boolean>(true);
  const [isAudioActive, setIsAudioActive] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [vrSupported, setVrSupported] = useState<boolean>(false);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);

  // Interaction coordinates (Spherical angles)
  const isUserInteracting = useRef<boolean>(false);
  const onPointerDownPointerX = useRef<number>(0);
  const onPointerDownPointerY = useRef<number>(0);
  const onPointerDownLon = useRef<number>(0);
  const onPointerDownLat = useRef<number>(0);
  const lon = useRef<number>(0);
  const lat = useRef<number>(0);
  const phi = useRef<number>(0);
  const theta = useRef<number>(0);

  // Check WebXR VR support
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'xr' in navigator) {
      // @ts-ignore
      navigator.xr?.isSessionSupported?.('immersive-vr').then((supported: boolean) => {
        setVrSupported(supported);
      }).catch(() => setVrSupported(false));
    }
  }, []);

  // Procedural Martian Wind Ambient Audio Synthesis (Muted by default)
  const toggleMartianAudio = useCallback(() => {
    if (isAudioActive) {
      if (audioContextRef.current) {
        audioContextRef.current.suspend();
      }
      setIsAudioActive(false);
      return;
    }

    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        // Generate Brown Noise buffer for deep atmospheric wind rumble
        const bufferSize = ctx.sampleRate * 4;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 3.2; // Gain compensation
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        // Low-pass filter simulating thin CO2 atmospheric acoustics
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320, ctx.currentTime);
        filter.Q.setValueAtTime(1.8, ctx.currentTime);

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.28, ctx.currentTime);
        audioGainRef.current = gainNode;

        whiteNoise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);
        whiteNoise.start();
      } else {
        audioContextRef.current.resume();
      }
      setIsAudioActive(true);
    } catch (err) {
      console.warn('Audio playback not allowed or supported:', err);
    }
  }, [isAudioActive]);

  // Initialize Three.js 360 Panorama Sphere
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setIsLoading(true);

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const aspect = container.clientWidth / (container.clientHeight || 1);
    const camera = new THREE.PerspectiveCamera(72, aspect, 1, 1100);
    cameraRef.current = camera;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Equirectangular Sphere Mesh
    // 500 unit sphere, rendered on inside using THREE.BackSide
    const sphereGeometry = new THREE.SphereGeometry(500, 64, 48);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      viewpoint.imageUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;

        const sphereMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide,
        });
        const mesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
        scene.add(mesh);
        setIsLoading(false);
      },
      undefined,
      (error) => {
        console.error('Failed to load 360 panorama:', error);
        // Fallback: warm Mars color sphere so scene is never black
        const sphereMaterial = new THREE.MeshBasicMaterial({
          color: 0xc8642a,
          wireframe: true,
          side: THREE.BackSide,
        });
        const mesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
        scene.add(mesh);
        setIsLoading(false);
      }
    );

    // 4. Pointer Drag Event Listeners
    const onPointerDown = (event: PointerEvent) => {
      isUserInteracting.current = true;
      onPointerDownPointerX.current = event.clientX;
      onPointerDownPointerY.current = event.clientY;
      onPointerDownLon.current = lon.current;
      onPointerDownLat.current = lat.current;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isUserInteracting.current) return;
      lon.current = (onPointerDownPointerX.current - event.clientX) * 0.14 + onPointerDownLon.current;
      lat.current = (event.clientY - onPointerDownPointerY.current) * 0.14 + onPointerDownLat.current;
    };

    const onPointerUp = () => {
      isUserInteracting.current = false;
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const fov = camera.fov + event.deltaY * 0.05;
      camera.fov = THREE.MathUtils.clamp(fov, 30, 95);
      camera.updateProjectionMatrix();
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // 5. Animation Render Loop
    let running = true;
    const animate = () => {
      if (!running) return;
      animFrameIdRef.current = requestAnimationFrame(animate);

      // Clamp latitude to avoid pole inversion
      lat.current = Math.max(-85, Math.min(85, lat.current));
      phi.current = THREE.MathUtils.degToRad(90 - lat.current);
      theta.current = THREE.MathUtils.degToRad(lon.current);

      const targetX = 500 * Math.sin(phi.current) * Math.cos(theta.current);
      const targetY = 500 * Math.cos(phi.current);
      const targetZ = 500 * Math.sin(phi.current) * Math.sin(theta.current);

      camera.lookAt(targetX, targetY, targetZ);
      renderer.render(scene, camera);
    };
    animate();

    // 6. Resize Observer
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      running = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      resizeObserver.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);

      renderer.dispose();
      sphereGeometry.dispose();

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [viewpoint.imageUrl]);

  const handleZoom = (delta: number) => {
    if (!cameraRef.current) return;
    cameraRef.current.fov = THREE.MathUtils.clamp(cameraRef.current.fov + delta, 30, 95);
    cameraRef.current.updateProjectionMatrix();
  };

  const handleResetOrientation = () => {
    lon.current = 0;
    lat.current = 0;
    if (cameraRef.current) {
      cameraRef.current.fov = 72;
      cameraRef.current.updateProjectionMatrix();
    }
  };

  const toggleFullscreen = () => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className="relative w-full h-full min-h-[520px] rounded-[18px] overflow-hidden bg-black select-none flex flex-col">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing flex-1" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-30 text-[#FFF4E6]">
          <Loader2 size={32} className="animate-spin text-[#F29A1F]" />
          <div className="text-[14px] font-semibold tracking-wide">
            Streaming High-Resolution 360° Mastcam Panorama...
          </div>
          <div className="text-[12px] font-mono-tabular text-[#FFF4E6]/70">
            {viewpoint.name} · {viewpoint.sol}
          </div>
        </div>
      )}

      {/* Top Bar: Back to Map Button & Viewpoint Metadata */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-20 pointer-events-none">
        {/* Back to Map Button */}
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto px-3.5 py-2 rounded-[12px] bg-black/70 hover:bg-black/90 text-[#FFF4E6] border border-white/25 backdrop-blur-md shadow-lg flex items-center gap-2 text-[12.5px] font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <ArrowLeft size={16} strokeWidth={2.5} className="text-[#F29A1F]" />
          <span>Back to Map</span>
        </button>

        {/* Viewpoint Title Badge */}
        <div className="pointer-events-auto hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-[12px] bg-black/70 border border-white/20 backdrop-blur-md text-[#FFF4E6] shadow-lg">
          <Compass size={15} className="text-[#F29A1F]" />
          <span className="text-[13px] font-bold">{viewpoint.name}</span>
          <span className="text-[11px] font-mono-tabular text-[#FFF4E6]/75">
            ({viewpoint.sol} · {viewpoint.elevationM} m)
          </span>
        </div>

        {/* Info Toggle */}
        <button
          type="button"
          title="Toggle Geological Context Info"
          aria-label="Toggle Geological Context Info"
          onClick={() => setShowInfo(!showInfo)}
          className={`pointer-events-auto p-2 rounded-[12px] border backdrop-blur-md shadow-lg transition-all cursor-pointer ${
            showInfo
              ? 'bg-[#F29A1F]/30 border-[#F29A1F] text-[#FFF4E6]'
              : 'bg-black/70 border-white/20 text-[#FFF4E6]/80 hover:text-white'
          }`}
        >
          <Info size={16} />
        </button>
      </div>

      {/* Geological Info Panel Overlay (Bottom Left) */}
      {showInfo && (
        <div className="absolute bottom-16 sm:bottom-4 left-3 max-w-sm p-3.5 rounded-[14px] bg-black/75 border border-white/20 backdrop-blur-md text-[#FFF4E6] shadow-2xl z-20 space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-mono-tabular uppercase tracking-wider text-[#F29A1F] font-bold">
              {viewpoint.feature}
            </span>
            <span className="text-[10px] font-mono-tabular text-[#FFF4E6]/60">
              {viewpoint.lat.toFixed(4)}°N, {viewpoint.lon.toFixed(4)}°E
            </span>
          </div>
          <h3 className="text-[14px] font-bold text-[#FFF4E6] leading-snug">
            {viewpoint.name}
          </h3>
          <p className="text-[12px] text-[#FFF4E6]/80 leading-relaxed font-sans">
            {viewpoint.description}
          </p>
          <div className="text-[10px] font-mono-tabular text-[#FFF4E6]/60 pt-1 border-t border-white/10">
            Source: NASA / JPL-Caltech / MSSS / ASU Mastcam-Z Equirectangular Archive
          </div>
        </div>
      )}

      {/* Bottom Right Floating Controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-20 bg-black/70 backdrop-blur-md p-1.5 rounded-[12px] border border-white/20 shadow-lg">
        {/* Ambient Martian Wind Audio */}
        <button
          type="button"
          title={isAudioActive ? 'Mute Martian Atmosphere' : 'Enable Atmospheric Wind Sound'}
          aria-label="Martian Ambient Audio Toggle"
          onClick={toggleMartianAudio}
          className={`p-2 rounded-[8px] transition-colors cursor-pointer ${
            isAudioActive
              ? 'bg-[#F29A1F]/30 text-[#FFF4E6] border border-[#F29A1F]/60'
              : 'text-[#FFF4E6]/75 hover:text-white hover:bg-white/10'
          }`}
        >
          {isAudioActive ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        <div className="w-[1px] h-4 bg-white/20" />

        {/* Zoom Controls */}
        <button
          type="button"
          title="Zoom In (Decrease FOV)"
          aria-label="Zoom In"
          onClick={() => handleZoom(-10)}
          className="p-2 rounded-[8px] text-[#FFF4E6]/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          title="Zoom Out (Increase FOV)"
          aria-label="Zoom Out"
          onClick={() => handleZoom(10)}
          className="p-2 rounded-[8px] text-[#FFF4E6]/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <ZoomOut size={16} />
        </button>

        {/* Reset Orientation */}
        <button
          type="button"
          title="Reset Horizon Orientation"
          aria-label="Reset View"
          onClick={handleResetOrientation}
          className="p-2 rounded-[8px] text-[#FFF4E6]/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <RotateCcw size={15} />
        </button>

        {/* WebXR VR Mode (if supported) */}
        {vrSupported && (
          <button
            type="button"
            title="Enter WebXR Virtual Reality"
            aria-label="Enter VR"
            className="p-2 rounded-[8px] text-[#F29A1F] hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Glasses size={16} />
          </button>
        )}

        {/* Fullscreen Toggle */}
        <button
          type="button"
          title="Toggle Fullscreen"
          aria-label="Toggle Fullscreen"
          onClick={toggleFullscreen}
          className="p-2 rounded-[8px] text-[#FFF4E6]/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    </div>
  );
};
