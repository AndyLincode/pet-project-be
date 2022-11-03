const mysql = require('mysql2');

const pool = mysql.createPool({
    host:'localhost',
    user:'root',
    password:'root',
    database:'clinic',
    waitForConnections:true,
    connectionLimit:5,
    queueLimit:0
});

module.exports = pool.promise();