const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');
const moment = require('moment-timezone'); // 日期格式(選擇性)

router.use((req, res, next) => {
  next();
});

async function getClinicData(req, res) {
  let where = `WHERE 1`;
  let rows = [];
  const sql = `SELECT * FROM clinic_data ${where} ORDER BY sid ASC`;
  [rows] = await db.query(sql);

  return { rows };
}

router.get('/list', async (req, res) => {
  res.json(await getClinicData(req,res))
});

module.exports = router;
