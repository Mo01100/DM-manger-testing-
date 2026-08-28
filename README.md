# Discord DM Manager

A powerful desktop application to manage and send Discord direct messages to multiple users simultaneously.

## Features

✅ **Multi-recipient messaging**: Send a single message to multiple Discord users at once
✅ **User-friendly interface**: Intuitive design for easy navigation
✅ **Select/Deselect all**: Quickly select or deselect all recipients
✅ **Real-time recipient count**: See how many users will receive your message
✅ **Message preview**: See character count before sending
✅ **Secure token handling**: Discord bot token input with password field

## Prerequisites

- Node.js 14+ and npm
- Discord Bot Token (from Discord Developer Portal)

## Installation

1. Clone or navigate to the project directory:
```bash
cd "Discord DM"
```

2. Install dependencies:
```bash
npm install
```

## Getting Your Discord Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and name it
3. Go to the "Bot" tab
4. Click "Add Bot"
5. Under "TOKEN" section, click "Copy" to copy your bot token
6. Paste this token in the application login screen

## Development

To run the app in development mode:

```bash
npm start
```

This will start both the React development server and Electron app.

## Building

To build the application for distribution:

```bash
npm run dist
```

This creates installers in the `dist/` folder.

## Project Structure

```
Discord DM/
├── public/
│   ├── electron.js          # Electron main process
│   ├── preload.js           # Preload script for IPC
│   └── index.html           # HTML template
├── src/
│   ├── components/          # React components
│   │   ├── RecipientSelector.tsx
│   │   └── MessageComposer.tsx
│   ├── pages/              # Page components
│   │   ├── Login.tsx
│   │   └── Dashboard.tsx
│   ├── styles/             # CSS files
│   ├── App.tsx
│   └── index.tsx
├── package.json
└── tsconfig.json
```

## How to Use

1. **Login**: Enter your Discord bot token and click Login
2. **Select Recipients**: Check the boxes next to the Discord users/groups you want to message
3. **Compose Message**: Type your message in the text area
4. **Send**: Click the "Send" button to deliver your message

## Technologies Used

- **Electron**: Cross-platform desktop application framework
- **React**: UI library
- **TypeScript**: Type-safe JavaScript
- **Discord.js**: Discord API interaction

## Important Notes

⚠️ **Bot Limitations**: 
- The bot must be in a mutual server/group with the recipients
- Direct messages must be enabled between the bot and users
- Respect Discord's rate limiting (may need delays between messages for large groups)

## Troubleshooting

**"Error loading channels"**
- Verify your bot token is correct
- Check that your bot has permission to read DMs
- Ensure your bot is in mutual servers with the recipients

**"Message failed to send"**
- Check Discord's status page
- Verify recipients haven't blocked the bot
- Ensure the message doesn't exceed 2000 characters

## License

MIT

## Support

For issues or feature requests, please create an issue in the repository.
