const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// 创建 Express 应用
const app = express();
const server = http.createServer(app);

// 设置 WebSocket
const io = socketIo(server);

// 设置 CORS 以允许前端跨域请求
app.use(cors({
    origin: 'http://talk.hekuo.us.kg', // 允许的前端域名
    methods: ['GET', 'POST'],
    credentials: true
}));

// 中间件解析 JSON
app.use(express.json());

// 服务器的用户数据库（可以替换为实际数据库）
let users = [];
let messages = [];

// 用于生成 JWT 的秘钥（开发环境下使用常量，生产环境请使用更复杂的秘钥）
const JWT_SECRET = 'your_jwt_secret_key';

// 用户注册
app.post('/register', async(req, res) => {
    const { username, password } = req.body;

    // 确保用户名唯一
    const existingUser = users.find(user => user.username === username);
    if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 保存用户数据
    const newUser = { username, password: hashedPassword };
    users.push(newUser);

    res.status(201).json({ message: 'User registered successfully' });
});

// 用户登录
app.post('/login', async(req, res) => {
    const { username, password } = req.body;

    const user = users.find(user => user.username === username);
    if (!user) {
        return res.status(400).json({ message: 'Invalid username or password' });
    }

    // 比对密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(400).json({ message: 'Invalid username or password' });
    }

    // 生成 JWT
    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({ token });
});

// JWT 验证中间件
function authenticateJWT(req, res, next) {
    const token = req.headers['authorization'];

    if (!token) {
        return res.sendStatus(403); // Forbidden if no token is found
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }

        req.user = user;
        next();
    });
}

// 群组和消息数据（简化示例）
const groups = [
    { id: 'bigGroup', name: '大群', members: [] }
];

// 处理 WebSocket 连接
io.on('connection', (socket) => {
    console.log('a user connected');

    // 加入群组
    socket.on('joinGroup', (groupId) => {
        socket.join(groupId);
        console.log(`User joined group: ${groupId}`);
    });

    // 发送消息
    socket.on('sendMessage', (msg) => {
        // 存储消息
        messages.push(msg);

        // 广播消息到指定群组
        io.to(msg.groupId).emit('newMessage', msg);
    });

    // 获取消息记录
    socket.on('getMessages', (groupId) => {
        const groupMessages = messages.filter(msg => msg.groupId === groupId);
        socket.emit('groupMessages', groupMessages);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

// 启动服务器
const port = 3001;
server.listen(port, () => {
    console.log(`Server is running on http://talk.hekuo.us.kg:${port}`);
});