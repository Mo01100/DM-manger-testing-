import React, { useState, useMemo } from 'react';
import '../styles/RecipientModal.css';

interface User {
  id: string;
  username: string;
  avatar?: string;
}

interface Channel {
  id: string;
  name?: string;
  recipient?: User;
  recipients?: User[];
  last_message_id?: string;
}

interface RecipientData {
  id: string;
  type: 'dm-channel' | 'user-id';
  userId?: string;
}

interface RecipientModalProps {
  isOpen: boolean;
  channels: Channel[];
  selectedRecipients: RecipientData[];
  onSelectionChange: (recipients: RecipientData[]) => void;
  onClose: () => void;
}

const RecipientModal: React.FC<RecipientModalProps> = ({
  isOpen,
  channels,
  selectedRecipients,
  onSelectionChange,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const getRecipientName = (channel: Channel): string => {
    console.log(`📝 Getting name for channel:`, channel);

    // For group DMs
    if (channel.name && channel.name.trim()) {
      return channel.name;
    }

    // For single recipient DMs (most common)
    if (channel.recipient?.username) {
      return channel.recipient.username;
    }

    // For channels with multiple recipients
    if (channel.recipients && channel.recipients.length > 0) {
      return channel.recipients.map(r => r.username || r.id).join(', ');
    }

    // Fallback
    return 'Unknown';
  };

  const getAvatar = (user?: User): string => {
    if (!user) {
      console.log('❌ No user provided to getAvatar');
      return 'https://cdn.discordapp.com/embed/avatars/0.png';
    }

    console.log(`🖼️ Getting avatar for user:`, user);

    if (user.avatar && user.id) {
      const url = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
      console.log(`✅ Avatar URL: ${url}`);
      return url;
    }

    console.log(`⚠️ No avatar found for user ${user.username}`);
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  };

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const query = searchQuery.toLowerCase();
    return channels.filter(ch => getRecipientName(ch).toLowerCase().includes(query));
  }, [channels, searchQuery]);

  const sortedChannels = [...filteredChannels].sort((a, b) => {
    const aId = a.last_message_id || '0';
    const bId = b.last_message_id || '0';
    return parseInt(bId) - parseInt(aId);
  });

  const handleToggleRecipient = (channelId: string) => {
    if (selectedRecipients.some(r => r.id === channelId)) {
      onSelectionChange(selectedRecipients.filter(r => r.id !== channelId));
    } else {
      onSelectionChange([...selectedRecipients, { id: channelId, type: 'dm-channel' }]);
    }
  };

  const handleSelectAll = () => {
    if (selectedRecipients.length === sortedChannels.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(sortedChannels.map(c => ({ id: c.id, type: 'dm-channel' })));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="recipient-modal-overlay" onClick={onClose}>
      <div className="recipient-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Select Recipients</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-search">
          <input
            type="text"
            placeholder="🔍 Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="modal-search-input"
            autoFocus
          />
        </div>

        <div className="modal-controls">
          <button 
            className="select-all-btn"
            onClick={handleSelectAll}
          >
            {selectedRecipients.length === sortedChannels.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="selection-count">
            {selectedRecipients.length} / {sortedChannels.length} selected
          </span>
        </div>

        <div className="modal-recipients">
          {sortedChannels.map((channel) => (
            <div
              key={channel.id}
              className={`modal-recipient-item ${
                selectedRecipients.some(r => r.id === channel.id) ? 'selected' : ''
              }`}
              onClick={() => handleToggleRecipient(channel.id)}
            >
              <img
                src={getAvatar(channel.recipient)}
                alt={getRecipientName(channel)}
                className="modal-recipient-avatar"
                onError={(e) => {
                  e.currentTarget.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
                }}
              />
              <div className="modal-recipient-info">
                <div className="modal-recipient-name">{getRecipientName(channel)}</div>
              </div>
              <input
                type="checkbox"
                checked={selectedRecipients.some(r => r.id === channel.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  handleToggleRecipient(channel.id);
                }}
                className="modal-recipient-checkbox"
              />
            </div>
          ))}
        </div>

        {sortedChannels.length === 0 && (
          <div className="modal-empty">
            <p>No DM channels found</p>
          </div>
        )}

        <div className="modal-footer">
          <button className="modal-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="modal-confirm-btn" 
            onClick={onClose}
            disabled={selectedRecipients.length === 0}
          >
            Confirm ({selectedRecipients.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipientModal;
