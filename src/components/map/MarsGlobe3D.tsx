import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Globe,
  Flame,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';

export type MarsModelType = 'normal' | 'thermal';

interface MarsGlobe3DProps {
  heightClass?: string;
}

export const MarsGlobe3D: React.FC<MarsGlobe3DProps> = ({
  heightClass = 'h-[580px]',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  const [activeModel, setActiveModel] = useState<MarsModelType>('normal');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);

  // References for Three.js instance
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const globeContainerRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Cache for loaded models to provide instant switching
  const modelCacheRef = useRef<Map<MarsModelType, THREE.Group>>(new Map());

  // Model file paths in public/models
  const modelPaths: Record<MarsModelType, string> = {
    normal: '/models/normal-mars.glb',
    thermal: '/models/thermal-mars.glb',
  };

  // Helper to normalize model scale & center
  const normalizeModel = (gltfScene: THREE.Group): THREE.Group => {
    const box = new THREE.Box3().setFromObject(gltfScene);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);

    // Center the geometry
    gltfScene.position.x -= sphere.center.x;
    gltfScene.position.y -= sphere.center.y;
    gltfScene.position.z -= sphere.center.z;

    // Scale to standard unit sphere (radius = 1.0)
    if (sphere.radius > 0) {
      const scaleFactor = 1.0 / sphere.radius;
      gltfScene.scale.setScalar(scaleFactor);
    }

    // Enhance materials for PBR lighting
    gltfScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = false;
        mesh.receiveShadow = false;

        const mat = mesh.material;
        if (mat instanceof THREE.MeshStandardMaterial) {
          const isThermal = mat.name.toLowerCase().includes('thermal');
          if (isThermal) {
            // Richer, deeper thermal color grading with zero flat-white wash
            mat.roughness = 0.52;
            mat.metalness = 0.06;
            mat.emissive = new THREE.Color(0x000000);
            if (mat.normalMap) {
              mat.normalScale.set(1.4, 1.4);
            }
          } else {
            mat.roughness = 0.82;
            mat.metalness = 0.05;
            if (mat.normalMap) {
              mat.normalScale.set(1.5, 1.5);
            }
          }
          mat.needsUpdate = true;
        }
      }
    });

    return gltfScene;
  };

  // Switch displayed model
  const switchModel = useCallback((modelType: MarsModelType) => {
    const globeContainer = globeContainerRef.current;
    if (!globeContainer) return;

    setActiveModel(modelType);
    setErrorMessage(null);

    // If model is already cached, display immediately
    const cached = modelCacheRef.current.get(modelType);
    if (cached) {
      // Clear previous children
      while (globeContainer.children.length > 0) {
        globeContainer.remove(globeContainer.children[0]);
      }
      globeContainer.add(cached);
      setIsLoading(false);
      return;
    }

    // Lazy load the model
    setIsLoading(true);
    setLoadingProgress(0);

    const loader = new GLTFLoader();
    const path = modelPaths[modelType];

    loader.load(
      path,
      (gltf) => {
        const normalized = normalizeModel(gltf.scene);
        modelCacheRef.current.set(modelType, normalized);

        // Check if user hasn't switched away while loading
        setActiveModel((current) => {
          if (current === modelType && globeContainerRef.current) {
            while (globeContainerRef.current.children.length > 0) {
              globeContainerRef.current.remove(globeContainerRef.current.children[0]);
            }
            globeContainerRef.current.add(normalized);
          }
          return current;
        });

        setIsLoading(false);
      },
      (xhr) => {
        if (xhr.lengthComputable && xhr.total > 0) {
          const percent = Math.round((xhr.loaded / xhr.total) * 100);
          setLoadingProgress(percent);
        }
      },
      (error) => {
        console.error(`Failed to load ${modelType} Mars model:`, error);
        setErrorMessage(
          `Unable to load ${modelType === 'normal' ? 'Normal' : 'Thermal'} 3D model. Telemetry assets in /public/models/ may be initializing.`
        );
        setIsLoading(false);
      }
    );
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    const canvasContainer = canvasContainerRef.current;
    if (!canvasContainer) return;

    // Detect WebGL capability
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) {
        setWebglSupported(false);
        setIsLoading(false);
        return;
      }
    } catch {
      setWebglSupported(false);
      setIsLoading(false);
      return;
    }

    // 1. Scene with clean transparent background
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    // 2. Camera centered with comfortable padding
    const aspect = canvasContainer.clientWidth / (canvasContainer.clientHeight || 1);
    const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 100);
    camera.position.set(0, 0, 3.4);
    cameraRef.current = camera;

    // 3. Renderer with transparent clear color
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.75;
    controls.minDistance = 1.8;
    controls.maxDistance = 6.0;
    controls.enablePan = false;
    controlsRef.current = controls;

    // 5. Lighting
    // Warm Sun directional key light
    const sunLight = new THREE.DirectionalLight(0xfff8ee, 2.5);
    sunLight.position.set(3.2, 1.4, 2.6);
    scene.add(sunLight);

    // Warm planetary fill light
    const fillLight = new THREE.DirectionalLight(0xd4702a, 0.65);
    fillLight.position.set(-3.0, -1.0, -1.8);
    scene.add(fillLight);

    // Ambient light so shadow side remains visible
    const ambientLight = new THREE.AmbientLight(0x2d1a10, 0.75);
    scene.add(ambientLight);

    // 6. Globe Container Group (clean, no atmosphere or background disc)
    const globeContainer = new THREE.Group();
    scene.add(globeContainer);
    globeContainerRef.current = globeContainer;

    // 7. Load default initial model ('normal')
    switchModel('normal');

    // 8. Animation Render Loop
    let isRunning = true;
    const animate = () => {
      if (!isRunning) return;
      animFrameIdRef.current = requestAnimationFrame(animate);

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize Observer
    const handleResize = () => {
      if (!canvasContainer || !renderer || !camera) return;
      const width = canvasContainer.clientWidth;
      const height = canvasContainer.clientHeight;
      if (width <= 0 || height <= 0) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvasContainer);

    // Cleanup on unmount
    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      resizeObserver.disconnect();

      controls.dispose();
      renderer.dispose();

      // Dispose cached geometries and textures
      modelCacheRef.current.forEach((group) => {
        group.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.geometry?.dispose();
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => m.dispose());
            } else if (mesh.material) {
              mesh.material.dispose();
            }
          }
        });
      });
      modelCacheRef.current.clear();

      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [switchModel]);

  // Controls helper functions
  const handleResetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 0, 3.4);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  const handleZoom = (delta: number) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const newPos = camera.position.clone().multiplyScalar(delta);
    if (newPos.length() >= 1.8 && newPos.length() <= 6.0) {
      camera.position.copy(newPos);
      controlsRef.current.update();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`glass-panel rounded-[20px] p-3 sm:p-4 flex flex-col justify-between border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.2)] select-none relative overflow-hidden ${heightClass}`}
    >
      {/* Top Header & Model Switcher Toolbar */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-white/15">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-[10px] bg-white/15 border border-white/20 text-[#FFF4E6]">
            <Globe size={18} strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-[14px] sm:text-[15px] font-bold text-[#FFF4E6] tracking-tight leading-tight flex items-center gap-1.5">
              <span>Planetary 3D Observation</span>
              <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-[#F29A1F] animate-pulse" />
            </h2>
            <p className="text-[11px] font-mono-tabular text-[#FFF4E6]/75">
              {activeModel === 'normal'
                ? 'Viking True Color · MOLA Topographic Relief'
                : 'THEMIS Night IR · Thermal Inertia Spectrum'}
            </p>
          </div>
        </div>

        {/* Model Switcher Buttons: "Normal Mars" and "Thermal Mars" */}
        <div
          role="tablist"
          aria-label="Mars 3D Model Mode Switcher"
          className="flex items-center p-1 rounded-full bg-black/25 border border-white/20 backdrop-blur-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeModel === 'normal'}
            aria-label="Normal Mars 3D Model with surface relief"
            onClick={() => switchModel('normal')}
            className={`px-3 py-1.5 rounded-full text-[11.5px] font-medium flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
              activeModel === 'normal'
                ? 'bg-white/[0.28] border border-white/60 text-[#FFF4E6] shadow-[0_2px_10px_rgba(0,0,0,0.15)] font-semibold'
                : 'text-[#FFF4E6]/75 hover:text-[#FFF4E6] hover:bg-white/[0.12] border border-transparent'
            }`}
          >
            <Globe size={13} strokeWidth={activeModel === 'normal' ? 2 : 1.5} className="text-[#FFF4E6]" />
            <span>Normal Mars</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeModel === 'thermal'}
            aria-label="Thermal Mars 3D Model with IR thermal inertia"
            onClick={() => switchModel('thermal')}
            className={`px-3 py-1.5 rounded-full text-[11.5px] font-medium flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
              activeModel === 'thermal'
                ? 'bg-white/[0.28] border border-white/60 text-[#FFF4E6] shadow-[0_2px_10px_rgba(0,0,0,0.15)] font-semibold'
                : 'text-[#FFF4E6]/75 hover:text-[#FFF4E6] hover:bg-white/[0.12] border border-transparent'
            }`}
          >
            <Flame size={13} strokeWidth={activeModel === 'thermal' ? 2 : 1.5} className="text-[#F29A1F]" />
            <span>Thermal Mars</span>
          </button>
        </div>
      </div>

      {/* 3D Viewport Area */}
      <div className="flex-1 min-h-0 w-full relative my-1 rounded-[14px] overflow-hidden bg-black/20 border border-white/10">
        {/* Three.js Canvas Mount Container */}
        <div ref={canvasContainerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-2.5 z-20 text-[#FFF4E6] transition-opacity duration-300">
            <Loader2 size={26} className="animate-spin text-[#F29A1F]" />
            <div className="text-[12.5px] font-medium tracking-wide">
              Streaming {activeModel === 'normal' ? 'Normal Surface Relief' : 'Thermal Infrared Mesh'}...
            </div>
            {loadingProgress > 0 && (
              <div className="w-32 bg-white/10 h-1.5 rounded-full overflow-hidden border border-white/20">
                <div
                  className="bg-[#F29A1F] h-full transition-all duration-150"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Error Fallback Banner */}
        {errorMessage && !isLoading && (
          <div className="absolute bottom-3 left-3 right-3 p-3 rounded-[12px] bg-red-950/80 border border-red-500/40 text-[#FFF4E6] text-[12px] flex items-center gap-2 z-20 backdrop-blur-md">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Unsupported WebGL Fallback */}
        {!webglSupported && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-[#FFF4E6] bg-black/60 z-30">
            <AlertCircle size={32} className="text-[#F29A1F] mb-2" />
            <div className="font-bold text-[15px]">WebGL Hardware Acceleration Not Detected</div>
            <p className="text-[12px] text-[#FFF4E6]/75 mt-1 max-w-sm">
              Your browser or graphics environment does not support 3D WebGL rendering. Please verify hardware acceleration in settings.
            </p>
          </div>
        )}

        {/* Interactive Floating Camera Controls (Bottom Right) */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 z-10 bg-black/40 backdrop-blur-md p-1 rounded-[10px] border border-white/15">
          <button
            type="button"
            title="Zoom In"
            aria-label="Zoom In"
            onClick={() => handleZoom(0.85)}
            className="p-1.5 rounded-[7px] text-[#FFF4E6]/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            title="Zoom Out"
            aria-label="Zoom Out"
            onClick={() => handleZoom(1.15)}
            className="p-1.5 rounded-[7px] text-[#FFF4E6]/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
          >
            <ZoomOut size={14} />
          </button>
          <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />
          <button
            type="button"
            title="Reset Orientation"
            aria-label="Reset Camera Orientation"
            onClick={handleResetCamera}
            className="p-1.5 rounded-[7px] text-[#FFF4E6]/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-mono-tabular"
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

        {/* Subtle Legend / Telemetry Tag (Bottom Left) */}
        <div className="absolute bottom-2.5 left-2.5 z-10 text-[10.5px] font-mono-tabular text-[#FFF4E6]/70 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-[8px] border border-white/10 pointer-events-none flex items-center gap-1.5">
          <Sparkles size={11} className="text-[#F29A1F]" />
          <span>Auto-Rotation Active · Drag to Orbit · Scroll to Zoom</span>
        </div>
      </div>

      {/* Footer Status Pill */}
      <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#FFF4E6]/75 pt-2 border-t border-white/15">
        <span>IAU 2000 Mars R: 3,396.19 km</span>
        <span className="text-[#FFF4E6]/90 font-medium">
          Active Telemetry: {activeModel === 'normal' ? 'Natural Albedo' : 'Thermal IR Channel'}
        </span>
      </div>
    </div>
  );
};
