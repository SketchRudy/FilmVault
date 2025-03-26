import express from 'express';
import mariadb from 'mariadb';
import dotenv from 'dotenv';
import { validateForm } from './public/scripts/server-validation.js';

dotenv.config();

const pool = mariadb.createPool({
    host: process.env.DB_HOST_LOCAL,
    user: process.env.DB_USER_LOCAL,
    password: process.env.DB_PASSWORD_LOCAL,
    database: process.env.DB_DATABASE_LOCAL
});

// const pool = mariadb.createPool({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_DATABASE
// });


async function connect() {
    try {
        const connection = await pool.getConnection();
        console.log(`Connected to database!`);
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
app.get('/', async(req,res) => {
    const connection = await connect();
    const movies = await connection.query(`SELECT * FROM movieLog;`);
    res.render('home',{ movies, search: '' }); // Define search as an empty string so it won't throw an error visiting home page
    connection.release();

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
        rating: req.body.rating,
        comments: req.body.comments
    }

    const result = validateForm(newMovie);
     if (!result.isValid) {
         console.log(result.errors);
         res.send(result.errors);
         return;
     }

    const connection = await connect();
    
    await connection.query(
        `INSERT INTO movieLog (title, director, genre, year, rating, comments)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newMovie.title, newMovie.director, newMovie.genre, newMovie.year, newMovie.rating, newMovie.comments]
    );    
    connection.release();

    console.log(newMovie);
    res.redirect('/');
});

app.get('/search', async (req,res) => {
    const search = req.query.search || '';
    const connection = await connect();
    const movies = await connection.query(
        `SELECT * FROM movieLog WHERE LOWER(title) LIKE LOWER(?)`,
        [`%${search}%`] // will match any title containing the search term within it
      );
      res.render('home', { movies, search });
      connection.release();
})

app.get('/edit/:id', async (req, res) => {
    const movieID = req.params.id // Access' route parameters
    const connection = await connect();
    const result = await connection.query(
        `SELECT * FROM movieLog WHERE movielogID = ?`,
        [movieID]
    );
    if(result.length > 0) {
        const movie = result[0];
        res.render('editMovie', { movie });
    } else {
        res.status(404).send('Movie not found'); 
    }
    connection.release();
})

app.post('/edit-movie', async (req, res) => {
    const editMovie = {
        movielogID: req.body.movielogID,
        title: req.body.title,
        director: req.body.director,
        genre: req.body.genre,
        year: req.body.year,
        rating: req.body.rating,
        comments: req.body.comments
      };

    const connection = await connect();
    await connection.query(
        `UPDATE movieLog SET title = ?, director = ?, genre = ?, year = ?, rating = ?, comments = ? WHERE movielogID = ?`,
        [
            editMovie.title, 
            editMovie.director, 
            editMovie.genre, 
            editMovie.year, 
            editMovie.rating,
            editMovie.comments, 
            editMovie.movielogID
        ]
      );
      res.redirect('/');
      connection.release();
})

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});