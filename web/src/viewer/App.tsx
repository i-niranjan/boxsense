import { Grid, Html, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { Matrix4 } from 'three';

// Mirrors SceneMessage in server/src/types.ts.
type ObjectState = 'visible' | 'occluded' | 'missing';
interface SceneObject {
  id: string;
  label: string;
  name?: string;
  position: [number, number, number];
  state: ObjectState;
  seenCount: number;
}
interface Scene {
  camera: number[] | null;
  objects: SceneObject[];
}

const STATE_COLORS: Record<ObjectState, string> = {
  visible: '#22c55e',
  occluded: '#f59e0b',
  missing: '#ef4444',
};

export function App() {
  const { scene, connected } = useScene();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', height: '100%' }}>
      <Canvas camera={{ position: [2, 2, 2], fov: 60 }}>
        <ambientLight intensity={0.8} />
        <Grid infiniteGrid cellSize={0.1} sectionSize={1} fadeDistance={20} cellColor="#1f2937" sectionColor="#374151" />
        <OrbitControls makeDefault />
        {scene.camera && <Phone pose={scene.camera} />}
        {scene.objects.map((o) => (
          <ObjectBox key={o.id} obj={o} />
        ))}
      </Canvas>

      <aside style={{ padding: 16, borderLeft: '1px solid #1f2937', overflowY: 'auto', fontSize: 14 }}>
        <h3 style={{ marginTop: 0 }}>Inventory</h3>
        <p style={{ color: connected ? '#22c55e' : '#ef4444' }}>{connected ? 'connected' : 'disconnected'}</p>
        <p>{scene.objects.length} objects</p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {scene.objects.map((o) => (
            <li key={o.id} style={{ marginBottom: 8 }}>
              <span style={{ color: STATE_COLORS[o.state] }}>●</span> {o.name ?? o.label}{' '}
              <span style={{ color: '#6b7280' }}>
                {o.id} · {o.state} · seen {o.seenCount}×
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function useScene() {
  const [scene, setScene] = useState<Scene>({ camera: null, objects: [] });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;
    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws?role=viewer`);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => setScene(JSON.parse(e.data));
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 1000);
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws.close();
    };
  }, []);

  return { scene, connected };
}

/** The phone's current position and direction. */
function Phone({ pose }: { pose: number[] }) {
  const matrix = useMemo(() => new Matrix4().fromArray(pose), [pose]);
  return (
    <group matrix={matrix} matrixAutoUpdate={false}>
      <mesh>
        <boxGeometry args={[0.07, 0.14, 0.01]} />
        <meshBasicMaterial color="#60a5fa" />
      </mesh>
      <axesHelper args={[0.15]} />
    </group>
  );
}

function ObjectBox({ obj }: { obj: SceneObject }) {
  // TODO: real size from the mask's 3D extent.
  return (
    <group position={obj.position}>
      <mesh>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshBasicMaterial color={STATE_COLORS[obj.state]} wireframe />
      </mesh>
      <Html center distanceFactor={4} position={[0, 0.16, 0]}>
        <div style={{ color: STATE_COLORS[obj.state], fontSize: 12, whiteSpace: 'nowrap' }}>{obj.name ?? obj.id}</div>
      </Html>
    </group>
  );
}
