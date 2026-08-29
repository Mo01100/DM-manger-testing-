import React, { useState, useMemo, useEffect, useCallback } from 'react';
import '../styles/RecipientModal.css';

interface User {
  id: string;
  username: string;
  global_name?: string;
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

interface RecipientGroup {
  id: string;
  name: string;
  emoji: string;
  channelIds: string[];
}

interface RecipientModalProps {
  isOpen: boolean;
  channels: Channel[];
  selectedRecipients: RecipientData[];
  onSelectionChange: (recipients: RecipientData[]) => void;
  onClose: () => void;
}

const GROUP_EMOJIS = ['🎮', '💼', '🎵', '📚', '⚽', '🎬', '🍕', '🌍', '💬', '🚀', '🎯', '🏠', '❤️', '🔥', '✨', '🎉'];
const STORAGE_KEY = 'discord-dm-groups';

const RecipientModal: React.FC<RecipientModalProps> = ({
  isOpen,
  channels,
  selectedRecipients,
  onSelectionChange,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'people' | 'groups'>('people');
  const [groups, setGroups] = useState<RecipientGroup[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupEmoji, setNewGroupEmoji] = useState('🎮');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupAddSearch, setEditingGroupAddSearch] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Load groups from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setGroups(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load groups:', e);
    }
  }, []);

  // Persist groups to localStorage
  const saveGroups = useCallback((newGroups: RecipientGroup[]) => {
    setGroups(newGroups);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newGroups));
    } catch (e) {
      console.error('Failed to save groups:', e);
    }
  }, []);

  const getUserDisplayName = (user?: User): string => {
    if (!user) return 'Unknown';
    return user.global_name || user.username;
  };

  const getRecipientName = (channel: Channel): string => {
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

  const getAvatar = (user?: User): string => {
    if (!user) {
      return 'https://cdn.discordapp.com/embed/avatars/0.png';
    }
    if (user.avatar && user.id) {
      const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
    }
    const defaultIndex = user.id ? (BigInt(user.id) >> BigInt(22)) % BigInt(6) : BigInt(0);
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
  };

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const query = searchQuery.toLowerCase();
    return channels.filter(ch => {
      const name = getRecipientName(ch).toLowerCase();
      const username = ch.recipient?.username?.toLowerCase() || '';
      return name.includes(query) || username.includes(query);
    });
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
      onSelectionChange(sortedChannels.map(c => ({ id: c.id, type: 'dm-channel' as const })));
    }
  };

  // --- Group Management ---

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup: RecipientGroup = {
      id: `group-${Date.now()}`,
      name: newGroupName.trim(),
      emoji: newGroupEmoji,
      channelIds: [],
    };
    saveGroups([...groups, newGroup]);
    setNewGroupName('');
    setNewGroupEmoji('🎮');
    setShowCreateGroup(false);
    // Immediately open the group for editing so user can add people
    setEditingGroupId(newGroup.id);
  };

  const handleDeleteGroup = (groupId: string) => {
    saveGroups(groups.filter(g => g.id !== groupId));
    if (editingGroupId === groupId) {
      setEditingGroupId(null);
    }
  };

  const handleAddToGroup = (groupId: string, channelId: string) => {
    saveGroups(groups.map(g => {
      if (g.id !== groupId) return g;
      if (g.channelIds.includes(channelId)) return g;
      return { ...g, channelIds: [...g.channelIds, channelId] };
    }));
  };

  const handleRemoveFromGroup = (groupId: string, channelId: string) => {
    saveGroups(groups.map(g => {
      if (g.id !== groupId) return g;
      return { ...g, channelIds: g.channelIds.filter(id => id !== channelId) };
    }));
  };

  const handleSelectGroup = (group: RecipientGroup) => {
    // Get all valid channel IDs from the group
    const validChannelIds = group.channelIds.filter(
      cId => channels.some(ch => ch.id === cId)
    );

    // Check if all group members are already selected
    const allSelected = validChannelIds.every(
      cId => selectedRecipients.some(r => r.id === cId)
    );

    if (allSelected && validChannelIds.length > 0) {
      // Deselect all members of this group
      onSelectionChange(
        selectedRecipients.filter(r => !validChannelIds.includes(r.id))
      );
    } else {
      // Select all members of this group (add only ones not already selected)
      const existingIds = new Set(selectedRecipients.map(r => r.id));
      const newRecipients = validChannelIds
        .filter(cId => !existingIds.has(cId))
        .map(cId => ({ id: cId, type: 'dm-channel' as const }));
      onSelectionChange([...selectedRecipients, ...newRecipients]);
    }
  };

  const getGroupSelectedCount = (group: RecipientGroup): number => {
    return group.channelIds.filter(
      cId => selectedRecipients.some(r => r.id === cId)
    ).length;
  };

  const isGroupFullySelected = (group: RecipientGroup): boolean => {
    const validIds = group.channelIds.filter(cId => channels.some(ch => ch.id === cId));
    return validIds.length > 0 && validIds.every(cId => selectedRecipients.some(r => r.id === cId));
  };

  // Get channels available to add to the editing group (not already in it)
  const availableChannelsForGroup = useMemo(() => {
    if (!editingGroupId) return [];
    const group = groups.find(g => g.id === editingGroupId);
    if (!group) return [];

    let filtered = channels.filter(ch => !group.channelIds.includes(ch.id));
    if (editingGroupAddSearch.trim()) {
      const query = editingGroupAddSearch.toLowerCase();
      filtered = filtered.filter(ch => {
        const name = getRecipientName(ch).toLowerCase();
        const username = ch.recipient?.username?.toLowerCase() || '';
        return name.includes(query) || username.includes(query);
      });
    }
    return filtered;
  }, [editingGroupId, groups, channels, editingGroupAddSearch]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setShowCreateGroup(false);
      setEditingGroupId(null);
      setEditingGroupAddSearch('');
      setShowEmojiPicker(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const editingGroup = editingGroupId ? groups.find(g => g.id === editingGroupId) : null;

  // --- Render: Editing a group (adding/removing members) ---
  if (editingGroup) {
    const memberChannels = editingGroup.channelIds
      .map(cId => channels.find(ch => ch.id === cId))
      .filter((ch): ch is Channel => !!ch);

    return (
      <div className="recipient-modal-overlay" onClick={() => setEditingGroupId(null)}>
        <div className="recipient-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-header-left">
              <button 
                className="modal-back-btn" 
                onClick={() => setEditingGroupId(null)}
                title="Back to groups"
              >
                ←
              </button>
              <h2>{editingGroup.emoji} {editingGroup.name}</h2>
            </div>
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          </div>

          {/* Current members */}
          <div className="group-edit-section">
            <div className="group-edit-section-header">
              <span className="group-edit-section-title">
                Members ({memberChannels.length})
              </span>
            </div>
            <div className="group-edit-members">
              {memberChannels.length === 0 ? (
                <div className="group-edit-empty">
                  <p>No members yet — add people below!</p>
                </div>
              ) : (
                memberChannels.map(channel => (
                  <div key={channel.id} className="group-edit-member-item">
                    <img
                      src={getAvatar(channel.recipient)}
                      alt={getRecipientName(channel)}
                      className="modal-recipient-avatar small"
                      onError={(e) => {
                        e.currentTarget.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
                      }}
                    />
                    <span className="group-edit-member-name">
                      {getRecipientName(channel)}
                    </span>
                    <button
                      className="group-edit-remove-btn"
                      onClick={() => handleRemoveFromGroup(editingGroup.id, channel.id)}
                      title="Remove from group"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add members */}
          <div className="group-edit-section add-section">
            <div className="group-edit-section-header">
              <span className="group-edit-section-title">Add People</span>
            </div>
            <div className="group-edit-add-search">
              <input
                type="text"
                placeholder="🔍 Search to add..."
                value={editingGroupAddSearch}
                onChange={(e) => setEditingGroupAddSearch(e.target.value)}
                className="modal-search-input"
              />
            </div>
            <div className="group-edit-add-list">
              {availableChannelsForGroup.slice(0, 50).map(channel => (
                <div
                  key={channel.id}
                  className="group-edit-member-item addable"
                  onClick={() => handleAddToGroup(editingGroup.id, channel.id)}
                >
                  <img
                    src={getAvatar(channel.recipient)}
                    alt={getRecipientName(channel)}
                    className="modal-recipient-avatar small"
                    onError={(e) => {
                      e.currentTarget.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
                    }}
                  />
                  <span className="group-edit-member-name">
                    {getRecipientName(channel)}
                  </span>
                  <span className="group-edit-add-btn">+ Add</span>
                </div>
              ))}
              {availableChannelsForGroup.length === 0 && (
                <div className="group-edit-empty">
                  <p>{editingGroupAddSearch ? 'No matching users found' : 'All users are already in this group'}</p>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button className="modal-confirm-btn" onClick={() => setEditingGroupId(null)}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Render: Main modal with tabs ---
  return (
    <div className="recipient-modal-overlay" onClick={onClose}>
      <div className="recipient-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Select Recipients</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Tab bar */}
        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'people' ? 'active' : ''}`}
            onClick={() => setActiveTab('people')}
          >
            👤 People
          </button>
          <button
            className={`modal-tab ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            📁 Groups
            {groups.length > 0 && (
              <span className="tab-badge">{groups.length}</span>
            )}
          </button>
        </div>

        {/* ===== People Tab ===== */}
        {activeTab === 'people' && (
          <>
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
              <button className="select-all-btn" onClick={handleSelectAll}>
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
          </>
        )}

        {/* ===== Groups Tab ===== */}
        {activeTab === 'groups' && (
          <>
            <div className="modal-groups-content">
              {/* Create group form */}
              {showCreateGroup ? (
                <div className="create-group-form">
                  <div className="create-group-form-header">
                    <h3>Create New Group</h3>
                  </div>
                  <div className="create-group-fields">
                    <div className="create-group-emoji-row">
                      <button 
                        className="emoji-picker-trigger"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        type="button"
                      >
                        {newGroupEmoji}
                      </button>
                      {showEmojiPicker && (
                        <div className="emoji-picker-dropdown">
                          {GROUP_EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              className={`emoji-option ${newGroupEmoji === emoji ? 'selected' : ''}`}
                              onClick={() => {
                                setNewGroupEmoji(emoji);
                                setShowEmojiPicker(false);
                              }}
                              type="button"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                      <input
                        type="text"
                        placeholder="Group name (e.g., Gaming Squad)"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="create-group-name-input"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateGroup();
                          if (e.key === 'Escape') {
                            setShowCreateGroup(false);
                            setNewGroupName('');
                          }
                        }}
                      />
                    </div>
                    <div className="create-group-actions">
                      <button
                        className="create-group-cancel-btn"
                        onClick={() => {
                          setShowCreateGroup(false);
                          setNewGroupName('');
                          setShowEmojiPicker(false);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="create-group-confirm-btn"
                        onClick={handleCreateGroup}
                        disabled={!newGroupName.trim()}
                      >
                        Create
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  className="create-group-btn"
                  onClick={() => setShowCreateGroup(true)}
                >
                  <span className="create-group-icon">+</span>
                  <span>Create New Group</span>
                </button>
              )}

              {/* Group list */}
              <div className="groups-list">
                {groups.length === 0 && !showCreateGroup && (
                  <div className="groups-empty">
                    <div className="groups-empty-icon">📁</div>
                    <h3>No groups yet</h3>
                    <p>Create a group to quickly message multiple people at once.</p>
                    <p className="groups-empty-hint">
                      For example: "Gaming Squad", "Work Team", "Movie Night"
                    </p>
                  </div>
                )}

                {groups.map(group => {
                  const memberCount = group.channelIds.filter(
                    cId => channels.some(ch => ch.id === cId)
                  ).length;
                  const selectedCount = getGroupSelectedCount(group);
                  const fullySelected = isGroupFullySelected(group);
                  
                  // Get first 4 member avatars for preview
                  const previewMembers = group.channelIds
                    .slice(0, 4)
                    .map(cId => channels.find(ch => ch.id === cId))
                    .filter((ch): ch is Channel => !!ch);

                  return (
                    <div key={group.id} className="group-card">
                      <div className="group-card-main" onClick={() => handleSelectGroup(group)}>
                        <div className="group-card-left">
                          <div className="group-card-emoji">{group.emoji}</div>
                          <div className="group-card-info">
                            <div className="group-card-name">{group.name}</div>
                            <div className="group-card-meta">
                              {memberCount} member{memberCount !== 1 ? 's' : ''}
                              {selectedCount > 0 && (
                                <span className="group-selected-badge">
                                  · {selectedCount} selected
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="group-card-right">
                          {/* Member avatar preview */}
                          <div className="group-card-avatars">
                            {previewMembers.map((ch, i) => (
                              <img
                                key={ch.id}
                                src={getAvatar(ch.recipient)}
                                alt=""
                                className="group-card-avatar-preview"
                                style={{ zIndex: 4 - i }}
                                onError={(e) => {
                                  e.currentTarget.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
                                }}
                              />
                            ))}
                            {group.channelIds.length > 4 && (
                              <div className="group-card-avatar-more">
                                +{group.channelIds.length - 4}
                              </div>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            checked={fullySelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectGroup(group);
                            }}
                            className="modal-recipient-checkbox"
                          />
                        </div>
                      </div>
                      <div className="group-card-actions">
                        <button
                          className="group-action-btn edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingGroupId(group.id);
                            setEditingGroupAddSearch('');
                          }}
                          title="Edit group members"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="group-action-btn delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGroup(group.id);
                          }}
                          title="Delete group"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
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
