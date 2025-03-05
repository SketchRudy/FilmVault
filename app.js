import express from 'express';
import mariadb from 'mariadb';
// import dotenv from 'dotenv';

const app = express();
app.use(express.urlencoded({extended:true}));
app.set('view engine','ejs');
app.use(express.static('public'));
const PORT = 3000;
app.get('/', (req,res) => {
    res.render('home');
});
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
})