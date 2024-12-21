const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public')); // serve your static front-end files from 'public'

// 1) Return a list of JSON filenames from the 'data' folder
app.get('/api/files', (req, res) => {
  const dataDir = path.join(__dirname, 'data');
  fs.readdir(dataDir, (err, files) => {
    if (err) {
      return res.status(500).send('Error reading data directory');
    }
    // Only keep files that end with .json
    const jsonFiles = files.filter(file => path.extname(file) === '.json');
    // Remove the .json extension for a cleaner list
    const filenames = jsonFiles.map(file => path.basename(file, '.json'));
    res.json(filenames);
  });
});

// 2) GET a specific file's contents
app.get('/api/actor/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'data', `${req.params.filename}.json`);
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Error reading file');
    }
    res.json(JSON.parse(data));
  });
});

// 3) POST (save) a specific file's contents
app.post('/api/actor/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'data', `${req.params.filename}.json`);
  fs.writeFile(filePath, JSON.stringify(req.body, null, 2), err => {
    if (err) {
      return res.status(500).send('Error saving file');
    }
    res.send('File saved successfully');
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
