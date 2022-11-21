const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');
const moment = require('moment-timezone'); // 日期格式(選擇性)
const SqlString = require('sqlstring');

// 資料表導入(products)
async function getListData(req) {
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

  // TODO: 特價類型篩選
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

  let totalPages = 0;
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

// 商品細節頁
async function getProductData(req) {
  let where = `WHERE 1`;

  // 細節頁
  let sid = req.params.sid ? req.params.sid.trim() : '';
  if (sid) {
    where = `WHERE p.sid =${sid}`;
  }

  const t_sql = `SELECT COUNT(1) totalRows, AVG(pr.scores) avgScores FROM \`products\` p JOIN \`product_comment_try\` pr ON pr.p_sid = p.sid ${where}`;
  const [[{ totalRows, avgScores }]] = await db.query(t_sql);

  let totalPages = 0;
  let rows = [];
  if (totalRows > 0) {
    const sql = `SELECT p.*, pc.name cname, pr.*  FROM \`products\` p JOIN \`product_categories\` pc ON p.category = pc.sid JOIN \`product_comment_try\` pr ON pr.p_sid = p.sid ${where}  `;

    [rows] = await db.query(sql);
  }
  return {
    totalRows,
    avgScores,
    totalPages,
    rows,
    query: req.query,
  };
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

// R
// router.get('/', async (req, res) => {
//   // 商品主頁

// });

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

// 新增評價
router.post('/addReply-api', async (req, res) => {
  // const reply = {
  //   scores: 5,
  //   comment: '測試新增回應',
  //   p_sid: 1,
  //   m_sid: 1,
  //   o_sid: 1,
  //   created_at: new Date(),
  // };
  const getReply = req.body;
  // const now = new Date;
  const m = moment();
  const reply = { ...getReply, created_at: m.format('YYYY-MM-DD HH:mm:ss') };

  console.log(reply);

  if (
    !reply.scores ||
    !reply.comment ||
    !reply.p_sid ||
    !reply.m_sid ||
    !reply.o_sid
  ) {
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

  insertSql = `INSERT INTO product_comment_try ${setSql}`;

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

module.exports = router;
