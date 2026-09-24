import { EXTERNAL_SIGNAL_DEFINITIONS } from './externalSignals'
import { parsePsyBrazilTelemetry } from './psybrazilTelemetry'
import { useStationTelemetry } from './useStationTelemetry'

const PSYBRAZIL_TELEMETRY_POLL_MS = 45_000

const PSYBRAZIL_TELEMETRY_CONFIGS = EXTERNAL_SIGNAL_DEFINITIONS.flatMap(
  (definition) => {
    if (
      definition.id !== 'psybrazil' &&
      !definition.id.startsWith('psybrazil-')
    ) {
      return []
    }

    const stationKey = new URL(definition.streamUrl).pathname
      .split('/')
      .filter(Boolean)
      .at(-1)

    if (!stationKey) {
      return []
    }

    const identity = { stationKey, streamUrl: definition.streamUrl }

    return [
      {
        sourceId: definition.id,
        telemetryUrl: `https://psybrazil.com.br/api/track.php?station=${encodeURIComponent(stationKey)}`,
        pollMs: PSYBRAZIL_TELEMETRY_POLL_MS,
        parse: (value: unknown) => parsePsyBrazilTelemetry(value, identity),
        requestLabel: definition.stationName,
      },
    ]
  },
)

export function usePsyBrazilTelemetry(selectedSourceId: string | null) {
  const activeConfig =
    PSYBRAZIL_TELEMETRY_CONFIGS.find(
      (config) => config.sourceId === selectedSourceId,
    ) ?? PSYBRAZIL_TELEMETRY_CONFIGS[0]

  return useStationTelemetry(selectedSourceId, activeConfig)
}