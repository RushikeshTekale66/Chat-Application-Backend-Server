const express = require('express');
const bcryptjs = require('bcryptjs');
const JWT = require('jsonwebtoken');
const cors = require('cors');
const app = express();


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
        const { conversationId, senderId, message, receiverId='' } = req.body;
        if(!senderId || !message) return res.status(400).send("Please fill all required fields");
        if(!conversationId && receiverId){
            const newConversation = new Conversations({members:[senderId, receiverId]});
            await newConversation.save();
            const newMessage = new Message({conversationId, senderId, message});
            await newMessage.save();
        }
        else if(!conversationId && !receiverId){
            return res.status(400).send("Please fill required fields conversation");
        }
        const newMessage = new Message({ conversationId, senderId, message });
        await newMessage.save();
        res.status(200).send("Message sent successfully");

    } catch (error) {
        console.log(error, " Error");
    }
})

// Get the conversation messages
app.get('/api/messages/:conversationId', async (req, res) => {
    try {
        const conversationId = req.params.conversationId;
        if(conversationId==='new') return res.status(200).json([]);
        const messages = await Message.find({ conversationId });
        const messageUserData = Promise.all(messages.map(async (message) => {
            const user = await Users.findById(message.senderId);
            return { user: {id: user._id, email: user.email, fullName: user.fullName}, message: message.message }
        }))
        res.status(200).json( await messageUserData);


    } catch (error) {

    }
})

// get all users
app.get("/api/users", async(req, res)=>{
    try {
        const users = await Users.find();
        const usersData = Promise.all(users.map(async(user)=>{
            return {user: {email:user.email, fullName: user.fullName, }, userId:user._id};
        }))
        res.status(200).send(await usersData);
        
    } catch (error) {
        console.log("Error ", error);
    }
})

app.listen((port), () => {
    console.log("Listning on port ", port);
});
