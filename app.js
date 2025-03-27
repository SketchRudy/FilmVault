import express from 'express';
import mariadb from 'mariadb';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import session from 'express-session';
import { validateForm } from './public/scripts/server-validation.js';
import { Filter } from 'bad-words';


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
app.use(session({
    secret: 'some-random-secret-here',
    resave: false,
    saveUninitialized: false
  }));
app.use(express.urlencoded({extended:true}));
app.set('view engine','ejs');
app.use(express.static('public'));
const PORT = 7000;
app.get('/', async(req,res) => {

    const connection = await connect();
    // Logged in users will see their own movies
    let movies = [];
    if (req.session.userID) {
        movies = await connection.query(`SELECT * FROM movieLog WHERE userID = ?`, [req.session.userID]);
    } else {
        movies = await connection.query(`SELECT * FROM movieLog`)
    }

    const groupedMovies = {};

    movies.forEach(movie => {
      if (!groupedMovies[movie.genre]) {
        groupedMovies[movie.genre] = [];
      }
      groupedMovies[movie.genre].push(movie);
    });
    
    res.render('home',{ movies, 
        groupedMovies,
        search: '', // Define search as an empty string so it won't throw an error visiting home page
        user: req.session.userID ? { // Display current user with ternary operator
            id: req.session.userID,
            username: req.session.username} : null
    }); 
    connection.release();

});

app.get('/register', (req,res) => {
    res.render('register');
})

app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    //  If fields are empty
    if (!username || !password) {
        return res.send("Username and password are required");
    }

        const connection = await connect();
        const existingUser = await connection.query(`SELECT  * FROM  users WHERE username = ?`,[username]);

    if (existingUser.length > 0) {
        connection.release();
        return res.render('register', { error: "Username is already registered."})
    }



    try {
        // "Salt rounds", passing passwords with bcrypt adds a random salt (some extra data) and then hashes it (makes it more secure)
        // 2^10 = 1024 rounds of processing. more rounds = more secure but slightly slower to compute
        const hashedPassword = await bcrypt.hash(password, 10); 
        const connection = await connect();

        await connection.query(
            `INSERT into users (username, password) VALUES (?, ?)`,
            [username, hashedPassword]
        ); 
        connection.release();

        console.log(`Registered user: ${username}`);
        res.redirect('/login');
    } catch (err) {
        console.error("Error registering user:", err);
        res.send("Something went wrong while registering");
    }
})

app.get('/login', (req,res) => {
    res.render('login');
})

app.post('/login', async(req,res) => {

    const { username, password } = req.body;

    if (!username || !password) {
        return res.send("Username and password are required.");
    }

    try {
        const connection = await connect();
        const result = await connection.query(
            `SELECT * FROM users WHERE username = ?`,
            [username]
        );
        connection.release();

        if (result.length === 0) {
            return res.render('login', { error: 'User not found.' });
        }

        const user = result[0];
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.render('login', { error: 'Incorrect Password.' });
        }

        req.session.userID = user.userID;
        req.session.username = user.username;

        console.log(`Logged in as ${user.username}`);
        res.redirect('/');
    } catch (err) {
        console.error("Login Error:", err);
        res.send("Something went wrong during login")
    }

})

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout error:", err);
        }
        res.redirect('/');
    });
});


app.get('/addMovie', (req,res) => {
    if (!req.session.userID) {
        return res.redirect('/login');
    }
    res.render('addMovie');
});
app.post('/submit-movie', async(req,res) => {
    const filter = new Filter();

    const newMovie = {
        title: req.body.title,
        director: req.body.director,
        genre: req.body.genre,
        year: req.body.year,
        rating: req.body.rating,
        comments: req.body.comments
    }

    newMovie.comments = filter.clean(newMovie.comments);

    const result = validateForm(newMovie);
     if (!result.isValid) {
         console.log(result.errors);
         res.send(result.errors);
         return;
     }

    const connection = await connect();
    
    await connection.query(
        `INSERT INTO movieLog (title, director, genre, year, rating, comments, userID)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newMovie.title, newMovie.director, newMovie.genre, newMovie.year, newMovie.rating, newMovie.comments, req.session.userID]
    );    
    connection.release();

    console.log(newMovie);
    res.redirect('/');
});

app.get('/search', async (req,res) => {
    const search = req.query.search || '';    
    const connection = await connect();
    let movies = [];

    if (req.session.userID) {
        movies = await connection.query(
            `SELECT * FROM movieLog WHERE userID = ? AND LOWER(title) LIKE LOWER(?)`,
            [req.session.userID, `%${search}%`] // will match any title containing the search term within it
          );
    } else {
        // If not logged in, show no movies 
        movies = await connection.query(
            `SELECT * FROM movieLog WHERE LOWER(title) LIKE LOWER(?)`,
            [`%${search}%`]
        );
    }

    const groupedMovies = {};

    movies.forEach(movie => {
      if (!groupedMovies[movie.genre]) {
        groupedMovies[movie.genre] = [];
      }
      groupedMovies[movie.genre].push(movie);
    });
    
      res.render('home', { movies, 
        groupedMovies,
        search, user: req.session.userID ? {
            id: req.session.userID,
            username: req.session.username} : null
    });
    connection.release();
})

app.get('/edit/:id', async (req, res) => {
    const movieID = req.params.id // Access' route parameters
    const connection = await connect();
    const result = await connection.query(
        `SELECT * FROM movieLog WHERE movieLogID = ?`,
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
    const filter =  new Filter();

    const editMovie = {
        movielogID: req.body.movielogID,
        title: req.body.title,
        director: req.body.director,
        genre: req.body.genre,
        year: req.body.year,
        rating: req.body.rating,
        comments: req.body.comments
      };

      editMovie.comments = filter.clean(editMovie.comments);

    const connection = await connect();
    await connection.query(
        `UPDATE movielog SET title = ?, director = ?, genre = ?, year = ?, rating = ?, comments = ? WHERE movielogID = ?`,
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
      connection.release();
      res.redirect('/');
})

app.delete('/movie/:id', async(req,res) =>{
    const movieID = req.params.id;
    try {
    const connection = await connect();
    await connection.query(`DELETE FROM movieLog WHERE movielogID = ?`, [movieID]);
    connection.release();
    console.log(`Movie ${movieID} successfully deleted`);
    res.status(200).json({ success: true });
    } catch (err) {
        console.error("Error deleting movie", err);
        res.status(500).json({ success: false, error: 'Deletion Failed'});
    }
})

app.get('/intro', (req,res) =>{
    res.render('intro');
})

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});