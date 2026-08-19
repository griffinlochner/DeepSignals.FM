# DeepSignals Environment Runtime Contract

This document defines the shared runtime semantics for DeepSignals environments. It describes player policy and analyzer data; it does not define artistic behavior for a particular environment.

## Runtime ownership

- `isPlaying` is player-owned and reflects actual playback.
- `motionEnabled` is the user's MOTION preference.
- `chromaEnabled` is the user's CHROMA preference.
- `volume` is the user's player volume.

The shared motion policy is:

```ts
effectiveMotion = isPlaying && motionEnabled
```

An environment may settle or freeze motion when playback stops, but must not change the user's MOTION preference. Starting playback again makes eligible motion active automatically.

MOTION and CHROMA are independent axes. Disabling one must not implicitly disable the other:

- MOTION controls movement, geometry animation, drift, and other kinetic behavior.
- CHROMA controls color, hue, saturation, brightness, and glow reactivity.

## Audio signals

`AudioReactiveSnapshot` remains the shared analyzer output. Its normalized fields include `energy`, `smoothedEnergy`, `bass`, `kickPulse`, `bassPulse`, `mids`, `highs`, `transient`, accepted kick-event fields, and `isActive`.

These analyzer values remain environment-neutral. Environments decide how to map them to movement, lighting, color, scale, glow, or other presentation. Those artistic mappings, curves, thresholds, and scene-specific smoothing remain environment-specific.

## Volume and visual reactivity

In the main player path, `HTMLAudioElement.volume` affects the amplitude entering the `MediaElementAudioSourceNode` and therefore affects the signal observed by the Web Audio analyser. Lower player volume naturally produces lower analyzer-derived reactive values; higher player volume produces stronger values.

Environments must not multiply `AudioReactiveSnapshot` values by `volume` again by default. Doing so would double-apply volume scaling. A future explicit visual-intensity value may define a different policy, but it is not part of this foundation contract.

## Optional generic events

Future runtime events such as `energySurge` may be exposed as optional, environment-neutral audio events. An environment may consume or ignore such an event. The event must describe the underlying signal transition, not its creative interpretation.

For example:

- Signal Runner may interpret it as BLAST OFF.
- A rollercoaster may interpret it as a launch burst.
- A biological environment may interpret it as an energy discharge.
- Another environment may ignore it.

## Acceptance matrix

| Playback | MOTION | CHROMA | Expected behavior |
| --- | --- | --- | --- |
| STOPPED | ON | ON | Resting or frozen motion; stopped-state visual treatment |
| STOPPED | OFF | ON | Resting or frozen motion; MOTION preference remains off |
| PLAYING | OFF | ON | Geometry and movement frozen or restrained; CHROMA may react |
| PLAYING | ON | OFF | Motion reacts; authored or base palette remains stable |
| PLAYING | ON | ON | Full reactive experience |
| PLAYING | OFF | OFF | Restrained or static visual experience |

Volume remains part of the current analyzer path, so it affects the apparent strength of reactive behavior for environments consuming the snapshot.
