const jwt = require('jsonwebtoken');
//加密 node src/jwt01 貼上02 sign簽章每次都不一樣tonken(key)
const str = jwt.sign({
    sid: 10,
    account: 'pinwei'
}, 'lasdkf39485349hflskdfsdklfsk');

console.log(str)