const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');
const jwt = require('jsonwebtoken');
const moment = require('moment-timezone'); // 日期格式(選擇性)

router.use((req, res, next) => {
  next();
});

//資料表導入(clinic)
async function getListData(req, res) {
  //全部的資料
  let where = `WHERE 1`;
  let rows = [];
  const sql = `SELECT cd.*,od.code FROM \`clinic_data\` cd JOIN \`code_data\` od ON cd.code=od.sid ${where} ORDER BY cd.sid ASC`;
  [rows] = await db.query(sql);

  return { rows };
}

async function getClinicData(req, res) {
  //診所細節頁
  let sid = req.params.sid ? req.params.sid.trim() : '';

  if (sid) {
    where = `WHERE cd.sid = ${sid}`;
  }

  let rows = [];

  const t_sql = `SELECT cd.*,od.code FROM \`clinic_data\` cd LEFT JOIN \`code_data\` od ON cd.code=od.sid ${where}`;

  [rows] = await db.query(t_sql);

  return { rows };
}

async function getCityData() {
  //全部的資料
  let where = `WHERE 1`;
  let rows = [];
  const sql = `SELECT cd.* FROM \`city_data\` cd ${where} ORDER BY cd.sid ASC`;
  [rows] = await db.query(sql);

  return { rows };
}

async function getAreaData() {
  //全部的資料
  let where = `WHERE 1`;
  let rows = [];
  const sql = `SELECT ad.* FROM \`area_data\` ad ${where} ORDER BY ad.sid ASC`;
  [rows] = await db.query(sql);

  return { rows };
}

async function getMemberData(req, res) {
  let sid = req.params.sid ? req.params.sid.trim() : '';
  // console.log(sid);

  let where = `WHERE md.sid = ${sid}`;

  let rows = [];

  const t_sql = `SELECT md.*,cd.*,ad.* FROM \`members_data\` md LEFT JOIN \`contact_data\` cd  ON md.sid=cd.sid LEFT JOIN \`address_data\` ad ON md.sid=ad.sid ${where}`;

  [rows] = await db.query(t_sql);

  return { rows };
}

async function getPetData(req,res) {
  let sid = req.params.sid ? req.params.sid.trim() : '';

  let where = `WHERE pd.member_sid = ${sid}`;

  let rows = [];

  const t_sql = `SELECT pd.* FROM \`pet_data\` pd ${where}`;

  [rows] = await db.query(t_sql);

  return { rows };
}
//新增資料

router.post('/add', async (req, res) => {
  const output = {
    success: false,
    code: 0,
    error: {},
    postData: req.body,
  };

  const sql =
    'INSERT INTO `reserve_data`(`member_sid`,`pet_sid`,`symptom`,`date`,`time`) VALUES (?,?,?,?,?)';

  const [result] = await db.query(sql, [
    req.body.membersid,
    req.body.petsid,
    req.body.symptom,
    req.body.date,
    req.body.time,
  ]);

  if (result.affectedRows) output.success = true;

  req.json(output);
});

router.get('/list', async (req, res) => {
  res.json(await getListData(req, res));
});

router.get('/reserve/:sid', async (req, res) => {
  res.json(await getClinicData(req, res));
});

router.get('/citydata', async (req, res) => {
  res.json(await getCityData(req, res));
});

router.get('/areadata', async (req, res) => {
  res.json(await getAreaData(req, res));
});

router.get('/member/:sid', async (req, res) => {
  res.json(await getMemberData(req, res));
});

router.get('/pet/:sid', async (req, res) => {
  res.json(await getPetData(req,res));
});

router.post('/login-api', async (req, res) => {
  const output = {
    success: false,
    error: '',
    postData: req.body,
    auth: {},
  };

  const sql = 'SELECT * FROM members_data WHERE account=?';
  const [rows] = await db.query(sql, [req.body.account]);

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
  }

  res.json(output);
});

module.exports = router;
