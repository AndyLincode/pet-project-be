const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');
const upload = require(__dirname + '/../modules/upload_img');

async function getArticles(req, res) {
  // 抓文章
  const a_sql = `SELECT a.*,m.name user FROM \`article\` a JOIN members_data m ON a.m_sid=m.sid WHERE 1 ORDER BY article_sid DESC`;

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
  const sql = `SELECT a.*,m.name user FROM \`article\` a JOIN members_data m ON a.m_sid=m.sid ${where} `;

  let details = [];
  details = await db.query(sql);
  // 留言內容
  // if (rows[0]) {
  const c_sql = `SELECT r.*, m.member_photo FROM \`reply\` r JOIN members_data m ON m.sid=r.m_sid WHERE r.a_sid=${sid}`;

  [forum_comment] = await db.query(c_sql);
  // }

  return { details, forum_comment };
}

router.get('/articles', async (req, res) => {
  const data = await getArticles(req, res);

  res.json(data);
});
router.get('/details', async (req, res) => {
  const data = await getArticleDetail(req, res);

  res.json(data);
});

// 回覆
// const replySql =
//   'INSERT INTO `reply`( `a_sid`, `m_sid`, `r_content`, `created_at`) VALUES (?,?,?,NOW())';
// const [result] = await db.query(replySql, [
//   req.body.a_sid,
//   req.body.m_sid,
//   req.body.r_content,
// ]);
// console.log(result);
// if (result.affectedRows) {
//   output.success = true;
//   output.sid = result.insertId;
// }
// console.log(output);
// res.json(output);

// 發文
router.post('/forum_post', upload.none(), async (req, res) => {
  const output = {
    success: false,
    code: 0,
    error: {},
    postData: req.body,
  };
  console.log(req.body.title);
  const messSql =
    'INSERT INTO `article`( `title`, `category`, `content`, `m_sid`,  `created_at`) VALUES (?,?,?,?,NOW())';
  const [result] = await db.query(messSql, [
    req.body.title,
    req.body.category,
    req.body.content,
    req.body.m_sid,
  ]);
  console.log(result);
  if (result.affectedRows) {
    output.success = true;
    output.sid = result.insertId;
  }
  console.log(output);
  res.json(output);
});
router.get('/allReply', async (req, res) => {
  console.log(req.query.message, req.query.sid);
  const sql = 'UPDATE `article` SET `a_reply`=? WHERE article_sid=? ';
  const [rows] = await db.query(sql, [req.query.message, req.query.sid]);
  res.json(rows);
});

module.exports = router;
