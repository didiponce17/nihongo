export function mountWritingCanvas(canvas) {
  const context = canvas.getContext("2d");
  let drawing = false;
  let strokes = [];
  let currentStroke = [];

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const bounds = canvas.getBoundingClientRect();
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    redraw();
  }

  function drawSegment(from, to) {
    context.strokeStyle = "#17221f";
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }

  function redraw() {
    context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    context.strokeStyle = "#d8d5ca";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(canvas.clientWidth / 2, 0);
    context.lineTo(canvas.clientWidth / 2, canvas.clientHeight);
    context.moveTo(0, canvas.clientHeight / 2);
    context.lineTo(canvas.clientWidth, canvas.clientHeight / 2);
    context.stroke();
    for (const stroke of strokes) for (let index = 1; index < stroke.length; index += 1) drawSegment(stroke[index - 1], stroke[index]);
  }

  function point(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  canvas.addEventListener("pointerdown", (event) => {
    drawing = true;
    currentStroke = [point(event)];
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    const next = point(event);
    drawSegment(currentStroke.at(-1), next);
    currentStroke.push(next);
  });
  canvas.addEventListener("pointerup", () => {
    if (currentStroke.length) strokes.push(currentStroke);
    currentStroke = [];
    drawing = false;
  });

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  return {
    clear() { strokes = []; redraw(); },
    undo() { strokes.pop(); redraw(); },
    destroy() { observer.disconnect(); },
  };
}