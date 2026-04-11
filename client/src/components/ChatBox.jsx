import { useEffect, useRef, useState } from "react";
import { formatChatTime } from "../utils/formatters.js";

export default function ChatBox({
  messages,
  onSend,
  disabled,
  playerId,
  framed = true,
  showHeading = true
}) {
  const [text, setText] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function submit(event) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    onSend(trimmed);
    setText("");
  }

  return (
    <section className={`chat ${framed ? "panel-section" : ""}`.trim()} aria-label="Room chat">
      {showHeading ? <h2>Room chat</h2> : null}
      <div className="chat-messages" aria-live="polite">
        {messages.length === 0 && <p className="muted">No messages yet.</p>}
        {messages.map((message) => (
          <article className={`chat-message ${message.senderPlayerId === playerId ? "own" : ""}`} key={message.messageId}>
            <div className="chat-meta">
              <strong>{message.senderName}</strong>
              <time dateTime={message.timestamp}>{formatChatTime(message.timestamp)}</time>
            </div>
            <p>{message.text}</p>
          </article>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input
          aria-label="Chat message"
          disabled={disabled}
          maxLength={200}
          onChange={(event) => setText(event.target.value)}
          placeholder="Message"
          value={text}
        />
        <button disabled={disabled || text.trim().length === 0} type="submit">Send</button>
      </form>
    </section>
  );
}
