const { 
  Client, 
  GatewayIntentBits, 
  AuditLogEvent, 
  EmbedBuilder, 
  REST, 
  Routes, 
  PermissionsBitField 
} = require('discord.js');

// === ENVIRONMENT VARIABLES ===
const env = process.env;
const botToken = env.token;
const botOwnerId = env.ownerId;
const logChId = env.logChannelId || '';

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
  punishRole: true,
  punishChannel: true,
  punishWebhook: true,
  punishBan: true,
  punishKick: true,
  punishBotAdd: true,
  punishEmoji: true,
  punishSticker: true,
  thresholds: {
    bans: 2, kicks: 2, channels: 2, roles: 2, 
    webhooks: 1, bots: 1, emojis: 3, stickers: 3
  },
  timeWindow: 15000,
  ignoreAdmins: true,
  premium: {
    enabled: true,
    premiumGuilds: new Map(),
    premiumUsers: new Set([botOwnerId]),
    activationKey: 'premiumactivationgodsosixev',
    pfpChangeCooldown: 300000
  }
};

const tracker = new Map();

const commands = [
  { name: 'premcmds', description: '📋 Show all Premium available commands' },
  {
    name: 'premium',
    description: 'Premium features & activation',
    options: [
      { name: 'action', type: 3, required: true, choices: [
        { name: 'Activate', value: 'activate' },
        { name: 'Status', value: 'status' },
        { name: 'Set Avatar', value: 'setavatar' },
        { name: 'Remove Avatar', value: 'removeavatar' },
        { name: 'List Premium', value: 'list' }
      ]},
      { name: 'code', type: 3, description: 'Your premium activation key' },
      { name: 'image', type: 11, description: 'Upload image for custom avatar' }
    ]
  },
  {
    name: 'antinuke',
    description: 'Control Anti-Nuke system',
    options: [
      { name: 'action', type: 3, required: true, choices: [
        { name: 'Enable', value: 'enable' },
        { name: 'Disable', value: 'disable' },
        { name: 'Status', value: 'status' },
        { name: 'Reset All', value: 'reset' }
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
        { name: 'Clear All', value: 'clear' }
      ]},
      { name: 'user', type: 6 }
    ]
  },
  {
    name: 'threshold',
    description: 'Set trigger limits',
    options: [
      { name: 'type', type: 3, required: true, choices: [
        { name: 'Ban Trigger', value: 'bans' },
        { name: 'Kick Trigger', value: 'kicks' },
        { name: 'Channel Trigger', value: 'channels' },
        { name: 'Role Trigger', value: 'roles' },
        { name: 'Webhook Trigger', value: 'webhooks' },
        { name: 'Bot Add Trigger', value: 'bots' }
      ]},
      { name: 'count', type: 4, required: true }
    ]
  },
  {
    name: 'instantban',
    description: 'Toggle instant ban mode',
    options: [
      { name: 'mode', type: 3, required: true, choices: [
        { name: 'ON — Ban Immediately', value: 'on' },
        { name: 'OFF — Kick Only', value: 'off' }
      ]}
    ]
  },
  { name: 'ping', description: 'Check bot latency' },
  { name: 'help', description: 'Show all commands' },
  { name: 'nukecheck', description: 'Scan for dangerous permissions' },
  { name: 'protect', description: 'Full server protection status' }
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(botToken);
  try {
    console.log('🔄 Registering commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ ${commands.length} commands registered!`);
  } catch (e) { console.error('Command Error:', e); }
}

function isPremiumGuild(guildId) { return CONFIG.premium.premiumGuilds.has(guildId); }
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
    if (CONFIG.instantBan) await member.ban({ reason: `🛡️ ANTI-NUKE: ${reason}` });
    else await member.kick(`🛡️ ANTI-NUKE: ${reason}`);
    return true;
  } catch { return false; }
}

async function sendLog(guild, executorId, actionType, punished) {
  if (!logChId) return;
  const channel = await client.channels.fetch(logChId).catch(() => null);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setColor(punished ? 'Red' : 'Yellow')
    .setTitle(punished ? '🚨 INSTANT BAN — NUKE DETECTED' : '⚠️ Suspicious Activity')
    .addFields(
      { name: 'User', value: `<@${executorId}> \`${executorId}\`` },
      { name: 'Action', value: actionType.toUpperCase() },
      { name: 'Result', value: punished ? '✅ BANNED' : '⚠️ Not banned' }
    )
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
}

client.on('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands();
  console.log(`💎 /premcmds ready! | Log Channel: ${logChId ? '✅ Set' : '⚠️ Not set — skipping logs'}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options, user, guild } = interaction;

  if (commandName === 'premcmds') {
    return interaction.reply({ embeds: [new EmbedBuilder()
      .setColor('Gold')
      .setTitle('💎 PREMIUM — AVAILABLE COMMANDS')
      .setDescription(`
**🔓 ACTIVATION**
\`/premium activate code:premiumactivationgodsosixev\` — Unlock Premium features
\`/premium status\` — Check Premium status here

**🖼️ CUSTOMIZATION**
\`/premium setavatar image:\` — Set custom server avatar
\`/premium removeavatar\` — Revert to default

**📊 BOT OWNER ONLY**
\`/premium list\` — All Premium servers

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**🛡️ FREE ANTI-NUKE COMMANDS**
\`/antinuke enable|disable|status\`
\`/whitelist add|remove|list|clear\`
\`/threshold <type> <count>\`
\`/instantban on|off\`
\`/nukecheck\` — Scan for threats
\`/protect\` — Full protection status
      `)
      .setFooter({ text: 'Your Key: premiumactivationgodsosixev' })
      .setTimestamp()
    ]});
  }

  if (commandName === 'premium') {
    const action = options.getString('action');
    const isGuildOwner = guild.ownerId === user.id;

    if (action === 'activate') {
      if (!isGuildOwner && !CONFIG.premium.premiumUsers.has(user.id)) {
        return interaction.reply({ content: '❌ **Only server owner can activate Premium!**', ephemeral: true });
      }
      const code = options.getString('code');
      if (code !== CONFIG.premium.activationKey) {
        return interaction.reply({ content: '❌ **Invalid Premium code!**', ephemeral: true });
      }
      if (isPremiumGuild(guild.id)) {
        return interaction.reply({ content: '✅ **Premium already active!**', ephemeral: true });
      }
      CONFIG.premium.premiumGuilds.set(guild.id, {
        activatedAt: Date.now(),
        pfpUrl: null,
        activatedBy: user.id
      });
      return interaction.reply({ embeds: [new EmbedBuilder()
        .setColor('Gold')
        .setTitle('💎 PREMIUM ACTIVATED!')
        .setDescription(`
✅ **Premium successfully enabled!**

**Unlocked:**
• 🖼️ Custom Server Avatar — \`/premium setavatar\`
• 💎 Premium Status Badge — shows in all status commands

**Next:** Type \`/premcmds\` to see everything!
        `)
      ]});
    }

    if (action === 'status') {
      const data = CONFIG.premium.premiumGuilds.get(guild.id);
      return interaction.reply({ embeds: [new EmbedBuilder()
        .setColor(data ? 'Gold' : 'Gray')
        .setTitle('💎 Premium Status')
        .setDescription(data ? `✅ **ACTIVE** — Activated <t:${Math.floor(data.activatedAt/1000)}:R>` : '❌ Not Active')
      ]});
    }

    if (action === 'setavatar') {
      if (!isPremiumGuild(guild.id)) return interaction.reply({ content: '❌ Premium required!', ephemeral: true });
      if (!isGuildOwner) return interaction.reply({ content: '❌ Only server owner can change this!', ephemeral: true });
      const attachment = options.getAttachment('image');
      if (!attachment || !attachment.contentType?.startsWith('image/')) {
        return interaction.reply({ content: '❌ Upload a valid image file!', ephemeral: true });
      }
      const data = CONFIG.premium.premiumGuilds.get(guild.id);
      data.pfpUrl = attachment.url;
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setTitle('🖼️ Avatar Saved!').setDescription('✅ Custom server avatar set').setImage(attachment.url)] });
    }

    if (action === 'removeavatar') {
      if (!isPremiumGuild(guild.id)) return interaction.reply({ content: '❌ Premium required!', ephemeral: true });
      if (!isGuildOwner) return interaction.reply({ content: '❌ Only server owner!', ephemeral: true });
      const data = CONFIG.premium.premiumGuilds.get(guild.id);
      data.pfpUrl = null;
      return interaction.reply('✅ **Avatar removed — using default**');
    }

    if (action === 'list') {
      if (user.id !== botOwnerId) return interaction.reply({ content: '❌ Owner only!', ephemeral: true });
      const list = Array.from(CONFIG.premium.premiumGuilds.keys()).map(id => `• \`${id}\``).join('\n') || 'None';
      return interaction.reply(`**💎 Premium Servers:**\n${list}`);
    }
    return;
  }

  const ownerOnly = ['antinuke', 'whitelist', 'threshold', 'instantban', 'nukecheck', 'protect'];
  if (ownerOnly.includes(commandName) && user.id !== botOwnerId) {
    return interaction.reply({ content: '❌ **ONLY BOT OWNER CAN USE THIS!**', ephemeral: true });
  }

  if (commandName === 'antinuke') {
    const act = options.getString('action');
    if (act === 'enable') { CONFIG.enabled = true; await interaction.reply('✅ **ANTI-NUKE ENABLED**'); }
    if (act === 'disable') { CONFIG.enabled = false; await interaction.reply('⚠️ **ANTI-NUKE DISABLED**'); }
    if (act === 'status') {
      await interaction.reply(`
🛡️ **STATUS**
Protection: ${CONFIG.enabled ? '✅ ON' : '❌ OFF'}
Instant Ban: ${CONFIG.instantBan ? '✅ ON' : '❌ OFF'}
Premium: ${isPremiumGuild(guild.id) ? '💎 ACTIVE' : 'Free'}
Log Channel: ${logChId ? '✅ Set' : '⚠️ Not configured'}
      `);
    }
    if (act === 'reset') {
      CONFIG.thresholds = { bans:2, kicks:2, channels:2, roles:2, webhooks:1, bots:1, emojis:3, stickers:3 };
      CONFIG.timeWindow = 15000;
      CONFIG.instantBan = true;
      await interaction.reply('✅ **All settings reset**');
    }
  }

  if (commandName === 'whitelist') {
    const act = options.getString('action');
    const usr = options.getUser('user');
    if (act === 'add' && usr) { CONFIG.whitelist.push(usr.id); await interaction.reply(`✅ Whitelisted: ${usr}`); }
    if (act === 'remove' && usr) { CONFIG.whitelist = CONFIG.whitelist.filter(id => id !== usr.id); await interaction.reply(`✅ Removed: ${usr}`); }
    if (act === 'list') { const list = CONFIG.whitelist.map(id => `<@${id}>`).join('\n'); await interaction.reply(`**Whitelist:**\n${list || 'None'}`); }
    if (act === 'clear') { CONFIG.whitelist = [botOwnerId]; await interaction.reply('✅ Cleared — only owner remains'); }
  }

  if (commandName === 'threshold') {
    const type = options.getString('type');
    const count = options.getInteger('count');
    CONFIG.thresholds[type] = count;
    await interaction.reply(`✅ **${type.toUpperCase()} → ${count} = Instant Ban**`);
  }

  if (commandName === 'instantban') {
    CONFIG.instantBan = options.getString('mode') === 'on';
    await interaction.reply(CONFIG.instantBan ? '⚡ **INSTANT BAN ACTIVE**' : '⚠️ **KICK ONLY**');
  }

  if (commandName === 'ping') {
    await interaction.reply(`🏓 Pong! \`${client.ws.ping}ms\``);
  }

  if (commandName === 'help') {
    await interaction.reply(`
🛡️ **ANTI-NUKE + PREMIUM**
\`/premcmds\` — Full Premium Commands
\`/antinuke enable|disable|status\`
\`/whitelist add|remove|list\`
\`/threshold <type> <count>\`
\`/instantban on|off\`
\`/nukecheck\` — Scan for threats
    `, { ephemeral: true });
  }

  if (commandName === 'nukecheck') {
    const dangerous = [];
    const roles = await guild.roles.fetch();
    for (const [, role] of roles) {
      if (role.permissions.has(PermissionsBitField.Flags.Administrator) && !role.managed) dangerous.push(`⚠️ ${role.name} — ADMIN`);
      if (role.permissions.has(PermissionsBitField.Flags.BanMembers)) dangerous.push(`⚠️ ${role.name} — Ban Members`);
    }
    await interaction.reply(`🔍 **SCAN RESULTS:**\n${dangerous.length ? dangerous.join('\n') : '✅ No dangerous roles!'}`);
  }

  if (commandName === 'protect') {
    await interaction.reply(`🛡️ **PROTECTION: ${CONFIG.enabled ? '✅ ON' : '❌ OFF'}** | ⚡ **INSTANT BAN: ${CONFIG.instantBan ? '✅ ON' : '❌ OFF'}** | 💎 **PREMIUM: ${isPremiumGuild(guild.id) ? '✅ ACTIVE' : 'Free'}** | 📋 **LOGS: ${logChId ? '✅ ON' : '⚠️ OFF'}**`);
  }
});

client.on('guildAuditLogEntryCreate', async entry => {
  if (!CONFIG.enabled) return;
  const { action, executorId, guild } = entry;
  if (!executorId || executorId === client.user.id || isWhitelisted(executorId)) return;

  let detected = false, actionType = '';
  if (action === AuditLogEvent.MemberBanAdd && trackAction(executorId, 'bans')) detected = true, actionType = 'Mass Ban';
  if (action === AuditLogEvent.MemberKick && trackAction(executorId, 'kicks')) detected = true, actionType = 'Mass Kick';
  if ([AuditLogEvent.ChannelCreate, AuditLogEvent.ChannelDelete].includes(action) && trackAction(executorId, 'channels')) detected = true, actionType = 'Channel Attack';
  if ([AuditLogEvent.RoleCreate, AuditLogEvent.RoleDelete].includes(action) && trackAction(executorId, 'roles')) detected = true, actionType = 'Role Attack';
  if (action === AuditLogEvent.WebhookCreate && trackAction(executorId, 'webhooks')) detected = true, actionType = 'Webhook Attack';
  if (action === AuditLogEvent.BotAdd && trackAction(executorId, 'bots')) detected = true, actionType = 'Bot Nuke';

  if (detected) {
    const punished = await punish(guild, executorId, `${actionType} — Limit Exceeded`);
    await sendLog(guild, executorId, actionType, punished);
  }
});

client.login(botToken);
client.login(botToken);