# mapping

Pure functions from audio features to visual parameters: `(slider values, AudioFeatures) → values the scene renders with`.

`lakeMapping.ts` is the one for the lake. It also defines the **Reactivity** sliders, one "amount" per
connection (loudness → flow, lows → warp, attack → flash...). This is the file to edit when you want the
visuals to feel different; `lakeMapping.test.ts` checks the basics still hold.
