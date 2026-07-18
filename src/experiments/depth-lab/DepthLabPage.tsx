import { useMemo, useState } from 'react'
import DepthLabShell from './DepthLabShell'
import type {
  DepthLabEnvironment,
  DepthLabLoadingState,
  DepthLabPlaybackState,
  DepthLabSettings,
} from './types'

const DEFAULT_SETTINGS: DepthLabSettings = {
  environment: 'beach-panorama',
  playbackState: 'dormant',
  motionIntensity: 0.35,
  depthStrength: 0.45,
  pointerParallaxEnabled: true,
  autoMotionEnabled: true,
}

const ENVIRONMENT_LABELS: Record<DepthLabEnvironment, string> = {
  'beach-panorama': 'Beach Panorama',
  'jungle-depth': 'Jungle Depth Image',
}

const STATE_LABELS: Record<DepthLabPlaybackState, string> = {
  dormant: 'Dormant',
  armed: 'Armed',
  playing: 'Playing',
}

function DepthLabPage() {
  const [settings, setSettings] = useState<DepthLabSettings>(DEFAULT_SETTINGS)
  const [loadingState, setLoadingState] = useState<DepthLabLoadingState>('loading')

  const status = useMemo(() => {
    const environmentLabel = ENVIRONMENT_LABELS[settings.environment]
    const stateLabel = STATE_LABELS[settings.playbackState]
    const loadingLabel =
      loadingState === 'loading' ? 'loading' : loadingState === 'ready' ? 'live' : 'asset error'

    return `${environmentLabel} · ${stateLabel} · ${loadingLabel}`
  }, [loadingState, settings.environment, settings.playbackState])

  return (
    <DepthLabShell
      settings={settings}
      status={status}
      onEnvironmentChange={(environment) => {
        setLoadingState('loading')
        setSettings((current) => ({ ...current, environment }))
      }}
      onPlaybackStateChange={(playbackState) => setSettings((current) => ({ ...current, playbackState }))}
      onMotionIntensityChange={(motionIntensity) => setSettings((current) => ({ ...current, motionIntensity }))}
      onDepthStrengthChange={(depthStrength) => setSettings((current) => ({ ...current, depthStrength }))}
      onPointerParallaxChange={(pointerParallaxEnabled) =>
        setSettings((current) => ({ ...current, pointerParallaxEnabled }))
      }
      onAutoMotionChange={(autoMotionEnabled) => setSettings((current) => ({ ...current, autoMotionEnabled }))}
      onLoadingStateChange={setLoadingState}
    />
  )
}

export default DepthLabPage
