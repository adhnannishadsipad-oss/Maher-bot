const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log('Maher Bot running on port ' + PORT));

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

let messages = [];
let analysis = { subjects: [], assignments: [], exams: [], notes: [], totalMessages: 0, lastUpdated: null };

function analyze() {
  const aMap = {}, eMap = {}, notes = [];
  const subjects = new Set();
  const aWords = ['assignment','homework','submit','due','deadline','task','project','report'];
  const eWords = ['exam','test','quiz','midterm','final','viva','practical'];
  const nWords = ['lecture','notes','slide','pdf','chapter','syllabus','material'];
  const dateRx = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*|today|tomorrow|monday|tuesday|wednesday|thursday|friday)/gi;
  const subRx = /(maths?|physics|chemistry|biology|english|computer|science|economics|programming|java|python|networks?|databases?|algorithms?)/gi;

  for (const m of messages) {
    const low = m.text.toLowerCase();
    const subs = (m.text.match(subRx) || []).map(s => s[0].toUpperCase() + s.slice(1).toLowerCase());
    const date = (m.text.match(dateRx) || [])[0] || null;
    subs.forEach(s => subjects.add(s));
    const isAssign = aWords.some(w => low.includes(w));
    const isExam = eWords.some(w => low.includes(w));
    const isNote = nWords.some(w => low.includes(w));
    if (isAssign) {
      const k = (subs[0]||'General') + (date||m.text.slice(0,15));
      if (!aMap[k]) aMap[k] = { subject: subs[0]||'General', text: m.text.slice(0,120), deadline: date||'No date', group: m.group, time: m.time, done: false };
    } else if (isExam) {
      const k = (subs[0]||'General') + 'exam' + (date||'');
      if (!eMap[k]) eMap[k] = { subject: subs[0]||'General', text: m.text.slice(0,120), date: date||'TBC', group: m.group, time: m.time };
    } else if (isNote) {
      notes.push({ subject: subs[0]||'General', text: m.text.slice(0,100), group: m.group, time: m.time });
    }
  }
  analysis = { subjects: [...subjects], assignments: Object.values(aMap).slice(0,20), exams: Object.values(eMap).slice(0,10), notes: notes.slice(0,15), totalMessages: messages.length, lastUpdated: new Date().toISOString() };
}

bot.on('message', msg => {
  if (!msg.text) return;
  if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') return;
  messages.push({ text: msg.text, group: msg.chat.title || 'Group', time: new Date(msg.date * 1000).toISOString() });
  if (messages.length > 500) messages = messages.slice(-500);
  if (messages.length % 5 === 0) analyze();
});

bot.onText(/\/start/, msg => bot.sendMessage(msg.chat.id, '👋 Maher College Bot is active!\n\nAdd me to your college groups as admin.\n\n/status - Stats\n/summary - Summary'));
bot.onText(/\/status/, msg => bot.sendMessage(msg.chat.id, `📊 Tracking ${messages.length} messages\n📋 ${analysis.assignments.length} assignments\n📅 ${analysis.exams.length} exams\n📚 Subjects: ${analysis.subjects.join(', ') || 'none yet'}`));
bot.onText(/\/summary/, msg => {
  let t = '📚 Summary:\n\n';
  if (analysis.assignments.length) { t += '📋 Assignments:\n'; analysis.assignments.slice(0,3).forEach(a => { t += `• ${a.subject} — ${a.deadline}\n`; }); }
  if (analysis.exams.length) { t += '\n📅 Exams:\n'; analysis.exams.slice(0,3).forEach(e => { t += `• ${e.subject} — ${e.date}\n`; }); }
  if (!analysis.assignments.length && !analysis.exams.length) t += 'Nothing detected yet!';
  bot.sendMessage(msg.chat.id, t);
});

app.get('/', (req, res) => res.json({ status: 'Maher Bot running ✅', messages: messages.length }));
app.get('/api/analysis', (req, res) => { if (!analysis.lastUpdated && messages.length) analyze(); res.json(analysis); });
app.post('/api/mark-done', (req, res) => { if (analysis.assignments[req.body.index]) analysis.assignments[req.body.index].done = true; res.json({ success: true }); });

bot.on('polling_error', err => console.error('Bot error:', err.message));
