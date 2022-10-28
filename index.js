require("dotenv").config();
const express = require("express");
const app = express();
const db = require(__dirname + "/modules/db_connect");
// app.set('view engine', 'ejs')

app.get("/", (req, res, next) => {
  res.json("<h2>首頁</h2>");
});

//裕庭新增商品路由
const productRouter = require(__dirname + '/routes/product');
app.use("/product", require(__dirname + "/routes/product"));

// 以下新增路由 (請做備註)
// 柏延新增文章路由
const forumRouter = require(__dirname + '/routes/forum');
app.use("/forum",forumRouter);



// --------404-------------

app.use((req, res) => {
  res.status(404).render("404");
});

const port = process.env.SERVER_PORT || 6002;

app.listen(port, () => console.log(`server started, port:${port}`));
