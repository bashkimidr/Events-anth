const fs = require('fs');
fs.writeFileSync('test3.js', `
const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const html = fs.readFileSync('index.html', 'utf-8');
const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
dom.window.localStorage = {
    _data: {},
    getItem: function(k) { return this._data[k] || null; },
    setItem: function(k, v) { this._data[k] = String(v); }
};
dom.window.alert = () => {};
dom.window.fetch = async () => ({ json: async () => ({ url: "mock.jpg" }) });
dom.window.URL.createObjectURL = () => "blob:mock";
setTimeout(() => {
    try {
    const doc = dom.window.document;
    doc.getElementById('admin-add-btn').click();
    doc.getElementById('event-title').value = "Test Event";
    doc.getElementById('event-category').value = "Music";
    doc.getElementById('event-date').value = "2026-05-01";
    doc.getElementById('event-time').value = "10:00";
    doc.getElementById('event-location').value = "Loc";
    doc.getElementById('event-city').value = "City";
    doc.getElementById('event-email').value = "test@abc.com";
    doc.getElementById('event-phone').value = "123456";
    doc.getElementById('save-event').click();
    setTimeout(() => {
        console.log("LS:", dom.window.localStorage.getItem('app_requested_events'));
    }, 1000);
    } catch(e) { console.error('CRASH:', e); }
}, 2000);
`);
