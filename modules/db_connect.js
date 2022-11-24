const mysql = require('mysql2');

const pool = mysql.createPool({
    host:'localhost',
    user:'pinwei',
    password:'root',
    database:'member_ship',
    waitForConnections:true,
    connectionLimit:5,
    queueLimit:0
});

module.exports = pool.promise();