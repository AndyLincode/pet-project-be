const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');
const SqlString = require('sqlstring');

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

router.get('/conversation/:sid', async (req, res) => {
  const sql = `SELECT * FROM \`conversation\` WHERE senderId=${req.params.sid}`;

  try {
    const [res] = await db.query();
  } catch (err) {
    console.log(err.message);
  }
});

module.exports = router;
