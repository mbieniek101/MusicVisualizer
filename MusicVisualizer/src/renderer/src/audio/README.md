# audio

Gets sound in and turns it into numbers the visuals can use. Knows nothing about visuals.

| File                  | What it does                                                                               | Runs in a browser only? |
| --------------------- | ------------------------------------------------------------------------------------------ | ----------------------- |
| `AudioEngine.ts`      | The Web Audio graph: device / system audio / file in, channel pick, gain, analyser out     | yes                     |
| `devices.ts`          | Lists recording devices, watches for plug/unplug                                           | yes                     |
| `outputWatcher.ts`    | Notices the default playback device changing, so System audio can follow it                | no                      |
| `FeatureExtractor.ts` | Raw samples + spectrum → `AudioFeatures`, once per frame                                   | no                      |
| `dsp.ts`              | Pure measurements: RMS, band energy, spectral centroid, spectral flux                      | no                      |
| `smoothing.ts`        | `Envelope` (attack/release), `AutoLevel` (normalizing), `OnsetDetector`                    | no                      |
| `momentum.ts`         | `momentum` (builds with hard, busy playing) and `surge` (a coasting push from each attack) | no                      |
| `pitch.ts`            | YIN pitch detection: the held note's frequency and how clear it is                         | no                      |
| `bend.ts`             | `bend`: how far the held note has been bent since it was picked (1 = a whole step)         | no                      |
| `types.ts`            | `AudioFeatures`, `AnalysisFrame`                                                           | no                      |

Everything marked "no" has tests next to it (`*.test.ts`), run with `npm test`.

## Tuning

Most of the feel lives in the constants at the top of `FeatureExtractor.ts`: band edges, attack/release
times, how long auto-leveling remembers your loudest playing, how long the attack flash takes to fade.
Live settings (gain, noise gate, attack sensitivity) are in the control panel; watch the
**Audio meters** folder while you adjust them.
