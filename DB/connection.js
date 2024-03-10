const mongoose = require('mongoose');

const url = "mongodb+srv://rushikesh:Rushi7887@cluster0.fllhqkj.mongodb.net/ChatApp";

mongoose.connect(url).then(()=>console.log("Connected to database")).catch((e)=>console.log("Error", e));