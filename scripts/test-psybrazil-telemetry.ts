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
}

console.log('PsyBrazil telemetry parser checks passed for all six stations')