import Cell from "./Cell.jsx";

function keyOf(row, col) {
  return `${row},${col}`;
}

export default function Board({ board, canMove, lastMove, sosLines, onMove }) {
  const sosCells = new Set((sosLines || []).flat().map(([row, col]) => keyOf(row, col)));
  const lastMoveKey = lastMove ? keyOf(lastMove.row, lastMove.col) : "";

  return (
    <div className="board" role="grid" aria-label="8 by 8 SOS board">
      {board.map((row, rowIndex) => row.map((value, colIndex) => {
        const cellKey = keyOf(rowIndex, colIndex);
        return (
          <Cell
            key={cellKey}
            col={colIndex}
            disabled={Boolean(value) || !canMove}
            highlighted={sosCells.has(cellKey)}
            lastMove={lastMoveKey === cellKey}
            onClick={() => onMove(rowIndex, colIndex)}
            row={rowIndex}
            value={value}
          />
        );
      }))}
    </div>
  );
}
