const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');
const moment = require('moment-timezone'); // 日期格式(選擇性)
const upload = require(__dirname + '/../modules/upload-img');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.post('/login-api', async (req, res) => {
  const output = {
    success: false,
    error: '帳密錯誤',
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
  const token = jwt.sign(
    {
      sid: row.sid,
      account: row.account,
    },
    'lasdkf39485349hflskdfsdklfsk'
  );
  //判斷密碼在資料庫
  output.success = req.body.password === row.password;
  if (output.success) {
    output.error = '';
    output.auth = { row: row, token: token, login: true };
  }
  /*
  output.success = await bcrypt.compare(
    req.body.password,
    row['password_hash']
  );
  */
  res.json(output);
});
//會員新增資料
router.post('/add', upload.none(), async (req, res) => {
  const output = {
    success: false,
    code: 0,
    error: {},
    postData: req.body, // 除錯用
  };

  const sql =
    'INSERT INTO `members_data`(`name`, `account`, `gender`, `password`,`city`,`area`,`address`, `create_at`) VALUES (?,?,?,?,?,?,?,NOW())';
  const [result] = await db.query(sql, [
    req.body.name,
    req.body.account,
    req.body.gender,
    req.body.password,
    // req.body.photo,
    req.body.city,
    req.body.area,
    req.body.address,
  ]);
  const sql2 =
    'INSERT INTO `contact_data`(`birthday`, `email`, `mobile`, `create_at`) VALUES (?,?,?,NOW())';
  const [result2] = await db.query(sql2, [
    req.body.birthday,
    req.body.email,
    req.body.mobile,
  ]);

  //affectedRows有影響的列數
  console.log(result);
  console.log(result2);
  if (result.affectedRows && result2.affectedRows) output.success = true;
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

module.exports = router;
