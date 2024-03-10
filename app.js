const express = require('express');
const bcryptjs = require('bcryptjs');
const JWT = require('jsonwebtoken');
const app = express();

// connection to database
require('./DB/connection');

// Import Files
const Users = require('./Models/users')

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const port = process.env.port || 5000;


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

app.post('/api/login', async(req, res, next) => {
    try {
        const {email, password } = req.body;

        if (!email || !password) {
            res.status(400).send("Please fill all required fields");
        }
        else{
            const user = await Users.findOne({email});
            if(!user) {
                res.status(400).send("User not exits");
            }
            else{
                const validateUser = await bcryptjs.compare(password, user.password);
                if(!validateUser) {
                    res.status(400).send("User email or password is incorrect");
                }
                else{
                    const payload = {
                        userId: user.id,
                        email: user.email
                    }
                    const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "scretkey";
                    JWT.sign(payload, JWT_SECRET_KEY, {expiresIn:84600}, async(err, token)=>{ 
                        await Users.updateOne({_id:user._id},{
                            $set:{token}
                        });
                        user.save();
                        next();
                    })
                    res.status(200).json({user:{email:user.email, fullName:user.fullName}, token:user.token});
                }
            }
        }
    }
    catch (e) { console.log(e)};
})

app.listen((port), () => {
    console.log("Listning on port ", port);
});
