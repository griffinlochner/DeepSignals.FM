import assert from 'node:assert/strict'
import { parsePsyBrazilTelemetry } from '../src/app/psybrazilTelemetry'

const definitions = [
  { stationKey: 'psybr', streamUrl: 'https://radio.psybrazil.com.br/psybr' },
  {
    stationKey: 'dumangue',
    streamUrl: 'https://radio.psybrazil.com.br/dumangue',
  },
  {
    stationKey: 'progressive',
    streamUrl: 'https://radio.psybrazil.com.br/progressive',
  },
  { stationKey: 'lofi', streamUrl: 'https://radio.psybrazil.com.br/lofi' },
  {
    stationKey: 'lowbpm',
    streamUrl: 'https://radio.psybrazil.com.br/lowbpm',
  },
  {
    stationKey: 'electro',
    streamUrl: 'https://radio.psybrazil.com.br/electro',
  },
] as const

assert.equal(definitions.length, 6)

const networkStations = Object.fromEntries(
  ['dumangue', 'electro', 'progressive', 'planb', 'lofi', 'whapade', 'lowbpm', 'psybr']
    .map((id, index) => [id, {
      id,
      status: 'online',
      listeners: 99,
      stream: {
        mount: id,
        stream_url: `https://psybrazil.com.br/${id}`,
        listeners: index,
        bitrate: 128 + index * 16,
      },
    }]),
)

for (const [index, definition] of definitions.entries()) {
  const identity = definition
  const listeners = index === 0 ? 0 : index + 1
  const bitrate = 128 + index * 16
  const validPayload = {
    station: definition.stationKey,
    status: 'online',
    listeners: { total: listeners },
    stream: { direct_url: definition.streamUrl, bitrate },
  }

  assert.deepEqual(parsePsyBrazilTelemetry(validPayload, identity), {
    listeners,
    bitrateKbps: bitrate,
  })
  assert.deepEqual(
    parsePsyBrazilTelemetry(
      { ...validPayload, listeners: { total: 'invalid' } },
      identity,
    ),
    { listeners: null, bitrateKbps: bitrate },
  )
  assert.deepEqual(
    parsePsyBrazilTelemetry(
      { ...validPayload, stream: { ...validPayload.stream, bitrate: 0 } },
      identity,
    ),
    { listeners, bitrateKbps: null },
  )
  assert.equal(
    parsePsyBrazilTelemetry({ ...validPayload, status: 'offline' }, identity),
    null,
  )
  assert.equal(
    parsePsyBrazilTelemetry({ ...validPayload, station: 'other' }, identity),
    null,
  )
  assert.equal(
    parsePsyBrazilTelemetry(
      {
        ...validPayload,
        stream: { ...validPayload.stream, direct_url: 'https://example.com/wrong' },
      },
      identity,
    ),
    null,
  )
  assert.equal(
    parsePsyBrazilTelemetry(
      {
        station: definition.stationKey,
        status: 'online',
        stream: { direct_url: definition.streamUrl },
      },
      identity,
    ),
    null,
  )

  const entry = networkStations[definition.stationKey]
  const wrap = (station: unknown) => ({
    ok: true,
    total_listeners: 999,
    stations: { ...networkStations, [definition.stationKey]: station },
  })
  assert.deepEqual(parsePsyBrazilTelemetry(wrap(entry), identity), {
    listeners: entry.stream.listeners,
    bitrateKbps: entry.stream.bitrate,
  })
  assert.deepEqual(
    parsePsyBrazilTelemetry(
      wrap({ ...entry, stream: { ...entry.stream, listeners: '0', bitrate: '256' } }),
      identity,
    ),
    { listeners: 0, bitrateKbps: 256 },
  )
  assert.deepEqual(
    parsePsyBrazilTelemetry(
      wrap({ ...entry, listeners: '3', stream: { bitrate: 256 } }),
      identity,
    ),
    { listeners: 3, bitrateKbps: 256 },
  )
  assert.deepEqual(
    parsePsyBrazilTelemetry(
      wrap({ ...entry, listeners: -1, stream: { bitrate: '192', listeners: -1 } }),
      identity,
    ),
    { listeners: null, bitrateKbps: 192 },
  )
  assert.deepEqual(
    parsePsyBrazilTelemetry(
      wrap({ ...entry, stream: { bitrate: 0, listeners: 0 } }),
      identity,
    ),
    { listeners: 0, bitrateKbps: null },
  )
  const otherStations = { ...networkStations }
  delete otherStations[definition.stationKey]
  assert.equal(
    parsePsyBrazilTelemetry({ ok: true, stations: otherStations }, identity),
    null,
  )
  for (const invalid of [
    null,
    [],
    { ...entry, id: 'other' },
    { ...entry, status: 'offline' },
    { ...entry, stream: { ...entry.stream, mount: 'other' } },
    { ...entry, stream: { ...entry.stream, direct_url: 'https://example.com/wrong' } },
    { ...entry, stream: { ...entry.stream, stream_url: 'https://psybrazil.com.br/other' } },
    { ...entry, listeners: null, stream: { listeners: '', bitrate: -1 } },
    { ...entry, stream: null },
  ]) {
    assert.equal(parsePsyBrazilTelemetry(wrap(invalid), identity), null)
  }
  assert.equal(
    parsePsyBrazilTelemetry({ ...wrap(entry), ok: false }, identity),
    null,
  )
  assert.equal(
    parsePsyBrazilTelemetry({ stations: null, ...validPayload }, identity),
    null,
  )
}

console.log('PsyBrazil telemetry parser checks passed for all six stations')