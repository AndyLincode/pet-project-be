const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');
const moment = require('moment-timezone'); // 日期格式(選擇性)
const upload = require(__dirname + '/../modules/upload-img');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const nodemailer = require('nodemailer');

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
    const { sid, name, member_photo } = row;

    const token = jwt.sign({ sid, name, member_photo }, process.env.JWT_SECRET);

    output.auth = {
      sid,
      name,
      token,
      member_photo,
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
    req.file.filename,
    req.body.city || null,
    req.body.area || null,
    req.body.address || null,
    req.body.birthday || null,
    req.body.mail || null,
    req.body.mobile || null,
  ]);

  //affectedRows有影響的列數
  // console.log(req);

  if (result.affectedRows) output.success = true;
  res.json(output);
});

//修改
router.put('/edit', upload.single('member_photo'), async (req, res) => {
  const output = {
    success: false,
    code: 0,
    error: {},
    postData: req.body, // 除錯用
    img: '',
  };

  const sql =
    'UPDATE `members_data` SET `name`=?,`email`=?,`mobile`=?,`birthday`=?,`city`=?,`area`=?,`address`=?,`gender`=?,`member_photo`=? WHERE `sid`=?';

  if (req.body.member_photo === '') {
    avatar = null;
  } else {
    avatar = req.file.filename;
  }

  const [result] = await db.query(sql, [
    req.body.name,
    req.body.mail,
    req.body.mobile,
    req.body.birthday || null,
    req.body.city,
    req.body.area,
    req.body.address,
    req.body.gender,
    avatar,
    req.body.sid,
  ]);

  if (result.changedRows) output.success = true;
  if (req.body.member_photo !== '') output.img = req.file.filename;

  res.json(output);
});

//MAIL
router.post('/send', upload.none(), async (req, res) => {
  try {
    const { name, mail, phone } = req.body;

    const options = {
      from: `PetBen 🛍️ <${process.env.USER}>`,
      to: `<${mail}>`,
      subject: 'Message From Shoeshop Store',
      html: `
            <div style="width: 100%; background-color: #f3f9ff; padding: 5rem 0">
            <div style="max-width: 700px; background-color: white; margin: 0 auto">
              <div style="width: 100%; background-color: #00efbc; padding: 20px 0">          
              </div>
              <div style="width: 100%; gap: 10px; padding: 30px 0; display: grid">
                <p style="font-weight: 800; font-size: 1.2rem; padding: 0 30px">
                  Form Shoeshop Store
                </p>
                <div style="font-size: .8rem; margin: 0 30px">
                  <p>FullName: <b>${name}</b></p>
                  <p>Email: <b>${mail}</b></p>
                  <p>Phone: <b>${phone}</b></p>
                  <p>Message: <i>歡迎你加入PetBen</i></p>
                </div>
              </div>
            </div>
          </div>
            `,
    };
    const Email = (options) => {
      let transpoter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secureConnection: true,
        auth: {
          type: 'OAuth2',
          user: process.env.USER,
          clientId: process.env.CLIENT_ID,
          clientSecret: process.env.CLIENT_SECRET,
          refreshToken: process.env.REFRESH_TOKEN,
          accessToken: process.env.ACCESS_TOKEN,
          expires: 1484314697598,
        },
      });
      transpoter.sendMail(options, (err, info) => {
        if (err) {
          console.log(err);
          return;
        }
      });
    };

    Email(options);

    res.json({ msg: 'Your message sent successfully' });
  } catch (error) {
    res.json({ msg: 'Error ' });
  }
});

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
  // console.log(sid);
  let rows = [];

  const sql = `SELECT * FROM \`reserve_data\` rd LEFT JOIN \`clinic_data\` cd ON cd.sid = rd.clinic_sid LEFT JOIN \`code_data\` od ON cd.code=od.sid ${where} ORDER BY date DESC`;

  [rows] = await db.query(sql);

  return { rows };
}

//抓會員資料
async function getMemberData(req, res) {
  let sid = req.params.sid ? req.params.sid.trim() : '';

  if (sid) {
    where = `WHERE md.sid = ${sid}`;
  }

  let rows = [];
  const sql = `SELECT * FROM \`members_data\` md ${where}`;
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

//抓城市資料
router.get('/citydata', async (req, res) => {
  res.json(await getCityData(req, res));
});
//抓地區資料
router.get('/areadata', async (req, res) => {
  res.json(await getAreaData(req, res));
});

//抓會員資料
router.get('/memberdata/:sid', async (req, res) => {
  res.json(await getMemberData(req, res));
});
//抓會員寵物資料
router.get('/petdata', async (req, res) => {});

//抓文章收藏資料
router.get('/articledata', async (req, res) => {});

//抓商品收藏資料
router.get('/productdata', async (req, rs) => {});

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
