const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 每位使用者的對話記錄
const conversations = new Map();

// 讀取 .md skill 檔案，移除 frontmatter
function loadSkill(fileName) {
  const filePath = path.join(__dirname, '../.claude/commands', `${fileName}.md`);
  const content = fs.readFileSync(filePath, 'utf8');
  return content.replace(/^---[\s\S]*?---\n/, '').trim();
}

// Discord 訊息上限 2000 字，截斷保留空間給提示
function truncate(text, limit = 1850) {
  return text.length > limit ? text.slice(0, limit) + '\n...(訊息過長，請用 `/chat` 繼續)' : text;
}

// 可用的 skills 對應表
const SKILLS = {
  nutrition: {
    file: 'nutrition-log-review',
    description: '分析飲食紀錄，給出可執行建議',
  },
  partner: {
    file: 'custom-work-partner',
    description: '溫柔陪跑者，幫你找解決方法',
  },
  route: {
    file: 'route-planner',
    description: '規劃交通路線與建議出發時間',
  },
};

// ── 提醒功能 ──────────────────────────────────────────────

const REMINDERS_FILE = path.join(__dirname, 'reminders.json');

function loadReminders() {
  if (fs.existsSync(REMINDERS_FILE)) {
    return JSON.parse(fs.readFileSync(REMINDERS_FILE, 'utf8'));
  }
  return [];
}

function saveReminders(reminders) {
  fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2), 'utf8');
}

// 給定事件日期，回傳前一天 22:00 台灣時間的 UTC timestamp (ms)
function calcReminderTime(eventDateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDateStr)) return null;
  const [y, m, d] = eventDateStr.split('-').map(Number);
  const eventDate = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(eventDate)) return null;
  // 前一天 22:00 UTC+8 = 前一天 14:00 UTC
  const prevDay = new Date(eventDate);
  prevDay.setUTCDate(prevDay.getUTCDate() - 1);
  prevDay.setUTCHours(14, 0, 0, 0); // 22:00 UTC+8
  return prevDay.getTime();
}

// setTimeout 最大值約 24.8 天，超過需分段遞迴
const MAX_TIMEOUT_MS = 2147483647;

async function fireReminder(reminder) {
  const channel = client.channels.cache.get(reminder.channelId);
  if (channel) {
    const embed = new EmbedBuilder()
      .setTitle('⏰ 提醒')
      .setDescription(reminder.message)
      .setColor(0x5865f2)
      .setFooter({ text: `由 ${reminder.userName} 設定` })
      .setTimestamp();
    await channel.send({ content: `<@${reminder.userId}>`, embeds: [embed] }).catch(() => {});
  }
  saveReminders(loadReminders().filter(r => r.id !== reminder.id));
}

function scheduleReminder(reminder) {
  const delay = reminder.remindAt - Date.now();
  if (delay <= 0) return;
  const wait = Math.min(delay, MAX_TIMEOUT_MS);
  setTimeout(() => {
    if (wait < delay) {
      scheduleReminder(reminder); // 還沒到，繼續等
    } else {
      fireReminder(reminder);
    }
  }, wait);
}

// ─────────────────────────────────────────────────────────

// 建立 slash commands 定義
const commandDefs = Object.entries(SKILLS).map(([name, skill]) =>
  new SlashCommandBuilder()
    .setName(name)
    .setDescription(skill.description)
    .addStringOption((opt) =>
      opt.setName('message').setDescription('你想說什麼').setRequired(true)
    )
    .toJSON()
);

// /chat：繼續目前對話
commandDefs.push(
  new SlashCommandBuilder()
    .setName('chat')
    .setDescription('繼續與目前的 skill 對話')
    .addStringOption((opt) =>
      opt.setName('message').setDescription('你的訊息').setRequired(true)
    )
    .toJSON()
);

// /reset：清除對話記錄
commandDefs.push(
  new SlashCommandBuilder()
    .setName('reset')
    .setDescription('重置對話，切換新的 skill')
    .toJSON()
);

// /remind：設定提醒
commandDefs.push(
  new SlashCommandBuilder()
    .setName('remind')
    .setDescription('設定提醒，將在事件前一天晚上 22:00（台灣時間）發送')
    .addStringOption((opt) =>
      opt.setName('date').setDescription('事件日期，格式 YYYY-MM-DD，例如 2026-05-10').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('message').setDescription('提醒內容').setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('發送到哪個頻道（預設：當前頻道）')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .toJSON()
);

// /reminders：查看所有待發送的提醒
commandDefs.push(
  new SlashCommandBuilder()
    .setName('reminders')
    .setDescription('查看你所有待發送的提醒')
    .toJSON()
);

// 呼叫 Claude API
async function callClaude(systemPrompt, messages) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });
  return response.content[0].text;
}

client.once('ready', async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), {
    body: commandDefs,
  });
  console.log(`Bot 已上線：${client.user.tag}`);
  console.log(`已註冊指令：${Object.keys(SKILLS).join(', ')}, chat, reset, remind, reminders`);

  // 載入並排程所有已存在的提醒
  const reminders = loadReminders();
  reminders.forEach(scheduleReminder);
  console.log(`已排程 ${reminders.length} 個提醒`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  const cmd = interaction.commandName;

  // ── /remind ──────────────────────────────────────────────
  if (cmd === 'remind') {
    const dateStr = interaction.options.getString('date');
    const message = interaction.options.getString('message');
    const targetChannel =
      interaction.options.getChannel('channel') ??
      (process.env.REMINDER_CHANNEL_ID
        ? client.channels.cache.get(process.env.REMINDER_CHANNEL_ID)
        : null) ??
      interaction.channel;

    const remindAt = calcReminderTime(dateStr);

    if (!remindAt) {
      await interaction.reply({
        content: '❌ 日期格式錯誤！請使用 `YYYY-MM-DD`，例如 `2026-05-10`。',
        ephemeral: true,
      });
      return;
    }

    if (remindAt <= Date.now()) {
      await interaction.reply({
        content: '❌ 事件日期太近，前一天 22:00 已過！請設定至少後天以後的日期。',
        ephemeral: true,
      });
      return;
    }

    const id = `${userId}-${Date.now()}`;
    const reminder = {
      id,
      userId,
      userName: interaction.user.username,
      channelId: targetChannel.id,
      message,
      eventDate: dateStr,
      remindAt,
    };

    const reminders = loadReminders();
    reminders.push(reminder);
    saveReminders(reminders);
    scheduleReminder(reminder);

    const displayRemindTime = new Date(remindAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

    const embed = new EmbedBuilder()
      .setTitle('✅ 提醒已設定')
      .addFields(
        { name: '📅 事件日期', value: dateStr, inline: true },
        { name: '📍 頻道', value: `<#${targetChannel.id}>`, inline: true },
        { name: '💬 內容', value: message },
        { name: '⏰ 提醒時間', value: `${displayRemindTime}（前一天晚上 22:00）` }
      )
      .setColor(0x57f287)
      .setFooter({ text: `ID: ${id}` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // ── /reminders ───────────────────────────────────────────
  if (cmd === 'reminders') {
    const reminders = loadReminders().filter(r => r.userId === userId);

    if (reminders.length === 0) {
      await interaction.reply({ content: '📭 你目前沒有任何待發送的提醒。', ephemeral: true });
      return;
    }

    const sorted = reminders.sort((a, b) => a.remindAt - b.remindAt);
    const embed = new EmbedBuilder()
      .setTitle('📋 你的提醒清單')
      .setColor(0x5865f2);

    for (const r of sorted) {
      const eventDate = r.eventDate ?? '未知';
      const remindTime = new Date(r.remindAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
      embed.addFields({
        name: `📅 事件：${eventDate}　⏰ 提醒：${remindTime}`,
        value: `💬 ${r.message}\n📍 <#${r.channelId}>`,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // ── 其餘 skill 指令 ───────────────────────────────────────
  await interaction.deferReply();

  try {
    if (cmd === 'reset') {
      conversations.delete(userId);
      await interaction.editReply('對話已重置。請用 `/nutrition`、`/partner` 等指令開始新對話。');
      return;
    }

    if (cmd === 'chat') {
      const session = conversations.get(userId);
      if (!session) {
        await interaction.editReply(
          '目前沒有進行中的對話。請先用 `/nutrition`、`/partner` 等指令開始。'
        );
        return;
      }
      const userMessage = interaction.options.getString('message');
      session.messages.push({ role: 'user', content: userMessage });

      const reply = await callClaude(session.systemPrompt, session.messages);
      session.messages.push({ role: 'assistant', content: reply });

      await interaction.editReply(truncate(reply));
      return;
    }

    const skill = SKILLS[cmd];
    const systemPrompt = loadSkill(skill.file);
    const userMessage = interaction.options.getString('message');
    const messages = [{ role: 'user', content: userMessage }];

    const reply = await callClaude(systemPrompt, messages);
    messages.push({ role: 'assistant', content: reply });

    conversations.set(userId, { systemPrompt, messages });

    const hint = '\n\n> 繼續對話請用 `/chat`，重置請用 `/reset`';
    await interaction.editReply(truncate(reply) + hint);
  } catch (err) {
    console.error(err);
    await interaction.editReply('發生錯誤，請稍後再試。');
  }
});

client.login(process.env.DISCORD_TOKEN);
