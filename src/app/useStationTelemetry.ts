import { useEffect, useRef, useState } from 'react'

export type StationTelemetry = {
  listeners: number | null
  bitrateKbps: number | null
}

type StationTelemetryConfig = {
  sourceId: string
  telemetryUrl: string
  pollMs: number
  parse: (value: unknown) => StationTelemetry | null
  requestLabel: string
}

export function useStationTelemetry(
  selectedSourceId: string | null,
  config: StationTelemetryConfig,
) {
  const [telemetry, setTelemetry] = useState<StationTelemetry | null>(null)
  const requestGenerationRef = useRef(0)

  useEffect(() => {
    requestGenerationRef.current += 1
    const generation = requestGenerationRef.current

    if (selectedSourceId !== config.sourceId) {
      return
    }

    let timeoutHandle: number | null = null
    let activeController: AbortController | null = null

    const poll = async () => {
      activeController = new AbortController()

      try {
        const response = await fetch(config.telemetryUrl, {
          cache: 'no-store',
          mode: 'cors',
          signal: activeController.signal,
        })

        if (!response.ok) {
          throw new Error(
            `${config.requestLabel} telemetry request failed (${response.status})`,
          )
        }

        const payload = await response.json()
        const nextTelemetry = config.parse(payload)

        if (requestGenerationRef.current !== generation) {
          return
        }

        setTelemetry((current) => {
          if (
            current?.listeners === nextTelemetry?.listeners &&
            current?.bitrateKbps === nextTelemetry?.bitrateKbps
          ) {
            return current
          }

          return nextTelemetry
        })
      } catch {
        if (
          activeController?.signal.aborted ||
          requestGenerationRef.current !== generation
        ) {
          return
        }

        setTelemetry(null)
      } finally {
        if (requestGenerationRef.current === generation) {
          timeoutHandle = window.setTimeout(poll, config.pollMs)
        }
      }
    }

    void poll()

    return () => {
      requestGenerationRef.current += 1
      activeController?.abort()
      setTelemetry(null)

      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle)
      }
    }
  }, [config, selectedSourceId])

  return selectedSourceId === config.sourceId ? telemetry : null
}