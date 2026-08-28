import React from 'react';
import '../styles/MessageComposer.css';

interface MessageComposerProps {
  message: string;
  onMessageChange: (message: string) => void;
  selectedCount: number;
  onSend: () => void;
  isSending: boolean;
}

const MessageComposer: React.FC<MessageComposerProps> = ({
  message,
  onMessageChange,
  selectedCount,
  onSend,
  isSending,
}) => {
  const charCount = message.length;
  const maxChars = 2000;

  return (
    <div className="message-composer">
      <div className="message-info">
        <span>Will send to {selectedCount} recipient(s)</span>
        <span className="char-count">
          {charCount} / {maxChars} characters
        </span>
      </div>

      <textarea
        value={message}
        onChange={(e) => onMessageChange(e.target.value.slice(0, maxChars))}
        placeholder="Type your message here..."
        maxLength={maxChars}
        className="message-input"
        rows={8}
      />

      <div className="composer-controls">
        <button
          onClick={onSend}
          disabled={selectedCount === 0 || message.trim() === '' || isSending}
          className="send-btn"
        >
          {isSending ? 'Sending...' : `Send to ${selectedCount}`}
        </button>
      </div>
    </div>
  );
};

export default MessageComposer;
