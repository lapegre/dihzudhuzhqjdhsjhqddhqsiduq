// bot.js — La Pègre · Log Bot
// npm install discord.js firebase-admin
// node bot.js

const { Client, GatewayIntentBits } = require('discord.js');
const admin = require('firebase-admin');

// ── CONFIG ─────────────────────────────────────────────────────────────────
const LOG_CHANNEL_ID = ['1439269158356258847', '1439269286173479052', '1440547576985157772'];  // le canal où le webhook poste les logs

const serviceAccount = require('./serviceAccountKey.json'); // clé Firebase Admin SDK
admin.initializeApp({ credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://lapegre-fe080-default-rtdb.europe-west1.firebasedatabase.app' });
const db = admin.database();
// ──────────────────────────────────────────────────────────────────────────

const DRUG_KEYWORDS = ['Cannabis','Coke','Cocaine','Weed','Heroine','Héroïne','Héro','Meth',
  'Xanax','Mdma','Lsd','Ecstasy','Crack','Meth Bleu','BlackTrip','SporeX','Carte Prépayée'];
const ACTION_MAP = {
  'Boitier darknet':    'Commande tablette',
  'Outil de crochettage':'Cambu',
  'Boîtier de piratage':'Atm',
  'Perceuse':'Fleeca',
};

function detectAction(txt) {
  const low = txt.toLowerCase();
  for (const [kw, label] of Object.entries(ACTION_MAP)) {
    if (low.includes(kw)) return label;
  }
  if (DRUG_KEYWORDS.some(d => low.includes(d))) return 'drug';
  return null;
}

// Parse un message du type :
// "Coffre fort Nord\nDimitri Valonshki a retiré 10x Cannabis."
function parseLog(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  let coffre = null, who = null, action = null;

  // Première ligne = nom du coffre si elle ne contient pas " a "
  if (lines.length >= 2 && !lines[0].includes(' a ')) {
    coffre = lines[0];
    const rest = lines.slice(1).join(' ');
    const m = rest.match(/^(.+?)\s+a\s+(.+)$/i);
    if (m) { who = m[1].trim(); action = m[2].trim(); }
  } else {
    const full = lines.join(' ');
    const m = full.match(/^(.+?)\s+a\s+(.+)$/i);
    if (m) { who = m[1].trim(); action = m[2].trim(); }
  }

  return { coffre, who, action };
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on('ready', () => console.log(`✓ Connecté en tant que ${client.user.tag}`));

client.on('messageCreate', async msg => {
  if (!LOG_CHANNEL_IDS.includes(msg.channelId)) return;
  // Accepte messages de webhook ou de bot
  const content = msg.content || (msg.embeds[0]?.description ?? '');
  if (!content) return;

  const { coffre, who, action } = parseLog(content);
  if (!who || !action) return;

  const now = new Date();
  const time = now.toTimeString().slice(0, 5);
  const detectedAction = detectAction(action);

  const entry = { coffre, who, action, detectedAction, time, ts: Date.now() };

  const ref = db.ref('logs');
  const snap = await ref.once('value');
  const current = snap.val() || [];
  const arr = Array.isArray(current) ? current : Object.values(current);
  arr.push(entry);
  // Garder max 200 entrées
  if (arr.length > 200) arr.splice(0, arr.length - 200);
  await ref.set(arr);
});

client.login(process.env.DISCORD_TOKEN);
