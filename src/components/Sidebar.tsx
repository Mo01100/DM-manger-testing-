import React, { useState, useMemo } from 'react';
import '../styles/Sidebar.css';

interface User {
  id: string;
  username: string;
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

interface Guild {
  id: string;
  name: string;
  icon?: string;
  owner: boolean;
}

interface SidebarProps {
  channels: Channel[];
  guilds: Guild[];
  guildMembers: { [guildId: string]: User[] };
  selectedChannelId: string | null;
  onSelectChannel: (channelId: string, type: 'dm' | 'member', userId?: string) => void;
  userData?: any;
}

const Sidebar: React.FC<SidebarProps> = ({
  channels,
  guilds,
  guildMembers,
  selectedChannelId,
  onSelectChannel,
  userData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGuilds, setExpandedGuilds] = useState<Set<string>>(new Set());

  const toggleGuildExpand = (guildId: string) => {
    const newExpanded = new Set(expandedGuilds);
    if (newExpanded.has(guildId)) {
      newExpanded.delete(guildId);
    } else {
      newExpanded.add(guildId);
    }
    setExpandedGuilds(newExpanded);
  };

  const getChannelName = (channel: Channel): string => {
    if (channel.name && channel.name.trim()) {
      return channel.name;
    }
    if (channel.recipient?.username) {
      return channel.recipient.username;
    }
    if (channel.recipients && channel.recipients.length > 0) {
      return channel.recipients.map(r => r.username).join(', ');
    }
    return 'Unknown';
  };

  const getAvatar = (user?: User): string => {
    if (user?.avatar && user?.id) {
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
    }
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  };

  // Filter channels and members based on search
  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const query = searchQuery.toLowerCase();
    return channels.filter(ch => getChannelName(ch).toLowerCase().includes(query));
  }, [channels, searchQuery]);

  const filteredGuildMembers = useMemo(() => {
    if (!searchQuery.trim()) return guildMembers;
    const query = searchQuery.toLowerCase();
    const filtered: { [key: string]: User[] } = {};
    
    Object.entries(guildMembers).forEach(([guildId, members]) => {
      filtered[guildId] = members.filter(m => m.username.toLowerCase().includes(query));
    });
    
    return filtered;
  }, [guildMembers, searchQuery]);

  const sortedChannels = [...filteredChannels].sort((a, b) => {
    const aId = a.last_message_id || '0';
    const bId = b.last_message_id || '0';
    return parseInt(bId) - parseInt(aId);
  });

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>💬 Discord</h2>
        {userData && (
          <div className="user-info">
            <span className="username">{userData.username}</span>
          </div>
        )}
      </div>

      <div className="sidebar-search">
        <input
          type="text"
          placeholder="🔍 Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="channels-section">
        {/* Direct Messages Section */}
        {sortedChannels.length > 0 && (
          <div className="section-group">
            <div className="section-title">
              💌 Direct Messages ({sortedChannels.length})
            </div>
            <div className="channels-list">
              {sortedChannels.map((channel) => (
                <div
                  key={channel.id}
                  className={`channel-item ${selectedChannelId === channel.id ? 'active' : ''}`}
                  onClick={() => onSelectChannel(channel.id, 'dm')}
                  title={getChannelName(channel)}
                >
                  <img 
                    src={getAvatar(channel.recipient)} 
                    alt="avatar" 
                    className="channel-avatar"
                    onError={(e) => {
                      e.currentTarget.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
                    }}
                  />
                  <div className="channel-info">
                    <div className="channel-name">{getChannelName(channel)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Guilds/Servers Section */}
        {guilds.length > 0 && (
          <div className="section-group">
            <div className="section-title">
              🏢 Servers ({guilds.length})
            </div>
            <div className="guilds-list">
              {guilds.map((guild) => {
                const guildMembers = filteredGuildMembers[guild.id] || [];
                const isExpanded = expandedGuilds.has(guild.id);
                
                return (
                  <div key={guild.id} className="guild-item">
                    <div
                      className="guild-header"
                      onClick={() => toggleGuildExpand(guild.id)}
                    >
                      <img
                        src={
                          guild.icon
                            ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
                            : 'https://cdn.discordapp.com/embed/avatars/0.png'
                        }
                        alt={guild.name}
                        className="guild-icon"
                        onError={(e) => {
                          e.currentTarget.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
                        }}
                      />
                      <div className="guild-info">
                        <div className="guild-name">{guild.name}</div>
                        <div className="guild-members-count">
                          {guildMembers.length} member{guildMembers.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                    </div>

                    {isExpanded && guildMembers.length > 0 && (
                      <div className="guild-members">
                        {guildMembers.slice(0, 50).map((member) => (
                          <div
                            key={member.id}
                            className={`member-item ${selectedChannelId === member.id ? 'active' : ''}`}
                            onClick={() => onSelectChannel(member.id, 'member', member.id)}
                            title={member.username}
                          >
                            <img
                              src={getAvatar(member)}
                              alt={member.username}
                              className="member-avatar"
                              onError={(e) => {
                                e.currentTarget.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
                              }}
                            />
                            <span className="member-name">{member.username}</span>
                          </div>
                        ))}
                        {guildMembers.length > 50 && (
                          <div className="member-item disabled">
                            +{guildMembers.length - 50} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sortedChannels.length === 0 && guilds.length === 0 && (
          <p className="no-channels">No conversations or servers found</p>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
