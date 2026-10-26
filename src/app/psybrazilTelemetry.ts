import type { StationTelemetry } from './useStationTelemetry'
import { isPsyBrazilRecord, selectPsyBrazilStation } from './psybrazilMetadata'

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
  const payload = selectPsyBrazilStation(value, expected.stationKey)
  if (!payload || !isPsyBrazilRecord(payload.stream)) {
    return null
  }

  const networkResponse = isPsyBrazilRecord(value) && 'stations' in value
  const stream = payload.stream
  if (
    payload.status !== 'online' ||
    (!networkResponse && payload.station !== expected.stationKey) ||
    (!networkResponse && stream.direct_url !== expected.streamUrl) ||
    (stream.direct_url !== undefined && stream.direct_url !== expected.streamUrl) ||
    (stream.stream_url !== undefined &&
      stream.stream_url !== expected.streamUrl &&
      stream.stream_url !== `https://psybrazil.com.br/${expected.stationKey}`)
  ) {
    return null
  }

  const listeners = networkResponse
    ? parseNonNegativeInteger(stream.listeners) ??
      parseNonNegativeInteger(payload.listeners)
    : parseNonNegativeInteger(
        isPsyBrazilRecord(payload.listeners) ? payload.listeners.total : null,
      )
  const bitrateKbps = parsePositiveNumber(stream.bitrate)

  if (listeners === null && bitrateKbps === null) {
    return null
  }

  return { listeners, bitrateKbps }
}