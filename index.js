require('dotenv').config();
const express = require('express');
const app = express();
const db = require(__dirname + '/modules/db_connect');
//讀寫檔案
const fs = require('fs').promises;
// app.set('view engine', 'ejs')
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const dayjs = require('dayjs');

dotenv.config();

app.set('view engine', 'ejs');
// top middleware

app.use(cors());
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
//碩恩新增購物車路由 merge後備份11/29
const cartRouter = require(__dirname + '/routes/cart');
app.use('/cart', cartRouter);
// socket io 路由
const socket = require(__dirname + '/routes/socket');
app.use('/service', socket);

// socket.io
// 將 express 放進 http 中開啟 Server 的 6003 port ， 正確開啟後console印出訊息
const socketPort = 3001 || 30002;
const server = require('http')
  .Server(app)
  .listen(socketPort, () => {
    console.log(`open socket server! port:${socketPort}`);
  });

// 將啟動的 Server 送給 socket.io 處理
const io = require('socket.io')(server, {
  // cors 讓 localhost 可跨 port 連接
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

let users = [];

const addUser = (userId, socketId) => {
  !users.some((user) => user.userId === userId) &&
    users.push({ userId, socketId });
};

const removeUser = (socketId) => {
  users = users.filter((user) => user.socketId !== socketId);
};

const getUser = (userId) => {
  return users.find((user) => user.userId === userId);
};

// 監聽 Server 連線後的所有事件，並捕捉事件 socket 執行
io.on('connection', (socket) => {
  // connect
  console.log(`a user Connected !`);
  io.emit('welcome', 'Hello this is socket!');
  // take userId and socketId from user
  socket.on('addUser', (userId) => {
    addUser(userId, socket.id);
    io.emit('getUsers', users);
  });

  // send and get message
  socket.on('sendMessage', ({ senderId, receiverId, text }) => {
    const user = getUser(receiverId);
    io.to(user.socketId).emit('getMessage', {
      receiverId,
      senderId,
      text,
    });
  });

  // disconnect
  socket.on('disconnect', () => {
    console.log('a user disconnected !');
    removeUser(socket.id);
    io.emit('getUsers', users);
  });
});

app.use(express.static('public'));

// --------404-------------

app.use((req, res) => {
  res.status(404).send('Error! NOT FOUND');
});

const port = process.env.SERVER_PORT || 6002;

app.listen(port, () => console.log(`server started, port:${port}`));
