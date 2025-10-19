
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

// Fetch YouTube live chat messages
app.get('/api/livechat', async (req, res) => {
  const { liveChatId, apiKey, pageToken } = req.query;
  if (!liveChatId || !apiKey) {
    return res.status(400).json({ error: 'Missing liveChatId or apiKey' });
  }
  try {
    const url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to index.html for root and unknown routes (for SPA behavior)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
