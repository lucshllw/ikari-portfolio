import type * as Three from 'three';

export type PickColor = 'coral' | 'lime';
export interface PickViewer {
  setColor(color: PickColor): void;
  rotate(horizontal: number, vertical?: number): void;
  setZoom(value: number): void;
  reset(): void;
  destroy(): void;
}
export interface PickViewerEvents { isCancelled?: () => boolean; onLost: () => void; onRendered?: () => void }

/** Called only after a user gesture. Every render is requested by an event. */
export async function createPickViewer(canvas: HTMLCanvasElement, color: PickColor, events: PickViewerEvents): Promise<PickViewer> {
  const T = await import('three');
  if (events.isCancelled?.()) throw new Error('Pick initialization cancelled');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0x000000, 0);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-2.15, 2.15, 2.15, -2.15, .1, 30);
  camera.position.set(0, 0, 6);
  const group = new T.Group();
  scene.add(group);
  const geometries = new Set<Three.BufferGeometry>();
  const materials = new Set<Three.Material>();
  const textures = new Set<Three.Texture>();
  let disposed = false;
  let visible = false;
  let frame = 0;
  let renderCount = 0;
  let drag: { id: number; x: number; y: number } | undefined;

  const disposers: (() => void)[] = [];
  try {
  const shape = new T.Shape();
  shape.moveTo(0, -1.6);
  shape.bezierCurveTo(-.35, -1.48, -1.63, .32, -1.43, 1.02);
  shape.bezierCurveTo(-1.26, 1.6, 1.26, 1.6, 1.43, 1.02);
  shape.bezierCurveTo(1.63, .32, .35, -1.48, 0, -1.6);
  shape.closePath();
  const geometry = new T.ExtrudeGeometry(shape, { depth: .14, bevelEnabled: true, bevelThickness: .055, bevelSize: .06, bevelSegments: 3, curveSegments: 20, steps: 1 });
  geometry.center();
  geometries.add(geometry);
  const gradient = new T.DataTexture(new Uint8Array([75, 75, 75, 255, 170, 170, 170, 255, 255, 255, 255, 255]), 3, 1, T.RGBAFormat);
  gradient.minFilter = gradient.magFilter = T.NearestFilter;
  gradient.needsUpdate = true;
  textures.add(gradient);
  const face = new T.MeshToonMaterial({ color: color === 'coral' ? '#FA7155' : '#C8FF00', gradientMap: gradient });
  const edge = new T.MeshToonMaterial({ color: '#111719', gradientMap: gradient });
  materials.add(face); materials.add(edge);
  const body = new T.Mesh(geometry, [face, edge]);
  group.add(body);
  const outlineMaterial = new T.MeshBasicMaterial({ color: '#111719', side: T.BackSide });
  materials.add(outlineMaterial);
  const outline = new T.Mesh(geometry, outlineMaterial);
  outline.scale.set(1.035, 1.035, 1.035);
  group.add(outline);

  const signatureCanvas = document.createElement('canvas');
  signatureCanvas.width = 640; signatureCanvas.height = 360;
  const context = signatureCanvas.getContext('2d');
  if (context) {
    context.fillStyle = '#111719'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.font = '900 156px Arial, sans-serif'; context.fillText('IKARI', 320, 132);
    context.font = '100px Arial, sans-serif'; context.fillText('★', 320, 275);
    const signature = new T.CanvasTexture(signatureCanvas);
    signature.colorSpace = T.SRGBColorSpace; textures.add(signature);
    const signatureMaterial = new T.MeshBasicMaterial({ map: signature, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const signatureGeometry = new T.PlaneGeometry(1.9, 1.069);
    materials.add(signatureMaterial); geometries.add(signatureGeometry);
    const mark = new T.Mesh(signatureGeometry, signatureMaterial);
    mark.position.set(0, .15, .135);
    group.add(mark);
  }
  scene.add(new T.AmbientLight('#F4EEDA', 2.1));
  const key = new T.DirectionalLight('#F4EEDA', 2.2); key.position.set(-3, 4, 5); scene.add(key);
  const rim = new T.DirectionalLight('#54D9D8', .65); rim.position.set(4, 1, -3); scene.add(rim);
  const resetAngles = () => group.rotation.set(-.18, -.42, -.12);
  resetAngles();

  function render() {
    frame = 0;
    canvas.dataset.renderPending = 'false';
    if (disposed || !visible || document.hidden) return;
    renderer.render(scene, camera);
    canvas.dataset.renderCount = String(++renderCount);
    events.onRendered?.();
  }
  function request() {
    if (!frame && !disposed && visible && !document.hidden) {
      canvas.dataset.renderPending = 'true';
      frame = requestAnimationFrame(render);
    }
  }
  function cancel() { cancelAnimationFrame(frame); frame = 0; canvas.dataset.renderPending = 'false'; }
  function resize() {
    if (disposed) return;
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(min-width:1024px)').matches ? 1.5 : 1));
    renderer.setSize(width, height, false);
    camera.left = -2.15 * width / height; camera.right = 2.15 * width / height;
    camera.updateProjectionMatrix(); request();
  }
  function rotate(horizontal: number, vertical = 0) {
    if (disposed) return;
    group.rotation.y += horizontal * Math.PI / 180;
    group.rotation.x = Math.max(-1.15, Math.min(1.15, group.rotation.x + vertical * Math.PI / 180));
    request();
  }
  function pointerDown(event: PointerEvent) {
    if (disposed || !event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return;
    rotate((event.clientX - drag.x) * .45, (event.clientY - drag.y) * .35);
    drag.x = event.clientX; drag.y = event.clientY;
  }
  function pointerEnd(event: PointerEvent) {
    if (drag?.id !== event.pointerId) return;
    drag = undefined;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  function lostCapture() { drag = undefined; }
  function setZoom(value: number) { if (disposed) return; camera.zoom = Math.max(.85, Math.min(1.25, value)); camera.updateProjectionMatrix(); request(); }
  function reset() { if (disposed) return; resetAngles(); camera.zoom = 1; camera.updateProjectionMatrix(); request(); }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') rotate(-15);
    else if (event.key === 'ArrowRight') rotate(15);
    else if (event.key === 'ArrowUp') rotate(0, -15);
    else if (event.key === 'ArrowDown') rotate(0, 15);
    else if (event.key === 'Home') reset();
    else if (event.key === '+' || event.key === '=') setZoom(camera.zoom + .05);
    else if (event.key === '-') setZoom(camera.zoom - .05);
    else return;
    event.preventDefault();
  }
  function visibility() { if (document.hidden) { cancel(); drag = undefined; } else request(); }
  function contextLost(event: Event) { event.preventDefault(); if (!disposed) { cancel(); events.onLost(); } }
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) request(); else { cancel(); drag = undefined; } }, { threshold: .01 });
  const resizeObserver = new ResizeObserver(resize);
  disposers.push(() => observer.disconnect(), () => resizeObserver.disconnect());
  observer.observe(canvas); resizeObserver.observe(canvas);
  document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerEnd);
  canvas.addEventListener('pointercancel', pointerEnd);
  canvas.addEventListener('lostpointercapture', lostCapture);
  canvas.addEventListener('keydown', keydown);
  canvas.addEventListener('webglcontextlost', contextLost);
  disposers.push(() => {
    document.removeEventListener('visibilitychange', visibility);
    canvas.removeEventListener('pointerdown', pointerDown);
    canvas.removeEventListener('pointermove', pointerMove);
    canvas.removeEventListener('pointerup', pointerEnd);
    canvas.removeEventListener('pointercancel', pointerEnd);
    canvas.removeEventListener('lostpointercapture', lostCapture);
    canvas.removeEventListener('keydown', keydown);
    canvas.removeEventListener('webglcontextlost', contextLost);
  });
  canvas.dataset.triangles = String(geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3);
  canvas.dataset.pickCanvas = 'true';
  canvas.dataset.renderPending = 'false';
  resize();
  return {
    setColor(next) { if (disposed) return; face.color.set(next === 'coral' ? '#FA7155' : '#C8FF00'); request(); },
    rotate, setZoom, reset,
    destroy() {
      if (disposed) return;
      disposed = true; cancel();
      if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id);
      drag = undefined;
      observer.disconnect(); resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerEnd);
      canvas.removeEventListener('pointercancel', pointerEnd);
      canvas.removeEventListener('lostpointercapture', lostCapture);
      canvas.removeEventListener('keydown', keydown);
      canvas.removeEventListener('webglcontextlost', contextLost);
      geometries.forEach(item => item.dispose());
      materials.forEach(item => item.dispose());
      textures.forEach(item => item.dispose());
      scene.clear(); renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss();
      signatureCanvas.width = signatureCanvas.height = 0;
    }
  };
  } catch (error) {
    disposed = true; cancelAnimationFrame(frame);
    disposers.forEach(dispose => dispose());
    geometries.forEach(item => item.dispose());
    materials.forEach(item => item.dispose());
    textures.forEach(item => item.dispose());
    scene.clear(); renderer.dispose(); renderer.forceContextLoss();
    throw error;
  }
}

