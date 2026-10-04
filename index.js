const { Client, GatewayIntentBits, AuditLogEvent, EmbedBuilder, REST, Routes, PermissionsBitField } = require('discord.js');

// === ENVIRONMENT VARIABLES ===
const botToken = process.env.token;
const botOwnerId = process.env.ownerId;
const logChId = process.env.logChannelId || '';

// ✅ ONLY THESE 2 INTENTS — NO MORE, NO LESS
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildAuditLogs
  ]
});

const CONFIG = {
  enabled: true,
  instantBan: true,
  whitelist: [botOwnerId],
  thresholds: {
    bans: 2, kicks: 2, channels: 2, roles: 2,
    webhooks: 1, bots: 1, emojis: 3, stickers: 3
  },
  timeWindow: 15000,
  ignoreAdmins: true,
  premium: {
    premiumGuilds: new Map(),
    activationKey: 'premiumactivationgodsosixev'
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
        { name: 'Status', value: 'status' }
      ]},
      { name: 'code', type: 3, description: 'Activation key' }
    ]
  },
  {
    name: 'antinuke',
    description: 'Control Anti-Nuke',
    options: [
      { name: 'action', type: 3, required: true, choices: [
        { name: 'Enable', value: 'enable' },
        { name: 'Disable', value: 'disable' },
        { name: 'Status', value: 'status' }
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
        { name: 'List', value: 'list' }
      ]},
      { name: 'user', type: 6, required: true }
    ]
  },
  { name: 'ping', description: 'Check bot latency' },
  { name: 'protect', description: 'Protection status' }
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(botToken);
  try {
    console.log('🔄 Registering commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ ${commands.length} commands registered!`);
  } catch (e) { console.error('Command Error:', e); }
}

function isWhitelisted(userId) { return CONFIG.whitelist.includes(userId); }
function trackAction(userId, type) {
  if (!tracker.has(userId)) tracker.set(userId, []);
  const actions = tracker.get(userId).filter(a => Date.now() - a.time < CONFIG.timeWindow);
  actions.push({ type, time: Date.now() });
  tracker.set(userId, actions);
  return actions.filter(a => a.type === type).length >= CONFIG.thresholds[type];
}

async function punish(guild, executorId, reason) {
  if (!CONFIG.enabled || isWhitelisted(executorId)) return false;
  const member = await guild.members.fetch(executorId).catch(() => null);
  if (!member || member.user.bot) return false;
  if (CONFIG.ignoreAdmins && member.permissions.has(PermissionsBitField.Flags.Administrator)) return false;
  if (member.roles.highest.position >= guild.members.me.roles.highest.position) return false;
  try {
    if (CONFIG.instantBan) await member.ban({ reason: `Anti-Nuke: ${reason}` });
    else await member.kick(`Anti-Nuke: ${reason}`);
    return true;
  } catch { return false; }
}

client.on('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands();
  console.log('💎 Bot ready!');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options, user, guild } = interaction;

  if (commandName === 'premcmds') {
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor('#ffd700')
        .setTitle('💎 COMMANDS')
        .setDescription(`
/premium activate code:premiumactivationgodsosixev
/antinuke enable|disable|status
/whitelist add|remove|list @user
/ping — Check online
/protect — Full status
        `)
      ]
    });
  }

  if (commandName === 'premium') {
    const action = options.getString('action');
    if (action === 'activate') {
      if (guild.ownerId !== user.id) return interaction.reply('❌ Only server owner!', { ephemeral: true });
      if (options.getString('code') !== 'premiumactivationgodsosixev') return interaction.reply('❌ Wrong code!', { ephemeral: true });
      CONFIG.premium.premiumGuilds.set(guild.id, true);
      return interaction.reply('💎 **PREMIUM ACTIVATED!**');
    }
    if (action === 'status') {
      return interaction.reply(CONFIG.premium.premiumGuilds.has(guild.id) ? '💎 Premium: ✅ Active' : 'Premium: ❌ Not active');
    }
  }

  const ownerOnly = ['antinuke', 'whitelist'];
  if (ownerOnly.includes(commandName) && user.id !== botOwnerId) {
    return interaction.reply('❌ **ONLY BOT OWNER!**', { ephemeral: true });
  }

  if (commandName === 'antinuke') {
    const act = options.getString('action');
    if (act === 'enable') { CONFIG.enabled = true; await interaction.reply('✅ **PROTECTION ON**'); }
    if (act === 'disable') { CONFIG.enabled = false; await interaction.reply('⚠️ **PROTECTION OFF**'); }
    if (act === 'status') {
      await interaction.reply(`🛡️ Active: ${CONFIG.enabled ? '✅ YES' : '❌ NO'} | ⚡ Instant Ban: ${CONFIG.instantBan ? '✅ ON' : '❌ OFF'}`);
    }
  }

  if (commandName === 'whitelist') {
    const act = options.getString('action');
    const usr = options.getUser('user');
    if (act === 'add') { CONFIG.whitelist.push(usr.id); await interaction.reply(`✅ Whitelisted: ${usr}`); }
    if (act === 'remove') { CONFIG.whitelist = CONFIG.whitelist.filter(id => id !== usr.id); await interaction.reply(`✅ Removed: ${usr}`); }
    if (act === 'list') { await interaction.reply(`**Whitelist:**\n${CONFIG.whitelist.map(id => `<@${id}>`).join('\n')}`); }
  }

  if (commandName === 'ping') {
    await interaction.reply(`🏓 Pong! \`${client.ws.ping}ms\``);
  }

  if (commandName === 'protect') {
    await interaction.reply(`🛡️ Protection: ${CONFIG.enabled ? '✅ ON' : '❌ OFF'}\n⚡ Instant Ban: ${CONFIG.instantBan ? '✅ ON' : '❌ OFF'}\n💎 Premium: ${CONFIG.premium.premiumGuilds.has(guild.id) ? '✅ YES' : 'NO'}`);
  }
});

client.on('guildAuditLogEntryCreate', async (log) => {
  if (!CONFIG.enabled) return;
  const { action, executorId, guild } = log;
  if (!executorId || executorId === client.user.id || isWhitelisted(executorId)) return;

  let detected = false, reason = '';
  if (action === AuditLogEvent.MemberBanAdd && trackAction(executorId, 'bans')) detected = true, reason = 'Mass Ban';
  if (action === AuditLogEvent.MemberKick && trackAction(executorId, 'kicks')) detected = true, reason = 'Mass Kick';
  if ([AuditLogEvent.ChannelCreate, AuditLogEvent.ChannelDelete].includes(action) && trackAction(executorId, 'channels')) detected = true, reason = 'Channel Attack';
  if ([AuditLogEvent.RoleCreate, AuditLogEvent.RoleDelete].includes(action) && trackAction(executorId, 'roles')) detected = true, reason = 'Role Attack';
  if (action === AuditLogEvent.WebhookCreate && trackAction(executorId, 'webhooks')) detected = true, reason = 'Webhook Attack';
  if (action === AuditLogEvent.BotAdd && trackAction(executorId, 'bots')) detected = true, reason = 'Bot Nuke';

  if (detected) await punish(guild, executorId, reason);
});

client.login(botToken);