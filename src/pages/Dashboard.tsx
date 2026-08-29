import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import RecipientModal from '../components/RecipientModal';
import MessageComposer from '../components/MessageComposer';
import ChatView from '../components/ChatView';
import '../styles/Dashboard.css';

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

interface DashboardProps {
  token: string;
  userData?: any;
  onLogout: () => void;
}

interface RecipientData {
  id: string;
  type: 'dm-channel' | 'user-id';
  userId?: string;
}

interface Guild {
  id: string;
  name: string;
  icon?: string;
  owner: boolean;
}

interface RecipientGroup {
  id: string;
  name: string;
  emoji: string;
  channelIds: string[];
}

const STORAGE_KEY = 'discord-dm-groups';

const Dashboard: React.FC<DashboardProps> = ({ token, userData, onLogout }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildMembers, setGuildMembers] = useState<{ [guildId: string]: User[] }>({});
  const [selectedRecipients, setSelectedRecipients] = useState<RecipientData[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [gifUrl, setGifUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [viewingChannelId, setViewingChannelId] = useState<string | null>(null);

  // Groups state (synced with localStorage)
  const [groups, setGroups] = useState<RecipientGroup[]>([]);

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  // Load groups from localStorage
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

  // Listen for group changes from the modal (storage event + custom event)
  useEffect(() => {
    const syncGroups = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setGroups(JSON.parse(saved));
        } else {
          setGroups([]);
        }
      } catch (e) {
        console.error('Failed to sync groups:', e);
      }
    };

    // Re-sync when the modal closes
    if (!showRecipientModal) {
      syncGroups();
    }

    // Also listen for storage events from other tabs
    window.addEventListener('storage', syncGroups);
    return () => window.removeEventListener('storage', syncGroups);
  }, [showRecipientModal]);

  const saveGroups = useCallback((newGroups: RecipientGroup[]) => {
    setGroups(newGroups);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newGroups));
    } catch (e) {
      console.error('Failed to save groups:', e);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [token]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setStatus('📡 Loading conversations and servers...');
      
      await Promise.all([
        loadChannels(),
        loadGuilds(),
      ]);
      
      setStatus('✅ Ready');
    } catch (error: any) {
      setStatus('❌ Error loading data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async () => {
    try {
      const response = await fetch('https://discord.com/api/v10/users/@me/channels', {
        headers: { Authorization: token },
      });

      if (!response.ok) {
        throw new Error(`Failed to load channels: ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 Channels loaded:', data.length);
      if (data.length > 0) {
        console.log('📋 Sample channel:', JSON.stringify(data[0], null, 2));
      }

      // Normalize and enrich channel data
      const enrichedChannels = await Promise.all(
        data.map(async (channel: any) => {
          // Discord API returns `recipients` (array), not `recipient` (singular).
          // Normalize: for single-user DMs (type 1), set `recipient` from `recipients[0]`.
          if (!channel.recipient && channel.recipients && channel.recipients.length > 0) {
            channel.recipient = channel.recipients[0];
          }

          // Fetch full user info to get accurate avatar, username, and display name
          const recipientId = channel.recipient?.id;
          if (recipientId) {
            try {
              const userResponse = await fetch(
                `https://discord.com/api/v10/users/${recipientId}`,
                { headers: { Authorization: token } }
              );
              if (userResponse.ok) {
                const fullUser = await userResponse.json();
                channel.recipient = {
                  id: fullUser.id,
                  username: fullUser.username,
                  global_name: fullUser.global_name || undefined,
                  avatar: fullUser.avatar,
                  discriminator: fullUser.discriminator,
                };
                console.log(`✅ Fetched user info for ${channel.recipient.global_name || channel.recipient.username}`);
              }
            } catch (err) {
              console.error(`⚠️ Failed to fetch user ${recipientId}:`, err);
            }
          }

          // Also normalize the recipients array with the same enriched data
          if (channel.recipient && channel.recipients) {
            channel.recipients = channel.recipients.map((r: any) =>
              r.id === channel.recipient.id ? channel.recipient : r
            );
          }

          return channel;
        })
      );

      setChannels(enrichedChannels);
    } catch (error: any) {
      console.error('❌ Channel load error:', error);
      throw error;
    }
  };

  const loadGuilds = async () => {
    try {
      const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { Authorization: token },
      });

      if (!response.ok) {
        throw new Error(`Failed to load guilds: ${response.status}`);
      }

      const data = await response.json();
      console.log('🏢 Guilds loaded:', data.length);
      setGuilds(data);

      // Load members for each guild
      const membersData: { [guildId: string]: User[] } = {};
      for (const guild of data) {
        try {
          const membersResponse = await fetch(
            `https://discord.com/api/v10/guilds/${guild.id}/members?limit=100`,
            { headers: { Authorization: token } }
          );

          if (membersResponse.ok) {
            const members = await membersResponse.json();
            membersData[guild.id] = members
              .map((m: any) => ({
                id: m.user.id,
                username: m.user.username,
                global_name: m.nick || m.user.global_name || undefined,
                avatar: m.user.avatar,
              }))
              .sort((a: User, b: User) => {
                const aName = a.global_name || a.username;
                const bName = b.global_name || b.username;
                return aName.localeCompare(bName);
              });
          }
        } catch (err) {
          console.error(`Failed to load members for guild ${guild.id}:`, err);
        }
      }
      setGuildMembers(membersData);
    } catch (error: any) {
      console.error('❌ Guild load error:', error);
      // Don't throw - guilds are optional
    }
  };

  const handleSelectChannel = (channelId: string, type: 'dm' | 'member', userId?: string) => {
    setSelectedChannelId(channelId);
    if (type === 'dm') {
      // Direct message channel — also open the conversation view
      setSelectedRecipients([{ id: channelId, type: 'dm-channel' }]);
      setViewingChannelId(channelId);
    } else {
      // Guild member - need user ID
      setSelectedRecipients([{ id: channelId, type: 'user-id', userId: userId || channelId }]);
    }
  };

  const handleSendMessages = async () => {
    if (selectedRecipients.length === 0) {
      setStatus('⚠️ Please select at least one recipient');
      return;
    }

    if (!message.trim() && !gifUrl) {
      setStatus('⚠️ Please enter a message or select a GIF');
      return;
    }

    try {
      setSending(true);
      let sentCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const recipient of selectedRecipients) {
        try {
          let channelId = recipient.id;
          
          // If it's a direct DM channel, we can send directly
          if (recipient.type === 'dm-channel') {
            console.log(`📤 Sending to DM channel: ${channelId}`);
          } else if (recipient.type === 'user-id') {
            // If it's a user ID, we need to create a DM channel first
            console.log(`📤 Creating DM with user: ${recipient.userId}`);
            setStatus(`⏳ Sending... (${sentCount}/${selectedRecipients.length})`);
            
            const dmResponse = await fetch(
              `https://discord.com/api/v10/users/@me/channels`,
              {
                method: 'POST',
                headers: {
                  Authorization: token,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ recipient_id: recipient.userId }),
              }
            );

            console.log(`📨 DM channel response: ${dmResponse.status}`);

            if (!dmResponse.ok) {
              const errText = await dmResponse.text();
              console.error(`Failed to create DM: ${dmResponse.status} - ${errText}`);
              
              let errorMsg = `Cannot message`;
              try {
                const errJson = JSON.parse(errText);
                console.error('Discord error details:', errJson);
                if (errJson.code === 50033) {
                  errorMsg = 'User has DMs disabled';
                } else if (errJson.message) {
                  errorMsg = errJson.message;
                }
              } catch (e) {
                // Not JSON
              }
              
              if (dmResponse.status === 400) {
                errorMsg = 'User has DMs disabled or is a bot';
              } else if (dmResponse.status === 403) {
                errorMsg = 'Cannot message (blocked/privacy settings)';
              } else if (dmResponse.status === 401) {
                errorMsg = 'Invalid token';
              } else if (dmResponse.status === 429) {
                errorMsg = 'Rate limited';
              }
              
              errors.push(`User: ${errorMsg}`);
              failedCount++;
              
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
            }

            const dmChannel = await dmResponse.json();
            channelId = dmChannel.id;
            console.log(`✅ DM channel created/found: ${channelId}`);
          }

          // Build the final message content: text + GIF URL
          const parts: string[] = [];
          if (message.trim()) parts.push(message);
          if (gifUrl) parts.push(gifUrl);
          const finalContent = parts.join('\n');

          // Now send the message to the channel
          console.log(`📨 Sending message to channel: ${channelId}`);
          const messageResponse = await fetch(
            `https://discord.com/api/v10/channels/${channelId}/messages`,
            {
              method: 'POST',
              headers: {
                Authorization: token,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ content: finalContent }),
            }
          );

          console.log(`📨 Message send response: ${messageResponse.status}`);

          if (messageResponse.ok) {
            console.log(`✅ Message sent`);
            sentCount++;
          } else {
            const errData = await messageResponse.text();
            console.error(`Failed to send message: ${messageResponse.status} - ${errData}`);
            
            let errorMsg = `${messageResponse.status}`;
            if (messageResponse.status === 403) {
              errorMsg = 'No permission to message';
            } else if (messageResponse.status === 429) {
              errorMsg = 'Rate limited';
            }
            
            errors.push(`Failed: ${errorMsg}`);
            failedCount++;
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (err: any) {
          failedCount++;
          console.error(`❌ Error:`, err);
          errors.push(`Error: ${err.message}`);
        }
      }

      if (sentCount > 0) {
        setStatus(`✅ Message sent to ${sentCount} user(s)${failedCount > 0 ? ` (${failedCount} failed)` : ''}`);
        setMessage('');
        setGifUrl('');
        setSelectedRecipients([]);
      } else {
        const errorDetails = errors.length > 0 ? `\n${errors.slice(0, 2).join('\n')}` : '';
        setStatus(`❌ Failed to send (${failedCount}${errorDetails})`);
      }
      
      if (errors.length > 0) {
        console.log('Error details:', errors);
      }
    } catch (error: any) {
      setStatus('❌ Error: ' + error.message);
      console.error('Send error:', error);
    } finally {
      setSending(false);
    }
  };

  // ---- Group helpers ----

  const getAvatar = (user?: User): string => {
    if (user?.avatar && user?.id) {
      const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
    }
    const defaultIndex = user?.id ? (BigInt(user.id) >> BigInt(22)) % BigInt(6) : BigInt(0);
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
  };

  const handleSelectGroup = (group: RecipientGroup) => {
    const validChannelIds = group.channelIds.filter(
      cId => channels.some(ch => ch.id === cId)
    );

    const allSelected = validChannelIds.every(
      cId => selectedRecipients.some(r => r.id === cId)
    );

    if (allSelected && validChannelIds.length > 0) {
      setSelectedRecipients(
        selectedRecipients.filter(r => !validChannelIds.includes(r.id))
      );
    } else {
      const existingIds = new Set(selectedRecipients.map(r => r.id));
      const newRecipients = validChannelIds
        .filter(cId => !existingIds.has(cId))
        .map(cId => ({ id: cId, type: 'dm-channel' as const }));
      setSelectedRecipients([...selectedRecipients, ...newRecipients]);
    }
  };

  const isGroupFullySelected = (group: RecipientGroup): boolean => {
    const validIds = group.channelIds.filter(cId => channels.some(ch => ch.id === cId));
    return validIds.length > 0 && validIds.every(cId => selectedRecipients.some(r => r.id === cId));
  };

  const getGroupSelectedCount = (group: RecipientGroup): number => {
    return group.channelIds.filter(
      cId => selectedRecipients.some(r => r.id === cId)
    ).length;
  };

  // ---- Drag-and-drop handlers ----

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = 'move';
    // Add a slight delay for the drag ghost
    setTimeout(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.classList.add('dragging');
      }
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex === null || dragIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    // Don't reset dragOverIndex here — it causes flickering
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newGroups = [...groups];
    const [draggedGroup] = newGroups.splice(dragIndex, 1);
    newGroups.splice(dropIndex, 0, draggedGroup);
    saveGroups(newGroups);

    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    if (dragNodeRef.current) {
      dragNodeRef.current.classList.remove('dragging');
    }
    setDragIndex(null);
    setDragOverIndex(null);
    dragNodeRef.current = null;
  };

  return (
    <div className="dashboard-container">
      <Sidebar
        channels={channels}
        guilds={guilds}
        guildMembers={guildMembers}
        selectedChannelId={selectedChannelId}
        onSelectChannel={handleSelectChannel}
        userData={userData}
      />

      <RecipientModal
        isOpen={showRecipientModal}
        channels={channels}
        selectedRecipients={selectedRecipients}
        onSelectionChange={setSelectedRecipients}
        onClose={() => setShowRecipientModal(false)}
      />

      <div className="main-content">
        <header className="dashboard-header">
          <h1>Discord DM Manager</h1>
          <button onClick={onLogout} className="logout-btn">
            Logout
          </button>
        </header>

        <div className="dashboard-content">
          {/* Left column: Recipients + Groups */}
          <div className="dashboard-left">
            <div className="section">
              <h2>Select Recipients</h2>
              {loading ? (
                <p className="loading">📡 Loading your data...</p>
              ) : channels.length === 0 ? (
                <p className="loading">📭 No conversations found</p>
              ) : (
                <div className="recipient-selector-button-wrapper">
                  <button 
                    className="recipient-selector-btn"
                    onClick={() => setShowRecipientModal(true)}
                  >
                    <div className="btn-text">
                      <span className="btn-label">👥 Select Recipients</span>
                      <span className="btn-count">{selectedRecipients.length} selected</span>
                    </div>
                    <span className="btn-arrow">›</span>
                  </button>
                </div>
              )}
            </div>

            {/* Groups section — directly below select recipients */}
            {groups.length > 0 && (
              <div className="section groups-section">
                <h2>📁 Your Groups</h2>
                <div className="dashboard-groups-list">
                  {groups.map((group, index) => {
                    const memberCount = group.channelIds.filter(
                      cId => channels.some(ch => ch.id === cId)
                    ).length;
                    const selectedCount = getGroupSelectedCount(group);
                    const fullySelected = isGroupFullySelected(group);

                    // Get first 3 member avatars for preview
                    const previewMembers = group.channelIds
                      .slice(0, 3)
                      .map(cId => channels.find(ch => ch.id === cId))
                      .filter((ch): ch is Channel => !!ch);

                    const isDragOver = dragOverIndex === index && dragIndex !== index;

                    return (
                      <div
                        key={group.id}
                        className={`dashboard-group-card ${fullySelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''} ${dragIndex === index ? 'dragging' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnter={(e) => handleDragEnter(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="dashboard-group-drag-handle">
                          <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
                            <circle cx="2" cy="2" r="1.5" />
                            <circle cx="6" cy="2" r="1.5" />
                            <circle cx="2" cy="7" r="1.5" />
                            <circle cx="6" cy="7" r="1.5" />
                            <circle cx="2" cy="12" r="1.5" />
                            <circle cx="6" cy="12" r="1.5" />
                          </svg>
                        </div>

                        <div
                          className="dashboard-group-main"
                          onClick={() => handleSelectGroup(group)}
                        >
                          <div className="dashboard-group-emoji">{group.emoji}</div>
                          <div className="dashboard-group-info">
                            <div className="dashboard-group-name">{group.name}</div>
                            <div className="dashboard-group-meta">
                              {memberCount} member{memberCount !== 1 ? 's' : ''}
                              {selectedCount > 0 && (
                                <span className="dashboard-group-selected">
                                  {' '}· {selectedCount} selected
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="dashboard-group-right">
                            <div className="dashboard-group-avatars">
                              {previewMembers.map((ch, i) => (
                                <img
                                  key={ch.id}
                                  src={getAvatar(ch.recipient)}
                                  alt=""
                                  className="dashboard-group-avatar-preview"
                                  style={{ zIndex: 3 - i }}
                                  onError={(e) => {
                                    e.currentTarget.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
                                  }}
                                />
                              ))}
                              {group.channelIds.length > 3 && (
                                <div className="dashboard-group-avatar-more">
                                  +{group.channelIds.length - 3}
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
                              className="dashboard-group-checkbox"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="groups-hint">
                  Drag to reorder · Click to select all members
                </p>
              </div>
            )}
          </div>

          {/* Right column: Chat View or Compose Message */}
          <div className="dashboard-right">
            {viewingChannelId && channels.find(ch => ch.id === viewingChannelId) ? (
              <div className="chat-view-wrapper">
                <ChatView
                  channel={channels.find(ch => ch.id === viewingChannelId)!}
                  token={token}
                  currentUserId={userData?.id}
                  onClose={() => setViewingChannelId(null)}
                />
              </div>
            ) : (
              <div className="section compose-section">
                <h2>Compose Message</h2>
                <MessageComposer
                  message={message}
                  onMessageChange={setMessage}
                  selectedCount={selectedRecipients.length}
                  onSend={handleSendMessages}
                  isSending={sending}
                  gifUrl={gifUrl}
                  onGifChange={setGifUrl}
                />
              </div>
            )}
          </div>
        </div>

        {status && (
          <div className={`status-message ${status.includes('❌') || status.includes('⚠️') ? 'error' : 'success'}`}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
