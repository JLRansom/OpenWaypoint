'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { MeetingMessage, MeetingAgentType } from '@/lib/types'
import { MEETING_AGENT_ORDER } from '@/lib/types'
import { ROLE_HEX } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Agent colours
// ---------------------------------------------------------------------------
const IDLE_COLOR = '#44475a'

function agentColor(agentType: MeetingAgentType): string {
  return ROLE_HEX[agentType] ?? IDLE_COLOR
}

// ---------------------------------------------------------------------------
// Table at the centre
// ---------------------------------------------------------------------------
function Table() {
  return (
    <mesh position={[0, -0.15, 0]} receiveShadow>
      <cylinderGeometry args={[1.8, 1.8, 0.12, 48]} />
      <meshStandardMaterial color="#282a36" metalness={0.3} roughness={0.6} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Single robot figure
// ---------------------------------------------------------------------------
interface RobotProps {
  agentType: MeetingAgentType
  position: [number, number, number]
  rotationY: number
  isSpeaking: boolean
  chatText: string | null
}

function Robot({ agentType, position, rotationY, isSpeaking, chatText }: RobotProps) {
  const groupRef = useRef<THREE.Group>(null)
  const color = agentColor(agentType)
  const emissiveColor = isSpeaking ? color : '#000000'
  const opacity = isSpeaking ? 1.0 : 0.55

  useFrame((state) => {
    if (!groupRef.current) return
    if (isSpeaking) {
      // Gentle bounce
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 4) * 0.04
    } else {
      groupRef.current.position.y = position[1]
    }
  })

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      {/* Torso */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.32, 0.44, 0.22]} />
        <meshStandardMaterial
          color={color}
          emissive={emissiveColor}
          emissiveIntensity={isSpeaking ? 0.25 : 0}
          transparent
          opacity={opacity}
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.61, 0]} castShadow>
        <boxGeometry args={[0.26, 0.26, 0.22]} />
        <meshStandardMaterial
          color={color}
          emissive={emissiveColor}
          emissiveIntensity={isSpeaking ? 0.5 : 0}
          transparent
          opacity={opacity}
          metalness={0.4}
          roughness={0.4}
        />
      </mesh>

      {/* Eyes (two small white boxes) */}
      <mesh position={[-0.065, 0.63, 0.112]}>
        <boxGeometry args={[0.06, 0.04, 0.01]} />
        <meshStandardMaterial color={isSpeaking ? '#ffffff' : '#6272a4'} emissive={isSpeaking ? '#ffffff' : '#000000'} emissiveIntensity={isSpeaking ? 0.8 : 0} />
      </mesh>
      <mesh position={[0.065, 0.63, 0.112]}>
        <boxGeometry args={[0.06, 0.04, 0.01]} />
        <meshStandardMaterial color={isSpeaking ? '#ffffff' : '#6272a4'} emissive={isSpeaking ? '#ffffff' : '#000000'} emissiveIntensity={isSpeaking ? 0.8 : 0} />
      </mesh>

      {/* Left arm */}
      <mesh position={[-0.21, 0.22, 0]} rotation={[0, 0, 0.3]} castShadow>
        <cylinderGeometry args={[0.05, 0.04, 0.35, 8]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} metalness={0.3} roughness={0.6} />
      </mesh>

      {/* Right arm */}
      <mesh position={[0.21, 0.22, 0]} rotation={[0, 0, -0.3]} castShadow>
        <cylinderGeometry args={[0.05, 0.04, 0.35, 8]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} metalness={0.3} roughness={0.6} />
      </mesh>

      {/* Chat bubble — only when speaking */}
      {isSpeaking && chatText && (
        <Html position={[0, 1.15, 0]} center distanceFactor={5} zIndexRange={[100, 0]}>
          <div
            style={{
              background: 'rgba(40,42,54,0.92)',
              border: `1px solid ${color}`,
              borderRadius: 8,
              padding: '6px 10px',
              maxWidth: 180,
              pointerEvents: 'none',
              backdropFilter: 'blur(4px)',
            }}
          >
            <p
              style={{
                color,
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 3,
              }}
            >
              {agentType}
            </p>
            <p
              style={{
                color: '#f8f8f2',
                fontSize: 10,
                lineHeight: 1.4,
                margin: 0,
                wordBreak: 'break-word',
              }}
            >
              {chatText}
            </p>
          </div>
        </Html>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// The full scene with 5 robots arranged around the table
// ---------------------------------------------------------------------------
function RobotsScene({
  speakingAgent,
  messages,
}: {
  speakingAgent: MeetingAgentType | null
  messages: MeetingMessage[]
}) {
  const radius = 2.2

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 5, 0]} intensity={1.2} color="#f8f8f2" castShadow />
      <pointLight position={[0, 2, 3]} intensity={0.3} color="#bd93f9" />

      {/* Table */}
      <Table />

      {/* Slow auto-orbit */}
      <OrbitControls
        autoRotate
        autoRotateSpeed={0.4}
        enableZoom={false}
        enablePan={false}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 4.5}
      />

      {/* Five robots */}
      {MEETING_AGENT_ORDER.map((agentType, i) => {
        const angle = (i / MEETING_AGENT_ORDER.length) * Math.PI * 2 - Math.PI / 2
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        const rotationY = -angle + Math.PI / 2 // face the centre

        const msgRow = messages.find((m) => m.agentType === agentType && m.status !== 'pending')
        const chatText = msgRow?.content
          ? msgRow.content.slice(-120).split(' ').slice(-20).join(' ')
          : null

        return (
          <Robot
            key={agentType}
            agentType={agentType}
            position={[x, 0, z]}
            rotationY={rotationY}
            isSpeaking={speakingAgent === agentType}
            chatText={speakingAgent === agentType ? chatText : null}
          />
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Exported scene (Canvas wrapper)
// ---------------------------------------------------------------------------
export function MeetingScene({
  speakingAgent,
  messages,
}: {
  speakingAgent: string | null
  messages: MeetingMessage[]
}) {
  const typedSpeaker = speakingAgent as MeetingAgentType | null

  return (
    <Canvas
      camera={{ position: [0, 3, 6], fov: 55 }}
      style={{ background: 'transparent' }}
      dpr={[1, 1.5]}
      shadows
    >
      <RobotsScene speakingAgent={typedSpeaker} messages={messages} />
    </Canvas>
  )
}
