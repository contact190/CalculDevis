import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Center, ContactShadows } from '@react-three/drei';
import { Rotate3D as Rotate3d, Maximize, Maximize2, Hand } from 'lucide-react';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';

// Minimalist extrusion logic for compatibility
const ExtrudedProfile = ({ svgData, depth = 500, color = '#cbd5e1' }) => {
  const geometries = useMemo(() => {
    if (!svgData) return [];
    try {
      // Decode SVG
      let svgText = svgData;
      if (svgData.startsWith('data:image/svg+xml;base64,')) {
        svgText = atob(svgData.split(',')[1]);
      } else if (svgData.startsWith('data:image/svg+xml,')) {
        svgText = decodeURIComponent(svgData.split(',')[1]);
      }

      const loader = new SVGLoader();
      const parsed = loader.parse(svgText);
      const shapes = parsed.paths.flatMap(path => path.toShapes(true));
      
      return shapes.map(s => {
        const geo = new THREE.ExtrudeGeometry(s, { 
          depth, 
          bevelEnabled: true, 
          bevelThickness: 1.5, // The "thickness" of the metal corners
          bevelSize: 1, 
          bevelOffset: 0, 
          bevelSegments: 2 
        });
        geo.computeVertexNormals();
        return geo;
      });
    } catch (e) {
      console.warn("3D Extrusion error:", e);
      return [];
    }
  }, [svgData, depth]);

  if (geometries.length === 0) {
    return (
      <mesh>
        <boxGeometry args={[50, 50, 800]} />
        <meshStandardMaterial color={color} metalness={0.5} />
      </mesh>
    );
  }

  return (
    <group rotation={[Math.PI, 0, 0]}>
      {geometries.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshStandardMaterial 
            color="#cbd5e1" 
            metalness={0.9} 
            roughness={0.25} 
            envMapIntensity={1}
            side={THREE.DoubleSide} 
          />
        </mesh>
      ))}
    </group>
  );
};

const Profile3DViewer = ({ svgData, title }) => {
  const [navMode, setNavMode] = useState('rotate'); // 'rotate' or 'pan'
  const controlsRef = useRef();
  
  const cameraConfig = useMemo(() => ({ position: [300, 300, 800], fov: 40 }), []);

  const resetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  return (
    <div style={{ 
      position: 'absolute', 
      top: 0, left: 0, right: 0, bottom: 0, 
      overflow: 'hidden', 
      background: 'radial-gradient(circle at center, #1e293b 0%, #030712 100%)',
      cursor: navMode === 'pan' ? 'grab' : 'default'
    }}>
      <Canvas 
        shadows 
        camera={cameraConfig}
        resize={{ scroll: false, debounce: 0 }}
        style={{ width: '100%', height: '100%', position: 'absolute' }}
      >
        <OrbitControls 
          ref={controlsRef}
          enableZoom={true} 
          enableRotate={navMode === 'rotate'}
          enablePan={true}
          mouseButtons={{
            LEFT: navMode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: navMode === 'rotate' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE
          }}
          makeDefault
          minDistance={100}
          maxDistance={3000}
        />
        
        {/* Advanced Lighting */}
        <ambientLight intensity={0.5} />
        <spotLight position={[200, 400, 200]} angle={0.15} penumbra={1} intensity={2} castShadow />
        <pointLight position={[-200, -100, -200]} intensity={0.5} color="#3b82f6" />
        
        <Environment preset="city" />
        
        <group position={[-150, 0, 0]}>
          <ExtrudedProfile svgData={svgData} />
          
          {/* Realistic Floor Shadows */}
          <ContactShadows 
            position={[0, -150, 0]} 
            opacity={0.6} 
            scale={2000} 
            blur={2.5} 
            far={500} 
            color="#000000" 
          />
        </group>
        
        <gridHelper args={[4000, 50, '#1e293b', '#0f172a']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -200]} />
      </Canvas>
      
      {/* Premium UI Overlay */}
      <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', pointerEvents: 'none', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{ width: '3px', height: '20px', background: '#3b82f6', borderRadius: '2px' }} />
          <h4 style={{ margin: 0, color: 'white', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 800 }}>
            Inspection Technique 3D
          </h4>
        </div>
        <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>{title || 'Profilé non identifié'}</p>
      </div>

      <div style={{ 
        position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
        padding: '0.4rem 1rem', borderRadius: '2rem', border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', gap: '1rem', zIndex: 10, color: '#94a3b8', fontSize: '0.65rem', fontWeight: 600,
        alignItems: 'center'
      }}>
         <button 
            onClick={() => setNavMode('rotate')}
            style={{ border: 'none', background: navMode === 'rotate' ? '#3b82f6' : 'transparent', color: navMode === 'rotate' ? 'white' : '#94a3b8', padding: '0.4rem 0.8rem', borderRadius: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
         >
           <Rotate3d size={14} /> Rotation
         </button>
         <button 
            onClick={() => setNavMode('pan')}
            style={{ border: 'none', background: navMode === 'pan' ? '#3b82f6' : 'transparent', color: navMode === 'pan' ? 'white' : '#94a3b8', padding: '0.4rem 0.8rem', borderRadius: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
         >
           <Hand size={14} /> Main (Pan)
         </button>
         <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)' }} />
         <button 
            onClick={resetView}
            style={{ border: 'none', background: 'transparent', color: '#94a3b8', padding: '0.4rem 0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
         >
           <Maximize size={14} /> Recentser
         </button>
      </div>
    </div>
  );
};

export default Profile3DViewer;
