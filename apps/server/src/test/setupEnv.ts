// Route every test (including app code using `getPrisma()`) to the dedicated test database.
if (process.env.DATABASE_URL_TEST) process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
