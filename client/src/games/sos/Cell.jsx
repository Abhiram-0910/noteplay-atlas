export default function Cell({ value, row, col, disabled, highlighted, lastMove, onClick }) {
  const classes = [
    "cell",
    value ? "filled" : "empty",
    highlighted ? "sos-highlight" : "",
    lastMove ? "last-move" : ""
  ].filter(Boolean).join(" ");

  return (
    <button
      aria-label={value ? `Cell ${row + 1}, ${col + 1}: ${value}` : `Empty cell ${row + 1}, ${col + 1}`}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      role="gridcell"
      type="button"
    >
      {value}
    </button>
  );
}
