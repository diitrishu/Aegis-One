/**
 * Disaster Report Generator
 * Generates comprehensive PDF reports for disasters with graphs, maps, and facility data
 */

class DisasterReportGenerator {
    constructor() {
        this.selectedDisaster = null;
        this.reportData = null;
        const configuredCandidates = Array.isArray(AppConfig.v2ApiCandidates) && AppConfig.v2ApiCandidates.length > 0
            ? AppConfig.v2ApiCandidates
            : [`${AppConfig.apiUrl}/v2`];
        this.v2ApiCandidates = [...new Set(configuredCandidates)];
        this.pdfTheme = {
            primary: [17, 63, 87],       // deep blue
            primarySoft: [230, 238, 245],
            accent: [14, 116, 144],      // teal-blue
            text: [17, 24, 39],          // near-black
            textMuted: [75, 85, 99],     // slate
            border: [203, 213, 225],     // cool gray
            success: [22, 101, 52],
            warning: [146, 64, 14],
            danger: [153, 27, 27],
            surface: [248, 250, 252],
            white: [255, 255, 255]
        };
    }

    async loadDisastersForReports() {
        // Prefer backend DB so reports include persisted incidents
        try {
            const response = await fetch(`${AppConfig.backendApiUrl}/disasters`);
            const result = await response.json();
            if (response.ok && result.success && Array.isArray(result.disasters)) {
                return result.disasters.map((d) => {
                    const ring = d.geometry?.coordinates?.[0] || [];
                    const pt = ring[0] || [0, 0];
                    return {
                        id: String(d.id),
                        disaster_type: String(d.disaster_type || ''),
                        severity: String(d.severity || ''),
                        description: d.description || '',
                        created_at: d.created_at || new Date().toISOString(),
                        created_by: d.created_by || 'web_user',
                        latitude: Number(pt[1] || 0),
                        longitude: Number(pt[0] || 0),
                        radius_km: 5
                    };
                });
            }
        } catch (error) {
            console.warn('Backend disaster list unavailable, falling back to localStorage', error);
        }

        const disasters = JSON.parse(localStorage.getItem('disasters') || '[]');
        return disasters.map(d => ({
            id: d.id,
            disaster_type: d.type,
            severity: d.severity,
            description: d.description,
            created_at: d.timestamp,
            created_by: 'web_user',
            latitude: d.latitude,
            longitude: d.longitude,
            radius_km: d.radius_km
        }));
    }

    sectionHeader(doc, title, margin) {
        doc.setFillColor(...this.pdfTheme.primary);
        doc.rect(0, 0, doc.internal.pageSize.getWidth(), 16, 'F');
        doc.setTextColor(...this.pdfTheme.white);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(title, margin, 10.5);
        doc.setTextColor(...this.pdfTheme.text);
    }

    /**
     * Initialize report generator and show disaster selection modal
     */
    async showDisasterSelection() {
        try {
            const disasters = await this.loadDisastersForReports();

            if (!disasters || disasters.length === 0) {
                showToast('No disasters found to generate reports', 'warning');
                return;
            }

            // Create and show modal
            this.createSelectionModal(disasters);
        } catch (error) {
            console.error('Error loading disasters:', error);
            showToast('Failed to load disasters', 'error');
        }
    }

    /**
     * Create disaster selection modal
     */
    createSelectionModal(disasters) {
        // Remove existing modal if any
        const existingModal = document.getElementById('report-selection-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'report-selection-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="margin: 0;">
                        <i class="fas fa-file-pdf"></i> Generate Disaster Report
                    </h3>
                    <button onclick="reportGenerator.closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                    Select a disaster to generate a comprehensive PDF report with graphs, facility data, and response metrics.
                </p>

                <div id="disaster-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
                    ${disasters.map(disaster => this.createDisasterCard(disaster)).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    /**
     * Create disaster card HTML
     */
    createDisasterCard(disaster) {
        const severityColors = {
            'Low': '#10b981',
            'Medium': '#f59e0b',
            'High': '#ef4444',
            'Critical': '#dc2626'
        };

        const disasterLabels = {
            'Flood': 'FL',
            'Earthquake': 'EQ',
            'Fire': 'FR',
            'Landslide': 'LS',
            'Cyclone': 'CY',
            'Drought': 'DR'
        };

        const date = new Date(disaster.created_at);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="disaster-card" onclick="reportGenerator.selectDisaster('${disaster.id}')" 
                 style="padding: 1rem; border: 2px solid var(--border-color); border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <span style="font-size: 0.75rem; font-weight: 700; color: #0f172a; background: #e2e8f0; border-radius: 999px; padding: 0.25rem 0.5rem;">${disasterLabels[disaster.disaster_type] || 'AL'}</span>
                            <h4 style="margin: 0; color: var(--text-primary);">${disaster.disaster_type}</h4>
                        </div>
                        <p style="margin: 0.25rem 0; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fas fa-calendar"></i> ${formattedDate}
                        </p>
                        <p style="margin: 0.25rem 0; color: var(--text-secondary); font-size: 0.875rem;">
                            <i class="fas fa-align-left"></i> ${disaster.description.substring(0, 80)}${disaster.description.length > 80 ? '...' : ''}
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <span style="padding: 0.25rem 0.75rem; background: ${severityColors[disaster.severity] || '#6b7280'}; color: white; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
                            ${disaster.severity}
                        </span>
                        <div style="margin-top: 0.5rem;">
                            <button class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">
                                <i class="fas fa-file-pdf"></i> Generate
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Select disaster and generate report
     */
    async selectDisaster(disasterId) {
        this.closeModal();

        // Show loading state
        showToast('Fetching real facility data...', 'info');

        try {
            const disasters = await this.loadDisastersForReports();
            const disaster = disasters.find(d => String(d.id) === String(disasterId));

            if (!disaster) {
                throw new Error('Disaster not found');
            }

            // Format disaster data for report
            const disasterData = {
                id: disaster.id,
                disaster_type: disaster.disaster_type || disaster.type,
                severity: disaster.severity,
                description: disaster.description,
                created_at: disaster.created_at || disaster.timestamp,
                created_by: 'web_user',
                radius_km: disaster.radius_km || 10
            };

            // Calculate response time
            const createdDate = new Date(disaster.created_at || disaster.timestamp);
            const now = new Date();
            const responseTimeSeconds = Math.floor((now - createdDate) / 1000);
            const hours = Math.floor(responseTimeSeconds / 3600);
            const minutes = Math.floor((responseTimeSeconds % 3600) / 60);
            const seconds = responseTimeSeconds % 60;

            disasterData.response_time_seconds = responseTimeSeconds;
            disasterData.response_time_formatted = `${hours}h ${minutes}m ${seconds}s`;

            // Fetch REAL facilities from API
            const searchRadius = (disaster.radius_km || 10) + 15; // disaster radius + 15km
            let realFacilities = [];
            
            try {
                const response = await fetch(
                    `${AppConfig.apiUrl}/facilities?lat=${disaster.latitude}&lon=${disaster.longitude}&radius=${searchRadius}&limit=50`
                );
                const result = await response.json();
                
                if (result.success && result.facilities && result.facilities.length > 0) {
                    realFacilities = result.facilities.map(f => ({
                        name: f.name,
                        type: f.type,
                        distance_km: f.distance_km,
                        latitude: f.latitude,
                        longitude: f.longitude
                    }));
                    console.log(`Loaded ${realFacilities.length} real facilities for report`);
                } else {
                    console.warn('No real facilities found, using fallback data');
                }
            } catch (error) {
                console.error('Error fetching facilities:', error);
            }

            // Fallback to mock data if no real facilities
            if (realFacilities.length === 0) {
                realFacilities = [
                    { name: 'District Hospital', type: 'Hospital', distance_km: 2.5 },
                    { name: 'City Medical Center', type: 'Hospital', distance_km: 4.2 },
                    { name: 'Fire Station Central', type: 'Fire Station', distance_km: 1.8 },
                    { name: 'Police Station North', type: 'Police Station', distance_km: 3.1 },
                    { name: 'Emergency Care Unit', type: 'Hospital', distance_km: 5.6 }
                ];
            }

            // Calculate facility statistics
            const facilityStats = this.calculateFacilityStatistics(realFacilities);

            // Get statistics (based on all disasters in localStorage)
            const statistics = [];
            const typeCounts = {};
            const severityCounts = {};

            disasters.forEach(d => {
                const typeKey = d.disaster_type || d.type || 'other';
                typeCounts[typeKey] = (typeCounts[typeKey] || 0) + 1;
                severityCounts[d.severity] = (severityCounts[d.severity] || 0) + 1;
            });

            Object.keys(typeCounts).forEach(type => {
                Object.keys(severityCounts).forEach(severity => {
                    const count = disasters.filter(d => (d.disaster_type || d.type) === type && d.severity === severity).length;
                    if (count > 0) {
                        statistics.push({ type, severity, count });
                    }
                });
            });

            // Calculate estimated affected population (rough estimate based on radius)
            const affectedArea = Math.PI * Math.pow(disaster.radius_km || 10, 2); // km2
            const roughPopulation = Math.floor(affectedArea * 500); // Assume 500 people per km2

            // Fetch advanced operational data from V2 API endpoints if available
            const advancedData = await this.fetchAdvancedOperationalData(disaster, disasters);
            const estimatedPopulation = advancedData.population?.population || roughPopulation;
            const populationAccuracy = advancedData.population?.accuracy || 'Model estimate';
            const historicalInsights = this.computeHistoricalInsights(disasters, disaster);
            const operationalScore = this.calculateOperationalScore(disasterData, facilityStats, advancedData);

            this.reportData = {
                disaster: disasterData,
                facilities: realFacilities,
                facilityStats: facilityStats,
                disasterLocation: {
                    latitude: disaster.latitude,
                    longitude: disaster.longitude
                },
                statistics: statistics,
                estimatedPopulation: estimatedPopulation,
                roughPopulationEstimate: roughPopulation,
                populationAccuracy: populationAccuracy,
                affectedArea: affectedArea,
                advancedData: advancedData,
                historicalInsights: historicalInsights,
                operationalScore: operationalScore,
                generatedAt: new Date().toISOString()
            };

            showToast('Generating comprehensive report...', 'info');

            // Generate PDF
            await this.generatePDF();

            showToast('Report generated successfully!', 'success');
        } catch (error) {
            console.error('Error generating report:', error);
            showToast('Failed to generate report', 'error');
        }
    }

    /**
     * Calculate facility statistics
     */
    calculateFacilityStatistics(facilities) {
        const stats = {
            total: facilities.length,
            byType: {},
            byDistance: {
                '0-5km': 0,
                '5-10km': 0,
                '10-20km': 0,
                '20+km': 0
            },
            closest: null,
            averageDistance: 0
        };

        let totalDistance = 0;

        facilities.forEach(f => {
            // Count by type
            stats.byType[f.type] = (stats.byType[f.type] || 0) + 1;

            // Count by distance
            const dist = parseFloat(f.distance_km);
            totalDistance += dist;

            if (dist < 5) stats.byDistance['0-5km']++;
            else if (dist < 10) stats.byDistance['5-10km']++;
            else if (dist < 20) stats.byDistance['10-20km']++;
            else stats.byDistance['20+km']++;

            // Track closest
            if (!stats.closest || dist < parseFloat(stats.closest.distance_km)) {
                stats.closest = f;
            }
        });

        stats.averageDistance = facilities.length > 0 ? (totalDistance / facilities.length).toFixed(2) : 0;

        return stats;
    }

    async fetchWithFallback(pathBuilder) {
        for (const baseUrl of this.v2ApiCandidates) {
            try {
                const url = pathBuilder(baseUrl);
                const response = await fetch(url);
                if (!response.ok) continue;
                const payload = await response.json();
                if (payload && payload.success) {
                    return { ok: true, baseUrl, payload };
                }
            } catch (error) {
                // Try next candidate silently
            }
        }
        return { ok: false, payload: null, baseUrl: null };
    }

    async fetchAdvancedOperationalData(disaster, disasters) {
        const radius = disaster.radius_km || 10;
        const lat = disaster.latitude;
        const lon = disaster.longitude;

        const [populationRes, riskRes, earthquakesRes, analyticsRes, floodRiskRes, elevationRes] = await Promise.all([
            this.fetchWithFallback(base => `${base}/population?lat=${lat}&lon=${lon}&radius=${radius}`),
            this.fetchWithFallback(base => `${base}/seismic-risk?lat=${lat}&lon=${lon}&radius=${Math.max(20, radius * 4)}`),
            this.fetchWithFallback(base => `${base}/earthquakes?lat=${lat}&lon=${lon}&radius=${Math.max(50, radius * 8)}&min_magnitude=4.0`),
            this.fetchWithFallback(base => `${base}/analytics`),
            this.fetchWithFallback(base => `${base}/flood-risk?lat=${lat}&lon=${lon}&radius=${Math.max(10, radius * 2)}&elevation_threshold_m=50`),
            this.fetchWithFallback(base => `${base}/elevation?lat=${lat}&lon=${lon}`)
        ]);

        const byMonth = {};
        disasters.forEach((d) => {
            const dt = new Date(d.created_at || d.timestamp);
            if (Number.isNaN(dt.getTime())) return;
            const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
            byMonth[key] = (byMonth[key] || 0) + 1;
        });

        return {
            v2Available: populationRes.ok || riskRes.ok || earthquakesRes.ok || analyticsRes.ok || floodRiskRes.ok || elevationRes.ok,
            population: populationRes.ok ? populationRes.payload : null,
            seismicRisk: riskRes.ok ? riskRes.payload.risk : null,
            earthquakes: earthquakesRes.ok ? (earthquakesRes.payload.earthquakes || []) : [],
            analytics: analyticsRes.ok ? analyticsRes.payload : null,
            floodRisk: floodRiskRes.ok ? floodRiskRes.payload : null,
            elevation: elevationRes.ok ? elevationRes.payload : null,
            localMonthlyIncidents: byMonth,
            dataSources: {
                population: populationRes.baseUrl,
                seismicRisk: riskRes.baseUrl,
                earthquakes: earthquakesRes.baseUrl,
                analytics: analyticsRes.baseUrl,
                floodRisk: floodRiskRes.baseUrl,
                elevation: elevationRes.baseUrl
            }
        };
    }

    computeHistoricalInsights(disasters, currentDisaster) {
        const now = new Date();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        let last30DaysIncidents = 0;
        let sameTypeTotal = 0;
        let highSeverityTotal = 0;

        disasters.forEach((d) => {
            const ts = new Date(d.timestamp);
            if (!Number.isNaN(ts.getTime()) && (now - ts) <= thirtyDaysMs) {
                last30DaysIncidents += 1;
            }
            if ((d.disaster_type || d.type || '').toLowerCase() === (currentDisaster.disaster_type || currentDisaster.type || '').toLowerCase()) {
                sameTypeTotal += 1;
            }
            const sev = (d.severity || '').toLowerCase();
            if (sev === 'high' || sev === 'critical') {
                highSeverityTotal += 1;
            }
        });

        return {
            totalIncidents: disasters.length,
            sameTypeTotal,
            highSeverityTotal,
            last30DaysIncidents
        };
    }

    calculateOperationalScore(disaster, facilityStats, advancedData) {
        const severityFactor = {
            low: 8,
            medium: 18,
            high: 30,
            critical: 42
        }[(disaster.severity || '').toLowerCase()] || 20;

        const availabilityScore = Math.min(35, facilityStats.total * 2);
        const distanceScore = Math.max(0, 30 - (parseFloat(facilityStats.averageDistance) * 2));

        let riskPenalty = 0;
        const riskLevel = advancedData?.seismicRisk?.risk_level || '';
        if (riskLevel === 'HIGH') riskPenalty = 15;
        else if (riskLevel === 'MEDIUM') riskPenalty = 8;
        else if (riskLevel === 'LOW') riskPenalty = 3;

        const raw = availabilityScore + distanceScore - severityFactor - riskPenalty + 55;
        const clamped = Math.max(0, Math.min(100, Math.round(raw)));

        const band = clamped >= 75 ? 'Strong' : clamped >= 55 ? 'Moderate' : 'Stressed';

        return {
            value: clamped,
            band
        };
    }

    /**
     * Generate PDF report
     */
    async generatePDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        if (typeof doc.autoTable !== 'function') {
            throw new Error('jsPDF AutoTable plugin is not loaded');
        }

        const disaster = this.reportData.disaster;
        const facilities = this.reportData.facilities;
        const facilityStats = this.reportData.facilityStats;
        const location = this.reportData.disasterLocation;

        let yPos = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const contentWidth = pageWidth - (2 * margin);

        // ===== COVER PAGE =====
        this.generateCoverPage(doc, disaster, location);

        // ===== PAGE 2: EXECUTIVE SUMMARY =====
        doc.addPage();
        yPos = 20;
        this.generateExecutiveSummary(doc, disaster, facilityStats, location, margin, yPos, contentWidth);

        // ===== PAGE 3: DISASTER DETAILS =====
        doc.addPage();
        yPos = 20;
        this.generateDisasterDetails(doc, disaster, location, margin, yPos, contentWidth);

        // ===== PAGE 4: GEOSPATIAL MAP SNAPSHOTS =====
        doc.addPage();
        yPos = 20;
        await this.generateGeospatialMaps(doc, disaster, facilities, location, margin, yPos, contentWidth);

        // ===== PAGE 5: FACILITY ANALYSIS =====
        doc.addPage();
        yPos = 20;
        await this.generateFacilityAnalysis(doc, facilityStats, margin, yPos, contentWidth);

        // ===== PAGE 6: FACILITY LIST =====
        doc.addPage();
        yPos = 20;
        this.generateFacilityList(doc, facilities, facilityStats, disaster, margin, yPos, contentWidth);

        // ===== PAGE 7: RESPONSE RECOMMENDATIONS =====
        doc.addPage();
        yPos = 20;
        this.generateRecommendations(doc, disaster, facilityStats, margin, yPos, contentWidth);

        // ===== PAGE 8: STATISTICAL ANALYSIS =====
        if (this.reportData.statistics && this.reportData.statistics.length > 0) {
            doc.addPage();
            yPos = 20;
            await this.generateStatisticalAnalysis(doc, margin, yPos, contentWidth);
        }

        // ===== PAGE 9: ADVANCED OPERATIONAL INTELLIGENCE =====
        doc.addPage();
        yPos = 20;
        this.generateOperationalIntelligence(doc, disaster, facilityStats, margin, yPos, contentWidth);

        // Add footers to all pages
        this.addFooters(doc, pageWidth, pageHeight, margin);

        // Save PDF
        const fileName = `Disaster_Response_Report_${disaster.disaster_type}_${new Date().getTime()}.pdf`;
        doc.save(fileName);
    }

    /**
     * Generate cover page
     */
    generateCoverPage(doc, disaster, location) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setFillColor(...this.pdfTheme.white);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setFillColor(...this.pdfTheme.primary);
        doc.rect(0, 0, pageWidth, 30, 'F');
        doc.setFillColor(...this.pdfTheme.accent);
        doc.rect(0, 30, pageWidth, 4, 'F');

        doc.setTextColor(...this.pdfTheme.white);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('DISASTER RESPONSE SYSTEM', 20, 18);
        doc.setFont('helvetica', 'normal');
        doc.text('Comprehensive Incident Report', pageWidth - 20, 18, { align: 'right' });

        doc.setTextColor(...this.pdfTheme.text);
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.text('INCIDENT REPORT', pageWidth / 2, 65, { align: 'center' });

        doc.setFontSize(20);
        doc.setTextColor(...this.pdfTheme.primary);
        doc.text(disaster.disaster_type.toUpperCase(), pageWidth / 2, 80, { align: 'center' });

        const severityColors = {
            low: this.pdfTheme.success,
            medium: this.pdfTheme.warning,
            high: this.pdfTheme.danger,
            critical: this.pdfTheme.danger
        };
        const sevColor = severityColors[(disaster.severity || '').toLowerCase()] || this.pdfTheme.textMuted;
        doc.setFillColor(...sevColor);
        doc.roundedRect(pageWidth / 2 - 34, 90, 68, 13, 2, 2, 'F');
        doc.setTextColor(...this.pdfTheme.white);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`${String(disaster.severity).toUpperCase()} SEVERITY`, pageWidth / 2, 98.2, { align: 'center' });

        doc.setTextColor(...this.pdfTheme.text);
        doc.setDrawColor(...this.pdfTheme.border);
        doc.setFillColor(...this.pdfTheme.surface);
        doc.roundedRect(20, 118, pageWidth - 40, 78, 3, 3, 'FD');

        const details = [
            ['Report Date', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
            ['Incident Timestamp', new Date(disaster.created_at).toLocaleString()],
            ['Incident Location', `${location.latitude.toFixed(4)} N, ${location.longitude.toFixed(4)} E`],
            ['Report ID', `#${disaster.id}`],
            ['Prepared By', 'AeGIS-1 v2.0']
        ];

        let y = 132;
        details.forEach(([label, value]) => {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...this.pdfTheme.textMuted);
            doc.text(`${label}:`, 28, y);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...this.pdfTheme.text);
            doc.text(String(value), 78, y);
            y += 13;
        });

        doc.setTextColor(...this.pdfTheme.textMuted);
        doc.setFontSize(8);
        doc.text('CONFIDENTIAL - FOR OFFICIAL USE ONLY', pageWidth / 2, pageHeight - 16, { align: 'center' });
    }

    /**
     * Generate executive summary
     */
    generateExecutiveSummary(doc, disaster, facilityStats, location, margin, yPos, contentWidth) {
        this.sectionHeader(doc, 'EXECUTIVE SUMMARY', margin);

        yPos = 25;
        doc.setTextColor(...this.pdfTheme.text);

        // Summary paragraph
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        
        const summaryText = `This report analyzes the ${disaster.disaster_type} incident recorded on ${new Date(disaster.created_at).toLocaleDateString()}, including live facility coverage, operational readiness scoring, and available V2 intelligence feeds (population, seismic risk, and earthquake history). The incident is classified as ${disaster.severity} severity and requires coordinated field response.`;
        
        const summaryLines = doc.splitTextToSize(summaryText, contentWidth);
        doc.text(summaryLines, margin, yPos);
        yPos += (summaryLines.length * 5) + 10;

        // Key findings section
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('KEY FINDINGS', margin, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const findings = [
            `- Disaster Type: ${disaster.disaster_type} (${disaster.severity} severity)`,
            `- Affected Area: ${this.reportData.affectedArea.toFixed(2)} km2 with estimated ${this.reportData.estimatedPopulation.toLocaleString()} people at risk (${this.reportData.populationAccuracy})`,
            `- Response Time: ${disaster.response_time_formatted} since initial report`,
            `- Emergency Facilities: ${facilityStats.total} facilities identified within response radius`,
            `- Closest Facility: ${facilityStats.closest ? facilityStats.closest.name + ' (' + parseFloat(facilityStats.closest.distance_km).toFixed(1) + ' km)' : 'N/A'}`,
            `- Operational Readiness Score: ${this.reportData.operationalScore.value}/100 (${this.reportData.operationalScore.band})`
        ];

        findings.forEach(finding => {
            const lines = doc.splitTextToSize(finding, contentWidth - 5);
            doc.text(lines, margin + 5, yPos);
            yPos += (lines.length * 5) + 2;
        });

        yPos += 10;

        // Critical metrics boxes
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('CRITICAL METRICS', margin, yPos);
        yPos += 10;

        const boxWidth = (contentWidth - 10) / 3;
        const boxHeight = 35;

        // Response Status
        const responseStatus = disaster.response_time_seconds < 3600 ? 'RAPID' : disaster.response_time_seconds < 7200 ? 'ACTIVE' : 'ONGOING';
        const statusColor = disaster.response_time_seconds < 3600 ? [16, 185, 129] : disaster.response_time_seconds < 7200 ? [245, 158, 11] : [239, 68, 68];
        
        doc.setFillColor(...this.pdfTheme.surface);
        doc.roundedRect(margin, yPos, boxWidth, boxHeight, 3, 3, 'F');
        doc.setDrawColor(...statusColor);
        doc.setLineWidth(1);
        doc.roundedRect(margin, yPos, boxWidth, boxHeight, 3, 3, 'S');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...this.pdfTheme.textMuted);
        doc.text('Response Status', margin + boxWidth / 2, yPos + 10, { align: 'center' });
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.text(responseStatus, margin + boxWidth / 2, yPos + 22, { align: 'center' });

        // Resource Availability
        const resourceStatus = facilityStats.total >= 15 ? 'ADEQUATE' : facilityStats.total >= 8 ? 'MODERATE' : 'LIMITED';
        const resourceColor = facilityStats.total >= 15 ? [16, 185, 129] : facilityStats.total >= 8 ? [245, 158, 11] : [239, 68, 68];
        
        doc.setFillColor(...this.pdfTheme.surface);
        doc.roundedRect(margin + boxWidth + 5, yPos, boxWidth, boxHeight, 3, 3, 'F');
        doc.setDrawColor(...resourceColor);
        doc.roundedRect(margin + boxWidth + 5, yPos, boxWidth, boxHeight, 3, 3, 'S');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...this.pdfTheme.textMuted);
        doc.text('Resource Availability', margin + boxWidth + 5 + boxWidth / 2, yPos + 10, { align: 'center' });
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(resourceColor[0], resourceColor[1], resourceColor[2]);
        doc.text(resourceStatus, margin + boxWidth + 5 + boxWidth / 2, yPos + 22, { align: 'center' });

        // Coverage Assessment
        const avgDist = parseFloat(facilityStats.averageDistance);
        const coverageStatus = avgDist < 5 ? 'EXCELLENT' : avgDist < 10 ? 'GOOD' : avgDist < 15 ? 'FAIR' : 'POOR';
        const coverageColor = avgDist < 5 ? [16, 185, 129] : avgDist < 10 ? [79, 124, 255] : avgDist < 15 ? [245, 158, 11] : [239, 68, 68];
        
        doc.setFillColor(...this.pdfTheme.surface);
        doc.roundedRect(margin + (boxWidth + 5) * 2, yPos, boxWidth, boxHeight, 3, 3, 'F');
        doc.setDrawColor(...coverageColor);
        doc.roundedRect(margin + (boxWidth + 5) * 2, yPos, boxWidth, boxHeight, 3, 3, 'S');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...this.pdfTheme.textMuted);
        doc.text('Coverage Assessment', margin + (boxWidth + 5) * 2 + boxWidth / 2, yPos + 10, { align: 'center' });
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(coverageColor[0], coverageColor[1], coverageColor[2]);
        doc.text(coverageStatus, margin + (boxWidth + 5) * 2 + boxWidth / 2, yPos + 22, { align: 'center' });

        yPos += boxHeight + 15;
        doc.setTextColor(...this.pdfTheme.text);
        doc.setDrawColor(...this.pdfTheme.border);
        doc.setLineWidth(0.1);

        // Immediate actions required
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('IMMEDIATE ACTIONS REQUIRED', margin, yPos);
        yPos += 8;

        doc.setFillColor(...this.pdfTheme.primarySoft);
        doc.roundedRect(margin, yPos, contentWidth, 45, 3, 3, 'F');

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        const actions = [
            '1. Deploy emergency response teams to disaster epicenter',
            `2. Activate ${facilityStats.closest ? facilityStats.closest.name : 'nearest facility'} as primary response center`,
            '3. Establish communication with all emergency facilities within 10km radius',
            '4. Initiate evacuation procedures for high-risk zones',
            '5. Set up emergency medical triage at closest hospital facility'
        ];

        let actionY = yPos + 8;
        actions.forEach(action => {
            doc.text(action, margin + 5, actionY);
            actionY += 7;
        });
    }

    /**
     * Generate disaster details page
     */
    generateDisasterDetails(doc, disaster, location, margin, yPos, contentWidth) {
        this.sectionHeader(doc, 'DISASTER DETAILS & IMPACT ASSESSMENT', margin);

        yPos = 25;
        doc.setTextColor(...this.pdfTheme.text);

        // Incident information
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('INCIDENT INFORMATION', margin, yPos);
        yPos += 10;

        doc.setFillColor(...this.pdfTheme.surface);
        doc.roundedRect(margin, yPos, contentWidth, 60, 3, 3, 'F');

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const incidentInfo = [
            ['Disaster Type:', disaster.disaster_type],
            ['Severity Level:', disaster.severity.toUpperCase()],
            ['Date & Time:', new Date(disaster.created_at).toLocaleString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            })],
            ['Location Coordinates:', `${location.latitude.toFixed(6)} N, ${location.longitude.toFixed(6)} E`],
            ['Affected Radius:', `${disaster.radius_km} kilometers`],
            ['Affected Area:', `${this.reportData.affectedArea.toFixed(2)} square kilometers`],
            ['Estimated Population:', `~${this.reportData.estimatedPopulation.toLocaleString()} people at risk (${this.reportData.populationAccuracy})`],
            ['Report ID:', `#${disaster.id}`],
            ['Reported By:', disaster.created_by]
        ];

        let infoY = yPos + 8;
        incidentInfo.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.text(label, margin + 5, infoY);
            doc.setFont('helvetica', 'normal');
            doc.text(value, margin + 55, infoY);
            infoY += 6;
        });

        yPos += 70;

        // Description section
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('INCIDENT DESCRIPTION', margin, yPos);
        yPos += 8;

        doc.setFillColor(...this.pdfTheme.white);
        doc.setDrawColor(...this.pdfTheme.border);
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, yPos, contentWidth, 40, 3, 3, 'FD');

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const descLines = doc.splitTextToSize(disaster.description, contentWidth - 10);
        doc.text(descLines, margin + 5, yPos + 8);

        yPos += 50;

        // Impact assessment
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('IMPACT ASSESSMENT', margin, yPos);
        yPos += 10;

        const impactBoxWidth = (contentWidth - 5) / 2;
        const impactBoxHeight = 50;

        // Population impact
        doc.setFillColor(...this.pdfTheme.primarySoft);
        doc.roundedRect(margin, yPos, impactBoxWidth, impactBoxHeight, 3, 3, 'F');
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Population Impact', margin + 5, yPos + 8);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const popImpact = [
            `Estimated Affected: ${this.reportData.estimatedPopulation.toLocaleString()}`,
            `Population Density: ~${Math.floor(this.reportData.estimatedPopulation / this.reportData.affectedArea)} per km2`,
            `Risk Level: ${disaster.severity === 'high' || disaster.severity === 'critical' ? 'HIGH' : 'MODERATE'}`,
            `Evacuation Priority: ${disaster.severity === 'critical' ? 'IMMEDIATE' : disaster.severity === 'high' ? 'HIGH' : 'STANDARD'}`,
            `Recent local incidents (30d): ${this.reportData.historicalInsights.last30DaysIncidents}`
        ];
        
        let popY = yPos + 18;
        popImpact.forEach(line => {
            doc.text(line, margin + 5, popY);
            popY += 6;
        });

        // Infrastructure impact
        doc.setFillColor(...this.pdfTheme.surface);
        doc.roundedRect(margin + impactBoxWidth + 5, yPos, impactBoxWidth, impactBoxHeight, 3, 3, 'F');
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Infrastructure Impact', margin + impactBoxWidth + 10, yPos + 8);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const infraImpact = [
            `Affected Area: ${this.reportData.affectedArea.toFixed(2)} km2`,
            `Radius: ${disaster.radius_km} km from epicenter`,
            `Operational Readiness: ${this.reportData.operationalScore.value}/100 (${this.reportData.operationalScore.band})`,
            `Road Access: ${disaster.severity === 'critical' ? 'SEVERELY IMPACTED' : 'PARTIALLY AFFECTED'}`,
            `Same-type historical incidents: ${this.reportData.historicalInsights.sameTypeTotal}`
        ];
        
        let infraY = yPos + 18;
        infraImpact.forEach(line => {
            doc.text(line, margin + impactBoxWidth + 10, infraY);
            infraY += 6;
        });

        yPos += impactBoxHeight + 15;

        // Response timeline
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('RESPONSE TIMELINE', margin, yPos);
        yPos += 10;

        const timelineEvents = [
            { time: '00:00', event: 'Disaster occurrence', status: 'completed' },
            { time: disaster.response_time_formatted, event: 'Report received and logged', status: 'completed' },
            { time: 'In Progress', event: 'Emergency services deployment', status: 'active' },
            { time: 'Pending', event: 'On-site assessment', status: 'pending' },
            { time: 'Pending', event: 'Full response coordination', status: 'pending' }
        ];

        timelineEvents.forEach((event, index) => {
            const statusColor = event.status === 'completed' ? [16, 185, 129] : 
                              event.status === 'active' ? [245, 158, 11] : [200, 200, 200];
            
            // Timeline dot
            doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
            doc.circle(margin + 5, yPos + 3, 2, 'F');
            
            // Timeline line
            if (index < timelineEvents.length - 1) {
                doc.setDrawColor(statusColor[0], statusColor[1], statusColor[2]);
                doc.setLineWidth(0.5);
                doc.line(margin + 5, yPos + 5, margin + 5, yPos + 12);
            }
            
            // Event text
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
            doc.text(event.time, margin + 10, yPos + 4);
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...this.pdfTheme.text);
            doc.text(event.event, margin + 40, yPos + 4);
            
            yPos += 10;
        });
    }

    /**
     * Generate facility analysis page
     */
    async generateFacilityAnalysis(doc, facilityStats, margin, yPos, contentWidth) {
        this.sectionHeader(doc, 'EMERGENCY FACILITY ANALYSIS', margin);

        yPos = 25;
        doc.setTextColor(...this.pdfTheme.text);

        // Summary boxes
        const summaryBoxWidth = (contentWidth - 10) / 3;
        const summaryBoxHeight = 30;

        // Total Facilities
        doc.setFillColor(240, 248, 255);
        doc.roundedRect(margin, yPos, summaryBoxWidth, summaryBoxHeight, 3, 3, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...this.pdfTheme.textMuted);
        doc.text('Total Facilities', margin + summaryBoxWidth / 2, yPos + 10, { align: 'center' });
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...this.pdfTheme.primary);
        doc.text(facilityStats.total.toString(), margin + summaryBoxWidth / 2, yPos + 23, { align: 'center' });

        // Closest Facility
        doc.setTextColor(...this.pdfTheme.text);
        doc.setFillColor(...this.pdfTheme.surface);
        doc.roundedRect(margin + summaryBoxWidth + 5, yPos, summaryBoxWidth, summaryBoxHeight, 3, 3, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...this.pdfTheme.textMuted);
        doc.text('Closest Facility', margin + summaryBoxWidth + 5 + summaryBoxWidth / 2, yPos + 10, { align: 'center' });
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...this.pdfTheme.success);
        const closestDist = facilityStats.closest ? `${parseFloat(facilityStats.closest.distance_km).toFixed(1)} km` : 'N/A';
        doc.text(closestDist, margin + summaryBoxWidth + 5 + summaryBoxWidth / 2, yPos + 23, { align: 'center' });

        // Average Distance
        doc.setTextColor(...this.pdfTheme.text);
        doc.setFillColor(...this.pdfTheme.surface);
        doc.roundedRect(margin + (summaryBoxWidth + 5) * 2, yPos, summaryBoxWidth, summaryBoxHeight, 3, 3, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...this.pdfTheme.textMuted);
        doc.text('Avg Distance', margin + (summaryBoxWidth + 5) * 2 + summaryBoxWidth / 2, yPos + 10, { align: 'center' });
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...this.pdfTheme.warning);
        doc.text(`${facilityStats.averageDistance} km`, margin + (summaryBoxWidth + 5) * 2 + summaryBoxWidth / 2, yPos + 23, { align: 'center' });

        yPos += summaryBoxHeight + 15;
        doc.setTextColor(...this.pdfTheme.text);

        // Facility type breakdown
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('FACILITY TYPE BREAKDOWN', margin, yPos);
        yPos += 10;

        const typeBoxHeight = 18;
        Object.entries(facilityStats.byType).forEach(([type, count]) => {
            const label = type.includes('Hospital') ? 'HOSPITAL' : type.includes('Fire') ? 'FIRE STATION' : type.includes('Police') ? 'POLICE STATION' : 'FACILITY';
            const percentage = ((count / facilityStats.total) * 100).toFixed(1);
            
            doc.setFillColor(...this.pdfTheme.surface);
            doc.roundedRect(margin, yPos, contentWidth, typeBoxHeight, 2, 2, 'F');
            
            // Progress bar
            const barWidth = (contentWidth - 80) * (count / facilityStats.total);
            doc.setFillColor(...this.pdfTheme.accent);
            doc.roundedRect(margin + 70, yPos + 4, barWidth, 10, 1, 1, 'F');
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(label, margin + 5, yPos + 12);
            
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...this.pdfTheme.primary);
            doc.text(`${count} (${percentage}%)`, margin + contentWidth - 5, yPos + 12, { align: 'right' });
            
            doc.setTextColor(...this.pdfTheme.text);
            yPos += typeBoxHeight + 3;
        });

        yPos += 10;

        // Distance distribution chart
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('DISTANCE DISTRIBUTION ANALYSIS', margin, yPos);
        yPos += 8;

        await this.addDistanceChart(doc, margin, yPos, contentWidth);
        yPos += 70;

        // Coverage analysis
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('COVERAGE ANALYSIS', margin, yPos);
        yPos += 8;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const riskLevel = this.reportData.advancedData?.seismicRisk?.risk_level || 'UNKNOWN';
        const coverageText = `The emergency facility distribution shows ${facilityStats.byDistance['0-5km']} facilities within immediate response range (0-5km), ${facilityStats.byDistance['5-10km']} in secondary range (5-10km), and ${facilityStats.byDistance['10-20km']} in extended range (10-20km). Current readiness score is ${this.reportData.operationalScore.value}/100 (${this.reportData.operationalScore.band}) with seismic risk flagged as ${riskLevel}.`;
        
        const coverageLines = doc.splitTextToSize(coverageText, contentWidth);
        doc.text(coverageLines, margin, yPos);
    }

    /**
     * Generate geospatial map snapshots (street, terrain, satellite)
     */
    async generateGeospatialMaps(doc, disaster, facilities, location, margin, yPos, contentWidth) {
        this.sectionHeader(doc, 'GEOSPATIAL RESPONSE MAPS', margin);
        yPos = 24;
        doc.setTextColor(...this.pdfTheme.text);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Disaster epicenter, affected radius, and nearby facilities over street, terrain, and satellite base maps.', margin, yPos);
        yPos += 7;

        const styles = [
            {
                id: 'street',
                name: 'Street Map',
                template: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                subdomains: ['a', 'b', 'c']
            },
            {
                id: 'terrain',
                name: 'Terrain Map',
                template: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
                subdomains: ['a', 'b', 'c']
            },
            {
                id: 'satellite',
                name: 'Satellite Map',
                template: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                subdomains: []
            }
        ];

        const maxFacilities = 25;
        const mapFacilities = facilities
            .filter(f => Number.isFinite(Number(f.latitude)) && Number.isFinite(Number(f.longitude)))
            .slice(0, maxFacilities);

        for (const style of styles) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...this.pdfTheme.primary);
            doc.text(style.name, margin, yPos + 4);

            const snapshot = await this.createMapSnapshot(style, location, disaster.radius_km || 10, mapFacilities);

            doc.setDrawColor(...this.pdfTheme.border);
            doc.setLineWidth(0.4);
            doc.roundedRect(margin, yPos + 6, contentWidth, 53, 2, 2, 'S');
            doc.addImage(snapshot.imageData, 'PNG', margin + 1, yPos + 7, contentWidth - 2, 51);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...this.pdfTheme.textMuted);
            const subtitle = snapshot.hasTiles
                ? `Source: ${style.name} tiles | Facilities shown: ${mapFacilities.length} | Radius: ${disaster.radius_km || 10} km`
                : `Base tiles unavailable, rendered with analytic overlay only | Facilities shown: ${mapFacilities.length}`;
            doc.text(subtitle, margin, yPos + 63);

            yPos += 67;
        }
    }

    async createMapSnapshot(style, location, radiusKm, facilities) {
        const width = 900;
        const height = 360;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Base background
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, width, height);

        // Build bounds around disaster + facilities
        const points = [
            { lat: location.latitude, lon: location.longitude },
            ...facilities.map(f => ({ lat: Number(f.latitude), lon: Number(f.longitude) }))
        ].filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));

        let minLat = location.latitude;
        let maxLat = location.latitude;
        let minLon = location.longitude;
        let maxLon = location.longitude;
        points.forEach(p => {
            minLat = Math.min(minLat, p.lat);
            maxLat = Math.max(maxLat, p.lat);
            minLon = Math.min(minLon, p.lon);
            maxLon = Math.max(maxLon, p.lon);
        });

        // Include disaster radius in bounds
        const latPad = (radiusKm || 10) / 111;
        const lonPad = (radiusKm || 10) / Math.max(20, 111 * Math.cos(location.latitude * Math.PI / 180));
        minLat -= latPad;
        maxLat += latPad;
        minLon -= lonPad;
        maxLon += lonPad;

        const center = {
            lat: (minLat + maxLat) / 2,
            lon: (minLon + maxLon) / 2
        };
        const zoom = this.fitZoomForBounds(minLat, maxLat, minLon, maxLon, width, height);
        const centerPx = this.projectWebMercator(center.lat, center.lon, zoom);
        const topLeft = { x: centerPx.x - width / 2, y: centerPx.y - height / 2 };

        const hasTiles = await this.drawTiles(ctx, style, zoom, topLeft, width, height);

        // Subtle overlay for readability
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(0, 0, width, height);

        // Draw disaster radius
        const disasterPx = this.projectWebMercator(location.latitude, location.longitude, zoom);
        const dx = disasterPx.x - topLeft.x;
        const dy = disasterPx.y - topLeft.y;
        const metersPerPx = 156543.03392 * Math.cos(location.latitude * Math.PI / 180) / Math.pow(2, zoom);
        const radiusPx = (radiusKm * 1000) / Math.max(0.001, metersPerPx);

        ctx.beginPath();
        ctx.arc(dx, dy, radiusPx, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.85)';
        ctx.stroke();

        // Draw lines to nearest facilities
        const nearest = [...facilities]
            .sort((a, b) => Number(a.distance_km || 9999) - Number(b.distance_km || 9999))
            .slice(0, 5);

        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.85)';
        nearest.forEach(f => {
            const p = this.projectWebMercator(Number(f.latitude), Number(f.longitude), zoom);
            const px = p.x - topLeft.x;
            const py = p.y - topLeft.y;
            ctx.beginPath();
            ctx.moveTo(dx, dy);
            ctx.lineTo(px, py);
            ctx.stroke();
        });

        // Facility markers
        facilities.forEach(f => {
            const p = this.projectWebMercator(Number(f.latitude), Number(f.longitude), zoom);
            const px = p.x - topLeft.x;
            const py = p.y - topLeft.y;
            if (px < -20 || py < -20 || px > width + 20 || py > height + 20) return;

            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#be123c';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
        });

        // Disaster marker
        ctx.beginPath();
        ctx.arc(dx, dy, 9, 0, Math.PI * 2);
        ctx.fillStyle = '#facc15';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#854d0e';
        ctx.stroke();

        // Simple legend
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillRect(12, 12, 220, 62);
        ctx.strokeStyle = 'rgba(148,163,184,0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(12, 12, 220, 62);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('Map Legend', 22, 28);
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(30, 42, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = '11px Arial';
        ctx.fillText('Disaster Epicenter', 42, 46);
        ctx.fillStyle = '#be123c';
        ctx.beginPath();
        ctx.arc(30, 58, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.fillText('Emergency Facility', 42, 61);

        const imageData = canvas.toDataURL('image/png');
        canvas.remove();
        return { imageData, hasTiles };
    }

    projectWebMercator(lat, lon, zoom) {
        const sin = Math.sin((lat * Math.PI) / 180);
        const scale = 256 * Math.pow(2, zoom);
        const x = ((lon + 180) / 360) * scale;
        const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
        return { x, y };
    }

    fitZoomForBounds(minLat, maxLat, minLon, maxLon, width, height) {
        for (let z = 14; z >= 4; z--) {
            const p1 = this.projectWebMercator(minLat, minLon, z);
            const p2 = this.projectWebMercator(maxLat, maxLon, z);
            const dx = Math.abs(p2.x - p1.x);
            const dy = Math.abs(p2.y - p1.y);
            if (dx <= width * 0.88 && dy <= height * 0.78) {
                return z;
            }
        }
        return 5;
    }

    async drawTiles(ctx, style, zoom, topLeft, width, height) {
        const worldTiles = Math.pow(2, zoom);
        const tileSize = 256;
        const minTileX = Math.floor(topLeft.x / tileSize);
        const maxTileX = Math.floor((topLeft.x + width) / tileSize);
        const minTileY = Math.floor(topLeft.y / tileSize);
        const maxTileY = Math.floor((topLeft.y + height) / tileSize);

        const jobs = [];
        for (let tx = minTileX; tx <= maxTileX; tx++) {
            for (let ty = minTileY; ty <= maxTileY; ty++) {
                if (ty < 0 || ty >= worldTiles) continue;
                const wrappedX = ((tx % worldTiles) + worldTiles) % worldTiles;
                const url = this.resolveTileUrl(style, zoom, wrappedX, ty);
                const dx = tx * tileSize - topLeft.x;
                const dy = ty * tileSize - topLeft.y;
                jobs.push({ url, dx, dy });
            }
        }

        let drawn = 0;
        await Promise.all(jobs.map(async (job) => {
            try {
                const response = await fetch(job.url, { mode: 'cors' });
                if (!response.ok) return;
                const blob = await response.blob();
                if (typeof createImageBitmap === 'function') {
                    const bitmap = await createImageBitmap(blob);
                    ctx.drawImage(bitmap, job.dx, job.dy, tileSize, tileSize);
                } else {
                    const img = await this.loadImageFromBlob(blob);
                    ctx.drawImage(img, job.dx, job.dy, tileSize, tileSize);
                }
                drawn += 1;
            } catch (error) {
                // Ignore individual tile failures
            }
        }));

        return drawn > 0;
    }

    resolveTileUrl(style, z, x, y) {
        const subdomains = style.subdomains || [];
        const sub = subdomains.length ? subdomains[Math.abs((x + y) % subdomains.length)] : '';
        return style.template
            .replace('{s}', sub)
            .replace('{z}', String(z))
            .replace('{x}', String(x))
            .replace('{y}', String(y));
    }

    loadImageFromBlob(blob) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = (err) => {
                URL.revokeObjectURL(url);
                reject(err);
            };
            img.src = url;
        });
    }

    /**
     * Generate facility list page
     */
    generateFacilityList(doc, facilities, facilityStats, disaster, margin, yPos, contentWidth) {
        this.sectionHeader(doc, 'EMERGENCY FACILITIES - COMPLETE LIST', margin);

        yPos = 25;
        doc.setTextColor(...this.pdfTheme.text);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Total ${facilities.length} facilities identified within ${disaster.radius_km + 15}km response radius, sorted by distance from disaster epicenter.`, margin, yPos);
        yPos += 10;

        // Facilities table
        const tableData = facilities.map((f, index) => [
            (index + 1).toString(),
            f.name,
            f.type,
            `${parseFloat(f.distance_km).toFixed(2)} km`,
            index < 5 ? 'Priority' : index < 15 ? 'Secondary' : 'Reserve'
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['#', 'Facility Name', 'Type', 'Distance', 'Response Priority']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: this.pdfTheme.primary,
                textColor: 255,
                fontSize: 9,
                fontStyle: 'bold'
            },
            margin: { left: margin, right: margin },
            styles: { fontSize: 8, cellPadding: 2.5, textColor: this.pdfTheme.text },
            alternateRowStyles: { fillColor: this.pdfTheme.surface },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },
                1: { cellWidth: 75 },
                2: { cellWidth: 35 },
                3: { cellWidth: 22, halign: 'right' },
                4: { cellWidth: 28, halign: 'center' }
            }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Closest facility highlight
        if (facilityStats.closest && yPos < doc.internal.pageSize.getHeight() - 50) {
            doc.setFillColor(...this.pdfTheme.surface);
            doc.roundedRect(margin, yPos, contentWidth, 35, 3, 3, 'F');
            
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...this.pdfTheme.success);
            doc.text('PRIMARY RESPONSE FACILITY - IMMEDIATE DEPLOYMENT', margin + 5, yPos + 8);
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...this.pdfTheme.text);
            doc.text(`Facility: ${facilityStats.closest.name}`, margin + 5, yPos + 16);
            doc.text(`Type: ${facilityStats.closest.type}`, margin + 5, yPos + 22);
            doc.text(`Distance: ${parseFloat(facilityStats.closest.distance_km).toFixed(2)} km (Estimated ${Math.ceil(parseFloat(facilityStats.closest.distance_km) * 2)} minutes response time)`, margin + 5, yPos + 28);
        }
    }

    /**
     * Generate recommendations page
     */
    generateRecommendations(doc, disaster, facilityStats, margin, yPos, contentWidth) {
        this.sectionHeader(doc, 'RESPONSE RECOMMENDATIONS & ACTION PLAN', margin);

        yPos = 25;
        doc.setTextColor(...this.pdfTheme.text);

        // Priority actions
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('PRIORITY ACTIONS (IMMEDIATE)', margin, yPos);
        yPos += 10;

        const priorityActions = [
            {
                title: 'Deploy Emergency Response Teams',
                details: `Dispatch teams from ${facilityStats.closest ? facilityStats.closest.name : 'nearest facility'} (${facilityStats.closest ? parseFloat(facilityStats.closest.distance_km).toFixed(1) : 'N/A'} km away). Estimated arrival: ${facilityStats.closest ? Math.ceil(parseFloat(facilityStats.closest.distance_km) * 2) : 'N/A'} minutes.`
            },
            {
                title: 'Establish Command Center',
                details: `Set up incident command post at disaster perimeter. Coordinate with ${facilityStats.total} identified emergency facilities and maintain live incident board updates.`
            },
            {
                title: 'Activate Communication Protocol',
                details: `Establish radio communication with all facilities within 10km radius. Readiness index is ${this.reportData.operationalScore.value}/100 (${this.reportData.operationalScore.band}).`
            },
            {
                title: 'Initiate Evacuation Procedures',
                details: `Evacuate estimated ${this.reportData.estimatedPopulation.toLocaleString()} people from ${disaster.radius_km}km affected radius. Population source accuracy: ${this.reportData.populationAccuracy}. Priority: ${disaster.severity === 'critical' ? 'IMMEDIATE' : disaster.severity === 'high' ? 'HIGH' : 'STANDARD'}.`
            }
        ];

        priorityActions.forEach((action, index) => {
            doc.setFillColor(...this.pdfTheme.primarySoft);
            doc.roundedRect(margin, yPos, contentWidth, 20, 2, 2, 'F');
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(`${index + 1}. ${action.title}`, margin + 5, yPos + 7);
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            const detailLines = doc.splitTextToSize(action.details, contentWidth - 10);
            doc.text(detailLines, margin + 5, yPos + 13);
            
            yPos += 22;
        });

        yPos += 10;

        // Resource allocation
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('RESOURCE ALLOCATION STRATEGY', margin, yPos);
        yPos += 10;

        const resources = [
            { category: 'Medical Resources', allocation: `Deploy from ${(facilityStats.byType['Hospital'] || facilityStats.byType['hospital'] || 0)} hospitals`, priority: 'HIGH' },
            { category: 'Fire & Rescue', allocation: `Mobilize ${(facilityStats.byType['Fire Station'] || facilityStats.byType['fire_station'] || 0)} fire stations`, priority: disaster.disaster_type === 'fire' ? 'CRITICAL' : 'MEDIUM' },
            { category: 'Law Enforcement', allocation: `Coordinate ${(facilityStats.byType['Police Station'] || facilityStats.byType['police_station'] || 0)} police stations`, priority: 'MEDIUM' },
            { category: 'Emergency Supplies', allocation: 'Stockpile at primary response facility', priority: 'HIGH' }
        ];

        doc.autoTable({
            startY: yPos,
            head: [['Resource Category', 'Allocation Strategy', 'Priority']],
            body: resources.map(r => [r.category, r.allocation, r.priority]),
            theme: 'grid',
            headStyles: {
                fillColor: this.pdfTheme.primary,
                textColor: 255,
                fontSize: 9,
                fontStyle: 'bold'
            },
            styles: { fontSize: 9, cellPadding: 3, textColor: this.pdfTheme.text, overflow: 'linebreak' },
            columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 80 },
                2: { cellWidth: 30, halign: 'center' }
            }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Risk mitigation
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('RISK MITIGATION MEASURES', margin, yPos);
        yPos += 8;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const seismicRisk = this.reportData.advancedData?.seismicRisk?.risk_level || 'UNKNOWN';
        const nearbyEqCount = this.reportData.advancedData?.earthquakes?.length || 0;
        const mitigationText = `Based on ${disaster.severity} severity, ${this.reportData.affectedArea.toFixed(2)} km2 affected area, seismic risk level ${seismicRisk}, and ${nearbyEqCount} nearby earthquake records from V2 feeds, recommended controls are: establish perimeter at ${disaster.radius_km + 2}km, deploy medical triage units at ${Math.min(3, Math.floor(facilityStats.total / 5))} strategic points, sustain continuous zone monitoring, prepare for secondary incidents, and secure supply continuity for 24-48 hours.`;
        
        const mitigationLines = doc.splitTextToSize(mitigationText, contentWidth);
        doc.text(mitigationLines, margin, yPos);
    }

    /**
     * Generate statistical analysis page
     */
    async generateStatisticalAnalysis(doc, margin, yPos, contentWidth) {
        // Header
        this.sectionHeader(doc, 'HISTORICAL STATISTICAL ANALYSIS', margin);

        yPos = 25;
        doc.setTextColor(...this.pdfTheme.text);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Historical disaster trends and patterns for comparative analysis and future preparedness planning.', margin, yPos);
        yPos += 15;

        // Add charts
        await this.addChartsToReport(doc, margin, yPos, contentWidth);
    }

    /**
     * Generate advanced operational intelligence page
     */
    generateOperationalIntelligence(doc, disaster, facilityStats, margin, yPos, contentWidth) {
        this.sectionHeader(doc, 'ADVANCED OPERATIONAL INTELLIGENCE', margin);

        yPos = 25;
        doc.setTextColor(...this.pdfTheme.text);

        const adv = this.reportData.advancedData || {};
        const risk = adv.seismicRisk || {};
        const earthquakes = adv.earthquakes || [];
        const floodRisk = adv.floodRisk || {};
        const elevation = adv.elevation || {};
        const insights = this.reportData.historicalInsights || {};

        // Data quality strip
        doc.setFillColor(...this.pdfTheme.surface);
        doc.roundedRect(margin, yPos, contentWidth, 20, 3, 3, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Readiness: ${this.reportData.operationalScore.value}/100 (${this.reportData.operationalScore.band})`, margin + 5, yPos + 8);
        doc.setFont('helvetica', 'normal');
        const v2Status = adv.v2Available ? 'Live V2 data available' : 'V2 feeds unavailable; report uses baseline model data';
        doc.text(`Data mode: ${v2Status}`, margin + 5, yPos + 15);
        yPos += 28;

        // Left box: population and incident load
        const boxWidth = (contentWidth - 5) / 2;
        doc.setFillColor(...this.pdfTheme.primarySoft);
        doc.roundedRect(margin, yPos, boxWidth, 55, 3, 3, 'F');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Population & Load Indicators', margin + 5, yPos + 8);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const leftLines = [
            `Affected population: ${this.reportData.estimatedPopulation.toLocaleString()}`,
            `Population confidence: ${this.reportData.populationAccuracy}`,
            `Incidents in last 30 days: ${insights.last30DaysIncidents || 0}`,
            `Same type historical incidents: ${insights.sameTypeTotal || 0}`,
            `High/Critical incidents in history: ${insights.highSeverityTotal || 0}`
        ];
        let leftY = yPos + 16;
        leftLines.forEach((line) => {
            doc.text(line, margin + 5, leftY);
            leftY += 7;
        });

        // Right box: seismic & earthquake indicators
        doc.setFillColor(...this.pdfTheme.surface);
        doc.roundedRect(margin + boxWidth + 5, yPos, boxWidth, 55, 3, 3, 'F');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Seismic & Exposure Indicators', margin + boxWidth + 10, yPos + 8);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const rightLines = [
            `Seismic risk level: ${risk.risk_level || 'UNKNOWN'}`,
            `Nearby earthquakes (query): ${earthquakes.length}`,
            `Major earthquakes (M6+): ${risk.major_earthquakes || 0}`,
            `Largest nearby magnitude: ${risk.largest_magnitude || 0}`,
            `Flood-risk zones (elevation model): ${floodRisk.count || 0}`,
            `High flood-risk zones: ${floodRisk.high_risk_count || 0}`,
            `Elevation at incident: ${elevation.elevation_m != null ? Number(elevation.elevation_m).toFixed(1) + ' m' : 'UNKNOWN'}`,
            `Average facility distance: ${facilityStats.averageDistance} km`
        ];
        let rightY = yPos + 16;
        rightLines.forEach((line) => {
            doc.text(line, margin + boxWidth + 10, rightY);
            rightY += 7;
        });
        yPos += 65;

        // Top nearby earthquakes table
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Nearest Earthquake Events (V2 Feed)', margin, yPos);
        yPos += 8;

        const eqRows = earthquakes.slice(0, 6).map((e, idx) => ([
            `${idx + 1}`,
            `${e.time || 'N/A'}`.substring(0, 19),
            `${Number(e.magnitude || 0).toFixed(1)}`,
            `${Number(e.distance_km || 0).toFixed(1)} km`,
            `${Number(e.depth_km || 0).toFixed(1)} km`
        ]));

        if (eqRows.length > 0) {
            doc.autoTable({
                startY: yPos,
                head: [['#', 'Timestamp', 'Magnitude', 'Distance', 'Depth']],
                body: eqRows,
                theme: 'grid',
                headStyles: {
                    fillColor: this.pdfTheme.primary,
                    textColor: 255,
                    fontSize: 9,
                    fontStyle: 'bold'
                },
                margin: { left: margin, right: margin },
                styles: { fontSize: 8, cellPadding: 2.5, textColor: this.pdfTheme.text, overflow: 'linebreak' }
            });
            yPos = doc.lastAutoTable.finalY + 10;
        } else {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.text('No nearby earthquake records available from active feeds.', margin, yPos);
            yPos += 12;
        }

        // Final recommendation paragraph
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Operational Interpretation', margin, yPos);
        yPos += 8;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const interpretation = `The current readiness posture is ${this.reportData.operationalScore.band.toUpperCase()} (${this.reportData.operationalScore.value}/100). Combined with ${risk.risk_level || 'UNKNOWN'} seismic background and ${insights.last30DaysIncidents || 0} incidents in the last 30 days, command should prioritize rapid triage deployment, communication redundancy, and periodic reassessment every 30 minutes during active operations.`;
        const interpretationLines = doc.splitTextToSize(interpretation, contentWidth);
        doc.text(interpretationLines, margin, yPos);
    }

    /**
     * Add footers to all pages
     */
    addFooters(doc, pageWidth, pageHeight, margin) {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);

            // Skip footer on cover page
            if (i === 1) continue;

            // Footer line
            doc.setDrawColor(...this.pdfTheme.border);
            doc.setLineWidth(0.3);
            doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

            doc.setFontSize(7);
            doc.setTextColor(...this.pdfTheme.textMuted);
            doc.setFont('helvetica', 'normal');
            doc.text(
                `Generated: ${new Date(this.reportData.generatedAt).toLocaleString()} | AeGIS-1 v2.0 | CONFIDENTIAL`,
                margin,
                pageHeight - 8
            );
            doc.text(
                `Page ${i} of ${pageCount}`,
                pageWidth - margin,
                pageHeight - 8,
                { align: 'right' }
            );
        }
    }

    /**
     * Add distance distribution chart to PDF
     */
    async addDistanceChart(doc, x, y, width) {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');

        const distData = this.reportData.facilityStats.byDistance;

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(distData),
                datasets: [{
                    label: 'Number of Facilities',
                    data: Object.values(distData),
                    backgroundColor: [
                        'rgba(14, 116, 144, 0.85)',
                        'rgba(17, 63, 87, 0.85)',
                        'rgba(180, 83, 9, 0.85)',
                        'rgba(153, 27, 27, 0.85)'
                    ],
                    borderColor: [
                        'rgb(14, 116, 144)',
                        'rgb(17, 63, 87)',
                        'rgb(180, 83, 9)',
                        'rgb(153, 27, 27)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: false,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Facilities by Distance from Disaster',
                        font: { size: 14, weight: 'bold' }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        const chartImage = canvas.toDataURL('image/png');
        doc.addImage(chartImage, 'PNG', x, y, width, 60);

        chart.destroy();
        canvas.remove();
    }

    /**
     * Add statistical charts to report
     */
    async addChartsToReport(doc, x, y, width) {
        const statistics = this.reportData.statistics;
        
        if (!statistics || statistics.length === 0) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...this.pdfTheme.textMuted);
            doc.text('Insufficient historical data for statistical analysis.', x, y);
            return;
        }

        // Calculate severity distribution
        const severityCounts = {};
        statistics.forEach(stat => {
            severityCounts[stat.severity] = (severityCounts[stat.severity] || 0) + stat.count;
        });

        // Calculate disaster type distribution
        const typeCounts = {};
        statistics.forEach(stat => {
            typeCounts[stat.type] = (typeCounts[stat.type] || 0) + stat.count;
        });

        // Create severity distribution doughnut chart
        const canvas1 = document.createElement('canvas');
        canvas1.width = 500;
        canvas1.height = 300;
        const ctx1 = canvas1.getContext('2d');

        const severityColors = {
            'Low': 'rgba(14, 116, 144, 0.8)',
            'Medium': 'rgba(180, 83, 9, 0.8)',
            'High': 'rgba(185, 28, 28, 0.8)',
            'Critical': 'rgba(127, 29, 29, 0.85)'
        };

        const severityBorderColors = {
            'Low': 'rgb(14, 116, 144)',
            'Medium': 'rgb(180, 83, 9)',
            'High': 'rgb(185, 28, 28)',
            'Critical': 'rgb(127, 29, 29)'
        };

        const chart1 = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: Object.keys(severityCounts),
                datasets: [{
                    label: 'Severity Distribution',
                    data: Object.values(severityCounts),
                    backgroundColor: Object.keys(severityCounts).map(s => severityColors[s] || 'rgba(107, 114, 128, 0.8)'),
                    borderColor: Object.keys(severityCounts).map(s => severityBorderColors[s] || 'rgb(107, 114, 128)'),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { font: { size: 11 } }
                    },
                    title: {
                        display: true,
                        text: 'Disaster Severity Distribution',
                        font: { size: 13, weight: 'bold' }
                    }
                }
            }
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        const chartImage1 = canvas1.toDataURL('image/png');
        doc.addImage(chartImage1, 'PNG', x, y, width / 2 - 5, 55);

        chart1.destroy();
        canvas1.remove();

        // Create disaster types bar chart
        const canvas2 = document.createElement('canvas');
        canvas2.width = 500;
        canvas2.height = 300;
        const ctx2 = canvas2.getContext('2d');

        const chart2 = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: Object.keys(typeCounts),
                datasets: [{
                    label: 'Number of Incidents',
                    data: Object.values(typeCounts),
                    backgroundColor: 'rgba(17, 63, 87, 0.85)',
                    borderColor: 'rgb(17, 63, 87)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: false,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Disaster Types Distribution',
                        font: { size: 13, weight: 'bold' }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        const chartImage2 = canvas2.toDataURL('image/png');
        doc.addImage(chartImage2, 'PNG', x + width / 2 + 5, y, width / 2 - 5, 55);

        chart2.destroy();
        canvas2.remove();

        // Add analysis text
        const totalIncidents = Object.values(typeCounts).reduce((a, b) => a + b, 0);
        const mostCommonType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
        const mostCommonSeverity = Object.entries(severityCounts).sort((a, b) => b[1] - a[1])[0];

        y += 65;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('HISTORICAL TRENDS ANALYSIS', x, y);
        y += 8;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const analysisText = `Based on ${totalIncidents} recorded incidents, ${mostCommonType[0]} disasters are the most frequent (${mostCommonType[1]} incidents, ${((mostCommonType[1] / totalIncidents) * 100).toFixed(1)}% of total). The majority of incidents are classified as ${mostCommonSeverity[0]} severity (${mostCommonSeverity[1]} incidents, ${((mostCommonSeverity[1] / totalIncidents) * 100).toFixed(1)}%). This historical data suggests the need for enhanced preparedness and resource allocation for ${mostCommonType[0]} response capabilities.`;
        
        const analysisLines = doc.splitTextToSize(analysisText, width);
        doc.text(analysisLines, x, y);
    }

    /**
     * Close modal
     */
    closeModal() {
        const modal = document.getElementById('report-selection-modal');
        if (modal) {
            modal.remove();
        }
    }
}

// Create global instance
window.reportGenerator = new DisasterReportGenerator();

// Add CSS for hover effect
const style = document.createElement('style');
style.textContent = `
    .disaster-card:hover {
        border-color: var(--primary) !important;
        box-shadow: 0 4px 12px rgba(79, 124, 255, 0.2);
        transform: translateY(-2px);
    }
`;
document.head.appendChild(style);
