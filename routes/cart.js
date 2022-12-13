const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');
const upload = require(__dirname + '/../modules/upload_img');
const ShortUniqueId = require('short-unique-id');
const dayjs = require('dayjs');
const opay = require('opay_payment_nodejs');
const SqlString = require('sqlstring');
const hmacSHA256 = require('crypto-js/hmac-sha256');
const Base64 = require('crypto-js/enc-base64');
const axios = require('axios');

const uid = new ShortUniqueId({ length: 20 });

let orderID = '';

//新增訂單資料
router.post('/addOrder', async (req, res) => {
  // return res.json(req.body);

  orderID = uid();

  const output = {
    order_total_success: false,
    photo_success: false,
    product_success: false,
    code: 0,
    error: {},
    postData: req.body, // 除錯用
  };

  const sqlOrders =
    'INSERT INTO `orders`(`orders_num`, `member_sid`, `photo_total_price`,`product_total_price`,`final_price`,`pay_way`, `ordered_at`) VALUES (?,?,?,?,?,?,NOW())';
  const [resultOrder] = await db.query(sqlOrders, [
    orderID,
    req.body.memberID,
    req.body.photo_totalPrice,
    req.body.totalPrice,
    req.body.cartTotalPrice,
    req.body.payWay,
  ]);

  let resultPhotoOrderDetails = [];
  if (req.body.photoCart.length === 1) {
    // 攝影師新增訂單
    for (let i = 0; i < req.body.photoCart.length; i++) {
      const sqlPhotoOrderDetails =
        'INSERT INTO `photo_order_details`(`orders_num`, `photo_sid`, `photographer_img`, `photographer_name`, `date`, `day_parts`, `price`,`amount`) VALUES (?,?,?,?,?,?,?,?)';
      [resultPhotoOrderDetails] = await db.query(sqlPhotoOrderDetails, [
        orderID,
        req.body.photoCart[i].sid,
        req.body.photoCart[i].img,
        req.body.photoCart[i].name,
        req.body.photoCart[i].date,
        req.body.photoCart[i].time,
        req.body.photoCart[i].price,
        1,
      ]);
    }
  }

  let resultOrderDetails = [];
  if (req.body.productCart.length >= 1) {
    // 商品新增訂單
    for (let i = 0; i < req.body.productCart.length; i++) {
      const sqlOrderDetails =
        'INSERT INTO `order_details`(`orders_num`, `product_sid`, `product_img`, `product_name`, `price`, `amount`, `amount_total`) VALUES (?,?,?,?,?,?,?)';
      [resultOrderDetails] = await db.query(sqlOrderDetails, [
        orderID,
        req.body.productCart[i].sid,
        req.body.productCart[i].img,
        req.body.productCart[i].name,
        req.body.productCart[i].member_price,
        req.body.productCart[i].amount,
        req.body.productCart[i].member_price * req.body.productCart[i].amount,
      ]);
    }
  }

  //affectedRows有影響的列數
  // console.log(req);

  if (
    resultOrder.affectedRows ||
    resultPhotoOrderDetails.affectedRows ||
    resultOrderDetails.affectedRows
  ) {
    output.success = true;
    // order_total_success=true;
    // photo_succes=true
    // product_success=true
  }

  res.json(output);
});

//歐付寶金流
//按下結帳API
router.get('/paymentaction', async (req, res) => {
  const uid = new ShortUniqueId({ length: 20 });
  const daytime = dayjs(new Date()).format('YYYY/MM/DD HH:mm:ss');

  const sql1 = `SELECT orders.final_price,orders.orders_num FROM orders WHERE orders.orders_num = ? `;

  const sql2 = `SELECT photo_order_details.photographer_name,photo_order_details.price,photo_order_details.date FROM orders LEFT JOIN photo_order_details ON orders.orders_num =photo_order_details.orders_num WHERE orders.orders_num = ?`;

  const sql3 = `SELECT order_details.product_name,order_details.price,order_details.amount FROM orders LEFT JOIN order_details ON orders.orders_num = order_details.orders_num WHERE orders.orders_num = ?`;

  const sqlString1 = SqlString.format(sql1, [orderID]);
  const sqlString2 = SqlString.format(sql2, [orderID]);
  const sqlString3 = SqlString.format(sql3, [orderID]);

  let rows1 = [];
  let rows2 = [];
  let rows3 = [];

  [rows1] = await db.query(sqlString1);
  [rows2] = await db.query(sqlString2);
  [rows3] = await db.query(sqlString3);

  // console.log(rows1);
  // console.log(rows2);
  // console.log(rows3);

  let photo_detail = `${rows2[0].photographer_name}攝影師 ${rows2[0].price}元`;
  let product_detail = ``;

  for (let aaa of rows3) {
    product_detail +=
      aaa.product_name + aaa.price + '元' + 'X' + aaa.amount + '#';
  }

  console.log(photo_detail);
  console.log(product_detail);

  let base_param = {
    MerchantTradeNo: `${rows1[0].orders_num}`, //請帶20碼uid, ex: f0a0d7e9fae1bb72bc93
    MerchantTradeDate: daytime, //ex: 2017/02/13 15:45:30
    TotalAmount: `${rows1[0].final_price}`,
    TradeDesc: 'PetBen商品',
    ItemName: `${photo_detail}#${product_detail}`,
    ReturnURL: 'http://localhost:3000/', // 付款結果通知URL  https://developers.opay.tw/AioMock/MerchantReturnUrl
    OrderResultURL: 'http://localhost:3000/cart/cartp3', // 在使用者在付款結束後，將使用者的瀏覽器畫面導向該URL所指定的URL
    EncryptType: 1,
    // ItemURL: 'http://item.test.tw',
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

router.post('/cartp3', (req, res) => {
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
  res.redirect('http://localhost:3000/cart/cartp3');
  // res.json(result);
});

const {
  LINE_PAY_VERSION,
  LINE_PAY_SITE,
  LINE_PAY_CHANELL_ID,
  LINE_PAY_CHANELL_SECRET,
  LINE_PAY_RERURN_CONFIRM_URL,
  LINE_PAY_RERURN_CANCEL_URL,
} = process.env;

// const orders = {
//   amount: 1000,
//   currency: 'TWD',
//   packages: [
//     {
//       id: 'products_1',
//       amount: 1000,
//       products: [
//         {
//           name: '六角棒棒',
//           quantity: 1,
//           price: 1000,
//         },
//       ],
//     },
//   ],
// };

router.post('/linepay', async (req, res) => {
  const sql1 = `SELECT orders.final_price,orders.orders_num FROM orders WHERE orders.orders_num = ? `;

  const sql2 = `SELECT photo_order_details.photographer_name name,photo_order_details.price price,photo_order_details.amount quantity FROM orders LEFT JOIN photo_order_details ON orders.orders_num =photo_order_details.orders_num WHERE orders.orders_num = ?`;

  const sql3 = `SELECT order_details.product_name name,order_details.price,order_details.amount quantity FROM orders LEFT JOIN order_details ON orders.orders_num = order_details.orders_num WHERE orders.orders_num = ?`;

  const sqlString1 = SqlString.format(sql1, [orderID]);
  const sqlString2 = SqlString.format(sql2, [orderID]);
  const sqlString3 = SqlString.format(sql3, [orderID]);

  let rows1 = [];
  let rows2 = [];
  let rows3 = [];

  [rows1] = await db.query(sqlString1);
  [rows2] = await db.query(sqlString2);
  [rows3] = await db.query(sqlString3);
  // console.log(rows3);

  let amount = rows1[0].final_price;

  const orders = {
    amount: amount,
    currency: 'TWD',
    orderId: orderID,
    packages: [
      {
        id: orderID,
        amount: amount,
        products: [...rows3, ...rows2],
      },
    ],
  };

  console.log(JSON.stringify(orders));

  try {
    const linePayBody = {
      ...orders,
      redirectUrls: {
        confirmUrl: `${LINE_PAY_RERURN_CONFIRM_URL}`,
        cancelUrl: `${LINE_PAY_RERURN_CANCEL_URL}`,
      },
    };

    const uri = '/payments/request';
    const nonce = parseInt(new Date().getTime() / 1000);
    const string = `${LINE_PAY_CHANELL_SECRET}/${LINE_PAY_VERSION}${uri}${JSON.stringify(
      linePayBody
    )}${nonce}`;

    const signature = Base64.stringify(
      hmacSHA256(string, LINE_PAY_CHANELL_SECRET)
    );

    const headers = {
      'Content-Type': 'application/json',
      'X-LINE-ChannelId': LINE_PAY_CHANELL_ID,
      'X-LINE-Authorization-Nonce': nonce,
      'X-LINE-Authorization': signature,
    };

    const url = `${LINE_PAY_SITE}/${LINE_PAY_VERSION}${uri}`;

    const response = await axios.post(url, linePayBody, { headers });

    if (response?.data?.returnCode === '0000') {
      res.json(response?.data?.info.paymentUrl.web);
    }

    //console.log(response);
  } catch (error) {
    console.log(error.message);
  }
});

router.get('/linepay/confirm', async (req, res) => {
  const { transactionId, orderId } = req.query;

  const sql1 = `SELECT orders.final_price,orders.orders_num FROM orders WHERE orders.orders_num = ? `;

  const sqlString1 = SqlString.format(sql1, [orderID]);
  let rows1 = [];
  [rows1] = await db.query(sqlString1);
  let amount = rows1[0].final_price;

  try {
    const linePayBody = {
      amount: amount,
      currency: 'TWD',
    };

    const uri = `/payments/${transactionId}/confirm`;

    const nonce = parseInt(new Date().getTime() / 1000);
    const string = `${LINE_PAY_CHANELL_SECRET}/${LINE_PAY_VERSION}${uri}${JSON.stringify(
      linePayBody
    )}${nonce}`;

    const signature = Base64.stringify(
      hmacSHA256(string, LINE_PAY_CHANELL_SECRET)
    );

    const url = `${LINE_PAY_SITE}/${LINE_PAY_VERSION}${uri}`;

    const headers = {
      'Content-Type': 'application/json',
      'X-LINE-ChannelId': LINE_PAY_CHANELL_ID,
      'X-LINE-Authorization-Nonce': nonce,
      'X-LINE-Authorization': signature,
    };

    const response = await axios.post(url, linePayBody, { headers });

    res.json(response.data);
  } catch (error) {
    console.log(error.message);
  }
});

async function getOrderData(req, res) {
  let sid = req.params.sid ? req.params.sid.trim() : '';

  let where = `WHERE od.member_sid = ${sid}`;

  const sql = `SELECT od.* FROM orders od ${where} ORDER BY ordered_at DESC LIMIT 0 , 1`;

  [rows] = await db.query(sql);

  return { rows };
}

router.get('/member_order/:sid', async (req, res) => {
  res.json(await getOrderData(req, res));
});

module.exports = router;
