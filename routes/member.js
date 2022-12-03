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
  }
  res.json(output);
});

//google登入
//使用OAuth2Client
const oAuth2c = new OAuth2Client(
  keys.web.client_id,
  keys.web.client_secret,
  keys.web.redirect_uris[1]
);
// //建立連結URL
router.get('/login', async (req, res, next) => {
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
router.get('/callback', async (req, res, next) => {
  const qs = req.query;

  let mail = '';
  let name = '';
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
    // console.log({ mail, name });
  }
  const output = {
    success: false,
    error: '',
    auth: {},
  };

  const sql_mail = `SELECT email FROM members_data WHERE email = ?`;
  const [rows] = await db.query(sql_mail, mail);
  // console.log(rows);
  if (rows.length === 1) {
    const sql_select = 'SELECT * FROM members_data WHERE email = ?';
    const [rows] = await db.query(sql_select, mail);
    if (!rows.length) {
      return res.json(output);
    }
    const row = rows[0];

    output.success = row['email'] === mail ? true : false;

    if (output.success) {
      const { sid, name } = row;
      const token = jwt.sign({ sid, name }, process.env.JWT_SECRET);
      output.auth = {
        sid,
        name,
        token,
      };
    }
  } else {
    const sql_insert =
      'INSERT INTO `members_data`(`email`,`name`) VALUES (?,?)';

    const [result] = await db.query(sql_insert, [mail, name]);

    const sql_select = 'SELECT * FROM members_data WHERE email = ?';
    const [rows] = await db.query(sql_select, mail);
    if (!rows.length) {
      return res.json(output);
    }
    const row = rows[0];

    output.success =
      row['email'] === mail && result.affectedRows ? true : false;

    if (output.success) {
      const { sid, name } = row;
      const token = jwt.sign({ sid, name }, process.env.JWT_SECRET);
      output.auth = {
        sid,
        name,
        token,
      };
    }
  }
  res.json(output);
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

  if (req.body.member_photo === 'noname.png') {
    avatar = req.body.member_photo;
  } else {
    avatar = req.file.filename;
  }

  const [result] = await db.query(sql, [
    req.body.name,
    req.body.account,
    req.body.gender || null,
    req.body.password,
    avatar,
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
    avatar = 'noname.png';
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

  if (req.body.pet_photo === 'cat_food.png' || 'dog_food.png') {
    avatar = req.body.member_photo;
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

  if (sid) {
    where = `WHERE md.sid = ${sid}`;
  }

  let rows = [];
  const sql = `SELECT * FROM \`members_data\` md JOIN \`orders\` ON  ${where}`;
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

//抓攝影訂單資料
async function getPhotoData(req, res) {
  let sid = req.params.sid ? req.params.sid.trim() : '';

  if (sid) {
    where = `WHERE od.member_sid = ${sid}`;
  }

  let rows = [];

  const sql = `SELECT * FROM \`orders\` od JOIN \`photo_order_details\` opd ON od.orders_num = opd.orders_num ${where}`;

  [rows] = await db.query(sql);

  return { rows };
}

//抓商品訂單資料
async function getProductData(req, res) {
  let sid = req.params.sid ? req.params.sid.trim() : '';

  if (sid) {
    where = `WHERE od.member_sid = ${sid}`;
  }

  let rows = [];

  const sql = `SELECT * FROM \`orders\` od JOIN \`order_details\` oud ON od.orders_num = oud.orders_num ${where}`;

  [rows] = await db.query(sql);

  return { rows };
}

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
router.get('/orderphotodata/:sid', async (req, res) => {
  res.json(await getPhotoData(req, res));
});

//抓商品訂單資料
router.get('/orderproductdata/:sid', async (req, res) => {
  res.json(await getProductData(req, res));
});

//會員細節資料
router.get('/memberdetail/:sid', async (req, res) => {
  res.json(await getMemberDetailData(req, res));
});

module.exports = router;
