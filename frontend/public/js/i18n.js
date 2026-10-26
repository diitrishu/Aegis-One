/*
 * AeGIS-1 frontend i18n support (English/Hindi).
 * Applies selected language across pages using localStorage.
 */
(function () {
    const STORAGE_KEY = "aegis_language";
    const SUPPORTED = ["en", "hi"];

    const HI = {
        "Dashboard": "डैशबोर्ड",
        "Map": "मानचित्र",
        "Disasters": "आपदाएं",
        "Facilities": "सुविधाएं",
        "Analytics": "विश्लेषण",
        "Operations": "ऑपरेशंस",
        "About": "परिचय",
        "Report Disaster": "आपदा रिपोर्ट करें",
        "Emergency Response Coordination": "आपातकालीन प्रतिक्रिया समन्वय",
        "Real-time disaster management for North India • Powered by AI & GIS Technology": "उत्तर भारत के लिए रियल-टाइम आपदा प्रबंधन • AI और GIS तकनीक से संचालित",
        "System Status": "सिस्टम स्थिति",
        "Active Disasters": "सक्रिय आपदाएं",
        "Emergency Facilities": "आपातकालीन सुविधाएं",
        "Districts Covered": "कवर किए गए जिले",
        "Quick Actions": "त्वरित कार्रवाई",
        "View Map": "मानचित्र देखें",
        "Live Tracking": "लाइव ट्रैकिंग",
        "Find Facilities": "सुविधाएं खोजें",
        "View Analytics": "विश्लेषण देखें",
        "Mobile Tracker": "मोबाइल ट्रैकर",
        "System Overview": "सिस्टम अवलोकन",
        "Facility Distribution": "सुविधा वितरण",
        "System Information": "सिस्टम जानकारी",
        "Hospitals": "अस्पताल",
        "Fire Stations": "फायर स्टेशन",
        "Police Stations": "पुलिस स्टेशन",
        "Historical Disasters": "ऐतिहासिक आपदाएं",
        "Operational Facilities": "संचालित सुविधाएं",
        "Last Updated": "अंतिम अपडेट",
        "Never": "कभी नहीं",
        "Quick Test Locations": "त्वरित परीक्षण स्थान",
        "Capital City": "राजधानी शहर",
        "National Capital": "राष्ट्रीय राजधानी",
        "Industrial Hub": "औद्योगिक केंद्र",
        "Heritage City": "विरासत शहर",
        "System Analytics": "सिस्टम विश्लेषण",
        "Disaster patterns and response metrics": "आपदा पैटर्न और प्रतिक्रिया मीट्रिक्स",
        "Refresh Data": "डेटा रीफ्रेश करें",
        "Generate Report": "रिपोर्ट बनाएं",
        "Total Disasters": "कुल आपदाएं",
        "Coverage Overview": "कवरेज अवलोकन",
        "System Performance": "सिस्टम प्रदर्शन",
        "Uptime": "अपटाइम",
        "Response Time": "प्रतिक्रिया समय",
        "Monitoring": "निगरानी",
        "Live Incident Intelligence": "लाइव घटना इंटेलिजेंस",
        "Analysis Location": "विश्लेषण स्थान",
        "Last Refreshed": "अंतिम रिफ्रेश",
        "Population in Radius": "त्रिज्या में जनसंख्या",
        "Population Accuracy": "जनसंख्या सटीकता",
        "Seismic Risk": "भूकंपीय जोखिम",
        "Nearby Earthquakes": "निकटवर्ती भूकंप",
        "Elevation": "ऊंचाई",
        "Flood-Risk Zones": "बाढ़-जोखिम क्षेत्र",
        "High Flood-Risk": "उच्च बाढ़-जोखिम",
        "Disaster Management": "आपदा प्रबंधन",
        "Report and manage disaster events": "आपदा घटनाओं की रिपोर्ट और प्रबंधन करें",
        "Report New Disaster": "नई आपदा रिपोर्ट करें",
        "Disaster Type": "आपदा प्रकार",
        "Select disaster type": "आपदा प्रकार चुनें",
        "Severity Level": "गंभीरता स्तर",
        "Latitude": "अक्षांश",
        "Longitude": "देशांतर",
        "Select Location on Map": "मानचित्र पर स्थान चुनें",
        "Hide Map": "मानचित्र छुपाएं",
        "Use My Location": "मेरा स्थान उपयोग करें",
        "Affected Radius (km)": "प्रभावित त्रिज्या (किमी)",
        "Area affected by the disaster": "आपदा से प्रभावित क्षेत्र",
        "Description": "विवरण",
        "Describe the disaster situation in detail...": "आपदा की स्थिति का विस्तार से वर्णन करें...",
        "ACTIVATE EMERGENCY RESPONSE": "आपातकालीन प्रतिक्रिया सक्रिय करें",
        "Quick Test Locations": "त्वरित परीक्षण स्थान",
        "Disaster Types": "आपदा प्रकार",
        "Enhanced Data Intelligence": "उन्नत डेटा इंटेलिजेंस",
        "Reported Disaster History": "रिपोर्ट की गई आपदा इतिहास",
        "Nearby Facilities for Selected History": "चयनित इतिहास के लिए निकटवर्ती सुविधाएं",
        "Loading reported disasters...": "रिपोर्ट की गई आपदाएं लोड हो रही हैं...",
        "Loading...": "लोड हो रहा है...",
        "About AeGIS-1": "AeGIS-1 के बारे में",
        "Real-time Emergency Coordination for North India": "उत्तर भारत के लिए रियल-टाइम आपातकालीन समन्वय",
        "Dark mode coming soon!": "डार्क मोड जल्द आ रहा है!",
        "Analytics updated": "विश्लेषण अपडेट हो गया",
        "Analytics updated with live data": "लाइव डेटा के साथ विश्लेषण अपडेट हुआ",
        "Failed to load analytics": "विश्लेषण लोड नहीं हो पाया",
        "Emergency Response Activated": "आपातकालीन प्रतिक्रिया सक्रिय",
        "Type": "प्रकार",
        "Severity": "गंभीरता",
        "Location": "स्थान",
        "Radius": "त्रिज्या",
        "View on Map": "मानचित्र पर देखें",
        "Load Facilities": "सुविधाएं लोड करें",
        "Report Another": "एक और रिपोर्ट करें",
        "Nearby Emergency Facilities": "निकटवर्ती आपातकालीन सुविधाएं",
        "Distance": "दूरी",
        "Capacity": "क्षमता",
        "Status": "स्थिति",
        "No Facilities Found": "कोई सुविधा नहीं मिली",
        "Search Facilities": "सुविधाएं खोजें",
        "Error Loading Facilities": "सुविधाएं लोड करने में त्रुटि",
        "North India Disaster Coverage": "उत्तर भारत आपदा कवरेज",
        "Emergency Operations Center": "आपातकालीन ऑपरेशंस सेंटर",
        "English": "English",
        "Hindi": "हिंदी"
    };

    const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;
    const escapeRegExp = (s) => s.replace(ESCAPE_RE, "\\$&");
    const getStoredLanguage = () => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return SUPPORTED.includes(saved) ? saved : "en";
    };

    const trimPreserve = (text, translatedCore) => {
        const lead = (text.match(/^\s*/) || [""])[0];
        const trail = (text.match(/\s*$/) || [""])[0];
        return `${lead}${translatedCore}${trail}`;
    };

    function translateByMap(original, lang) {
        if (lang !== "hi" || !original) return original;
        const raw = String(original);
        const core = raw.trim();

        if (HI[core]) return trimPreserve(raw, HI[core]);

        let replaced = raw;
        const keys = Object.keys(HI).sort((a, b) => b.length - a.length);
        for (const en of keys) {
            const hi = HI[en];
            if (!en || !hi) continue;
            const re = new RegExp(escapeRegExp(en), "g");
            replaced = replaced.replace(re, hi);
        }
        return replaced;
    }

    function translateTextNode(node, lang) {
        if (!node || !node.nodeValue) return;
        const parent = node.parentElement;
        if (!parent) return;
        if (["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE"].includes(parent.tagName)) return;
        const value = node.nodeValue;
        if (!value.trim()) return;

        if (!Object.prototype.hasOwnProperty.call(node, "__i18nOriginal")) {
            node.__i18nOriginal = value;
        }
        const source = node.__i18nOriginal;
        const next = lang === "en" ? source : translateByMap(source, lang);
        if (next !== node.nodeValue) {
            node.nodeValue = next;
        }
    }

    function translateAttributes(el, lang) {
        const attrs = ["placeholder", "title", "aria-label"];
        for (const attr of attrs) {
            if (!el.hasAttribute(attr)) continue;
            const key = `data-i18n-orig-${attr}`;
            if (!el.hasAttribute(key)) {
                el.setAttribute(key, el.getAttribute(attr) || "");
            }
            const source = el.getAttribute(key) || "";
            const next = lang === "en" ? source : translateByMap(source, lang);
            if (el.getAttribute(attr) !== next) {
                el.setAttribute(attr, next);
            }
        }

        if (el.tagName === "INPUT" && ["button", "submit", "reset"].includes((el.type || "").toLowerCase())) {
            const key = "data-i18n-orig-value";
            if (!el.hasAttribute(key)) {
                el.setAttribute(key, el.value || "");
            }
            const source = el.getAttribute(key) || "";
            const next = lang === "en" ? source : translateByMap(source, lang);
            if (el.value !== next) {
                el.value = next;
            }
        }
    }

    function applyToRoot(root, lang) {
        if (!root) return;
        if (root.nodeType === Node.TEXT_NODE) {
            translateTextNode(root, lang);
            return;
        }
        if (root.nodeType !== Node.ELEMENT_NODE && root !== document) return;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);
        textNodes.forEach((n) => translateTextNode(n, lang));

        const elementRoot = root === document ? document.documentElement : root;
        if (elementRoot.querySelectorAll) {
            elementRoot.querySelectorAll("*").forEach((el) => translateAttributes(el, lang));
        }
    }

    let observer = null;
    let isApplying = false;

    function withApplyGuard(fn) {
        isApplying = true;
        try {
            fn();
        } finally {
            isApplying = false;
        }
    }

    function setupObserver() {
        if (observer) observer.disconnect();
        observer = new MutationObserver((mutations) => {
            if (isApplying) return;
            const lang = getStoredLanguage();
            withApplyGuard(() => {
                mutations.forEach((m) => {
                    if (m.type === "characterData") {
                        translateTextNode(m.target, lang);
                    } else if (m.type === "childList") {
                        m.addedNodes.forEach((n) => applyToRoot(n, lang));
                    }
                });
            });
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function syncSwitchers(lang) {
        document.querySelectorAll("[data-language-switcher]").forEach((el) => {
            if ("value" in el) el.value = lang;
        });
    }

    function applyLanguage(lang) {
        const target = SUPPORTED.includes(lang) ? lang : "en";
        document.documentElement.setAttribute("lang", target);
        withApplyGuard(() => applyToRoot(document, target));
        syncSwitchers(target);
    }

    function setLanguage(lang) {
        const target = SUPPORTED.includes(lang) ? lang : "en";
        localStorage.setItem(STORAGE_KEY, target);
        applyLanguage(target);
    }

    function initSwitchers() {
        document.querySelectorAll("[data-language-switcher]").forEach((el) => {
            if (el.__i18nBound) return;
            el.__i18nBound = true;
            el.addEventListener("change", (e) => setLanguage(e.target.value));
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        initSwitchers();
        applyLanguage(getStoredLanguage());
        setupObserver();
    });

    window.I18n = {
        setLanguage,
        getLanguage: getStoredLanguage,
        translate: (text) => translateByMap(text, getStoredLanguage())
    };
})();
