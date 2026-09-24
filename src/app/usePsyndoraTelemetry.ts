import { useStationTelemetry, type StationTelemetry } from './useStationTelemetry'

const PSYNDORA_TELEMETRY_POLL_MS = 45_000

type PsyndoraTelemetryEntry = {
  listeners?: unknown
  bitrate?: unknown
  mountpoint?: unknown
}

type PsyndoraTelemetryResponse = {
  data?: unknown
}

function parseNonNegativeInteger(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN

  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null
}

function parseBitrateKbps(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(?:kbps)?$/i)

  if (!match?.[1]) {
    return null
  }

  const parsed = Number(match[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function parsePsyndoraTelemetry(value: unknown): StationTelemetry | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const data = (value as PsyndoraTelemetryResponse).data

  if (!Array.isArray(data) || data.length !== 1) {
    return null
  }

  const entry = data[0] as PsyndoraTelemetryEntry | null

  if (!entry || entry.mountpoint !== '/stream') {
    return null
  }

  return {
    listeners: parseNonNegativeInteger(entry.listeners),
    bitrateKbps: parseBitrateKbps(entry.bitrate),
  }
}

const PSYNDORA_PSYTRANCE_TELEMETRY_CONFIG = {
  sourceId: 'psyndora-psytrance',
  telemetryUrl: 'https://cast.magicstreams.gr:2199/rpc/psyndora/streaminfo.get',
  pollMs: PSYNDORA_TELEMETRY_POLL_MS,
  parse: parsePsyndoraTelemetry,
  requestLabel: 'Psyndora Psytrance',
}

const PSYNDORA_CHILLOUT_TELEMETRY_CONFIG = {
  sourceId: 'psyndora-chillout',
  telemetryUrl: 'https://cast.magicstreams.gr:2199/rpc/psychill/streaminfo.get',
  pollMs: PSYNDORA_TELEMETRY_POLL_MS,
  parse: parsePsyndoraTelemetry,
  requestLabel: 'Psyndora Chillout',
}

export function usePsyndoraTelemetry(selectedSourceId: string | null) {
  const psytranceTelemetry = useStationTelemetry(
    selectedSourceId,
    PSYNDORA_PSYTRANCE_TELEMETRY_CONFIG,
  )
  const chilloutTelemetry = useStationTelemetry(
    selectedSourceId,
    PSYNDORA_CHILLOUT_TELEMETRY_CONFIG,
  )

  return psytranceTelemetry ?? chilloutTelemetry
}