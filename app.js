import express from 'express';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import session from 'express-session';
import { validateForm } from './public/scripts/server-validation.js';
import { Filter } from 'bad-words';


dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT || 3306)
});


async function connect() {
    try {
        const connection = await pool.getConnection();
        console.log(`Connected to database!`);
        return connection;
    } catch (err) {
        console.log('Error connecting to database: ' + err);
        throw err;
    }
}

const app = express();
app.get('/health', (req, res) => res.json({ ok: true }));
app.set('trust proxy', 1); // Railway/any proxy
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
}));
app.use(express.urlencoded({extended:true}));
app.set('view engine','ejs');
app.use(express.static('public'));
const PORT = process.env.PORT || 7000;

/*
 * 
 * 
 * 
 * 
 */
// --- poster proxy (v3 or v4) ---
import 'dotenv/config'; // ensure env is loaded at app start

const fetchAny = typeof fetch === 'function'
  ? fetch
  : (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const posterCache = new Map();
const POSTER_TTL_MS = 1000 * 60 * 60 * 24 * 7;

app.get('/poster', async (req, res) => {
  const title = String(req.query.title || '').trim();
  const year  = String(req.query.year  || '').trim();
  const FALLBACK = '/images/placeholder.png';

  if (!title) return res.redirect(FALLBACK);

  const TMDB_KEY = process.env.TMDB_API_KEY || '';
  if (!TMDB_KEY) {
    console.error('[poster] Missing TMDB_API_KEY');
    return res.redirect(FALLBACK);
  }
  const isV4 = TMDB_KEY.startsWith('eyJ'); // v4 tokens look like a JWT

  const key = (title + '|' + year).toLowerCase();
  const hit = posterCache.get(key);
  if (hit && hit.exp > Date.now()) return res.redirect(hit.url);

  try {
    const url = new URL('https://api.themoviedb.org/3/search/movie');
    url.searchParams.set('query', title);
    if (year) url.searchParams.set('year', year);
    url.searchParams.set('include_adult', 'false');
    url.searchParams.set('language', 'en-US');

    const opts = {};
    if (isV4) {
      opts.headers = { Authorization: `Bearer ${TMDB_KEY}` };
    } else {
      url.searchParams.set('api_key', TMDB_KEY); // v3 key support
    }

    const resp = await fetchAny(url, opts);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.error('[poster] TMDB error', resp.status, txt.slice(0,200));
      return res.redirect(FALLBACK);
    }

    const data = await resp.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    const best = results.find(m => m && m.poster_path) || null;

    const imgUrl = best
      ? `https://image.tmdb.org/t/p/w342${best.poster_path}`
      : FALLBACK;

    posterCache.set(key, { url: imgUrl, exp: Date.now() + POSTER_TTL_MS });
    return res.redirect(imgUrl);
  } catch (e) {
    console.error('[poster] exception', e);
    return res.redirect(FALLBACK);
  }
});



/**
 * 
 * 
 * 
 * 
 * 
 */
app.get('/', async(req,res) => {

    // Logged in users will see their own movies
    let connection;
    try {
        connection = await connect();
    } catch (e) {
        return res.status(503).send('Database unavailable, try again in a moment.');
    }
    let movies = [];

    if (req.session.userID) {
        const[rows] = await connection.query(`SELECT * FROM movieLog WHERE userID = ?`, [req.session.userID]);
        movies = rows;
    } else {
        const[rows] = await connection.query(`SELECT * FROM movieLog`);
        movies = rows;
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
    if (connection) connection.release();

});

app.get('/register', (req,res) => {
    res.render('register');
})

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    //  If fields are empty
    if (!username || !password) return res.send("Username and password are required");

    let connection;
    try {
        connection = await connect();

        const [existingUser] = await connection.query(
            `SELECT  * FROM  users WHERE username = ?`,[username]
        );

    if (existingUser.length > 0) {
        return res.render('register', { error: "Username is already registered."})
    }

        // "Salt rounds", passing passwords with bcrypt adds a random salt (some extra data) and then hashes it (makes it more secure)
        // 2^10 = 1024 rounds of processing. more rounds = more secure but slightly slower to compute
        const hashedPassword = await bcrypt.hash(password, 10); 

        await connection.query(
            `INSERT into users (username, password) VALUES (?, ?)`,
            [username, hashedPassword]
        ); 

        console.log(`Registered user: ${username}`);
        res.redirect('/login');
    } catch (err) {
        console.error("Error registering user:", err);
        res.send("Something went wrong while registering");
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

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
        const [rows] = await connection.query(
            `SELECT * FROM users WHERE username = ?`,
            [username]
        );
        connection.release();

        if (rows.length === 0) {
            return res.render('login', { error: 'User not found.' });
        }

        const user = rows[0];
        const passwordMatch = await bcrypt.compare(password, String(user.password));

        if (!passwordMatch) {
            return res.render('login', { error: 'Incorrect Password.' });
        }

        req.session.userID = user.userID;
        req.session.username = user.username;

        console.log(`Logged in as ${user.username}`);
        req.session.save(() => res.redirect('/'));
        return;
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
    return res.status(401).send('Please log in to add a movie.');
  }
    if (!req.session.userID) {
        return res.redirect('/login');
    }
    res.render('addMovie');
});
app.post('/submit-movie', async(req,res) => {
    if (!req.session.userID) {
        return res.status(401).send('Please log in to add a movie.');
    }

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
    const search = (req.query.search || '').trim();    
    const connection = await connect();
    let movies = [];

    if (req.session.userID) {
        const [rows] = await connection.query(
            `SELECT * FROM movieLog WHERE userID = ? AND title LIKE CONCAT("%", ?, "%")`,
            [req.session.userID, search] // will match any title containing the search term within it
          );
          movies = rows;
    } else {
        // If not logged in, show no movies 
        const [rows] = await connection.query(
            `SELECT * FROM movieLog WHERE title LIKE CONCAT("%", ?, "%")`,
            [search]
        );
        movies = rows
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
    const [result] = await connection.query(
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});