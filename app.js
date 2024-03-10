const express = require('express');
const app = express();

// connection to database
require('./DB/connection');

// Import Files
const Users = require('./Models/users')

app.use(express.json());
app.use(express.urlencoded({extended:false}));

const port = process.env.port || 5000;


app.get('/', async(req, res)=>{
    res.send("I am ok");
    const result = await Users.find({});
    console.log(result);
})

app.listen((port), ()=>{
    console.log("Listning on port ", port);
});
