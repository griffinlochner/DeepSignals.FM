import type { StationTelemetry } from './useStationTelemetry'

type PsyBrazilTelemetryResponse = {
  station?: unknown
  status?: unknown
  listeners?: {
    total?: unknown
  }
  stream?: {
    direct_url?: unknown
    bitrate?: unknown
  }
}

export type PsyBrazilTelemetryIdentity = {
  stationKey: string
  streamUrl: string
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function parseNonNegativeInteger(value: unknown): number | null {
  const parsed = parseNumber(value)
  return parsed !== null && parsed >= 0 ? Math.trunc(parsed) : null
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = parseNumber(value)
  return parsed !== null && parsed > 0 ? parsed : null
}

export function parsePsyBrazilTelemetry(
  value: unknown,
  expected: PsyBrazilTelemetryIdentity,
): StationTelemetry | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const payload = value as PsyBrazilTelemetryResponse

  if (
    payload.station !== expected.stationKey ||
    payload.status !== 'online' ||
    payload.stream?.direct_url !== expected.streamUrl
  ) {
    return null
  }

  const listeners = parseNonNegativeInteger(payload.listeners?.total)
  const bitrateKbps = parsePositiveNumber(payload.stream.bitrate)

  if (listeners === null && bitrateKbps === null) {
    return null
  }

  return { listeners, bitrateKbps }
}