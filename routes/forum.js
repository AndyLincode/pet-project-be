const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');

async function getArticles(req, res) {
  // 抓文章
  const a_sql = `SELECT a.*,m.name user FROM \`article\` a JOIN members_data m ON a.m_sid=m.sid WHERE 1`;

  let rows = [];
  [rows] = await db.query(a_sql);

  // 抓tags
  const t_sql = `SELECT ta.a_sid, t.tag_name FROM tag_article ta JOIN tag t ON t.sid=ta.t_sid WHERE 1`;
  let tags = [];
  [tags] = await db.query(t_sql);

  return { rows, tags };
}

async function getArticleDetail(req, res) {
  let where = ' WHERE 1';
  // 攝影師表單
  let sid = req.query.sid ? req.query.sid.trim() : '';
  if (sid) {
    where = `WHERE a.article_sid =${sid}`;
  }
  // 抓文章詳細
  const sql = `SELECT a.*,m.name user FROM \`article\` a JOIN members_data m ON a.m_sid=m.sid ${where}`;

  let details = [];
  details = await db.query(sql);

  return { details };
}

router.get('/articles', async (req, res) => {
  const data = await getArticles(req, res);

  res.json(data);
});
router.get('/details', async (req, res) => {
  const data = await getArticleDetail(req, res);

  res.json(data);
});

module.exports = router;
