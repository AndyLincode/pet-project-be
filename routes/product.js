const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');
const moment = require('moment-timezone'); // 日期格式(選擇性)
const SqlString = require('sqlstring');
const jwt = require('jsonwebtoken');

// try JWT
// app.get("/fake-login", (req, res) => {
//   req.session.admin = {
//     id: 888,
//     account: "Andy",
//     nickname: "小林",
//   };

//   res.redirect("/");
// });
// app.get("/logout", (req, res) => {
//   delete req.session.admin;

//   res.redirect("/");
// });

// router.post('/login-api', async (req, res) => {
//   const output = {
//     success: false,
//     error: '帳號或密碼錯誤',
//     postData: req.body, //除錯用
//     auth: {},
//   };
//   const sql = 'SELECT * FROM admins WHERE account=?';
//   const [rows] = await db.query(sql, [req.body.account]);

//   if (!rows.length) {
//     return res.json(output);
//   }

//   const row = rows[0];
//   console.log(row);
//   console.log(req.body.password);

//   output.success = req.body.password == row['password_hash'] ? true : false;
//   if (output.success) {
//     output.error = '';
//     const { sid, account } = row;
//     const token = jwt.sign({ sid, account }, process.env.JWT_SECRET);
//     output.auth = {
//       sid,
//       account,
//       token,
//     };
//   }

//   res.json(output);
// });

// 資料表導入(products)
async function getListData(req, res) {
  const perPage = 16;
  let page = +req.query.page || 1;
  // trim() 去除空白
  let search = req.query.search ? req.query.search.trim() : '';
  let where = `WHERE 1`;
  let sort = `p.created_at DESC`;
  // let priceSort = ` p.member_price DESC`;

  // 分類篩選
  let sortMethod = req.params.sortMethod ? req.params.sortMethod.trim() : '';
  console.log('sortMethod:', sortMethod);
  if (sortMethod) {
    if (sortMethod === 'highToLow') {
      sort = ` p.member_price DESC`;
    } else if (sortMethod === 'lowToHigh') {
      sort = ` p.member_price`;
    }
  }

  // DONE: 特價類型篩選
  // 特價類型篩選
  let salesType = req.query.salesType ? req.query.salesType.trim() : '';
  console.log('salesType:', salesType);
  if (salesType) {
    if (salesType === 'sp') {
      where = `WHERE p.specials = '特價促銷'`;
    } else if (salesType === 'multi') {
      where = `WHERE p.specials = '多件優惠'`;
    }
  }

  // 搜尋篩選
  if (search) {
    where += ` AND(p.name LIKE ${db.escape(
      '%' + search + '%'
    )} OR p.member_price LIKE ${db.escape('%' + search + '%')})`;
    // db.escape() 跳脫
  }
  // res.type('text/plain; charset=utf-8');

  // 分類篩選
  let cate = req.params.cate ? req.params.cate.trim() : '';
  console.log('category:', cate);
  if (cate) {
    if (+cate === 1 || +cate === 2) {
      where += ` AND pc.parent_sid =${cate}`;
    } else if (cate == 0) {
      where += '';
    } else {
      where += ` AND p.category=${cate}`;
    }
  }

  // 價格區間篩選
  let min_price = +req.query.min_price || 0;
  let max_price = +req.query.max_price || 99999;
  console.log({ min_price, max_price });
  if (min_price >= 0 && max_price >= 0) {
    where += ` AND p.member_price BETWEEN ${+min_price} AND ${+max_price}`;
  } else {
    where += ``;
  }

  const t_sql = `SELECT COUNT(1) totalRows FROM \`products\` p JOIN \`product_categories\` pc ON p.category = pc.sid  ${where}  `;
  const [[{ totalRows }]] = await db.query(t_sql);

  let totalPages = 1;
  let rows = [];
  if (totalRows > 0) {
    totalPages = Math.ceil(totalRows / perPage);
    if (page > totalPages) {
      return res.redirect(`?page=${totalPages}`);
    }
    const sql = `SELECT p.*, pc.name cname FROM \`products\` p JOIN \`product_categories\` pc ON p.category = pc.sid ${where} ORDER BY ${sort} LIMIT ${
      (page - 1) * perPage
    }, ${perPage}`;

    [rows] = await db.query(sql);
  }
  return {
    totalRows,
    totalPages,
    perPage,
    page,
    rows,
    search,
    query: req.query,
  };
}

// 商品細節頁 + 相關商品 + 評論
async function getProductData(req) {
  let where = `WHERE 1`;

  // 細節頁
  let sid = req.params.sid ? req.params.sid.trim() : '';
  if (sid) {
    where = `WHERE p.sid =${sid}`;
  }

  const t_sql = `SELECT  AVG(pr.scores) avgScores FROM \`products\` p JOIN \`product_comment\` pr ON pr.p_sid = p.sid ${where}`;
  const [[{ avgScores }]] = await db.query(t_sql);

  let rows = [];

  const sql = `SELECT p.*, pc.name cname  FROM \`products\` p JOIN \`product_categories\` pc ON p.category = pc.sid ${where}  `;

  [rows] = await db.query(sql);

  // 相關商品 (亂數抓取)
  if (rows[0]) {
    const r_sql = `SELECT * FROM products WHERE category=${rows[0].category} AND sid!=${rows[0].sid} ORDER by RAND()  limit 5`;

    [related_p] = await db.query(r_sql);
  }

  // 評論
  if (rows[0]) {
    const c_sql = `SELECT pr.*, m.member_photo FROM \`product_comment\` pr JOIN members_data m ON m.sid=pr.m_sid WHERE pr.p_sid=${sid}`;

    [comment] = await db.query(c_sql);
  }

  return {
    avgScores,
    rows,
    related_p,
    comment,
    query: req.query,
  };
}

// 歷史瀏覽
async function getHistory(req) {
  let sid = req.query.sid ? req.query.sid.trim() : 0;

  const sql = `SELECT * FROM products WHERE sid=${sid}`;

  [history_p] = await db.query(sql);

  return {
    history_p,
  };
}

// 資料表導入(商品收藏)
async function getLovedList(req, res) {
  const m_sid = +req.query.m_sid;

  // 判斷登入
  if (!m_sid) {
    return res.json({ message: '請先登入', code: '401' });
  }

  const sql = `SELECT * FROM product_loved WHERE m_sid=?`;
  const formatSql = SqlString.format(sql, [m_sid]);
  let rows = [];
  [rows] = await db.query(formatSql);
  return { rows };
}

// 資料表導入(商品分類)
async function getCateData(req) {
  const c_sql = `SELECT * FROM product_categories`;
  let rows = [];
  [rows] = await db.query(c_sql);
  return { rows };
}

// 資料表導入(攝影師)
async function getPhotographers(req) {
  let where = ' WHERE 1';

  // 攝影師表單
  let sid = req.params.sid ? req.params.sid.trim() : '';
  if (sid) {
    where = `WHERE sid =${sid}`;
  }

  const p_sql = `SELECT * FROM photographer ${where}`;
  let rows = [];
  [rows] = await db.query(p_sql);
  return { rows };
}

// 資料表導入(首頁推薦商品)
async function getRecommendedProducts(req, res) {
  const mode = req.params.mode;
  let where = 'WHERE 1';
  if (mode) {
    where = `WHERE category=${mode}`;
  }

  const sql = `SELECT * FROM \`products\` ${where} LIMIT 8`;
  let rows = [];
  [rows] = await db.query(sql);
  return { rows };
}

// R
// 取得分類傳至react呈現
router.get('/c-json', async (req, res) => {
  // 商品分類
  const data = await getCateData(req);

  res.json(data);
});

// 資料庫資料以json呈現
router.get(
  '/p-json/:cate?/:sortMethod?/:priceSort?/:salesType?',
  async (req, res) => {
    const data = await getListData(req);

    res.json(data);
  }
);

// 細節頁
router.get('/detail/:sid', async (req, res) => {
  const data = await getProductData(req);

  res.json(data);
});

//抓瀏覽紀錄
router.get('/history', async (req, res) => {
  const data = await getHistory(req);

  res.json(data);
});

// 攝影師資訊
router.get('/photographers-json', async (req, res) => {
  const data = await getPhotographers(req);

  res.json(data);
});

// 攝影師表單
router.get('/photographersForm/:sid', async (req, res) => {
  const data = await getPhotographers(req);

  res.json(data);
});

// 取得收藏列表
router.get('/lovedList', async (req, res) => {
  const data = await getLovedList(req);

  res.json(data);
});

// 取得推薦商品
router.get('/recommended/:mode', async (req, res) => {
  const data = await getRecommendedProducts(req);

  res.json(data);
});

// C
// 新增評價
router.post('/addReply-api', async (req, res) => {
  const getReply = req.body;
  // const now = new Date;
  const m = moment();
  const reply = { ...getReply, created_at: m.format('YYYY-MM-DD HH:mm:ss') };

  console.log(reply);

  if (!reply.scores || !reply.comment || !reply.p_sid || !reply.m_sid) {
    return res.json({ message: '請輸入回應', code: '401' });
  }

  // 產生 sql 語法
  const set = [];
  let setSql = '';
  let insertSql = '';

  // obj.entries -> score : 5 , comment: '測試新增回應' , ....
  for (const [key, value] of Object.entries(reply)) {
    if (value) {
      // SqlString 處理 sql 語法套件
      set.push(`${key} = ${SqlString.escape(value)}`);
    }
  }

  // 檢查
  if (!set.length) {
    return res.json({ message: 'fail', code: '400' });
  }

  setSql = ` SET ` + set.join(`, `);

  insertSql = `INSERT INTO product_comment ${setSql}`;

  console.log(insertSql);

  try {
    // insert to db
    const [result] = await db.query(insertSql, [{ ...reply }]);

    res.json(result);
    if (result.insertSql) {
      return res.json({ message: 'success', code: '200' });
    } else {
      return res.json({ message: 'fail', code: '400' });
    }
  } catch (error) {
    console.log(error.message);
  }
  // res.json(reply);
});

// 新增收藏
router.get('/addLoved-api', async (req, res) => {
  const p_sid = req.query.p_sid;
  const m_sid = req.query.m_sid;

  // 判斷登入
  if (!m_sid) res.json({ message: '請先登入', code: '401' });

  const insertSql =
    'INSERT INTO `product_loved`(`p_sid`, `m_sid`) VALUES (?,?)';

  try {
    const [result] = await db.query(insertSql, [p_sid, m_sid]);

    res.json(result);
    if (result.insertSql) {
      return res.json({ message: 'success', code: '200' });
    } else {
      return res.json({ message: 'fail', code: '403' });
    }
  } catch (error) {
    console.log(error.message);
  }
});

// 移除收藏
router.get('/delLoved-api', async (req, res) => {
  const p_sid = req.query.p_sid;
  const m_sid = req.query.m_sid;

  const delSql = 'DELETE FROM `product_loved` WHERE p_sid=? AND m_sid=?';

  try {
    const [result] = await db.query(delSql, [p_sid, m_sid]);

    res.json(result);
    if (result.insertSql) {
      return res.json({ message: 'success', code: '200' });
    } else {
      return res.json({ message: 'fail', code: '400' });
    }
  } catch (error) {
    console.log(error.message);
  }
});

module.exports = router;
