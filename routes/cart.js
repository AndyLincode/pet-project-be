const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');
const upload = require(__dirname + '/../modules/upload_img');
const ShortUniqueId = require('short-unique-id');

const uid = new ShortUniqueId({ length: 20 });

const orderID = uid();

//新增訂單資料
router.post('/addOrder', async (req, res) => {
  // return res.json(req.body);

  const output = {
    order_total_success: false,
    photo_success: false,
    product_success: false,
    code: 0,
    error: {},
    postData: req.body, // 除錯用
  };

  const sqlOrders =
    'INSERT INTO `orders`(`orders_num`, `member_sid`, `photo_total_price`,`product_total_price`,`final_price`, `ordered_at`) VALUES (?,?,?,?,?,NOW())';
  const [resultOrder] = await db.query(sqlOrders, [
    orderID,
    req.body.memberID,
    req.body.photo_totalPrice,
    req.body.totalPrice,
    req.body.cartTotalPrice,
  ]);

  let resultPhotoOrderDetails = [];
  if (req.body.photoCart.length === 1) {
    // 攝影師新增訂單
    for (let i = 0; i < req.body.photoCart.length; i++) {
      const sqlPhotoOrderDetails =
        'INSERT INTO `photo_order_details`(`orders_num`, `photo_sid`, `photographer_img`, `photographer_name`, `date`, `day_parts`, `price`) VALUES (?,?,?,?,?,?,?)';
      [resultPhotoOrderDetails] = await db.query(sqlPhotoOrderDetails, [
        orderID,
        req.body.photoCart[i].sid,
        req.body.photoCart[i].img,
        req.body.photoCart[i].name,
        req.body.photoCart[i].date,
        req.body.photoCart[i].time,
        req.body.photoCart[i].price,
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
  ){
    output.success = true;
    // order_total_success=true;
    // photo_succes=true
    // product_success=true
  }
    
    
  res.json(output);
});


//歐付寶金流
//按下結帳API
router.get('/paymentaction', (req, res) => {
  const uid = new ShortUniqueId({ length: 20 });
  const daytime = dayjs(new Date()).format('YYYY/MM/DD HH:mm:ss');
  let base_param = {
    MerchantTradeNo: uid(), //請帶20碼uid, ex: f0a0d7e9fae1bb72bc93
    MerchantTradeDate: daytime, //ex: 2017/02/13 15:45:30
    TotalAmount: '100',
    TradeDesc: '企鵝玩偶 一隻',
    ItemName: '企鵝玩偶 300元 X 1#企鵝玩偶 200元 X 1',
    ReturnURL: 'http://localhost:3000/', // 付款結果通知URL  https://developers.opay.tw/AioMock/MerchantReturnUrl
    OrderResultURL: 'http://localhost:3000/cart/cart_p3', // 在使用者在付款結束後，將使用者的瀏覽器畫面導向該URL所指定的URL
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
  res.redirect('http://localhost:3000/cart/cart_p3');
  // res.json(result);
});


module.exports = router;
