const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');
const jwt = require('jsonwebtoken');
const moment = require('moment-timezone'); // 日期格式(選擇性)
const upload = require(__dirname + '/../modules/upload_img');
// const opay = require('opay_payment_nodejs');
const ShortUniqueId = require('short-unique-id');
const dayjs = require('dayjs');

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
  const sql = `SELECT cd.* FROM \`city_data\` cd ${where} `;
  [rows] = await db.query(sql);

  return { rows };
}

async function getAreaData() {
  //全部的資料
  let where = `WHERE 1`;
  let rows = [];
  const sql = `SELECT ad.* FROM \`area_data\` ad ${where} `;
  [rows] = await db.query(sql);

  return { rows };
}

async function getMemberData(req, res) {
  let sid = req.params.sid ? req.params.sid.trim() : '';
  // console.log(sid);

  let where = `WHERE md.sid = ${sid}`;

  let rows = [];

  const t_sql = `SELECT md.* FROM \`members_data\` md ${where}`;

  [rows] = await db.query(t_sql);

  return { rows };
}

async function getPetData(req, res) {
  let sid = req.params.sid ? req.params.sid.trim() : '';

  let where = `WHERE pd.member_sid = ${sid}`;

  let rows = [];

  const t_sql = `SELECT pd.* FROM \`pet_data\` pd ${where}`;

  [rows] = await db.query(t_sql);

  return { rows };
}

async function getCityName(req, res) {
  let sid = req.params.sid ? req.params.sid.trim() : '';

  let where = `WHERE cd.sid = ${sid}`;

  let rows = [];

  const sql = `SELECT * FROM \`city_data\` cd ${where}`;

  [rows] = await db.query(sql);
  return { rows };
}

async function getAreaName(req, res) {
  let sid = req.params.sid ? req.params.sid.trim() : '';

  let where = `WHERE ad.sid = ${sid}`;

  let rows = [];

  const sql = `SELECT * FROM \`area_data\` ad ${where}`;

  [rows] = await db.query(sql);
  return { rows };
}

//歐付寶金流
//按下結帳API
router.get('/paymentaction', (req, res) => {
  const uid = new ShortUniqueId({ length: 20 });
  const daytime = dayjs(new Date()).format('YYYY/MM/DD HH:mm:ss');
  let base_param = {
    MerchantTradeNo: uid(), //請帶20碼uid, ex: f0a0d7e9fae1bb72bc93
    MerchantTradeDate: daytime, //ex: 2017/02/13 15:45:30
    TotalAmount: '100',
    TradeDesc: '陪伴商品',
    ItemName: '企鵝玩偶 300元 X 1 # 企鵝玩偶 200元 X 1',
    ReturnURL: 'http://localhost:3000/', // 付款結果通知URL  https://developers.opay.tw/AioMock/MerchantReturnUrl
    OrderResultURL: 'http://localhost:3000/clinic/payresult', // 在使用者在付款結束後，將使用者的瀏覽器畫面導向該URL所指定的URL
    EncryptType: 1,
    // ItemURL: 'http://item.test.tw',aw
    Remark: '該服務繳費成立時，恕不接受退款。',
    // HoldTradeAMT: '1',
    // StoreID: '',
    // UseRedeem: ''
  };
  console.log(uid());
  let create = new opay();
  // let parameters = {};
  // let invoice = {};
  try {
    let htm = create.payment_client.aio_check_out_credit_onetime(
      (parameters = base_param)
    );
    // console.log(htm);
    res.json(htm);
  } catch (err) {
    // console.log(err);
    let error = {
      status: '500',
      stack: '',
    };
    res.json(error);
  }
});

router.post('/payment', (req, res) => {
  var rtnCode = req.body.RtnCode;
  var simulatePaid = req.body.SimulatePaid;
  var merchantID = req.body.MerchantID;
  var merchantTradeNo = req.body.MerchantTradeNo;
  var storeID = req.body.StoreID;
  var rtnMsg = req.body.RtnMsg;
  // var tradeNo = req.body.TradeNo;
  var tradeAmt = req.body.TradeAmt;
  // var payAmt = req.body.PayAmt;
  var paymentDate = req.body.PaymentDate;
  var paymentType = req.body.PaymentType;
  // var paymentTypeChargeFee = req.body.PaymentTypeChargeFee;

  let paymentInfo = {
    merchantID: merchantID,
    merchantTradeNo: merchantTradeNo,
    storeID: storeID,
    rtnMsg: rtnMsg,
    paymentDate: paymentDate,
    paymentType: paymentType,
    tradeAmt: tradeAmt,
  };

  //(添加simulatePaid模擬付款的判斷 1為模擬付款 0 為正式付款)
  //測試環境
  if (rtnCode === '1' && simulatePaid === '1') {
    // 這部分可與資料庫做互動
    res.write('1|OK');
    res.end();
  }
});

router.post('/payresult', (req, res) => {
  var merchantID = req.body.MerchantID; //會員編號
  var merchantTradeNo = req.body.MerchantTradeNo; //交易編號
  var storeID = req.body.StoreID; //商店編號
  var rtnMsg = req.body.RtnMsg; //交易訊息
  var paymentDate = req.body.PaymentDate; //付款時間
  var paymentType = req.body.PaymentType; //付款方式
  var tradeAmt = req.body.TradeAmt; //交易金額

  let result = {
    member: {
      merchantID: merchantID,
      merchantTradeNo: merchantTradeNo,
      storeID: storeID,
      rtnMsg: rtnMsg,
      paymentDate: paymentDate,
      paymentType: paymentType,
      tradeAmt: tradeAmt,
    },
  };
  console.log('result: ' + JSON.stringify(result));
  res.redirect('http://localhost:3000/clinic/payresult');
  // res.json(result);
});

//新增資料

router.post('/add', upload.none(), async (req, res) => {
  const output = {
    success: false,
    code: 0,
    error: {},
    postData: req.body,
  };

  const sql =
    'INSERT INTO `reserve_data`(`member_sid`,`pet_sid`,`clinic_sid`,`symptom`,`date`,`time`) VALUES (?,?,?,?,?,?)';

  const [result] = await db.query(sql, [
    req.body.member_sid,
    req.body.pet_sid,
    req.body.clinic_sid,
    req.body.symptom,
    req.body.date,
    req.body.time,
  ]);

  if (result.affectedRows) output.success = true;

  // console.log(result);

  res.json(output);
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
  res.json(await getPetData(req, res));
});

router.get('/cityname/:sid', async (req, res) => {
  res.json(await getCityName(req, res));
});

router.get('/areaname/:sid', async (req, res) => {
  res.json(await getAreaName(req, res));
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
