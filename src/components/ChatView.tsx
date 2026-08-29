import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/ChatView.css';

interface User {
  id: string;
  username: string;
  global_name?: string;
  avatar?: string;
  discriminator?: string;
}

interface Channel {
  id: string;
  name?: string;
  recipient?: User;
  recipients?: User[];
  last_message_id?: string;
  type?: number;
}

interface DiscordMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    global_name?: string;
    avatar?: string;
  };
  timestamp: string;
  edited_timestamp?: string;
  attachments?: Array<{
    id: string;
    filename: string;
    url: string;
    proxy_url: string;
    content_type?: string;
    width?: number;
    height?: number;
  }>;
  embeds?: Array<{
    title?: string;
    description?: string;
    url?: string;
    thumbnail?: { url: string };
    image?: { url: string };
  }>;
  type: number;
}

interface ChatViewProps {
  channel: Channel;
  token: string;
  currentUserId?: string;
  onClose: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({ channel, token, currentUserId, onClose }) => {
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollRestorationRef = useRef<{ height: number; top: number } | null>(null);

  const getUserDisplayName = (user?: User | DiscordMessage['author']): string => {
    if (!user) return 'Unknown';
    return user.global_name || user.username;
  };

  const getChannelName = (): string => {
    if (channel.name && channel.name.trim()) {
      return channel.name;
    }
    if (channel.recipient) {
      return getUserDisplayName(channel.recipient);
    }
    if (channel.recipients && channel.recipients.length > 0) {
      return channel.recipients.map(r => getUserDisplayName(r)).join(', ');
    }
    return 'Unknown';
  };

  const getAvatar = (user?: User | DiscordMessage['author']): string => {
    if (user?.avatar && user?.id) {
      const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
    }
    const defaultIndex = user?.id ? (BigInt(user.id) >> BigInt(22)) % BigInt(6) : BigInt(0);
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days < 7) {
      return `${date.toLocaleDateString([], { weekday: 'long' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const formatDateDivider = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Check if a message is from the same author and close in time (for grouping)
  const shouldGroupWithPrevious = (msg: DiscordMessage, prevMsg?: DiscordMessage): boolean => {
    if (!prevMsg) return false;
    if (msg.author.id !== prevMsg.author.id) return false;
    const timeDiff = new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime();
    return timeDiff < 5 * 60 * 1000; // 5 minutes
  };

  // Check if we need a date divider between messages
  const needsDateDivider = (msg: DiscordMessage, prevMsg?: DiscordMessage): boolean => {
    if (!prevMsg) return true;
    const msgDate = new Date(msg.timestamp).toDateString();
    const prevDate = new Date(prevMsg.timestamp).toDateString();
    return msgDate !== prevDate;
  };

  const fetchMessages = useCallback(async (before?: string) => {
    try {
      if (before) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      let url = `https://discord.com/api/v10/channels/${channel.id}/messages?limit=50`;
      if (before) {
        url += `&before=${before}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: token },
      });

      if (!response.ok) {
        if (response.status === 403) {
          setError('No permission to view this conversation');
        } else if (response.status === 401) {
          setError('Authentication failed');
        } else {
          setError(`Failed to load messages (${response.status})`);
        }
        return;
      }

      const data: DiscordMessage[] = await response.json();
      
      if (data.length < 50) {
        setHasMore(false);
      }

      // Discord returns newest first, reverse for chronological order
      const chronological = data.reverse();

      if (before) {
        // Save scroll position before prepending
        if (messagesContainerRef.current) {
          scrollRestorationRef.current = {
            height: messagesContainerRef.current.scrollHeight,
            top: messagesContainerRef.current.scrollTop,
          };
        }
        setMessages(prev => [...chronological, ...prev]);
      } else {
        setMessages(chronological);
      }
    } catch (err: any) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [channel.id, token]);

  // Initial load
  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    setError(null);
    fetchMessages();
  }, [channel.id, fetchMessages]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading && messages.length > 0 && !scrollRestorationRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [loading, messages.length]);

  // Restore scroll position after loading older messages
  useEffect(() => {
    if (scrollRestorationRef.current && messagesContainerRef.current) {
      const { height: prevHeight, top: prevTop } = scrollRestorationRef.current;
      const newHeight = messagesContainerRef.current.scrollHeight;
      messagesContainerRef.current.scrollTop = prevTop + (newHeight - prevHeight);
      scrollRestorationRef.current = null;
    }
  }, [messages]);

  // Handle scroll to top -> load more
  const handleScroll = () => {
    if (!messagesContainerRef.current || loadingMore || !hasMore) return;
    if (messagesContainerRef.current.scrollTop < 100) {
      const oldestMsg = messages[0];
      if (oldestMsg) {
        fetchMessages(oldestMsg.id);
      }
    }
  };

  // Send a reply
  const handleSendReply = async () => {
    if (!replyText.trim() || sending) return;

    try {
      setSending(true);
      const response = await fetch(
        `https://discord.com/api/v10/channels/${channel.id}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: replyText }),
        }
      );

      if (response.ok) {
        const newMsg: DiscordMessage = await response.json();
        setMessages(prev => [...prev, newMsg]);
        setReplyText('');
        // Scroll to bottom after sending
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      } else {
        const errText = await response.text();
        console.error('Failed to send:', response.status, errText);
      }
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  // Detect URLs in message content and make them clickable
  const renderContent = (content: string) => {
    // Simple URL regex
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    const parts = content.split(urlRegex);

    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        // Reset lastIndex since we're reusing the regex
        urlRegex.lastIndex = 0;
        // Check if it's an image/gif URL
        if (/\.(gif|png|jpg|jpeg|webp)(\?.*)?$/i.test(part)) {
          return (
            <React.Fragment key={i}>
              <a href={part} target="_blank" rel="noopener noreferrer" className="chat-link">
                {part}
              </a>
              <div className="chat-embed-image">
                <img src={part} alt="" loading="lazy" />
              </div>
            </React.Fragment>
          );
        }
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="chat-link">
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="chat-view">
      {/* Chat header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <img
            src={getAvatar(channel.recipient)}
            alt=""
            className="chat-header-avatar"
            onError={(e) => {
              e.currentTarget.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
            }}
          />
          <div className="chat-header-info">
            <h3>{getChannelName()}</h3>
            {channel.recipient?.username && (
              <span className="chat-header-username">@{channel.recipient.username}</span>
            )}
          </div>
        </div>
        <button className="chat-close-btn" onClick={onClose} title="Close conversation">
          ✕
        </button>
      </div>

      {/* Messages area */}
      <div
        className="chat-messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {/* Loading older messages indicator */}
        {loadingMore && (
          <div className="chat-loading-more">
            <div className="chat-spinner" />
            <span>Loading older messages...</span>
          </div>
        )}

        {/* Beginning of conversation */}
        {!hasMore && messages.length > 0 && (
          <div className="chat-beginning">
            <img
              src={getAvatar(channel.recipient)}
              alt=""
              className="chat-beginning-avatar"
              onError={(e) => {
                e.currentTarget.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
              }}
            />
            <h2>{getChannelName()}</h2>
            <p>This is the beginning of your direct message history with <strong>{getChannelName()}</strong>.</p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="chat-loading">
            <div className="chat-spinner" />
            <span>Loading messages...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="chat-error">
            <span>⚠️ {error}</span>
            <button onClick={() => fetchMessages()}>Retry</button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && messages.length === 0 && (
          <div className="chat-empty">
            <p>No messages yet. Say hi! 👋</p>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, index) => {
          const prevMsg = index > 0 ? messages[index - 1] : undefined;
          const grouped = shouldGroupWithPrevious(msg, prevMsg);
          const showDivider = needsDateDivider(msg, prevMsg);
          const isOwnMessage = msg.author.id === currentUserId;

          return (
            <React.Fragment key={msg.id}>
              {showDivider && (
                <div className="chat-date-divider">
                  <span>{formatDateDivider(msg.timestamp)}</span>
                </div>
              )}
              <div className={`chat-message ${grouped ? 'grouped' : ''} ${isOwnMessage ? 'own' : ''}`}>
                {!grouped && (
                  <img
                    src={getAvatar(msg.author)}
                    alt=""
                    className="chat-msg-avatar"
                    onError={(e) => {
                      e.currentTarget.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
                    }}
                  />
                )}
                <div className={`chat-msg-content ${grouped ? 'no-avatar' : ''}`}>
                  {!grouped && (
                    <div className="chat-msg-header">
                      <span className={`chat-msg-author ${isOwnMessage ? 'you' : ''}`}>
                        {getUserDisplayName(msg.author)}
                      </span>
                      <span className="chat-msg-time">{formatTimestamp(msg.timestamp)}</span>
                      {msg.edited_timestamp && (
                        <span className="chat-msg-edited">(edited)</span>
                      )}
                    </div>
                  )}
                  {msg.content && (
                    <div className="chat-msg-text">{renderContent(msg.content)}</div>
                  )}
                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="chat-msg-attachments">
                      {msg.attachments.map(att => {
                        const isImage = att.content_type?.startsWith('image/');
                        const isVideo = att.content_type?.startsWith('video/');
                        if (isImage) {
                          return (
                            <div key={att.id} className="chat-attachment-image">
                              <img
                                src={att.proxy_url || att.url}
                                alt={att.filename}
                                loading="lazy"
                                style={{
                                  maxWidth: Math.min(att.width || 400, 400),
                                  maxHeight: 300,
                                }}
                              />
                            </div>
                          );
                        }
                        if (isVideo) {
                          return (
                            <div key={att.id} className="chat-attachment-video">
                              <video
                                src={att.proxy_url || att.url}
                                controls
                                style={{ maxWidth: 400, maxHeight: 300 }}
                              />
                            </div>
                          );
                        }
                        return (
                          <a
                            key={att.id}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="chat-attachment-file"
                          >
                            📎 {att.filename}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply input */}
      <div className="chat-reply-bar">
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${getChannelName()}`}
          className="chat-reply-input"
          rows={1}
          disabled={sending}
        />
        <button
          className="chat-send-btn"
          onClick={handleSendReply}
          disabled={!replyText.trim() || sending}
          title="Send message"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatView;
