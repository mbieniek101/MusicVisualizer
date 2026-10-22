#version 300 es
// Lake scene: domain-warped fractal noise.
//
// The idea: fbm(p) gives smooth clouds. If you look up fbm at a position that
// was itself pushed around by another fbm (and that one by a third), the
// clouds fold into swirling, liquid shapes, like oil drifting on water.
// See https://iquilezles.org/articles/warp/ for the original write-up.

precision highp float;

uniform vec2 uResolution;    // canvas size in pixels
uniform float uTime;         // already scaled by flow speed on the JS side
uniform float uZoom;         // higher = closer in: fewer, bigger blobs
uniform float uWarp;         // how strongly each noise layer pushes the next
uniform int uOctaves;        // fbm detail layers
uniform float uHue;          // rotates the palette
uniform float uColorSpread;  // how many colors appear across the frame
uniform float uSaturation;
uniform float uBrightness;
uniform float uBlackLevel;   // noise value below which everything is black
uniform float uSoftness;     // width of the fade from black into a blob

out vec4 outColor;

const int MAX_OCTAVES = 8;
const float TAU = 6.28318530718;

// ---- noise ---------------------------------------------------------------

// Pseudo-random number in [0,1) for a 2D lattice point ("hash without sine", Dave Hoskins).
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Value noise: random values on a grid, smoothly interpolated between.
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f); // smoothstep curve hides the grid
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Rotating each octave stops the layers lining up into visible grid streaks.
const mat2 ROTATE = mat2(0.8, 0.6, -0.6, 0.8);

// Fractal Brownian motion: several octaves of noise, each twice the frequency
// and half the strength of the last. Normalized so the result stays in ~0..1
// whatever the octave count, so the Detail slider doesn't change brightness.
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float total = 0.0;
  for (int i = 0; i < MAX_OCTAVES; i++) {
    if (i >= uOctaves) break;
    value += amplitude * noise(p);
    total += amplitude;
    p = ROTATE * p * 2.02;
    amplitude *= 0.5;
  }
  return value / total;
}

// ---- color ---------------------------------------------------------------

// Cosine palette (iquilezles.org/articles/palettes): one formula, endless gradients.
// These coefficients cycle through magenta, cyan and yellow, the classic VHS colors.
vec3 palette(float t) {
  vec3 a = vec3(0.5);
  vec3 b = vec3(0.5);
  vec3 c = vec3(1.0);
  vec3 d = vec3(0.0, 0.33, 0.67);
  return a + b * cos(TAU * (c * t + d));
}

vec3 adjustSaturation(vec3 color, float amount) {
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  return mix(vec3(luma), color, amount);
}

// ---- main ----------------------------------------------------------------

void main() {
  // Centered coordinates where the screen height spans 1 unit, so blobs stay
  // round on any aspect ratio (a 16:9 projector, a square test window...).
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  // The offset keeps us away from the noise origin, where hashes tend to come out
  // low; without it the center of the screen (the middle of the amp) stays dark.
  // Dividing by zoom means a bigger value shows less of the pattern, i.e. zooms in.
  // At zoom 1 the screen height spans 3 units of noise.
  vec2 p = uv * (3.0 / uZoom) + vec2(37.2, 17.9);
  float t = uTime;

  // Layer 1: a slowly drifting 2D offset field.
  vec2 q = vec2(
    fbm(p + vec2(0.0, 0.0) + 0.10 * t),
    fbm(p + vec2(5.2, 1.3) - 0.08 * t)
  );

  // Layer 2: noise sampled at positions pushed around by layer 1.
  vec2 r = vec2(
    fbm(p + uWarp * q + vec2(1.7, 9.2) + 0.15 * t),
    fbm(p + uWarp * q + vec2(8.3, 2.8) + 0.126 * t)
  );

  // Final value: noise pushed around by layer 2.
  float f = fbm(p + uWarp * r);

  // Color comes from the warp fields, not just f, so neighboring blobs pick up
  // different colors as they fold into each other: the oil-slick look.
  // The mix below averages about 0.8, so subtracting it centers the colors on
  // palette position 0.33 (blue), spreading out toward magenta and cyan.
  float variation = 0.6 * f + 0.5 * length(q) + 0.3 * r.x - 0.8;
  float colorIndex = 0.33 + uHue + uColorSpread * variation;
  vec3 color = adjustSaturation(palette(colorIndex), uSaturation);

  // Blob mask: low values go to true black, so on the amp only the blobs carry light.
  float mask = smoothstep(uBlackLevel, uBlackLevel + uSoftness, f);

  // A slight boost toward each blob's core gives them some depth.
  float core = smoothstep(uBlackLevel + uSoftness, uBlackLevel + uSoftness + 0.25, f);
  color *= mask * (0.85 + 0.35 * core) * uBrightness;

  outColor = vec4(color, 1.0);
}
