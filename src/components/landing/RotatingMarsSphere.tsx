import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface RotatingMarsSphereProps {
  onClick?: () => void;
  size?: number;
}

export const RotatingMarsSphere: React.FC<RotatingMarsSphereProps> = ({
  onClick,
  size = 88,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const hoverRef = useRef(false);

  useEffect(() => {
    hoverRef.current = isHovered;
  }, [isHovered]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup - tight view for clean floating planet
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 0, 3.1);

    // 3. Renderer with transparent background and high pixel ratio
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 4. Mars Sphere with 2K NASA Viking Color and MOLA Normal Map
    const textureLoader = new THREE.TextureLoader();
    const colorMap = textureLoader.load('/mars_viking_color_2k.jpg');
    colorMap.colorSpace = THREE.SRGBColorSpace;
    const normalMap = textureLoader.load('/mars_mola_normal_2k.jpg');

    const geometry = new THREE.SphereGeometry(1, 48, 48);
    const material = new THREE.MeshStandardMaterial({
      map: colorMap,
      normalMap: normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.82,
      metalness: 0.04,
    });

    const marsMesh = new THREE.Mesh(geometry, material);
    // Real Mars axial obliquity (~25.19 degrees)
    marsMesh.rotation.z = THREE.MathUtils.degToRad(25.19);
    scene.add(marsMesh);

    // 5. Lighting: Crisp key sunlight casting realistic crater/canyon relief shadows
    const sunLight = new THREE.DirectionalLight(0xfff6ea, 2.8);
    sunLight.position.set(-2.8, 1.8, 3.2);
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x2a140b, 0.55);
    scene.add(ambientLight);

    // Warm atmospheric rim light
    const rimLight = new THREE.DirectionalLight(0xf0942f, 1.0);
    rimLight.position.set(2.4, -1.0, -1.5);
    scene.add(rimLight);

    // 6. Animation loop
    let animId: number;
    const render = () => {
      animId = requestAnimationFrame(render);
      // Continuous planetary rotation around tilted axis
      const speed = hoverRef.current ? 0.005 : 0.0022;
      marsMesh.rotation.y += speed;
      renderer.render(scene, camera);
    };
    render();

    // 7. Cleanup
    return () => {
      cancelAnimationFrame(animId);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      colorMap.dispose();
      normalMap.dispose();
      renderer.dispose();
    };
  }, [size]);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title="Open Interactive Mars Map"
      className="group cursor-pointer flex items-center gap-4 select-none transition-all duration-300"
    >
      {/* Left Column: MARS label on TOP, Curvy Circular HUD Radar with Rotating Mars below */}
      <div className="flex flex-col items-center gap-1.5">
        {/* 'MARS' Top Label matching Reference Screenshot */}
        <span className="font-techno tracking-[0.24em] text-[11px] sm:text-[12px] font-bold text-[#FFF4E6]/90 uppercase group-hover:text-white group-hover:tracking-[0.28em] transition-all duration-300">
          MARS
        </span>

        {/* Circular Radar HUD with 3D Globe */}
        <div className="relative flex items-center justify-center">
          {/* Outer Concentric Curved Radar Rings matching reference */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Outer Subtle Glass / Radar Rim */}
            <div
              className={`w-[110px] h-[110px] sm:w-[118px] sm:h-[118px] rounded-full border border-white/20 transition-all duration-500 ${
                isHovered
                  ? 'border-[#FA5E16]/75 shadow-[0_0_24px_rgba(250,94,22,0.45)] scale-105'
                  : 'border-white/25 shadow-[0_0_12px_rgba(0,0,0,0.4)]'
              }`}
            />
            {/* Thin Inner Radar Guideline */}
            <div className="absolute w-[98px] h-[98px] sm:w-[106px] sm:h-[106px] rounded-full border border-white/15 pointer-events-none" />

            {/* Orbiting Satellite Beacon */}
            <div className="absolute w-[110px] h-[110px] sm:w-[118px] sm:h-[118px] rounded-full pointer-events-none animate-orbit">
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#FFF4E6] shadow-[0_0_8px_#FA5E16,0_0_2px_#FFF4E6]" />
            </div>
          </div>

          {/* Real 3D Rotating Three.js Mars Globe */}
          <div
            ref={mountRef}
            className="relative z-10 transition-transform duration-500 ease-out group-hover:scale-105"
            style={{ width: size, height: size }}
          />
        </div>
      </div>

      {/* Right Side: 'FIND ON THE MAP ›' Label aligned horizontally with planet */}
      <div className="flex items-center gap-1.5 pt-4">
        <span className="font-techno tracking-[0.2em] text-[11px] sm:text-[12.5px] font-bold text-[#FFF4E6]/85 group-hover:text-white uppercase transition-colors">
          FIND ON THE MAP
        </span>
        <span className="text-[#FA5E16] font-bold text-[14px] group-hover:translate-x-1.5 transition-transform duration-200">
          ›
        </span>
      </div>
    </div>
  );
};
