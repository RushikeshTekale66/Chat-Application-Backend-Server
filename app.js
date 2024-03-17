const express = require('express');
const bcryptjs = require('bcryptjs');
const JWT = require('jsonwebtoken');
const cors = require('cors');
const app = express();
// socket.io imported
const io = require('socket.io')(8080, {
    cors: {
        origin: 'http://localhost:3000'
    }
});



// connection to database
require('./DB/connection');

// Import Files
const Users = require('./Models/users')
const Conversations = require('./Models/Conversations')
const Message = require('./Models/Messages');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

const port = process.env.port || 8000;

// socket.io integreated
let users = [];
io.on('connection', socket => {
    // console.log("Socket id : ", socket.id);

    // get data from frontend
    socket.on('addUser', userId => {
        const userExist = users.find(user => user.userId === userId);
        if (!userExist) {
            const user = { userId, socketId: socket.id };
            users.push(user);
            // send data to frontend
            io.emit('getUsers', users);
        }
    });

    socket.on('disconnect', () => {
        users = users.filter(user => user.socketId !== socket.id);
        io.emit('getUsers', users);
    });

    socket.on('sendMessage', async ({ senderId, receiverId, message, conversationId }) => {
        const receiver = users.find(user => user.userId === receiverId);
        const sender = users.find(user => user.userId === senderId);
        const user = await Users.findById(senderId);
        if (receiver) {
            io.to(receiver.socketId).to(sender.socketId).emit('getMessage', {
                senderId,
                message,
                conversationId,
                receiverId,
                user: { id: user._id, fullName: user.fullName, email: user.email }
            })
        }
        else {
            io.to(sender.socketId).emit('getMessage', {
                senderId,
                message,
                conversationId,
                receiverId,
                user: { id: user._id, fullName: user.fullName, email: user.email }
            })
        }
    })

})


app.get('/', async (req, res) => {
    res.send("I am ok")
    let result = await Users.find({});
    console.log(result);
})

// Register user
app.post(('/api/register'), async (req, res, next) => {
    try {
        const { fullName, email, password } = req.body;

        if (!fullName || !email || !password) {
            res.status(400).send("Please fill all required fields");
        }
        else {
            const isAlreadExist = await Users.findOne({ email });
            if (isAlreadExist) {
                res.status(400).send("User already exist");
            }
            else {
                const newUser = new Users({ fullName, email });
                bcryptjs.hash(password, 10, (err, hashedPassword) => {
                    newUser.set('password', hashedPassword);
                    newUser.save();
                    next();
                });
                return res.status(200).send("User registered successfully");
            }
        }
    }
    catch (err) { }
})

// Login to application
app.post('/api/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).send("Please fill all required fields");
        }
        else {
            const user = await Users.findOne({ email });
            if (!user) {
                res.status(400).send("User not exits");
            }
            else {
                const validateUser = await bcryptjs.compare(password, user.password);
                if (!validateUser) {
                    res.status(400).send("User email or password is incorrect");
                }
                else {
                    const payload = {
                        userId: user.id,
                        email: user.email
                    }
                    const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "scretkey";
                    JWT.sign(payload, JWT_SECRET_KEY, { expiresIn: 84600 }, async (err, token) => {
                        await Users.updateOne({ _id: user._id }, {
                            $set: { token }
                        });
                        user.save();
                        return res.status(200).json({ user: { email: user.email, fullName: user.fullName, id: user._id }, token: token });

                    })


                }
            }
        }
    }
    catch (e) { console.log(e) };
})

// Make conversation between two users
app.post("/api/conversation", async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        const newConversation = new Conversations({ members: [senderId, receiverId] });
        await newConversation.save();
        res.status(200).send("Conversation created successfully")
    } catch (error) {
        console.log(error);
    }
})

// Get conversation of user
app.get("/api/conversations/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const conversations = await Conversations.find({ members: { $in: [userId] } });
        // console.log(userId);
        const conversationUserData = Promise.all(conversations.map(async (conconversation) => {
            const receiverId = conconversation.members.find((member) => member !== userId);
            const user = await Users.findById(receiverId);
            return { user: { receiverId: user._id, email: user.email, fullName: user.fullName }, conversationId: conconversation._id };
        }))
        res.status(200).json(await conversationUserData);
    } catch (error) {
        console.log("Error", error);
    }
})

// Send message to database
app.post('/api/message', async (req, res) => {
    try {
        const { conversationId, senderId, message, receiverId = '' } = req.body;
        if (!senderId || !message) return res.status(400).send("Please fill all required fields");
        if (conversationId === 'new' && receiverId) {
            const newConversation = new Conversations({ members: [senderId, receiverId] });
            await newConversation.save();
            const newMessage = new Message({ conversationId: newConversation._id, senderId, message });
            await newMessage.save();
            console.log(senderId, " receiver ", receiverId);
        }
        else if (!conversationId && !receiverId) {
            return res.status(400).send("Please fill required fields conversation");
        }
        const newMessage = new Message({ conversationId, senderId, message });
        await newMessage.save();
        res.status(200).send("Message sent successfully");
        // console.log(senderId , " receiver ", receiverId, "converid", conversationId);

    } catch (error) {
        console.log(error, " Error");
    }
})

// Get the conversation messages
app.get('/api/messages/:conversationId', async (req, res) => {
    try {
        const checkMessage = async (conversationId) => {
            const messages = await Message.find({ conversationId });
            const messageUserData = Promise.all(messages.map(async (message) => {
                const user = await Users.findById(message.senderId);
                return { user: { id: user._id, email: user.email, fullName: user.fullName }, message: message.message }
            }))
            res.status(200).json(await messageUserData);
        }
        const conversationId = req.params.conversationId;
        if (conversationId === 'new') {
            const checkConversation = await Conversations.find({ members: { $in: [req.query.senderId, req.query.receiverId] } });
            if (checkConversation.length > 0) {
                checkMessage(checkConversation[0]._id);
            }
            else {
                return res.status(200).json([]);
            }
            // return res.status(200).json([]);
        }
        else {
            checkMessage(conversationId);
        }


    } catch (error) {
        console.log("Error : ", error);
    }
})

// get all users
app.get("/api/users/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const users = await Users.find({ _id: { $ne: userId } });
        // console.log(users);
        const usersData = Promise.all(users.map(async (user) => {
            return { user: { email: user.email, fullName: user.fullName, receiverId: user._id } };
        }))
        res.status(200).send(await usersData);

    } catch (error) {
        console.log("Error ", error);
    }
})

app.listen((port), () => {
    console.log("Listning on port ", port);
});
