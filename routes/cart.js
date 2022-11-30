const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');

// //新增訂單資料
// router.post('/add', upload.none, async (req, res) => {
//   const output = {
//     success: false,
//     code: 0,
//     error: {},
//     postData: req.body, // 除錯用
//   };

//   const sqlOrders =
//     'INSERT INTO `orders`(`orders_sid`, `member_sid`, `amount_total`, `ordered_at`) VALUES (?,?,?,NOW())';

//   const [result] = await db.query(sqlOrders, [
//     req.body.orders_sid,
//     req.body.member_sid,
//     req.body.amount_total,
//   ]);

//   //affectedRows有影響的列數
//   // console.log(req);

//   if (result.affectedRows) output.success = true;
//   res.json(output);
// });

// router.post('/add', upload.none, async (req, res) => {
//   const output = {
//     success: false,
//     code: 0,
//     error: {},
//     postData: req.body, // 除錯用
//   };

//   const sqlOrderDetails =
//     'INSERT INTO `order_details`(`orders_sid`, `product_sid`, `product_img`, `product_name`, `price`, `amount`, `amount_total`) VALUES (?,?,?,?,?,?,?)';

//   const [result] = await db.query(sqlOrderDetails, [
//     req.body.orders_sid,
//     req.body.product_sid,
//     req.body.product_img,
//     req.body.product_name,
//     req.body.price,
//     req.body.amount,
//     req.body.amount_total,
//   ]);

//   //affectedRows有影響的列數
//   // console.log(req);

//   if (result.affectedRows) output.success = true;
//   res.json(output);
// });

// router.post('/add', upload.none, async (req, res) => {
//   const output = {
//     success: false,
//     code: 0,
//     error: {},
//     postData: req.body, // 除錯用
//   };

//   const sqlPhotoOrderDetails =
//     'INSERT INTO `photo_order_details`(`photo_order_sid`, `photo_sid`, `photographer_img`, `photographer_name`, `date`, `day_parts`, `price`) VALUES (?,?,?,?,?,?,?)';

//   const [result] = await db.query(sqlPhotoOrderDetails, [
//     req.body.photo_order_sid,
//     req.body.photo_sid,
//     req.body.photographer_img,
//     req.body.photographer_name,
//     req.body.date,
//     req.body.day_parts,
//     req.body.price,
//   ]);

//   //affectedRows有影響的列數
//   // console.log(req);

//   if (result.affectedRows) output.success = true;
//   res.json(output);
// });

module.exports = router;
