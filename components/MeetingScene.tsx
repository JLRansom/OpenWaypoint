'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Dracula hex palette — matches ROLE_HEX in lib/constants.ts
// ---------------------------------------------------------------------------
const AGENT_COLORS: Record<string, string> = {
  writer:        '#bd93f9', // purple
  researcher:    '#8be9fd', // cyan
  coder:         '#50fa7b', // green
  'senior-coder': '#ffb86c', // orange
  tester:        '#ff79c6', // pink
}
const IDLE_COLOR = '#6272a4' // dracula comment

// ---------------------------------------------------------------------------
// Particle field component
// ---------------------------------------------------------------------------
function ParticleField({ speakingAgent }: { speakingAgent: string | null }) {
  const ref = useRef<THREE.Points>(null)
  const count = 2000

  // Pre-compute random positions (stable across renders)
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 10
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10
    }
    return pos
  }, [])

  const color = speakingAgent ? AGENT_COLORS[speakingAgent] ?? IDLE_COLOR : IDLE_COLOR

  useFrame((state, delta) => {
    if (!ref.current) return
    // Slow rotation
    ref.current.rotation.x += delta * 0.02
    ref.current.rotation.y += delta * 0.03

    // Gentle pulse when an agent is speaking
    if (speakingAgent) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.05
      ref.current.scale.setScalar(scale)
    } else {
      ref.current.scale.setScalar(1)
    }
  })

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color={color}
        size={0.02}
        sizeAttenuation
        depthWrite={false}
        opacity={speakingAgent ? 0.7 : 0.35}
      />
    </Points>
  )
}

// ---------------------------------------------------------------------------
// Ambient floating ring (decorative)
// ---------------------------------------------------------------------------
function FloatingRing({ speakingAgent }: { speakingAgent: string | null }) {
  const ref = useRef<THREE.Mesh>(null)
  const color = speakingAgent ? AGENT_COLORS[speakingAgent] ?? IDLE_COLOR : IDLE_COLOR

  useFrame((state, delta) => {
    if (!ref.current) return
    ref.current.rotation.x += delta * 0.1
    ref.current.rotation.z += delta * 0.05
    // Gentle float
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.3
  })

  return (
    <mesh ref={ref} position={[0, 0, 0]}>
      <torusGeometry args={[2, 0.01, 16, 64]} />
      <meshBasicMaterial color={color} transparent opacity={speakingAgent ? 0.4 : 0.15} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Exported scene
// ---------------------------------------------------------------------------
export function MeetingScene({ speakingAgent }: { speakingAgent: string | null }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 60 }}
      style={{ background: 'transparent' }}
      dpr={[1, 1.5]}
    >
      <ambientLight intensity={0.2} />
      <ParticleField speakingAgent={speakingAgent} />
      <FloatingRing speakingAgent={speakingAgent} />
    </Canvas>
  )
}
