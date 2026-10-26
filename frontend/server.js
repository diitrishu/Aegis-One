#!/usr/bin/env node
/**
 * AEGIS-1 - FRONTEND SERVER
 * Node.js web interface for emergency response operations
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Utility function to execute Python commands in backend
function executePython(command, args = []) {
    return new Promise((resolve, reject) => {
        const backendPath = path.join(__dirname, '..', 'backend');
        const pythonProcess = spawn('python', [command, ...args], {
            cwd: backendPath
        });
        
        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(new Error(`Python process exited with code ${code}: ${stderr}`));
            }
        });

        pythonProcess.on('error', (error) => {
            reject(error);
        });
    });
}

// Serve main dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to get system status
app.get('/api/status', async (req, res) => {
    try {
        console.log('🔍 Getting system status...');
        const output = await executePython('disaster_cli_clean.py', ['status']);
        
        // Debug: Log raw output
        console.log('📄 Raw output sample:', output.substring(output.length - 500));
        
        // Parse the output to extract key information
        const statusData = {
            system_ready: output.includes('System Ready: YES'),
            total_facilities: extractNumber(output, 'Total Facilities:'),
            operational_facilities: extractNumber(output, 'Operational Facilities:'),
            districts_covered: extractNumber(output, 'Districts Covered:'),
            historical_disasters: extractNumber(output, 'Historical Disasters:'),
            active_disasters: extractNumber(output, 'Active Disasters:'),
            hospitals: extractNumber(output, 'Hospitals:'),
            fire_stations: extractNumber(output, 'Fire Stations:'),
            police_stations: extractNumber(output, 'Police Stations:'),
            last_updated: new Date().toISOString(),
            raw_output: output.split('\n').slice(-20).join('\n') // Last 20 lines for debugging
        };

        console.log('✅ System status retrieved:', {
            ready: statusData.system_ready,
            facilities: statusData.total_facilities,
            hospitals: statusData.hospitals,
            fire_stations: statusData.fire_stations,
            police_stations: statusData.police_stations
        });

        res.json(statusData);
    } catch (error) {
        console.error('❌ Error getting system status:', error.message);
        res.status(500).json({
            error: 'Failed to get system status',
            message: error.message,
            system_ready: false,
            total_facilities: 0,
            districts_covered: 0,
            historical_disasters: 0,
            active_disasters: 0
        });
    }
});

// API endpoint to create disaster
app.post('/api/create_disaster', async (req, res) => {
    try {
        console.log('🚨 Creating disaster event:', req.body);
        
        const { disaster_type, latitude, longitude, description, severity = 'medium', radius_km = 5 } = req.body;
        
        // Validate required fields
        if (!disaster_type || !latitude || !longitude || !description) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: disaster_type, latitude, longitude, description'
            });
        }

        const args = [
            'create',
            '--type', disaster_type,
            '--lat', latitude.toString(),
            '--lon', longitude.toString(),
            '--desc', description,
            '--severity', severity,
            '--radius', radius_km.toString()
        ];

        const output = await executePython('disaster_cli_clean.py', args);
        
        // Extract disaster ID from output
        const disasterIdMatch = output.match(/DISASTER EVENT CREATED: ([^\s\n]+)/);
        const disasterId = disasterIdMatch ? disasterIdMatch[1] : 'unknown';
        
        // Extract JSON data from output
        let responseData = {
            agencies_notified: false,
            facilities_identified: false,
            population_assessed: false,
            coordination_initiated: false,
            affected_population: 0,
            facilities: {
                hospitals: 0,
                fire_stations: 0,
                police_stations: 0,
                total_capacity: 0
            }
        };
        
        const jsonMatch = output.match(/===JSON_START===([\s\S]*?)===JSON_END===/);
        if (jsonMatch) {
            try {
                responseData = JSON.parse(jsonMatch[1].trim());
            } catch (e) {
                console.error('Failed to parse JSON response:', e);
            }
        }

        console.log('✅ Disaster created:', disasterId);

        res.json({
            success: true,
            disaster_id: disasterId,
            message: 'Emergency response protocol activated',
            details: {
                type: disaster_type.toUpperCase(),
                location: `${latitude}, ${longitude}`,
                severity: severity.toUpperCase(),
                radius: `${radius_km} km`
            },
            response: responseData
        });

    } catch (error) {
        console.error('❌ Error creating disaster:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to create disaster event',
            message: error.message
        });
    }
});

// API endpoint to find facilities
app.get('/api/facilities', async (req, res) => {
    try {
        const { lat, lon, type, radius = 15, limit = 10 } = req.query;
        
        if (!lat || !lon) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: lat, lon'
            });
        }

        console.log(`🏥 Finding facilities near ${lat}, ${lon} (radius: ${radius}km)`);

        const args = [
            'facilities',
            '--lat', lat,
            '--lon', lon,
            '--radius', radius.toString(),
            '--limit', limit.toString()
        ];

        if (type) {
            args.push('--type', type);
        }

        const output = await executePython('disaster_cli_clean.py', args);
        
        // Check if system loaded facilities
        if (output.includes('0 facilities loaded') || output.includes('No facilities found')) {
            console.log('⚠️  No facilities data loaded or found');
            return res.json({
                success: true,
                facilities: [],
                count: 0,
                parameters: { lat, lon, type, radius, limit },
                message: 'No facilities found in the database. The system may need facility data to be loaded.',
                raw_output: output
            });
        }
        
        // Parse facilities from output
        const facilities = parseFacilitiesOutput(output);

        console.log(`✅ Found ${facilities.length} facilities`);

        res.json({
            success: true,
            facilities: facilities,
            count: facilities.length,
            parameters: { lat, lon, type, radius, limit }
        });

    } catch (error) {
        console.error('❌ Error finding facilities:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to find facilities',
            message: error.message,
            facilities: [],
            count: 0
        });
    }
});

// API endpoint to get disaster report
app.get('/api/report/:disasterId', async (req, res) => {
    try {
        const { disasterId } = req.params;
        console.log(`📋 Getting report for disaster: ${disasterId}`);
        
        const output = await executePython('disaster_cli_clean.py', ['report', '--disaster-id', disasterId]);
        
        res.json({
            success: true,
            disaster_id: disasterId,
            report: parseReportOutput(output),
            raw_output: output
        });

    } catch (error) {
        console.error('❌ Error getting disaster report:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get disaster report',
            message: error.message
        });
    }
});

// Utility functions
function extractNumber(text, label) {
    const regex = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*([\\d,]+)`, 'i');
    const match = text.match(regex);
    if (match) {
        return parseInt(match[1].replace(/,/g, ''));
    }
    return 0;
}

function parseFacilitiesOutput(output) {
    try {
        // Try to extract JSON output first
        const jsonMatch = output.match(/===JSON_START===([\s\S]*?)===JSON_END===/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1].trim());
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                console.error('Failed to parse JSON facilities:', e);
            }
        }
        
        // Fallback to text parsing
        const facilities = [];
        const lines = output.split('\n');
        let currentFacility = null;

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Look for facility entries (numbered lines)
            const facilityMatch = trimmed.match(/^\d+\.\s+(.+)$/);
            if (facilityMatch) {
                if (currentFacility) {
                    facilities.push(currentFacility);
                }
                currentFacility = {
                    name: facilityMatch[1],
                    type: '',
                    distance_km: 0,
                    capacity: '',
                    status: '',
                    latitude: 0,
                    longitude: 0
                };
            } else if (currentFacility) {
                if (trimmed.startsWith('Type:')) {
                    currentFacility.type = trimmed.replace('Type:', '').trim();
                } else if (trimmed.startsWith('Distance:')) {
                    const distStr = trimmed.replace('Distance:', '').trim();
                    currentFacility.distance_km = parseFloat(distStr) || 0;
                } else if (trimmed.startsWith('Capacity:')) {
                    currentFacility.capacity = trimmed.replace('Capacity:', '').trim();
                } else if (trimmed.startsWith('Status:')) {
                    currentFacility.status = trimmed.replace('Status:', '').trim();
                }
            }
        }
        
        if (currentFacility) {
            facilities.push(currentFacility);
        }
        
        return facilities;
    } catch (error) {
        console.error('Error parsing facilities output:', error);
        return [];
    }
}

function parseReportOutput(output) {
    const report = {
        disaster_info: {},
        facility_status: {},
        response_status: {}
    };
    
    const lines = output.split('\n');
    let currentSection = '';
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.includes('DISASTER INFORMATION:')) {
            currentSection = 'disaster_info';
        } else if (trimmed.includes('FACILITY STATUS:')) {
            currentSection = 'facility_status';
        } else if (trimmed.includes('RESPONSE STATUS:')) {
            currentSection = 'response_status';
        } else if (trimmed.includes(':') && currentSection) {
            const [key, value] = trimmed.split(':').map(s => s.trim());
            if (key && value) {
                report[currentSection][key.toLowerCase().replace(/\s+/g, '_')] = value;
            }
        }
    }
    
    return report;
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🚨 AEGIS-1 - FRONTEND');
    console.log('====================================================');
    console.log(`🌐 Server running at: http://localhost:${PORT}`);
    console.log('📍 Access the dashboard in your browser');
    console.log('🔗 Backend: Python disaster response system');
    console.log('🚨 System ready for emergency operations');
    console.log('====================================================');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down frontend server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down frontend server...');
    process.exit(0);
});