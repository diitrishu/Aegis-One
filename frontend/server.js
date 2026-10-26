#!/usr/bin/env node
/**
 * AEGIS-1 - FRONTEND SERVER
 * Serves the web interface and forwards /api/* to the Python backend API.
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/+$/, '');

app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve main dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Legacy route: /api/report/:id -> backend /api/disasters/:id/report-data
app.get('/api/report/:disasterId', async (req, res) => {
    await forward(req, res, `/api/disasters/${encodeURIComponent(req.params.disasterId)}/report-data`);
});

// Everything else under /api goes straight to the Python backend
// (status, create_disaster, facilities, disasters, layers, damage, population, v2/...)
app.use('/api', async (req, res) => {
    await forward(req, res, `/api${req.url}`);
});

async function forward(req, res, backendPath) {
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    try {
        const response = await fetch(`${BACKEND_URL}${backendPath}`, {
            method: req.method,
            headers: hasBody ? { 'Content-Type': 'application/json' } : {},
            body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
            signal: AbortSignal.timeout(30000)
        });
        const text = await response.text();
        res.status(response.status);
        res.set('Content-Type', response.headers.get('content-type') || 'application/json');
        res.send(text);
    } catch (error) {
        console.error(`Backend request failed (${req.method} ${backendPath}):`, error.message);
        res.status(502).json({
            success: false,
            error: 'Backend API is not reachable',
            message: `Could not reach ${BACKEND_URL}. Start it with: python backend/simple_disaster_api.py`,
            system_ready: false
        });
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log('AEGIS-1 FRONTEND');
        console.log('====================================================');
        console.log(`Server running at: http://localhost:${PORT}`);
        console.log(`Backend API:       ${BACKEND_URL}`);
        console.log('====================================================');
    });

    process.on('SIGINT', () => { console.log('\nShutting down frontend server...'); process.exit(0); });
    process.on('SIGTERM', () => { console.log('\nShutting down frontend server...'); process.exit(0); });
}

module.exports = app;
