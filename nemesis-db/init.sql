CREATE TABLE Users (
    user_id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    balance REAL NOT NULL DEFAULT 0
);


CREATE TABLE Transactions (
    transaction_id INTEGER PRIMARY KEY,
    sender_id INTEGER,
    receiver_id INTEGER,
    amount REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES Users(user_id),
    FOREIGN KEY (receiver_id) REFERENCES Users(user_id),
    CHECK (sender_id != receiver_id)  -- Ensures the sender and receiver are not the same user
);


INSERT INTO Users (username, balance) VALUES ('exampleUser', 1000.00);