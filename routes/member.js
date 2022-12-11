const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');
const moment = require('moment-timezone'); // 日期格式(選擇性)
const upload = require(__dirname + '/../modules/upload_img');
const jwt = require('jsonwebtoken');
const SqlString = require('sqlstring');
const nodemailer = require('nodemailer');
const { OAuth2Client, auth } = require('google-auth-library');
const keys = require(__dirname + '/../client_secret.json');
const dayjs = require('dayjs');
const ShortUniqueId = require('short-unique-id');
const axios = require('axios');
const Qs = require('qs');
const { v4: uuid4 } = require('uuid');
const fs = require('fs');
const https = require('https');

// const uid = new ShortUniqueId({ length: 6 });

router.post('/login-api', async (req, res) => {
  const output = {
    success: false,
    error: '',
    postData: req.boby, //除錯用
    auth: {},
  };
  //判斷帳號在資料庫
  const sql = 'SELECT * FROM 	members_data WHERE email=?';
  const [rows] = await db.query(sql, [req.body.mail]); // 這個質去看帳號
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
  }
  res.json(output);
});

//line登入

router.get('/linelogin', async (req, res) => {
  let URL = 'https://access.line.me/oauth2/v2.1/authorize?';

  //必填
  URL += 'response_type=code';
  URL += `&client_id=${process.env.LINE_CHANELL_ID}`;
  URL += `&redirect_uri=${process.env.LINE_REDIRECT_URL}`;
  URL += '&state=123456789';
  URL += '&scope=openid%20profile%20email';
  //選填
  URL += '&prompt=consent';
  URL += '&max_age=241000';
  res.json(URL);
});

router.get('/linecallback', async (req, res) => {
  const qs = req.query;

  let option1 = Qs.stringify({
    grant_type: 'authorization_code',
    code: qs.code,
    redirect_uri: process.env.LINE_REDIRECT_URL,
    client_id: process.env.LINE_CHANELL_ID,
    client_secret: process.env.LINE_CHANELL_SECRET,
  });

  let id_token = '';

  const res1 = await axios.post(
    'https://api.line.me/oauth2/v2.1/token',
    option1,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  //console.log(res1);

  id_token = res1.data.id_token;

  let option2 = Qs.stringify({
    client_id: process.env.LINE_CHANELL_ID,
    id_token: id_token,
  });
  //console.log(option2);

  const res2 = await axios.post(
    'https://api.line.me/oauth2/v2.1/verify',
    option2,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  const output = {
    registersuccess: false,
    loginsuccess: false,
    error: '',
    auth: {},
  };
  //console.log(res2);
  let name = res2.data.name;
  let mail = res2.data.email;
  let photo = res2.data.picture;

  //拿到照片
  function saveImageToDisk(url, path) {
    let fullurl = url;

    let localpath = fs.createWriteStream(path);

    let request = https.get(fullurl, (res) => {
      res.pipe(localpath);
    });
  }

  let photoname = uuid4();
  saveImageToDisk(photo, './public/uploads/imgs/' + photoname + '.jpg');
  const sql_mail = `SELECT email FROM members_data WHERE email = ?`;
  const [rows] = await db.query(sql_mail, mail);
  // console.log(rows);

  if (rows.length < 1) {
    const sql_insert =
      'INSERT INTO `members_data`(`email`,`name`,`member_photo`) VALUES (?,?,?)';

    const [result] = await db.query(sql_insert, [
      mail,
      name,
      photoname + '.jpg',
    ]);

    if (result.affectedRows) output.registersuccess = true;

    return res.json(output);
  } else if (rows.length === 1) {
    const sql_select = 'SELECT * FROM members_data WHERE email = ?';
    const [rows] = await db.query(sql_select, mail);
    if (!rows.length) {
      return res.json(output);
    }
    const row = rows[0];

    output.loginsuccess = row['email'] === mail ? true : false;

    if (output.loginsuccess) {
      const { sid, name, member_photo } = row;
      const token = jwt.sign({ sid, name }, process.env.JWT_SECRET);
      output.auth = {
        sid,
        member_photo,
        name,
        token,
      };
    }
    return res.json(output);
  }
});

//google登入
//使用OAuth2Client
const oAuth2c = new OAuth2Client(
  keys.web.client_id,
  keys.web.client_secret,
  keys.web.redirect_uris[1]
);
// //建立連結URL
router.get('/googlelogin', async (req, res, next) => {
  const authorizeUrl = oAuth2c.generateAuthUrl({
    access_type: 'offline',
    // 欲取得 email, 要兩個 scopes
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
  // res.render('login', { title: '點擊連結登入', authorizeUrl });
  res.json(authorizeUrl);
});

// //利用tokens取得資料
router.get('/googlecallback', async (req, res, next) => {
  const qs = req.query;

  let mail = '';
  let name = '';
  let photo = '';
  if (qs.code) {
    const r = await oAuth2c.getToken(qs.code);
    oAuth2c.setCredentials(r.tokens);
    const url =
      'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,photos';

    // console.log(
    //   `https://oauth2.googleapis.com/tokeninfo?id_token=${r.tokens.id_token}`
    // );
    const response = await oAuth2c.request({ url });

    myData = response.data;

    mail = myData.emailAddresses[0].value;
    name = myData.names[0].givenName;
    photo = myData.photos[0].url;
    //console.log({ mail, name });
  }
  const output = {
    registersuccess: false,
    loginsuccess: false,
    error: '',
    auth: {},
  };

  //拿到照片
  function saveImageToDisk(url, path) {
    let fullurl = url;

    let localpath = fs.createWriteStream(path);

    let request = https.get(fullurl, (res) => {
      res.pipe(localpath);
    });
  }

  let photoname = uuid4();
  saveImageToDisk(photo, './public/uploads/imgs/' + photoname + '.jpg');

  const sql_mail = `SELECT email FROM members_data WHERE email = ?`;
  const [rows] = await db.query(sql_mail, mail);
  // console.log(rows);

  if (rows.length < 1) {
    const sql_insert =
      'INSERT INTO `members_data`(`email`,`name`,`member_photo`) VALUES (?,?,?)';

    const [result] = await db.query(sql_insert, [
      mail,
      name,
      photoname + '.jpg',
    ]);

    if (result.affectedRows) output.registersuccess = true;

    return res.json(output);
  } else if (rows.length === 1) {
    const sql_select = 'SELECT * FROM members_data WHERE email = ?';
    const [rows] = await db.query(sql_select, mail);
    if (!rows.length) {
      return res.json(output);
    }
    const row = rows[0];

    output.loginsuccess = row['email'] === mail ? true : false;

    if (output.loginsuccess) {
      const { sid, name, member_photo } = row;
      const token = jwt.sign({ sid, name }, process.env.JWT_SECRET);
      output.auth = {
        sid,
        member_photo,
        name,
        token,
      };
    }

    return res.json(output);
  }
});

//會員新增資料
router.post('/add', upload.none(), async (req, res) => {
  const photo = 'person_0.png';
  const output = {
    success: false,
    code: 0,
    error: {},
    postData: req.body, // 除錯用
  };

  const sql =
    'INSERT INTO `members_data`( `email`, `password`, `member_photo`,`create_at`) VALUES (?,?,?,?,NOW())';

  const [result] = await db.query(sql, [
    req.body.mail,
    req.body.password,
    photo,
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
    avatar = 'person_0.png';
  } else {
    avatar = req.file.filename;
  }

  const [result] = await db.query(sql, [
    req.body.name,
    req.body.mail,
    req.body.mobile,
    req.body.birthday,
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

//忘記密碼 MAIL
router.post('/sendpassword', upload.none(), async (req, res) => {
  try {
    const { mail } = req.body;
    const uid = new ShortUniqueId({ length: 10 });
    const password = uid();
    const time = dayjs(new Date()).format('YYYY/MM/DD HH:mm:ss');
    const options = {
      from: `PetBen 📧 <${process.env.USER}>`,
      to: `<${mail}>`,
      subject: 'Reset Your Password',
      html: `
                <div style="font-size: .8rem; margin: 0 30px">
                  <p>Email: <b>${mail}</b></p>
                  <p>新密碼:<b>${password}</b></p>
                  <p>重設時間:<b>${time}</b></p>
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

    const sql = 'UPDATE `members_data` SET `password` = ? WHERE `email`= ?';
    const [result] = await db.query(sql, [password, mail]);

    res.json({ msg: 'success' });
  } catch (error) {
    res.json({ msg: 'Error ' });
  }
});

//註冊 MAIL
router.post('/sendregister', upload.none(), async (req, res) => {
  try {
    const { mail, phone } = req.body;

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
                  <p>Email: <b>${mail}</b></p>
                  <p>Phone: <b>${phone}</b></p>
                  <p>Message: <i>歡迎你加入PetBen</i></p>
                  <p>優惠代碼: <b>PetBen1214</b></p>
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

//新增寵物資料
router.post('/addpet', upload.single('pet_photo'), async (req, res) => {
  const output = {
    success: false,
    code: 0,
    error: {},
    postData: req.body,
  };
  const sql =
    'INSERT INTO `pet_data`(`pet_pid`,`pet_name`,`Kind_of_pet`,`pet_gender`,`pet_birthday`,`member_sid`,`birth_control`,`pet_photo`) VALUES (?,?,?,?,?,?,?,?)';

  if (req.body.pet_photo === 'cat.png' || 'dog.png') {
    avatar = req.body.pet_photo;
  } else {
    avatar = req.file.filename;
  }

  const [result] = await db.query(sql, [
    req.body.pid,
    req.body.name,
    req.body.type,
    req.body.gender,
    req.body.birthday,
    req.body.memberID,
    req.body.control,
    avatar,
  ]);

  if (result.affectedRows) output.success = true;
  res.json(output);
});

//刪除寵物資料
router.delete('/delpet/:sid', async (req, res) => {
  console.log(req.params.sid);
  const sql = 'DELETE FROM `pet_data` WHERE sid = ?';
  const [result] = await db.query(sql, [req.params.sid]);
  console.log(result);
  res.json({ success: !!result.affectedRows, result });
});

//抓寵物資料
async function getPetData(req, res) {
  let sid = req.params.sid ? req.params.sid.trim() : '';

  if (sid) {
    where = `WHERE pd.member_sid = ${sid}`;
  }

  let rows = [];

  const sql = `SELECT * FROM \`pet_data\` pd ${where}`;

  [rows] = await db.query(sql);

  return { rows };
}

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

//刪除寵物掛號資料
router.delete('/delclinic/:sid', async (req, res) => {
  const sql = 'DELETE FROM `reserve_data` WHERE reserve_sid = ?';
  const [result] = await db.query(sql, [req.params.sid]);

  res.json({ success: !!result.affectedRows, result });
});

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

//抓會員細節資料
async function getMemberDetailData(req, res) {
  let sid = req.params.sid ? req.params.sid.trim() : '';
  // console.log(sid);

  if (sid) {
    where = `WHERE od.member_sid = ${sid}`;
  }

  const sql = `SELECT COUNT(1) total, SUM(final_price) price FROM \`orders\` od ${where}`;

  [[{ total, price }]] = await db.query(sql);

  return { total, price };
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

// 抓商品收藏列表
async function getProductLovedList(req) {
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

//抓文章收藏列表
async function getArticleLovedList(req, res) {
  const m_sid = +req.query.m_sid;

  if (!m_sid) {
    return res.json({ message: '請先登入', code: '401' });
  }

  const sql = `SELECT md.name, al.*,a.title,a.category,a.created_at,a.m_sid author FROM article_collection al JOIN article a ON al.a_sid = a.article_sid JOIN members_data md ON md.sid = a.m_sid WHERE al.m_sid =?`;

  const formatSql = SqlString.format(sql, [m_sid]);
  let rows = [];

  [rows] = await db.query(formatSql);

  return { rows };
}

//抓訂單總資料
async function getOrderData(req, res) {
  let sid = req.params.sid ? req.params.sid.trim() : '';

  let where = `WHERE od.member_sid = ${sid}`;

  let rows = [];

  const sql = `SELECT * FROM \`orders\` od ${where}`;

  [rows] = await db.query(sql);

  return { rows };
}

//抓商品細節資料
async function getProductDetailData(req, res) {
  let sid = req.params.sid ? req.params.sid : '';

  let rows = [];

  const sql = `SELECT * FROM \`order_details\` odd  WHERE odd.orders_num = \'${sid}\'`;
  [rows] = await db.query(sql);

  return { rows };
}

//抓攝影細節資料
async function getPhotoDetailData(req, res) {
  let sid = req.params.sid ? req.params.sid : '';

  let rows = [];

  const sql = `SELECT * FROM \`photo_order_details\` pod WHERE pod.orders_num = \'${sid}\'`;
  [rows] = await db.query(sql);

  return { rows };
}

//多筆移除商品收藏
router.post('/deleteproudctlist', async (req, res) => {
  console.log(req.body);

  const sql = 'DELETE FROM product_loved WHERE p_sid IN (?)';

  const [result] = await db.query(sql, [req.body]);

  res.json({ success: !!result.affectedRows, result });
});

//多筆移除文章收藏
router.post('/deletearticlelist', async (req, res) => {
  console.log(req.body);

  const sql = 'DELETE FROM article_collection WHERE a_sid IN (?)';

  const [result] = await db.query(sql, [req.body]);

  res.json({ success: !!result.affectedRows, result });
});

//修改密碼
router.put('/resetpassword', upload.none(), async (req, res) => {
  const output = {
    success: false,
    code: 0,
    error: {},
    postData: req.body,
  };

  const sql = 'UPDATE `members_data` SET `password`=? WHERE `sid` = ?';

  const [result] = await db.query(sql, [req.body.password, req.body.sid]);

  if (result.changedRows) output.success = true;

  res.json(output);
});

//產生code

//手機驗證
router.post('/phonecheck', upload.none(), async (req, res) => {
  function codeTo() {
    let digits = '0123456789';
    let otp = '';
    for (let i = 0; i < 6; i++) {
      otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
  }

  let code = await codeTo();
  const sql = 'INSERT INTO `member_code`(`code`) VALUES (?);';

  const [result] = await db.query(sql, [code]);

  try {
    const username = process.env.SNS_ACCOUNT;
    const password = process.env.SNS_PASSWORD;
    const phone = req.body.mobile;
    const text = `您的驗證碼${code}`;

    const api = `${process.env.SNS_API}&username=${username}&password=${password}&dstaddr=${phone}&smbody=${text}`;

    const response = await axios.get(api);
    res.json({ msg: 'success' });
  } catch (error) {
    res.json({ msg: 'error' });
  }
});

router.post('/checkcode', upload.none(), async (req, res) => {
  let where = `WHERE mc.code = \'${req.body.code}\'`;
  let rows = [];

  const sql = `SELECT * FROM \`member_code\` mc ${where}`;

  [rows] = await db.query(sql);

  if (rows.length === 1) {
    res.json({ msg: 'success' });
  } else {
    res.json({ msg: 'error' });
  }
});

//抓商品訂單資料
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
router.get('/petdata/:sid', async (req, res) => {
  res.json(await getPetData(req, res));
});

//抓文章收藏資料
router.get('/articledata', async (req, res) => {
  res.json(await getArticleLovedList(req, res));
});

//抓商品收藏資料
router.get('/productdata', async (req, res) => {
  res.json(await getProductLovedList(req));
});

//抓診所掛號資料
router.get('/clinicdata/:sid', async (req, res) => {
  res.json(await getClinicData(req, res));
});

//抓攝影訂單細節資料
router.get('/orderphotodetail/:sid', async (req, res) => {
  res.json(await getPhotoDetailData(req, res));
});

//抓訂單總資料
router.get('/orderdata/:sid', async (req, res) => {
  res.json(await getOrderData(req, res));
});

//抓商品訂單細節資料
router.get('/orderproductdetail/:sid', async (req, res) => {
  res.json(await getProductDetailData(req, res));
});

//會員細節資料
router.get('/memberdetail/:sid', async (req, res) => {
  res.json(await getMemberDetailData(req, res));
});

module.exports = router;
