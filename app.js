import express from 'express';
import mariadb from 'mariadb';
import dotenv from 'dotenv';

dotenv.config();

const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

async function connect() {
    try {
        const connection = await pool.getConnection();
        console.log(`Connected to database: ${pool.database}`);
        return connection;
    } catch (err) {
        console.log('Error connecting to database: ' + err);
    }
}

const app = express();
app.use(express.urlencoded({extended:true}));
app.set('view engine','ejs');
app.use(express.static('public'));
const PORT = 7000;
app.get('/', (req,res) => {
    res.render('home');
});
app.get('/addMovie', (req,res) => {
    res.render('addMovie');
});
app.post('/submit-movie', async(req,res) => {
    const newMovie = {
        title: req.body.title,
        director: req.body.director,
        genre: req.body.genre,
        year: req.body.year,
        comments: req.body.comments
    }
    // const connection = await connect();
    // const movies = await connection.query(`INSERT INTO movieLog (title,director,genre,year,comments) VALUES ("${newMovie.title}","${newMovie.director}","${newMovie.genre}",${newMovie.year},"${newMovie.comments}");`);
    console.log(newMovie);
    res.render('home');
});
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});