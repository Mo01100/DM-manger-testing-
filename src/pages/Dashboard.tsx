import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import RecipientModal from '../components/RecipientModal';
import MessageComposer from '../components/MessageComposer';
import '../styles/Dashboard.css';

interface User {
  id: string;
  username: string;
  avatar?: string;
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

const Dashboard: React.FC<DashboardProps> = ({ token, userData, onLogout }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildMembers, setGuildMembers] = useState<{ [guildId: string]: User[] }>({});
  const [selectedRecipients, setSelectedRecipients] = useState<RecipientData[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [showRecipientModal, setShowRecipientModal] = useState(false);

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

      // Enrich channel data with user avatars
      const enrichedChannels = await Promise.all(
        data.map(async (channel: any) => {
          // If it's a single recipient DM, fetch the user info to get avatar
          if (channel.recipient?.id && !channel.recipient?.avatar) {
            try {
              const userResponse = await fetch(
                `https://discord.com/api/v10/users/${channel.recipient.id}`,
                { headers: { Authorization: token } }
              );
              if (userResponse.ok) {
                const userData = await userResponse.json();
                channel.recipient = {
                  ...channel.recipient,
                  avatar: userData.avatar,
                };
                console.log(`✅ Fetched avatar for ${userData.username}`);
              }
            } catch (err) {
              console.error(`⚠️ Failed to fetch user ${channel.recipient.id}:`, err);
            }
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
                username: m.nick || m.user.username,
                avatar: m.user.avatar,
              }))
              .sort((a: User, b: User) => a.username.localeCompare(b.username));
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
      // Direct message channel
      setSelectedRecipients([{ id: channelId, type: 'dm-channel' }]);
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

    if (!message.trim()) {
      setStatus('⚠️ Please enter a message');
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
              body: JSON.stringify({ content: message }),
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

          <div className="section">
            <h2>Compose Message</h2>
            <MessageComposer
              message={message}
              onMessageChange={setMessage}
              selectedCount={selectedRecipients.length}
              onSend={handleSendMessages}
              isSending={sending}
            />
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
