(() => {
  const canvas = document.querySelector('.balatro__canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    powerPreference: 'high-performance'
  });
  if (!gl) return;

  const vertexSource = `#version 300 es
    const vec2 corners[3] = vec2[3](
      vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0)
    );
    void main() {
      gl_Position = vec4(corners[gl_VertexID], 0.0, 1.0);
    }
  `;

  const fragmentSource = `#version 300 es
    precision highp float;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uPointer;
    uniform float uBlock;
    out vec4 fragColor;

    vec3 paint(vec2 coords) {
      vec2 screenSize = uResolution;
      vec2 uv = (coords - 0.5 * screenSize) / length(screenSize);
      float radius = length(uv);
      float speed = -0.4 + uTime * 0.7 + uPointer;
      float swirl = 0.25;
      float angle = atan(uv.y, uv.x) + speed + 302.2
        - 20.0 * (swirl * radius + (1.0 - swirl));
      vec2 mid = (screenSize / length(screenSize)) / 2.0;
      uv = vec2(radius * cos(angle) + mid.x, radius * sin(angle) + mid.y) - mid;
      uv *= 30.0;

      vec2 uv2 = vec2(uv.x + uv.y);
      for (int i = 0; i < 5; i++) {
        uv2 += sin(max(uv.x, uv.y)) + uv;
        uv += 0.5 * vec2(
          cos(5.1123314 + 0.353 * uv2.y + uTime * 0.13),
          sin(uv2.x - uTime * 0.113)
        );
        uv -= cos(uv.x + uv.y) - sin(uv.x * 0.711 - uv.y);
      }

      float contrast = 3.5;
      float contrastMod = 0.25 * contrast + 0.5 * swirl + 1.2;
      float amount = min(2.0, max(0.0, length(uv) * 0.035 * contrastMod));
      float c1 = max(0.0, 1.0 - contrastMod * abs(1.0 - amount));
      float c2 = max(0.0, 1.0 - contrastMod * abs(amount));
      float c3 = 1.0 - min(1.0, c1 + c2);
      float lighting = 0.4 * max(c1 * 5.0 - 4.0, 0.0)
        + 0.4 * max(c2 * 5.0 - 4.0, 0.0);

      vec3 color1 = vec3(0.008, 0.008, 0.008);
      vec3 color2 = vec3(1.0);
      vec3 color3 = vec3(0.086, 0.137, 0.145);
      vec3 color = 0.3 / contrast * color1
        + (1.0 - 0.3 / contrast) * (color1 * c1 + color2 * c2 + color3 * c3)
        + lighting;
      return clamp(color, 0.0, 1.0);
    }

    void main() {
      vec2 pixel = floor(gl_FragCoord.xy / uBlock) * uBlock + 0.5 * uBlock;
      vec3 color = paint(vec2(pixel.x, uResolution.y - pixel.y));
      fragColor = vec4(color, 1.0);
    }
  `;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Balatro shader error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return;

  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Balatro program error:', gl.getProgramInfoLog(program));
    return;
  }

  const resolutionLocation = gl.getUniformLocation(program, 'uResolution');
  const timeLocation = gl.getUniformLocation(program, 'uTime');
  const pointerLocation = gl.getUniformLocation(program, 'uPointer');
  const blockLocation = gl.getUniformLocation(program, 'uBlock');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 1;
  let height = 1;
  let block = 1.5;
  let pointer = 0;
  let targetPointer = 0;
  let animationFrame = 0;
  let startedAt = performance.now();

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const budgetScale = Math.min(1, Math.sqrt(2400000 / (innerWidth * innerHeight * dpr * dpr)));
    const pixelRatio = Math.max(0.5, dpr * budgetScale);
    block = 1.5 * pixelRatio;
    width = Math.max(1, Math.round(innerWidth * pixelRatio));
    height = Math.max(1, Math.round(innerHeight * pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    draw(performance.now());
  };

  const draw = now => {
    animationFrame = 0;
    if (document.visibilityState === 'hidden') return;
    const elapsed = reducedMotion ? 0 : (now - startedAt) / 1000 * 0.35;
    pointer += (targetPointer - pointer) * 0.025;
    gl.useProgram(program);
    gl.uniform2f(resolutionLocation, width, height);
    gl.uniform1f(timeLocation, elapsed);
    gl.uniform1f(pointerLocation, pointer);
    gl.uniform1f(blockLocation, block);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reducedMotion) animationFrame = requestAnimationFrame(draw);
  };

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', event => {
    targetPointer = (event.clientX / innerWidth - 0.5) * 0.35;
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !reducedMotion && !animationFrame) {
      startedAt = performance.now();
      animationFrame = requestAnimationFrame(draw);
    }
  });
  resize();
})();
