#version 300 es
// One oversized triangle that covers the whole screen; the fragment shader does all the work.
// Vertex 0 → (-1,-1), vertex 1 → (3,-1), vertex 2 → (-1,3)
void main() {
  vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
