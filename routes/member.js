const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');
const moment = require('moment-timezone'); // 日期格式(選擇性)
const upload = require(__dirname + '/../modules/upload_img');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const SqlString = require('sqlstring');

router.post('/login-api', async (req, res) => {
  const output = {
    success: false,
    error: '',
    postData: req.boby, //除錯用
    auth: {},
  };
  //判斷帳號在資料庫
  const sql = 'SELECT * FROM 	members_data WHERE account=?';
  const [rows] = await db.query(sql, [req.body.username]); // 這個質去看帳號
  if (!rows.length) {
    return res.json(output);
  }
  const row = rows[0];

  output.success = req.body.password == row['password'] ? true : false;
  if (output.success) {
    const { sid, name } = row;

    const token = jwt.sign({ sid, name }, process.env.JWT_SECRET);

    output.auth = {
      sid,
      name,
      token,
    };
    res.json(output);
  }
});

//會員新增資料
router.post('/add', upload.single('member_photo'), async (req, res) => {
  const output = {
    success: false,
    code: 0,
    error: {},
    postData: req.body, // 除錯用
  };

  const sql =
    'INSERT INTO `members_data`(`name`, `account`, `gender`, `password`,`member_photo`,`city`,`area`,`address`,`birthday`, `email`, `mobile`, `create_at`) VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())';

  const [result] = await db.query(sql, [
    req.body.name,
    req.body.account,
    req.body.gender || null,
    req.body.password,
    req.file.originalname,
    req.body.city || null,
    req.body.area || null,
    req.body.address || null,
    req.body.birthday || null,
    req.body.email || null,
    req.body.mobile || null,
  ]);

  //affectedRows有影響的列數
  console.log(result);

  if (result.affectedRows) output.success = true;
  res.json(output);
});

//修改
router.get('/edit', async (req, res) => {});
router.put('/edit', upload.none(), async (req, res) => {});

//刪除寵物資料
router.delete('/del/:sid', async (req, res) => {
  const sql = 'DELETE FROM `pet_data` WHERE sid = ?';
  const [result] = await db.query(sql, [req.params.sid]);
  res.json(result);
});

//搜尋寵物資訊 傳回前端
router.get('/data', async (req, res) => {
  const sql = 'SELECT * FROM `pet_data`';
  const [rows] = await db.query(sql);
  res.json(rows);
});

//抓掛號預約資料
async function getClinicData(req, res) {
  let sid = req.params.sid ? req.params.sid.trim() : '';

  if (sid) {
    where = `WHERE rd.member_sid = ${sid}`;
  }
  console.log(sid);
  let rows = [];

  const sql = `SELECT * FROM \`reserve_data\` rd LEFT JOIN \`clinic_data\` cd ON cd.sid = rd.clinic_sid ${where}`;

  [rows] = await db.query(sql);

  return { rows };
}

//抓城市資料
async function getCityData() {
  //全部的資料
  let where = `WHERE 1`;
  let rows = [];
  const sql = `SELECT cd.* FROM \`city_data\` cd ${where} ORDER BY cd.sid ASC`;
  [rows] = await db.query(sql);

  return { rows };
}
//抓地區資料
async function getAreaData() {
  //全部的資料
  let where = `WHERE 1`;
  let rows = [];
  const sql = `SELECT ad.* FROM \`area_data\` ad ${where} ORDER BY ad.sid ASC`;
  [rows] = await db.query(sql);

  return { rows };
}

// 抓收藏列表
async function getLovedList(req) {
  const m_sid = +req.query.m_sid;

  // 判斷登入
  if (!m_sid) {
    return res.json({ message: '請先登入', code: '401' });
  }

  const sql = `SELECT pl.*, p.img, p.name, p.price, p.member_price FROM product_loved pl JOIN products p ON p.sid=pl.p_sid WHERE pl.m_sid=?`;
  const formatSql = SqlString.format(sql, [m_sid]);
  let rows = [];
  [rows] = await db.query(formatSql);
  return { rows };
}

//抓城市資料
router.get('/citydata', async (req, res) => {
  res.json(await getCityData(req, res));
});
//抓地區資料
router.get('/areadata', async (req, res) => {
  res.json(await getAreaData(req, res));
});
//抓會員寵物資料
router.get('/petdata', async (req, res) => {});

//抓文章收藏資料
router.get('/articledata', async (req, res) => {});

//抓商品收藏資料
router.get('/productdata', async (req, res) => {
  res.json(await getLovedList(req));
});

//抓診所掛號資料
router.get('/clinicdata/:sid', async (req, res) => {
  res.json(await getClinicData(req, res));
});

//抓攝影訂單資料
router.get('/orderphotodata', async (req, res) => {});

//抓商品訂單資料
router.get('/orderproductdata', async (req, res) => {});

//修改會員資料

module.exports = router;
