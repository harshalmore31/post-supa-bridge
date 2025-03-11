const express = require('express');
require('dotenv').config();
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the "supa" directory
app.use(express.static(path.join(__dirname, 'supa')));

// Endpoint to pass config values to index.html
app.get('/config', (req, res) => {
  res.json({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY
  });
});

// Fallback route to serve index.html for any other request
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'supa', 'index.html'));
});

app.listen(port, () => console.log(`Server listening on port ${port}`));
