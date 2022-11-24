const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');
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

  const t_sql = `SELECT * FROM \`clinic_data\` cd LEFT JOIN \`code_data\` od ON cd.code=od.sid ${where}`;

  [rows] = await db.query(t_sql);

  return { rows };
}

router.get('/list', async (req, res) => {
  res.json(await getListData(req, res));
});

router.get('/reserve/:sid', async (req, res) => {
  res.json(await getClinicData(req, res));
});

module.exports = router;
