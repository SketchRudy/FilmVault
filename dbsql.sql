-- CREATE DATABASE IF NOT EXISTS filmvault;
-- USE filmvault;

-- CREATE TABLE users (
-- 	   userID INT auto_increment,
--     username VARCHAR(255) not null unique,
--     password VARCHAR(255) not null,
--     PRIMARY KEY (userID)
-- );

-- CREATE TABLE movieLog (
-- 	   movielogID INT auto_increment,
--     title VARCHAR(255),
--     director VARCHAR(255),
--     genre VARCHAR(255),
--     year INT,
--     rating INT,
--     comments TEXT,
--     PRIMARY KEY (movielogID)
--     FOREIGN KEY (userID) REFERENCES users(userID)
-- );

-- DROP TABLE movieLog

-- SELECT * FROM movieLog;
