const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
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
  console.log(`已註冊指令：${Object.keys(SKILLS).join(', ')}, chat, reset`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  const cmd = interaction.commandName;

  await interaction.deferReply();

  try {
    // /reset
    if (cmd === 'reset') {
      conversations.delete(userId);
      await interaction.editReply('對話已重置。請用 `/nutrition`、`/partner` 等指令開始新對話。');
      return;
    }

    // /chat：繼續現有對話
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

    // skill 指令：開始新對話
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
