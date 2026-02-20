import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getAudio } from "../lib/audioEngine";

type FloatingCircle = {
  mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  driftX: number;
  driftY: number;
  ampX: number;
  ampY: number;
  phase: number;
  baseScale: number;
  baseOpacity: number;
  pulseOffset: number;
};

const BackgroundVisualizer = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.z = 9;

    const circleGeometry = new THREE.CircleGeometry(1, 48);
    const palette = [0x7c3aed, 0x14b8a6, 0x38bdf8, 0x22d3ee];
    const circleCount = 6;
    const circles: FloatingCircle[] = [];

    for (let i = 0; i < circleCount; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: palette[i % palette.length],
        transparent: true,
        opacity: 0.12 + Math.random() * 0.24,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(circleGeometry, material);
      mesh.position.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 11,
        -1 - Math.random() * 4
      );

      const baseScale = 0.95 + Math.random() * 2.2;
      mesh.scale.setScalar(baseScale);
      scene.add(mesh);

      circles.push({
        mesh,
        driftX: (Math.random() - 0.5) * 0.0065,
        driftY: (Math.random() - 0.5) * 0.0065,
        ampX: 0.25 + Math.random() * 0.9,
        ampY: 0.25 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        baseScale,
        baseOpacity: material.opacity,
        pulseOffset: Math.random() * Math.PI * 2
      });
    }

    let frameId = 0;
    let analyser: AnalyserNode | null = null;
    let dataArray: Uint8Array<ArrayBuffer> | null = null;

    const audio = getAudio();
    const setupAnalyser = () => {
      if (analyser) return;
      try {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(audio);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      } catch {
        analyser = null;
      }
    };

    const resize = () => {
      if (!container) return;
      const { clientWidth, clientHeight } = container;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    };

    const animate = (time = 0) => {
      frameId = requestAnimationFrame(animate);

      const t = time * 0.001;
      const xLimit = 5.4 * camera.aspect;
      const yLimit = 5.4;
      let boost = 0;

      if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        boost = dataArray.reduce((acc, val) => acc + val, 0) / (dataArray.length * 255);
      }

      for (const circle of circles) {
        const pulse = 1 + Math.sin(t * 1.1 + circle.pulseOffset) * 0.08 + boost * 0.15;
        circle.mesh.scale.setScalar(circle.baseScale * pulse);
        circle.mesh.material.opacity = Math.min(0.55, circle.baseOpacity + boost * 0.12);

        circle.mesh.position.x +=
          circle.driftX + Math.sin(t * 0.55 + circle.phase) * 0.0022 * circle.ampX;
        circle.mesh.position.y +=
          circle.driftY + Math.cos(t * 0.47 + circle.phase) * 0.0022 * circle.ampY;

        if (circle.mesh.position.x > xLimit) circle.mesh.position.x = -xLimit;
        if (circle.mesh.position.x < -xLimit) circle.mesh.position.x = xLimit;
        if (circle.mesh.position.y > yLimit) circle.mesh.position.y = -yLimit;
        if (circle.mesh.position.y < -yLimit) circle.mesh.position.y = yLimit;
      }

      renderer.render(scene, camera);
    };

    const onPlay = () => {
      setupAnalyser();
    };

    window.addEventListener("resize", resize);
    audio.addEventListener("play", onPlay);
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      audio.removeEventListener("play", onPlay);
      cancelAnimationFrame(frameId);
      for (const circle of circles) {
        scene.remove(circle.mesh);
        circle.mesh.material.dispose();
      }
      circleGeometry.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="pointer-events-none absolute inset-0 opacity-70" />;
};

export default BackgroundVisualizer;
