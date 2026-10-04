const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Antinuke Bot Running 🛡️'));
app.listen(PORT, () => console.log(`✅ Port ${PORT} open — Ready!`));

const { Client, Events, GatewayIntentBits, AuditLogEvent, EmbedBuilder, REST, Routes } = require('discord.js');

const token = process.env.token;
const ownerId = process.env.ownerId;
const logChannelId = process.env.logChannelId;

// ✅ CORRECTED INTENTS — No invalid names!
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
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
  timeWindow: 15000
};

const tracker = new Map();

const commands = [
  { name: 'premcmds', description: 'Show all Premium commands' },
  {
    name: 'antinuke',
    description: 'Control anti-nuke protection',
    options: [
      { name: 'enable', description: 'Turn on anti-nuke protection', type: 1 },
      { name: 'disable', description: 'Turn off anti-nuke protection', type: 1 },
      { name: 'status', description: 'Check protection status', type: 1 }
    ]
  },
  {
    name: 'whitelist',
    description: 'Manage protected users',
    options: [
      { name: 'add', description: 'Add user to whitelist', type: 1, options: [{ name: 'user', description: 'User to protect', type: 6, required: true }] },
      { name: 'remove', description: 'Remove user from whitelist', type: 1, options: [{ name: 'user', description: 'User to remove', type: 6, required: true }] },
      { name: 'list', description: 'Show all whitelisted users', type: 1 }
    ]
  },
  { name: 'ping', description: 'Check bot response time' }
];

client.on(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    console.log('Registering commands...');
    const rest = new REST({ version: '10' }).setToken(token);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('💎 Bot Ready — All commands active!');
  } catch (err) {
    console.error('Command Error:', err);
  }
});

client.on(Events.GuildAuditLogEntryCreate, async (entry) => {
  if (!CONFIG.enabled) return;
  const { action, executor } = entry;
  if (!executor || CONFIG.whitelist.includes(executor.id)) return;

  const now = Date.now();
  const key = `${entry.guild.id}-${executor.id}`;
  if (!tracker.has(key)) tracker.set(key, []);
  const userActions = tracker.get(key);
  userActions.push({ action, time: now });
  
  const recent = userActions.filter(a => now - a.time < CONFIG.timeWindow);
  tracker.set(key, recent);

  let type = null;
  if (action === AuditLogEvent.MemberBanAdd) type = 'bans';
  if (action === AuditLogEvent.MemberKick) type = 'kicks';
  if (action === AuditLogEvent.ChannelCreate || action === AuditLogEvent.ChannelDelete) type = 'channels';
  if (action === AuditLogEvent.RoleCreate || action === AuditLogEvent.RoleDelete) type = 'roles';
  if (action === AuditLogEvent.WebhookCreate || action === AuditLogEvent.WebhookDelete) type = 'webhooks';

  if (!type) return;
  
  if (recent.length >= CONFIG.thresholds[type]) {
    try {
      const member = await entry.guild.members.fetch(executor.id).catch(() => null);
      if (member && CONFIG.instantBan) {
        await member.ban({ reason: `Anti-Nuke: ${type} threshold exceeded` });
        console.log(`🚨 Banned ${executor.tag} for ${type}`);
      }
    } catch (e) {
      console.error('Ban failed:', e);
    }
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, user, options } = interaction;

  if (commandName === 'ping') {
    await interaction.reply(`🏓 Pong! Latency: ${client.ws.ping}ms`);
  }

  if (commandName === 'premcmds') {
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🛡️ Commands').setDescription('`/antinuke enable/disable/status`\n`/whitelist add @user`\n`/whitelist remove @user`\n`/whitelist list`').setColor('Blue')] });
  }

  if (commandName === 'antinuke') {
    if (user.id !== ownerId) return interaction.reply({ content: '❌ Only owner!', ephemeral: true });
    const sub = options.getSubcommand();
    if (sub === 'enable') { CONFIG.enabled = true; await interaction.reply('✅ Anti-nuke **ENABLED**'); }
    if (sub === 'disable') { CONFIG.enabled = false; await interaction.reply('⚠️ Anti-nuke **DISABLED**'); }
    if (sub === 'status') { await interaction.reply(`🛡️ Status: **${CONFIG.enabled ? 'ACTIVE' : 'OFF'}**`); }
  }

  if (commandName === 'whitelist') {
    if (user.id !== ownerId) return interaction.reply({ content: '❌ Only owner!', ephemeral: true });
    const sub = options.getSubcommand();
    if (sub === 'add') {
      const target = options.getUser('user');
      if (!CONFIG.whitelist.includes(target.id)) CONFIG.whitelist.push(target.id);
      await interaction.reply(`✅ Whitelisted ${target}`);
    }
    if (sub === 'remove') {
      const target = options.getUser('user');
      CONFIG.whitelist = CONFIG.whitelist.filter(id => id !== target.id);
      await interaction.reply(`✅ Removed ${target}`);
    }
    if (sub === 'list') {
      const list = CONFIG.whitelist.map(id => `<@${id}>`).join('\n') || 'None';
      await interaction.reply(`📋 Whitelist:\n${list}`);
    }
  }
});

client.login(token);