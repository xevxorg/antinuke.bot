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
  { name: 'premcmds', description: '📋 Show all Premium commands' },
  {
    name: 'premium',
    description: 'Premium features',
    options: [
      { name: 'action', type: 3, required: true, choices: [
        { name: 'Activate', value: 'activate' },
        { name: 'Status', value: 'status' },
        { name: 'Set Avatar', value: 'setavatar' },
        { name: 'Remove Avatar', value: 'removeavatar' },
        { name: 'List Premium', value: 'list' }
      ]},
      { name: 'code', type: 3 },
      { name: 'image', type: 11 }
    ]
  },
  {
    name: 'antinuke',
    description: 'Control Anti-Nuke',
    options: [
      { name: 'action', type: 3, required: true, choices: [
        { name: 'Enable', value: 'enable' },
        { name: 'Disable', value: 'disable' },
        { name: 'Status', value: 'status' },
        { name: 'Reset', value: 'reset' }
      ]}
    ]
  },
  {
    name: 'whitelist',
    description: 'Manage safe users',
    options: [
      { name: 'action', type: 3, required: true, choices: [
        { name: 'Add', value: 'add' },
        { name: 'Remove', value: 'remove' },
        { name: 'List', value: 'list' },
        { name: 'Clear', value: 'clear' }
      ]},
      { name: 'user', type: 6, required: true }
    ]
  },
  {
    name: 'threshold',
    description: 'Set detection limits',
    options: [
      { name: 'type', type: 3, required: true, choices: [
        { name: 'Bans', value: 'bans' },
        { name: 'Kicks', value: 'kicks' },
        { name: 'Channels', value: 'channels' },
        { name: 'Roles', value: 'roles' },
        { name: 'Webhooks', value: 'webhooks' },
        { name: 'Bots', value: 'bots' }
      ]},
      { name: 'count', type: 4, required: true }
    ]
  },
  {
    name: 'instantban',
    description: 'Toggle instant ban',
    options: [
      { name: 'mode', type: 3, required: true, choices: [
        { name: 'ON', value: 'on' },
        { name: 'OFF', value: 'off' }
      ]}
    ]
  },
  { name: 'ping', description: 'Check bot latency' },
  { name: 'help', description: 'Show all commands' },
  { name: 'nukecheck', description: 'Scan server for risks' },
  { name: 'protect', description: 'Full protection status' }
];

async function registerCommands() {
  try {
    console.log('🔄 Registering commands...');
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ ${commands.length} commands registered!`);
  } catch (err) {
    console.error('Register Error:', err);
  }
}

function isWhitelisted(id) { return CONFIG.whitelist.includes(id); }
function isPremiumGuild(id) { return CONFIG.premium.guilds.has(id); }
function trackAction(userId, type) {
  if (!tracker.has(userId)) tracker.set(userId, []);
  const recent = tracker.get(userId).filter(a => Date.now() - a.time < CONFIG.timeWindow);
  recent.push({ type, time: Date.now() });
  tracker.set(userId, recent);
  return recent.filter(a => a.type === type).length >= CONFIG.thresholds[type];
}

async function punish(guild, uid, reason) {
  if (!CONFIG.enabled || isWhitelisted(uid)) return false;
  const member = await guild.members.fetch(uid).catch(() => null);
  if (!member || member.user.bot) return false;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return false;
  if (member.roles.highest.position >= guild.members.me.roles.highest.position) return false;
  try {
    if (CONFIG.instantBan) await member.ban({ reason });
    else await member.kick(reason);
    return true;
  } catch { return false; }
}

async function sendLog(guild, uid, action, banned) {
  if (!LOG_CHANNEL_ID) return;
  const ch = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!ch) return;
  await ch.send({ embeds: [new EmbedBuilder()
    .setColor(banned ? '#ff0000' : '#ffff00')
    .setTitle(banned ? '🚨 BANNED — NUKE DETECTED' : '⚠️ Suspicious Activity')
    .addFields(
      { name: 'User', value: `<@${uid}> \`${uid}\`` },
      { name: 'Action', value: action },
      { name: 'Result', value: banned ? '✅ BANNED' : '⚠️ Not banned' }
    )
    .setTimestamp()
  ]}).catch(() => {});
}

client.on(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands();
  console.log('💎 Bot Ready — All commands active!');
});

client.on(Events.InteractionCreate, async i => {
  if (!i.isChatInputCommand()) return;
  const { commandName, options, user, guild } = i;

  if (commandName === 'premcmds') {
    return i.reply({ embeds: [new EmbedBuilder()
      .setColor('#ffd700')
      .setTitle('💎 ALL COMMANDS')
      .setDescription(`
**Premium**
/premium activate code:premiumactivationgodsosixev
/premium status
/premium setavatar image:
/premium removeavatar
/premium list

**Anti-Nuke**
/antinuke enable|disable|status|reset
/whitelist add|remove|list|clear @user
/threshold bans 2 | kicks 2 | etc
/instantban on|off

**Tools**
/ping — Check online
/help — This list
/nukecheck — Scan server
/protect — Full status
      `)
    ]});
  }

  if (commandName === 'premium') {
    const act = options.getString('action');
    if (act === 'activate') {
      if (guild.ownerId !== user.id) return i.reply('❌ Only server owner!', { ephemeral: true });
      if (options.getString('code') !== CONFIG.premium.key) return i.reply('❌ Wrong key!', { ephemeral: true });
      if (isPremiumGuild(guild.id)) return i.reply('✅ Already active!', { ephemeral: true });
      CONFIG.premium.guilds.set(guild.id, { at: Date.now() });
      return i.reply('💎 **PREMIUM ACTIVATED!**');
    }
    if (act === 'status') return i.reply(isPremiumGuild(guild.id) ? '💎 Premium: ✅ Active' : 'Premium: ❌ Not active');
    if (act === 'setavatar') {
      if (!isPremiumGuild(guild.id)) return i.reply('❌ Premium only!', { ephemeral: true });
      const img = options.getAttachment('image');
      if (!img) return i.reply('❌ Upload an image!', { ephemeral: true });
      return i.reply({ embeds: [new EmbedBuilder().setColor('#00ff00').setTitle('🖼️ Avatar Saved').setImage(img.url)] });
    }
    if (act === 'removeavatar') return i.reply('✅ Avatar removed');
    if (act === 'list') {
      if (user.id !== OWNER_ID) return i.reply('❌ Owner only!', { ephemeral: true });
      return i.reply(`Premium servers:\n${Array.from(CONFIG.premium.guilds.keys()).join('\n') || 'None'}`);
    }
    return;
  }

  const ownerCmds = ['antinuke','whitelist','threshold','instantban','nukecheck','protect'];
  if (ownerCmds.includes(commandName) && user.id !== OWNER_ID) {
    return i.reply('❌ Only bot owner!', { ephemeral: true });
  }

  if (commandName === 'antinuke') {
    const act = options.getString('action');
    if (act === 'enable') { CONFIG.enabled = true; await i.reply('✅ PROTECTION ON'); }
    if (act === 'disable') { CONFIG.enabled = false; await i.reply('⚠️ PROTECTION OFF'); }
    if (act === 'status') {
      await i.reply(`🛡️ Active: ${CONFIG.enabled ? '✅ YES' : '❌ NO'} | ⚡ Instant: ${CONFIG.instantBan ? '✅ ON' : '❌ OFF'} | 💎 Premium: ${isPremiumGuild(guild.id) ? '✅ YES' : 'NO'}`);
    }
    if (act === 'reset') {
      CONFIG.thresholds = { bans:2,kicks:2,channels:2,roles:2,webhooks:1,bots:1,emojis:3,stickers:3 };
      CONFIG.instantBan = true;
      await i.reply('✅ All reset');
    }
  }

  if (commandName === 'whitelist') {
    const act = options.getString('action');
    const usr = options.getUser('user');
    if (act === 'add') { CONFIG.whitelist.push(usr.id); await i.reply(`✅ Whitelisted ${usr}`); }
    if (act === 'remove') { CONFIG.whitelist = CONFIG.whitelist.filter(id => id !== usr.id); await i.reply(`✅ Removed ${usr}`); }
    if (act === 'list') { await i.reply(CONFIG.whitelist.map(id => `<@${id}>`).join('\n') || 'None'); }
    if (act === 'clear') { CONFIG.whitelist = [OWNER_ID]; await i.reply('✅ Cleared'); }
  }

  if (commandName === 'threshold') {
    const type = options.getString('type');
    const val = options.getInteger('count');
    CONFIG.thresholds[type] = val;
    await i.reply(`✅ ${type} → ${val}`);
  }

  if (commandName === 'instantban') {
    CONFIG.instantBan = options.getString('mode') === 'on';
    await i.reply(CONFIG.instantBan ? '⚡ Instant Ban: ON' : 'Kick only');
  }

  if (commandName === 'ping') await i.reply(`🏓 Pong! \`${client.ws.ping}ms\``);
  if (commandName === 'help') await i.reply('Check /premcmds for all commands', { ephemeral: true });
  if (commandName === 'protect') {
    await i.reply(`🛡️ ON: ${CONFIG.enabled} | ⚡ INSTANT: ${CONFIG.instantBan} | 💎 PREMIUM: ${isPremiumGuild(guild.id)}`);
  }
  if (commandName === 'nukecheck') {
    const dangers = [];
    const roles = await guild.roles.fetch();
    for (const [,r] of roles) {
      if (r.permissions.has(PermissionsBitField.Flags.Administrator) && !r.managed) dangers.push(`⚠️ ${r.name} — ADMIN`);
      if (r.permissions.has(PermissionsBitField.Flags.BanMembers)) dangers.push(`⚠️ ${r.name} — BAN`);
    }
    await i.reply(dangers.length ? dangers.join('\n') : '✅ No dangerous roles');
  }
});

client.on(Events.GuildAuditLogEntryCreate, async log => {
  if (!CONFIG.enabled) return;
  const { action, executorId, guild } = log;
  if (!executorId || executorId === client.user.id || isWhitelisted(executorId)) return;

  let detected = false, reason = '';
  if (action === AuditLogEvent.MemberBanAdd && trackAction(executorId, 'bans')) detected = true, reason = 'Mass Ban';
  if (action === AuditLogEvent.MemberKick && trackAction(executorId, 'kicks')) detected = true, reason = 'Mass Kick';
  if ([AuditLogEvent.ChannelCreate,AuditLogEvent.ChannelDelete].includes(action) && trackAction(executorId, 'channels')) detected = true, reason = 'Channel Attack';
  if ([AuditLogEvent.RoleCreate,AuditLogEvent.RoleDelete].includes(action) && trackAction(executorId, 'roles')) detected = true, reason = 'Role Attack';
  if (action === AuditLogEvent.WebhookCreate && trackAction(executorId, 'webhooks')) detected = true, reason = 'Webhook Attack';
  if (action === AuditLogEvent.BotAdd && trackAction(executorId, 'bots')) detected = true, reason = 'Bot Nuke';

  if (detected) {
    const banned = await punish(guild, executorId, reason);
    await sendLog(guild, executorId, reason, banned);
  }
});

client.login(TOKEN);