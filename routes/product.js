const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');
const moment = require('moment-timezone'); // 日期格式(選擇性)

// 資料表導入(products)
async function getListData(req) {
  const perPage = 16;
  let page = +req.query.page || 1;
  // trim() 去除空白
  let search = req.query.search ? req.query.search.trim() : '';
  let where = `WHERE 1`;
  if (search) {
    where += ` AND(\`name\` LIKE ${db.escape(
      '%' + search + '%'
    )} OR \`sid\` LIKE ${db.escape('%' + search + '%')})`;
    // db.escape() 跳脫
  }

  // 分類篩選
  let cate = req.params.cate ? req.params.cate.trim() : '';
  // console.log(cate);
  if (cate) {
    if (+cate === 1 || +cate === 2) {
      where = `JOIN \`product_categories\` pc ON p.category = pc.sid WHERE pc.parent_sid =${cate}`;
    } else {
      where = `WHERE \`category\`=${cate}`;
    }
  }

  // 細節頁
  let sid = req.params.sid ? req.params.sid.trim() : '';
  // console.log(sid);
  if (sid) {
      where = `JOIN \`product_categories\` pc ON p.category = pc.sid WHERE p.sid =${sid}`;
  }

  const t_sql = `SELECT COUNT(1) totalRows FROM products p ${where}`;
  const [[{ totalRows }]] = await db.query(t_sql);

  let totalPages = 0;
  let rows = [];
  if (totalRows > 0) {
    totalPages = Math.ceil(totalRows / perPage);
    if (page > totalPages) {
      return res.redirect(`?page=${totalPages}`);
    }
    const sql = `SELECT p.* FROM \`products\` p ${where} ORDER BY sid DESC LIMIT ${
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

// 資料表導入(商品分類)
async function getCateData(req) {
  const c_sql = `SELECT * FROM product_categories`;
  let rows = [];
  [rows] = await db.query(c_sql);
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
router.get('/p-json', async (req, res) => {
  const data = await getListData(req);

  res.json(data);
});

// 分類篩選
router.get('/p-json/cate/:cate', async (req, res) => {
  const data = await getListData(req);

  res.json(data);
});

// 細節篩選
router.get('/p-json/detail/:sid', async (req, res) => {
  const data = await getListData(req);

  res.json(data);
});

module.exports = router;
