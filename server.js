const express = require('express');
const path = require('path');
const fileupload = require('express-fileupload');

let initial_path = path.joinn(__dirname, "public");

const app = express();
app.use(express.static(initial_path));
app.use(fileupload());

app.get('/', (req, res) -> {
	res.sendFile(path.join(initial_path, "home.html"));
})

app.listen("3000", () => {
	constole.log('listening');
})

app.get('/editor', (req, res) -> {
	res.sendFile(path.join(initial_path, "editor.html"));
})
