const express = require('express');
const router = express.Router();
const db = require(__dirname + '/../modules/db_connect');

router.use((req, res, next) => {
  next();
});





module.exports = router;