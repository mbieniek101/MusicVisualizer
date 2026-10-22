# samples

Audio for testing without a guitar plugged in. Load one with **Audio input → Load audio file…**.

- `test-plucks.wav`: synthetic plucked strings, 6.45 s, looping cleanly. Six quiet single notes about
  0.4 s apart, a loud low strum, then silence while it rings out. Expect **Attacks** to spike 7 times per
  loop and the meters to fall to zero in the gap.
- `make_test_plucks.py`: regenerates it (`python make_test_plucks.py test-plucks.wav`, needs numpy).

Short recordings of your own playing are worth adding here too.
