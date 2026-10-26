export function isPsyBrazilRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** The current endpoint returns the whole network, regardless of ?station=. */
export function selectPsyBrazilStation(
  value: unknown,
  stationKey: string,
): Record<string, unknown> | null {
  if (!isPsyBrazilRecord(value) || value.ok === false || value.success === false) {
    return null
  }

  let station = value

  if ('stations' in value) {
    if (
      !isPsyBrazilRecord(value.stations) ||
      !Object.hasOwn(value.stations, stationKey)
    ) {
      return null
    }

    const entry = value.stations[stationKey]
    if (!isPsyBrazilRecord(entry)) {
      return null
    }
    station = entry
  }

  const stream = isPsyBrazilRecord(station.stream) ? station.stream : null
  if (
    station.ok === false ||
    station.success === false ||
    (station.status !== undefined && station.status !== 'online') ||
    (station.station !== undefined && station.station !== stationKey) ||
    (station.id !== undefined && station.id !== stationKey) ||
    (stream?.mount !== undefined && stream.mount !== stationKey)
  ) {
    return null
  }

  return station
}
