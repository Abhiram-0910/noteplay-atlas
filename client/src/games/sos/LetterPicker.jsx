export default function LetterPicker({ selectedLetter, setSelectedLetter, disabled }) {
  return (
    <section className="letter-picker" aria-label="Choose letter">
      <p className="eyebrow">Selected letter</p>
      <div className="letter-buttons">
        {["S", "O"].map((letter) => (
          <button
            aria-pressed={selectedLetter === letter}
            className={selectedLetter === letter ? "selected" : ""}
            disabled={disabled}
            key={letter}
            onClick={() => setSelectedLetter(letter)}
            type="button"
          >
            {letter}
          </button>
        ))}
      </div>
    </section>
  );
}
