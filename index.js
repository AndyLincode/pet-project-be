require('dotenv').config();
const express = require('express');
const app = express();
const db = require(__dirname + '/modules/db_connect');
//讀寫檔案
const fs = require('fs').promises
// app.set('view engine', 'ejs')
const cors = require('cors');
const multer = require('multer');

// top middleware
app.use(cors());
// header 解析
app.use(express.urlencoded({ extended: false }));
// 解析 JSON
app.use(express.json());
// 解析Form表單
app.post(multer().none(), async (req, res, next) => {
  next();
});

app.get('/', (req, res, next) => {
  res.json('<h2>首頁</h2>');
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.post(multer().none(), async (req, res) => {
  next();
});

// 以下新增路由 (請做備註)
//裕庭新增商品路由
const productRouter = require(__dirname + '/routes/product');
app.use('/product', productRouter);
//坤達新增診所路由
const clinicRouter = require(__dirname + '/routes/clinic');
app.use('/clinic', clinicRouter);
// 柏延新增文章路由
const forumRouter = require(__dirname + '/routes/forum');
app.use('/forum', forumRouter);
//品葳新增會員路由
const memberRouter = require(__dirname + '/routes/member');
app.use('/member', memberRouter);
//碩恩新增購物車路由
const cartRouter = require(__dirname + '/routes/cart');
app.use('/cart', cartRouter);

// --------404-------------

app.use((req, res) => {
  res.status(404).send('Error! NOT FOUND');
});

const port = process.env.SERVER_PORT || 6002

app.listen(port, () => console.log(`server started, port:${port}`))
