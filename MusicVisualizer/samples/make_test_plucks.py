# Synthetic guitar: Karplus-Strong plucks. Pattern: single notes, a gap, a loud low strum, a gap.
import numpy as np, wave, sys
SR = 48000
def pluck(freq, dur, amp):
    n = int(SR * dur); period = int(SR / freq)
    buf = np.random.uniform(-1, 1, period)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = 0.996 * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    return amp * out
events = []  # (start time, freq, amp)
t = 0.5
for f in [196, 247, 294, 392, 494, 587]:  # quiet single notes, G major-ish
    events.append((t, f, 0.25)); t += 0.4
t += 1.0  # gap of silence
for f in [82, 110, 147]:  # loud low strum (E A D)
    events.append((t, f, 0.6)); t += 0.015
t += 2.0
total = t + 0.5
audio = np.zeros(int(SR * total))
for start, f, a in events:
    s = pluck(f, 1.8, a); i = int(start * SR)
    audio[i:i + len(s)] += s[: len(audio) - i]
audio = np.clip(audio, -1, 1)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((audio * 32767).astype(np.int16).tobytes())
print('seconds', round(total, 2), 'onsets expected', len(events) - 2)
