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

module.exports = router;
