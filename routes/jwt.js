const jwt = require('jsonwebtoken');
//解密 透過tonken,key去解析資料
const myToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzaWQiOjEwLCJhY2NvdW50IjoicGlud2VpIiwiaWF0IjoxNjY3ODA5MDUzfQ.flx2BPfm5KI3pv8hG1dPy5BDYLH7d2RlubLkZbSOKEU';


const payload = jwt.verify(myToken, 'lasdkf39485349hflskdfsdklfsk');

//node src/jwt02{ sid: 10, account: 'pinwei', iat: 1667809053 }

console.log(payload);