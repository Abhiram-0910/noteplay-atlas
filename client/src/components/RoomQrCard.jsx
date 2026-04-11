import { useEffect, useMemo, useState } from "react";
import { buildJoinUrl } from "../utils/roomLinks.js";

function qrCells(qrcode, value) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const cells = [];
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        cells.push(`${col},${row}`);
      }
    }
  }
  return { count, cells };
}

export default function RoomQrCard({ roomCode }) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(null);
  const joinUrl = useMemo(() => buildJoinUrl(roomCode), [roomCode]);

  useEffect(() => {
    let cancelled = false;
    setQr(null);
    import("qrcode-generator").then((module) => {
      if (!cancelled) {
        setQr(qrCells(module.default, joinUrl));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  async function copyLink() {
    try {
      await navigator.clipboard?.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="room-qr-card" aria-label="Room QR join code">
      <div className="room-qr-header">
        <div>
          <p className="eyebrow">Room QR</p>
          <h2>Scan to join</h2>
        </div>
        <button type="button" className="secondary compact" onClick={copyLink}>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      <div className="qr-frame">
        {qr ? (
          <svg
            aria-label={`QR code for room ${roomCode}`}
            role="img"
            viewBox={`0 0 ${qr.count} ${qr.count}`}
          >
            <rect fill="#f7ffe8" height={qr.count} width={qr.count} />
            {qr.cells.map((cell) => {
              const [x, y] = cell.split(",").map(Number);
              return <rect fill="#05070b" height="1" key={cell} width="1" x={x} y={y} />;
            })}
          </svg>
        ) : (
          <div className="qr-loading">Preparing QR</div>
        )}
      </div>

      <p className="join-link-text">{joinUrl}</p>
    </section>
  );
}
