import { useEffect, useRef, useState } from "react";

const sizes = [3, 7, 12];

function pointFromEvent(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

export default function ScratchPad({ framed = true, showHeading = true }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const [mode, setMode] = useState("pen");
  const [size, setSize] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.fillStyle = "#070a0f";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.fillStyle = "#070a0f";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function start(event) {
    const canvas = canvasRef.current;
    drawingRef.current = true;
    lastPointRef.current = pointFromEvent(canvas, event);
    canvas.setPointerCapture?.(event.pointerId);
  }

  function draw(event) {
    if (!drawingRef.current) {
      return;
    }
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const nextPoint = pointFromEvent(canvas, event);
    const lastPoint = lastPointRef.current || nextPoint;

    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = size;
    context.strokeStyle = mode === "erase" ? "#070a0f" : "#c7f24a";
    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(nextPoint.x, nextPoint.y);
    context.stroke();
    lastPointRef.current = nextPoint;
  }

  function stop(event) {
    drawingRef.current = false;
    lastPointRef.current = null;
    canvasRef.current?.releasePointerCapture?.(event.pointerId);
  }

  return (
    <section className={`scratchpad ${framed ? "panel-section" : ""}`.trim()} aria-label="Rough work pad">
      <div className="scratchpad-header">
        {showHeading ? (
          <div>
            <p className="eyebrow">Scratchpad</p>
            <h2>Rough work</h2>
          </div>
        ) : <div />}
        <button type="button" className="secondary compact" onClick={clear}>Clear</button>
      </div>

      <canvas
        aria-label="Draw rough work"
        className="scratchpad-canvas"
        height="320"
        onPointerCancel={stop}
        onPointerDown={start}
        onPointerLeave={stop}
        onPointerMove={draw}
        onPointerUp={stop}
        ref={canvasRef}
        width="520"
      />

      <div className="scratchpad-tools">
        <button className={mode === "pen" ? "" : "secondary"} onClick={() => setMode("pen")} type="button">Pen</button>
        <button className={mode === "erase" ? "" : "secondary"} onClick={() => setMode("erase")} type="button">Erase</button>
        <label>
          Size
          <select onChange={(event) => setSize(Number(event.target.value))} value={size}>
            {sizes.map((nextSize) => <option key={nextSize} value={nextSize}>{nextSize}px</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}
