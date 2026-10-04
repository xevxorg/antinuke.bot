const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Antinuke Bot Running 🛡️'));
app.listen(PORT, () => console.log(`✅ Port ${PORT} open — Ready!`));
const { Client, Events, GatewayIntentBits, AuditLogEvent, EmbedBuilder, REST, Routes, PermissionsBitField } = require('discord.js');

// === ENVIRONMENT VARIABLES — ONLY READ HERE ===
const TOKEN = process.env.token;
const OWNER_ID = process.env.ownerId;
const LOG_CHANNEL_ID = process.env.logChannelId || null;

// ✅ DIRECT INTENT VALUES — NO MORE "undefined"
const client = new Client({
  intents: [
    1 << 0,   // Guilds
    1 << 11   // GuildAuditLogs
  ]
});

const CONFIG = {
  enabled: true,
  instantBan: true,
  whitelist: [OWNER_ID],
  thresholds: {
    bans: 2, kicks: 2, channels: 2, roles: 2,
    webhooks: 1, bots: 1, emojis: 3, stickers: 3
  },
  timeWindow: 15000,
  premium: {
    guilds: new Map(),
    key: 'premiumactivationgodsosixev'
  }
};

const tracker = new Map();

const commands = [
  {
    name: 'premcmds',
    description: 'Display all available premium commands'
  },
  {
    name: 'premium',
    description: 'Manage premium features',
    options: [
      {
        name: 'activate',
        description: 'Activate premium using your code',
        type: 3,
        required: true
      }
    ]
  },
  {
    name: 'antinuke',
    description: 'Control anti-nuke protection system',
    options: [
      {
        name: 'enable',
        description: 'Turn on anti-nuke protection'
      },
      {
        name: 'disable',
        description: 'Turn off anti-nuke protection'
      },
      {
        name: 'status',
        description: 'Check current protection status'
      },
      {
        name: 'threshold',
        description: 'Set detection sensitivity',
        options: [
          {
            name: 'bans',
            description: 'Max bans before lock'
          },
          {
            name: 'kicks',
            description: 'Max kicks before lock'
          },
          {
            name: 'channels',
            description: 'Max channel changes before lock'
          },
          {
            name: 'roles',
            description: 'Max role changes before lock'
          },
          {
            name: 'webhooks',
            description: 'Max webhooks before lock'
          },
          {
            name: 'bots',
            description: 'Max bot joins before lock'
          }
        ]
      }
    ]
  },
  {
    name: 'whitelist',
    description: 'Manage protected users',
    options: [
      {
        name: 'add',
        description: 'Add a user to whitelist',
        type: 6,
        required: true
      },
      {
        name: 'remove',
        description: 'Remove a user from whitelist',
        type: 6,
        required: true
      },
      {
        name: 'list',
        description: 'Show all whitelisted users'
      }
    ]
  },
  {
    name: 'protect',
    description: 'Lock server to prevent damage'
  },
  {
    name: 'unprotect',
    description: 'Unlock server after threat'
  },
  {
    name: 'ping',
    description: 'Check bot response time'
  }
];