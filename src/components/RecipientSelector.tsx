import React from 'react';
import '../styles/RecipientSelector.css';

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

  const getUserDisplayName = (user?: User): string => {
    if (!user) return 'Unknown';
    return user.global_name || user.username;
  };

  const getRecipientName = (channel: Channel): string => {
    // For group DMs
    if (channel.name && channel.name.trim()) {
      return channel.name;
    }

    // For single recipient DMs (most common)
    if (channel.recipient) {
      return getUserDisplayName(channel.recipient);
    }

    // For channels with multiple recipients
    if (channel.recipients && channel.recipients.length > 0) {
      return channel.recipients.map((r: User) => getUserDisplayName(r)).join(', ');
    }

    // Fallback
    return 'Unknown';
  };

  const getAvatar = (user?: User): string => {
    if (user?.avatar && user?.id) {
      const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
    }
    // Use user ID to pick one of the 6 default avatars (0-5) for variety
    const defaultIndex = user?.id ? (BigInt(user.id) >> BigInt(22)) % BigInt(6) : BigInt(0);
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
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
              src={getAvatar(channel.recipient)} 
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
