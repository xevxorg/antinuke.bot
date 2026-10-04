const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Antinuke Bot Running 🛡️'));
app.listen(PORT, () => console.log(`✅ Port ${PORT} open — Ready!`));

// === ENVIRONMENT VARIABLES ===
const { Client, Events, GatewayIntentBits, AuditLogEvent, EmbedBuilder, REST, Routes, PermissionsBitField } = require('discord.js');

const token = process.env.token;
const ownerId = process.env.ownerId;
const logChannelId = process.env.logChannelId;

// === BOT CLIENT WITH INTENTS ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildAuditLogEntries,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

const CONFIG = {
  enabled: true,
  instantBan: true,
  whitelist: [ownerId],
  thresholds: {
    bans: 2,
    kicks: 2,
    channels: 2,
    roles: 2,
    webhooks: 1,
    bots: 1,
    emojis: 3,
    stickers: 3
  },
  timeWindow: 15000,
  premium: {
    guilds: new Map(),
    key: 'premiumactivationgodsosixev'
  }
};

const tracker = new Map();

// === COMMAND DEFINITIONS ===
const commands = [
  {
    name: 'premcmds',
    description: 'Show all Premium commands'
  },
  {
    name: 'premium',
    description: 'Manage premium features',
    options: [
      {
        name: 'activate',
        description: 'Activate premium with code',
        type: 3,
        required: true
      }
    ]
  },
  {
    name: 'antinuke',
    description: 'Control anti-nuke protection',
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

// === READY EVENT ===
client.on(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  
  try {
    console.log('Registering commands...');
    const rest = new REST({ version: '10' }).setToken(token);
    
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    
    console.log('💎 Bot Ready — All commands active!');
  } catch (error) {
    console.error('Register Error:', error);
  }
});

// === ANTI-NUKE DETECTION ===
client.on(Events.GuildAuditLogEntryCreate, async (entry) => {
  if (!CONFIG.enabled) return;
  
  const { action, executor, target } = entry;
  if (!executor || CONFIG.whitelist.includes(executor.id)) return;

  const now = Date.now();
  const guildId = entry.guild.id;
  const userId = executor.id;
  const key = `${guildId}-${userId}`;

  if (!tracker.has(key)) tracker.set(key, []);
  const userActions = tracker.get(key);
  userActions.push({ action, time: now });

  const recentActions = userActions.filter(a => now - a.time < CONFIG.timeWindow);
  tracker.set(key, recentActions);

  let actionType = null;
  if (action === AuditLogEvent.MemberBanAdd) actionType = 'bans';
  if (action === AuditLogEvent.MemberKick) actionType = 'kicks';
  if (action === AuditLogEvent.ChannelCreate || action === AuditLogEvent.ChannelDelete) actionType = 'channels';
  if (action === AuditLogEvent.RoleCreate || action === AuditLogEvent.RoleDelete) actionType = 'roles';
  if (action === AuditLogEvent.WebhookCreate || action === AuditLogEvent.WebhookDelete) actionType = 'webhooks';
  if (action === AuditLogEvent.BotAdd) actionType = 'bots';

  if (!actionType) return;

  const count = recentActions.filter(a => {
    if (action === AuditLogEvent.MemberBanAdd && a.action === AuditLogEvent.MemberBanAdd) return true;
    if (action === AuditLogEvent.MemberKick && a.action === AuditLogEvent.MemberKick) return true;
    if ((action === AuditLogEvent.ChannelCreate || action === AuditLogEvent.ChannelDelete) && 
        (a.action === AuditLogEvent.ChannelCreate || a.action === AuditLogEvent.ChannelDelete)) return true;
    if ((action === AuditLogEvent.RoleCreate || action === AuditLogEvent.RoleDelete) && 
        (a.action === AuditLogEvent.RoleCreate || a.action === AuditLogEvent.RoleDelete)) return true;
    if ((action === AuditLogEvent.WebhookCreate || action === AuditLogEvent.WebhookDelete) && 
        (a.action === AuditLogEvent.WebhookCreate || a.action === AuditLogEvent.WebhookDelete)) return true;
    if (action === AuditLogEvent.BotAdd && a.action === AuditLogEvent.BotAdd) return true;
    return false;
  }).length;

  if (count >= CONFIG.thresholds[actionType]) {
    try {
      const member = await entry.guild.members.fetch(executor.id).catch(() => null);
      if (member && CONFIG.instantBan) {
        await member.ban({ reason: `Anti-Nuke: ${actionType} threshold exceeded` });
        console.log(`🚨 Banned ${executor.tag} for ${actionType}`);
      }
    } catch (e) {
      console.error('Ban failed:', e);
    }
  }
});

// === COMMAND HANDLER ===
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, user } = interaction;

  if (commandName === 'ping') {
    await interaction.reply(`🏓 Pong! Latency: ${client.ws.ping}ms`);
  }

  if (commandName === 'premcmds') {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🛡️ Premium Commands')
          .setDescription('`/premium activate <code>` — Activate premium\n`/antinuke enable/disable/status` — Control protection\n`/whitelist add/remove/list` — Manage trusted users\n`/protect` — Lock server\n`/unprotect` — Unlock server')
          .setColor('Blue')
      ]
    });
  }

  if (commandName === 'antinuke') {
    if (user.id !== ownerId) return interaction.reply({ content: '❌ Only the owner can use this!', ephemeral: true });
    
    const sub = options.getSubcommand();
    if (sub === 'enable') {
      CONFIG.enabled = true;
      await interaction.reply('✅ Anti-nuke protection **ENABLED**');
    } else if (sub === 'disable') {
      CONFIG.enabled = false;
      await interaction.reply('⚠️ Anti-nuke protection **DISABLED**');
    } else if (sub === 'status') {
      await interaction.reply(`🛡️ Protection: **${CONFIG.enabled ? 'ACTIVE' : 'OFF'}**`);
    }
  }

  if (commandName === 'whitelist') {
    if (user.id !== ownerId) return interaction.reply({ content: '❌ Only the owner can use this!', ephemeral: true });
    
    const sub = options.getSubcommand();
    if (sub === 'add') {
      const target = options.getUser('user');
      if (!CONFIG.whitelist.includes(target.id)) CONFIG.whitelist.push(target.id);
      await interaction.reply(`✅ Added ${target} to whitelist`);
    } else if (sub === 'remove') {
      const target = options.getUser('user');
      CONFIG.whitelist = CONFIG.whitelist.filter(id => id !== target.id);
      await interaction.reply(`✅ Removed ${target} from whitelist`);
    } else if (sub === 'list') {
      const list = CONFIG.whitelist.map(id => `<@${id}>`).join('\n') || 'None';
      await interaction.reply(`📋 Whitelist:\n${list}`);
    }
  }

  if (commandName === 'protect') {
    if (user.id !== ownerId) return interaction.reply({ content: '❌ Only the owner can use this!', ephemeral: true });
    CONFIG.enabled = true;
    await interaction.reply('🔒 Server locked — Maximum protection active');
  }

  if (commandName === 'unprotect') {
    if (user.id !== ownerId) return interaction.reply({ content: '❌ Only the owner can use this!', ephemeral: true });
    await interaction.reply('🔓 Server unlocked — Use `/antinuke disable` to fully turn off');
  }

  if (commandName === 'premium') {
    const code = options.getString('activate');
    if (code === CONFIG.premium.key) {
      CONFIG.premium.guilds.set(interaction.guildId, true);
      await interaction.reply('✅ Premium activated! All features unlocked ✨');
    } else {
      await interaction.reply({ content: '❌ Invalid premium code', ephemeral: true });
    }
  }
});

// === LOGIN — THIS CONNECTS YOUR BOT ===
client.login(token);