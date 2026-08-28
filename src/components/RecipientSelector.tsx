import React from 'react';
import '../styles/RecipientSelector.css';

interface RecipientSelectorProps {
  channels: Channel[];
  selectedRecipients: RecipientData[];
  onSelectionChange: (recipients: RecipientData[]) => void;
}

interface RecipientData {
  id: string;
  type: 'dm-channel' | 'user-id';
  userId?: string;
}

const RecipientSelector: React.FC<RecipientSelectorProps> = ({
  channels,
  selectedRecipients,
  onSelectionChange,
}) => {
  const handleToggleRecipient = (channelId: string) => {
    if (selectedRecipients.some(r => r.id === channelId)) {
      onSelectionChange(selectedRecipients.filter((r) => r.id !== channelId));
    } else {
      onSelectionChange([...selectedRecipients, { id: channelId, type: 'dm-channel' }]);
    }
  };

  const handleSelectAll = () => {
    if (selectedRecipients.length === channels.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(channels.map((c) => ({ id: c.id, type: 'dm-channel' })));
    }
  };

  const getRecipientName = (channel: Channel): string => {
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
      return channel.recipients.map(r => r.username).join(', ');
    }

    // Fallback
    return 'Unknown';
  };

  const getAvatar = (channel: Channel): string => {
    // Try to get avatar from recipient
    if (channel.recipient?.avatar && channel.recipient?.id) {
      return `https://cdn.discordapp.com/avatars/${channel.recipient.id}/${channel.recipient.avatar}.png`;
    }

    // Default Discord avatar
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  };

  return (
    <div className="recipient-selector">
      <div className="selector-controls">
        <button
          className="select-all-btn"
          onClick={handleSelectAll}
        >
          {selectedRecipients.length === channels.length
            ? 'Deselect All'
            : 'Select All'}
            </button>
            <span className="selection-count">
              {selectedRecipients.length} / {channels.length} selected
            </span>
      </div>

      <div className="recipient-list">
        {channels.map((channel) => (
          <div key={channel.id} className="recipient-item">
            <img 
              src={getAvatar(channel)} 
              alt="avatar" 
              className="recipient-avatar"
              onError={(e) => {
                e.currentTarget.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
              }}
            />
            <input
              type="checkbox"
              id={channel.id}
              checked={selectedRecipients.some(r => r.id === channel.id)}
              onChange={() => handleToggleRecipient(channel.id)}
              className="recipient-checkbox"
            />
            <label htmlFor={channel.id} className="recipient-label">
              {getRecipientName(channel)}
            </label>
          </div>
        ))}
      </div>

      {channels.length === 0 && (
        <p className="no-recipients">No DM channels found</p>
      )}
    </div>
  );
};

export default RecipientSelector;
