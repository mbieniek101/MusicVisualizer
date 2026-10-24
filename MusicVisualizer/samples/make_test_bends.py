"""Synthesize a guitar-like test of bends, for checking bend tracking without a guitar.

    python make_test_bends.py test-bends.wav      (needs numpy)

Timeline (loops cleanly):
  0.4 s  pick G3, let it ring
  0.9 s  bend up a whole step over 0.35 s, hold with vibrato
  2.2 s  release back down over 0.3 s
  3.2 s  pick D4, quick half-step bend up and back
  4.6 s  strum a chord (E A D G), which should NOT read as a bend
  6.0 s  silence until 7 s
"""
import sys
import numpy as np

SR = 48000
TOTAL = 7.0
t = np.arange(int(SR * TOTAL)) / SR
audio = np.zeros_like(t)


def note(start, end, semitone_curve, base_hz, amp=0.35, decay=1.4):
    """A plucked, harmonic tone whose pitch follows semitone_curve(time since start)."""
    mask = (t >= start) & (t < end)
    local = t[mask] - start
    hz = base_hz * 2 ** (semitone_curve(local) / 12)
    phase = 2 * np.pi * np.cumsum(hz) / SR  # integrate frequency so glides stay smooth
    env = np.exp(-local / decay) * np.minimum(1, local / 0.003)  # 3 ms pick attack
    tone = sum(np.sin(h * phase) * np.exp(-local * h * 0.6) / h for h in range(1, 7))
    audio[mask] += amp * env * tone


def ramp(x, x0, x1):
    return np.clip((x - x0) / (x1 - x0), 0, 1)


def big_bend(x):  # relative to the pick at 0.4 s
    up = 2 * ramp(x, 0.5, 0.85)
    vibrato = 0.25 * np.sin(2 * np.pi * 5.5 * (x - 0.95)) * ramp(x, 0.95, 1.15) * (x < 1.8)
    down = 2 * ramp(x, 1.8, 2.1)
    return up + vibrato - down


def quick_bend(x):
    return ramp(x, 0.25, 0.4) - ramp(x, 0.7, 0.85)


note(0.4, 3.1, big_bend, 196.0, decay=2.5)
note(3.2, 4.5, quick_bend, 293.66, decay=1.5)
for i, hz in enumerate([82.41, 110.0, 146.83, 196.0]):  # strum
    note(4.6 + i * 0.012, 6.0, lambda x: 0 * x, hz, amp=0.25, decay=0.9)

audio = np.clip(audio, -1, 1)
import wave

with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((audio * 32767).astype(np.int16).tobytes())
print('wrote', sys.argv[1], f'{TOTAL} s')
