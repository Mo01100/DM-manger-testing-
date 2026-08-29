import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/MessageComposer.css';

interface MessageComposerProps {
  message: string;
  onMessageChange: (message: string) => void;
  selectedCount: number;
  onSend: () => void;
  isSending: boolean;
  gifUrl: string;
  onGifChange: (url: string) => void;
}

interface TenorGif {
  id: string;
  title: string;
  media_formats: {
    gif?: { url: string };
    tinygif?: { url: string };
    mediumgif?: { url: string };
    nanogif?: { url: string };
  };
}

const TENOR_API_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'; // Public Tenor API key (Google)

const GIF_CATEGORIES = [
  { name: 'Trending', query: 'trending', emoji: '🔥' },
  { name: 'Reaction', query: 'reaction', emoji: '😂' },
  { name: 'Gaming', query: 'gaming', emoji: '🎮' },
  { name: 'Anime', query: 'anime', emoji: '⛩️' },
  { name: 'Celebration', query: 'celebration', emoji: '🎉' },
  { name: 'Love', query: 'love', emoji: '❤️' },
  { name: 'Hello', query: 'hello wave', emoji: '👋' },
  { name: 'Sad', query: 'sad', emoji: '😢' },
];

const MessageComposer: React.FC<MessageComposerProps> = ({
  message,
  onMessageChange,
  selectedCount,
  onSend,
  isSending,
  gifUrl,
  onGifChange,
}) => {
  const charCount = message.length;
  const maxChars = 2000;
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState<TenorGif[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifCategory, setGifCategory] = useState<string | null>(null);
  const gifPickerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close GIF picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (gifPickerRef.current && !gifPickerRef.current.contains(e.target as Node)) {
        setShowGifPicker(false);
      }
    };
    if (showGifPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showGifPicker]);

  const searchGifs = useCallback(async (query: string) => {
    if (!query.trim()) {
      setGifResults([]);
      setGifCategory(null);
      return;
    }

    try {
      setGifLoading(true);
      const endpoint = query === '__trending__'
        ? `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=30&media_filter=gif,tinygif`
        : `https://tenor.googleapis.com/v2/search?key=${TENOR_API_KEY}&q=${encodeURIComponent(query)}&limit=30&media_filter=gif,tinygif`;

      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setGifResults(data.results || []);
      } else {
        console.error('Tenor API error:', response.status);
        setGifResults([]);
      }
    } catch (err) {
      console.error('GIF search error:', err);
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (gifSearch.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        searchGifs(gifSearch);
      }, 400);
    } else if (!gifCategory) {
      setGifResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [gifSearch, searchGifs, gifCategory]);

  const handleCategoryClick = (query: string) => {
    setGifCategory(query);
    setGifSearch('');
    if (query === 'trending') {
      searchGifs('__trending__');
    } else {
      searchGifs(query);
    }
  };

  const handleSelectGif = (gif: TenorGif) => {
    const url =
      gif.media_formats?.gif?.url ||
      gif.media_formats?.mediumgif?.url ||
      gif.media_formats?.tinygif?.url ||
      '';

    if (url) {
      onGifChange(url);
      setShowGifPicker(false);
      setGifSearch('');
      setGifResults([]);
      setGifCategory(null);
    }
  };

  const getGifThumbnail = (gif: TenorGif): string => {
    return (
      gif.media_formats?.tinygif?.url ||
      gif.media_formats?.nanogif?.url ||
      gif.media_formats?.gif?.url ||
      ''
    );
  };

  const handleGifPickerToggle = () => {
    const next = !showGifPicker;
    setShowGifPicker(next);
    if (!next) {
      setGifSearch('');
      setGifResults([]);
      setGifCategory(null);
    }
  };

  const canSend = selectedCount > 0 && (message.trim() !== '' || gifUrl !== '') && !isSending;

  return (
    <div className="message-composer">
      <div className="message-info">
        <span>Will send to {selectedCount} recipient(s)</span>
        <span className="char-count">
          {charCount} / {maxChars} characters
        </span>
      </div>

      {/* GIF preview */}
      {gifUrl && (
        <div className="gif-preview">
          <img src={gifUrl} alt="Selected GIF" />
          <div className="gif-preview-info">
            <div className="gif-preview-label">📎 GIF attached</div>
            <div className="gif-preview-url">{gifUrl}</div>
          </div>
          <button
            className="gif-preview-remove"
            onClick={() => onGifChange('')}
            title="Remove GIF"
          >
            ✕
          </button>
        </div>
      )}

      <div className="message-input-wrapper">
        <textarea
          value={message}
          onChange={(e) => onMessageChange(e.target.value.slice(0, maxChars))}
          placeholder={gifUrl ? 'Add a comment (optional)...' : 'Type your message here...'}
          maxLength={maxChars}
          className="message-input"
          rows={6}
        />

        <div className="message-toolbar">
          <div className="gif-picker-container" ref={gifPickerRef}>
            <button
              className={`toolbar-btn ${showGifPicker ? 'active' : ''}`}
              onClick={handleGifPickerToggle}
              title="Send a GIF"
              type="button"
            >
              GIF
            </button>

            {showGifPicker && (
              <div className="gif-picker">
                <div className="gif-picker-header">
                  <h3>GIF</h3>
                  <input
                    type="text"
                    placeholder="Search Tenor..."
                    value={gifSearch}
                    onChange={(e) => {
                      setGifSearch(e.target.value);
                      if (e.target.value.trim()) setGifCategory(null);
                    }}
                    className="gif-search-input"
                    autoFocus
                  />
                  <button
                    className="gif-picker-close"
                    onClick={() => setShowGifPicker(false)}
                  >
                    ✕
                  </button>
                </div>

                {/* Show categories when no search/category selected */}
                {!gifSearch.trim() && !gifCategory && (
                  <div className="gif-picker-categories">
                    {GIF_CATEGORIES.map(cat => (
                      <div
                        key={cat.query}
                        className="gif-category"
                        onClick={() => handleCategoryClick(cat.query)}
                      >
                        <div style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '32px',
                          background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-input))'
                        }}>
                          {cat.emoji}
                        </div>
                        <div className="gif-category-label">{cat.name}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Loading */}
                {gifLoading && (
                  <div className="gif-picker-loading">
                    <span>Searching...</span>
                  </div>
                )}

                {/* GIF results grid */}
                {!gifLoading && (gifSearch.trim() || gifCategory) && gifResults.length > 0 && (
                  <div className="gif-picker-grid">
                    {gifCategory && !gifSearch.trim() && (
                      <button
                        className="gif-category-back"
                        onClick={() => {
                          setGifCategory(null);
                          setGifResults([]);
                        }}
                        style={{
                          gridColumn: '1 / -1',
                          background: 'var(--bg-input)',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600,
                          textAlign: 'left',
                        }}
                      >
                        ← Back to categories
                      </button>
                    )}
                    {gifResults.map((gif) => (
                      <div
                        key={gif.id}
                        className="gif-item"
                        onClick={() => handleSelectGif(gif)}
                        title={gif.title || 'GIF'}
                      >
                        <img
                          src={getGifThumbnail(gif)}
                          alt={gif.title || 'GIF'}
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {!gifLoading && (gifSearch.trim() || gifCategory) && gifResults.length === 0 && (
                  <div className="gif-picker-empty">
                    <span>No GIFs found. Try a different search!</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="composer-controls">
        <button
          onClick={onSend}
          disabled={!canSend}
          className="send-btn"
        >
          {isSending ? 'Sending...' : `Send to ${selectedCount}`}
        </button>
      </div>
    </div>
  );
};

export default MessageComposer;
