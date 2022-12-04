const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');

const getConversations = async (req, res) => {
  const sql = `SELECT c.*, m.name senderName, m.member_photo senderImg FROM \`conversation\` c JOIN members_data m ON m.sid=c.senderId WHERE receiverId=${req.params.sid}`;
  const r_sql = `SELECT c.*, m.name receiverName, m.member_photo receiverImg FROM \`conversation\` c JOIN members_data m ON m.sid=c.receiverId WHERE senderId=${req.params.sid}`;

  try {
    const [result] = await db.query(sql);
    const [receiver] = await db.query(r_sql);

    return { result, receiver };
  } catch (err) {
    console.log(err.message);
  }
};

// new conversation
router.post('/newConversation', async (req, res) => {
  const data = req.body;
  const newConversation = { ...data };

  const sql = `INSERT INTO \`conversation\`( \`senderId\`, \`receiverId\`, \`created_at\`) VALUES (?,?,NOW())`;

  try {
    const [result] = await db.query(sql, [
      newConversation.senderId,
      newConversation.receiverId,
    ]);
    res.json(result);
  } catch (err) {
    console.log(err.message);
  }
});

// getConversations
router.get('/conversation/:sid', async (req, res) => {
  const data = await getConversations(req);

  res.json(data);
});

// new messages
router.post('/newMessage', async (req, res) => {
  const data = req.body;
  const newMessage = { ...data };

  const sql = `INSERT INTO messages( conversation_sid, sender_sid, messages, created_at) VALUES (?,?,?,NOW())`;

  try {
    const [result] = await db.query(sql, [
      newMessage.conversationId,
      newMessage.senderId,
      newMessage.messages,
    ]);
    res.json(result);
  } catch (err) {
    console.log(err.message);
  }
});

// get messages
router.get('/messages/:sid', async (req, res) => {
  const sql = `SELECT m.*,member.name sender FROM \`messages\` m JOIN members_data member ON member.sid=m.sender_sid WHERE m.conversation_sid=${req.params.sid} `;
  try {
    const [result] = await db.query(sql);

    res.json(result);
  } catch (err) {
    console.log(err.message);
  }
});

module.exports = router;
