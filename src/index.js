require('dotenv').config();

const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { db } = require('./configs/db.config');
const testApi = require('./apis/test.api');

/* ============== Import api =============== */

/* ============== Config =============== */
app.use(express.json({}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.SIGNED_COOKIE || 'signed_cookie'));

// set logging
app.use(morgan('tiny'));

/* ============== APis =============== */
app.use('/', testApi);

/* ============== Listening =============== */
const normalizePort = (port) => parseInt(port, 10);
const PORT = normalizePort(process.env.PORT || 3001);

db.sync({ after: true }).then((_) => {
	app.listen(PORT, () => {
		console.log(`Server is listening on port ${PORT}`);
	});
});
