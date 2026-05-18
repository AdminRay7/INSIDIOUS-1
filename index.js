const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const mongoose = require("mongoose");
const config = require("./config");
const app = express();
const PORT = 21079;
const HOST = '0.0.0.0';

// ========== GLOBAL ERROR HANDLERS (to see why it crashes) ==========
process.on('uncaughtException', (err) => {
    console.error('💥 UNCAUGHT EXCEPTION:', err);
    console.error(err.stack);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 UNHANDLED REJECTION:', reason);
    // Don't exit immediately, let the bot try to recover
});
// ==================================================================

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', '*');
    next();
});
app.use(express.json());

const { User } = require('./database/models');

let globalConn = null;
let isReady = false;
let retryCount = 0;

// Database
mongoose.connect(config.mongodb).then(() => console.log("✅ Database Connected")).catch(e => console.log("DB Error:", e.message));

// Web Page - Pairing Code Only
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>INSIDIOUS BOT - Pairing</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
                    font-family: 'Courier New', monospace;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    padding: 20px;
                }
                .container {
                    background: rgba(0,0,0,0.95);
                    border-radius: 20px;
                    padding: 40px;
                    max-width: 500px;
                    width: 100%;
                    text-align: center;
                    border: 2px solid #8b0000;
                    box-shadow: 0 0 30px rgba(139,0,0,0.3);
                }
                h1 { 
                    color: #8b0000; 
                    font-size: 2.5em; 
                    margin-bottom: 10px;
                    text-shadow: 0 0 10px rgba(139,0,0,0.5);
                }
                .subtitle {
                    color: #888;
                    margin-bottom: 20px;
                    font-size: 12px;
                }
                .status {
                    margin: 20px 0;
                    padding: 12px;
                    border-radius: 10px;
                    font-size: 14px;
                }
                .ready { 
                    background: #1a3a1a; 
                    color: #4caf50; 
                    border-left: 4px solid #4caf50;
                }
                .waiting { 
                    background: #3a2a1a; 
                    color: #ff9800; 
                    border-left: 4px solid #ff9800;
                }
                .error { 
                    background: #3a1a1a; 
                    color: #f44336; 
                    border-left: 4px solid #f44336;
                }
                input {
                    width: 100%;
                    padding: 15px;
                    margin: 10px 0;
                    background: #2a2a2a;
                    border: 2px solid #8b0000;
                    color: white;
                    border-radius: 10px;
                    font-size: 16px;
                    text-align: center;
                }
                input:focus {
                    outline: none;
                    border-color: #ff0000;
                }
                button {
                    background: linear-gradient(135deg, #8b0000 0%, #cc0000 100%);
                    color: white;
                    padding: 15px;
                    border: none;
                    border-radius: 10px;
                    font-size: 18px;
                    font-weight: bold;
                    cursor: pointer;
                    width: 100%;
                    margin-top: 10px;
                    transition: all 0.3s;
                }
                button:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 20px rgba(139,0,0,0.4);
                }
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .code-container {
                    margin-top: 20px;
                    padding: 20px;
                    background: #0a0a0a;
                    border-radius: 15px;
                    border: 2px dashed #8b0000;
                    display: none;
                }
                .code {
                    font-size: 42px;
                    font-weight: bold;
                    color: #ff4444;
                    background: #000;
                    padding: 20px;
                    border-radius: 10px;
                    letter-spacing: 8px;
                    margin: 15px 0;
                    font-family: monospace;
                }
                .footer {
                    margin-top: 20px;
                    font-size: 10px;
                    color: #555;
                }
                .info {
                    background: #1a1a2a;
                    padding: 10px;
                    border-radius: 8px;
                    font-size: 11px;
                    margin-top: 15px;
                }
                .spinner {
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    border: 2px solid #fff;
                    border-top: 2px solid #8b0000;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-right: 8px;
                    vertical-align: middle;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🥀 INSIDIOUS</h1>
                <div class="subtitle">WhatsApp Bot - Pairing System</div>
                
                <div id="status" class="status waiting">
                    <span class="spinner"></span> Bot is starting...
                </div>
                
                <div class="info">
                    <strong>📱 How to connect your WhatsApp:</strong><br><br>
                    1️⃣ Enter your phone number below (with country code)<br>
                    2️⃣ Click "Get Pairing Code"<br>
                    3️⃣ Open WhatsApp on your phone<br>
                    4️⃣ Go to Settings → Linked Devices<br>
                    5️⃣ Tap "Link with Phone Number"<br>
                    6️⃣ Enter the 8-digit code<br>
                    7️⃣ Wait 5 seconds - Bot will connect!
                </div>
                
                <input type="text" id="phone" placeholder="254712345678" />
                <button id="pairBtn" onclick="getPairingCode()" disabled>
                    🔗 Get Pairing Code
                </button>
                
                <div id="codeContainer" class="code-container">
                    <div style="color: #8b0000; margin-bottom: 10px;">✦ YOUR PAIRING CODE ✦</div>
                    <div id="pairingCode" class="code"></div>
                    <small>Enter this code in WhatsApp → Linked Devices → Link with Phone Number</small>
                </div>
                
                <div id="message" style="margin-top: 15px; font-size: 12px;"></div>
                <div class="footer">Powered by INSIDIOUS BOT | Developed by STANYTZ</div>
            </div>

            <script>
                let checkInterval;
                
                async function checkBotStatus() {
                    try {
                        const res = await fetch('/status');
                        const data = await res.json();
                        const statusDiv = document.getElementById('status');
                        const pairBtn = document.getElementById('pairBtn');
                        
                        if (data.ready) {
                            statusDiv.innerHTML = '✅ BOT IS READY - Enter your number';
                            statusDiv.className = 'status ready';
                            pairBtn.disabled = false;
                            if (checkInterval) clearInterval(checkInterval);
                        } else if (data.connected) {
                            statusDiv.innerHTML = '<span class="spinner"></span> Connecting to WhatsApp... Please wait';
                            statusDiv.className = 'status waiting';
                            pairBtn.disabled = true;
                        } else {
                            statusDiv.innerHTML = '<span class="spinner"></span> Bot is starting... Please wait 30 seconds';
                            statusDiv.className = 'status waiting';
                            pairBtn.disabled = true;
                        }
                    } catch(e) {
                        console.log('Status check failed');
                    }
                }
                
                async function getPairingCode() {
                    const phone = document.getElementById('phone').value;
                    if (!phone) {
                        showMessage('❌ Please enter your phone number', 'error');
                        return;
                    }
                    
                    const cleanPhone = phone.replace(/[^0-9]/g, '');
                    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
                        showMessage('❌ Invalid phone number (10-15 digits required)', 'error');
                        return;
                    }
                    
                    const pairBtn = document.getElementById('pairBtn');
                    const originalText = pairBtn.textContent;
                    pairBtn.disabled = true;
                    pairBtn.textContent = '⏳ Generating Code...';
                    document.getElementById('codeContainer').style.display = 'none';
                    
                    try {
                        const res = await fetch('/pair?num=' + cleanPhone);
                        const data = await res.json();
                        
                        if (data.success) {
                            document.getElementById('pairingCode').textContent = data.code;
                            document.getElementById('codeContainer').style.display = 'block';
                            showMessage('✅ Pairing code generated! Enter it in WhatsApp', 'success');
                            
                            setTimeout(() => {
                                document.getElementById('codeContainer').style.display = 'none';
                            }, 600000);
                        } else {
                            showMessage('❌ ' + (data.error || 'Failed to generate code. Try again.'), 'error');
                        }
                    } catch(e) {
                        showMessage('❌ Connection error. Make sure the bot is running.', 'error');
                    } finally {
                        pairBtn.disabled = false;
                        pairBtn.textContent = originalText;
                    }
                }
                
                function showMessage(msg, type) {
                    const msgDiv = document.getElementById('message');
                    msgDiv.style.color = type === 'error' ? '#f44336' : '#4caf50';
                    msgDiv.innerHTML = msg;
                    setTimeout(() => {
                        msgDiv.innerHTML = '';
                    }, 5000);
                }
                
                checkBotStatus();
                checkInterval = setInterval(checkBotStatus, 3000);
            </script>
        </body>
        </html>
    `);
});

// API Endpoints
app.get('/status', (req, res) => {
    res.json({ 
        ready: isReady && globalConn !== null,
        connected: globalConn !== null
    });
});

app.get('/pair', async (req, res) => {
    const num = req.query.num;
    if (!num) {
        return res.json({ error: 'Phone number required' });
    }
    
    try {
        const cleanNum = num.replace(/[^0-9]/g, '');
        
        if (!globalConn || !isReady) {
            return res.json({ error: 'Bot is not connected. Please wait 1 minute.' });
        }
        
        console.log(`\n📱 Generating pairing code for +${cleanNum}...`);
        const code = await globalConn.requestPairingCode(cleanNum);
        console.log(`✅ Pairing code: ${code}`);
        console.log(`📝 Tell user to enter this code in WhatsApp\n`);
        
        // Save to database
        const jid = cleanNum + '@s.whatsapp.net';
        try {
            await User.findOneAndUpdate(
                { jid },
                { jid, linkedAt: new Date(), isActive: true },
                { upsert: true }
            );
        } catch(e) {}
        
        res.json({ success: true, code: code });
    } catch (err) {
        console.error('Pairing error:', err.message);
        res.json({ error: 'Connection failed. Bot may be reconnecting. Try again in 30 seconds.' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: isReady ? 'online' : 'connecting',
        uptime: process.uptime()
    });
});

// WhatsApp Connection
async function startBot() {
    try {
        console.log("\n🚀 Starting INSIDIOUS Bot...");
        console.log("⏳ Connecting to WhatsApp...");
        
        const { state, saveCreds } = await useMultiFileAuthState("session");
        const { version } = await fetchLatestBaileysVersion();
        
        const conn = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
            },
            logger: pino({ level: "silent" }),
            browser: ["INSIDIOUS BOT", "Chrome", "120.0.0"],
            markOnlineOnConnect: true,
            printQRInTerminal: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
        });
        
        globalConn = conn;
        
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                isReady = true;
                retryCount = 0;
                console.log("\n✅✅✅ INSIDIOUS IS ONLINE! ✅✅✅\n");
                console.log(`🌐 Web Panel: http://fi13.bot-hosting.cloud:${PORT}`);
                console.log("📱 You can now generate pairing codes!\n");
                
                // Notify owner
                try {
                    const ownerJid = config.ownerNumber + '@s.whatsapp.net';
                    await conn.sendMessage(ownerJid, { 
                        text: `✅ INSIDIOUS BOT IS ONLINE!\n🌐 http://fi13.bot-hosting.cloud:${PORT}\n\nUse the web panel to pair new devices.`
                    });
                    console.log("✅ Owner notified");
                } catch(e) {
                    console.log("⚠️ Owner not notified (number not saved in contacts)");
                }
            }
            
            if (connection === 'close') {
                isReady = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`⚠️ Connection closed. Code: ${statusCode}`);
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log("❌ Session expired! Please delete session folder and restart.");
                } else if (retryCount < 5) {
                    retryCount++;
                    const delay = 10000;
                    console.log(`🔄 Reconnecting in ${delay/1000}s... (Attempt ${retryCount}/5)`);
                    setTimeout(startBot, delay);
                } else {
                    console.log("❌ Max reconnection attempts reached. Please restart manually.");
                }
            }
        });
        
        conn.ev.on('creds.update', saveCreds);
        
        // Handle messages – dynamic import to avoid missing file error
        try {
            const handler = require('./handler');
            conn.ev.on('messages.upsert', async (m) => {
                try {
                    await handler(conn, m);
                } catch(e) {
                    console.error("Handler error:", e.message);
                }
            });
        } catch(e) {
            console.warn("⚠️ No handler module found – message processing disabled");
        }
        
        // Anti-call
        if (config.anticall) {
            conn.ev.on('call', async (calls) => {
                for (let call of calls) {
                    if (call.status === 'offer') {
                        try {
                            await conn.rejectCall(call.id, call.from);
                            console.log(`📞 Rejected call from ${call.from}`);
                        } catch(e) {}
                    }
                }
            });
        }
        
    } catch(err) {
        console.error("Start error:", err);
        if (retryCount < 5) {
            retryCount++;
            setTimeout(startBot, 10000);
        }
    }
}

// Start everything
startBot();

app.listen(PORT, HOST, () => {
    console.log(`\n🌐 Web Dashboard: http://fi13.bot-hosting.cloud:${PORT}`);
    console.log("📱 PAIRING CODE SYSTEM ACTIVE");
    console.log("⏳ Waiting for WhatsApp connection...");
    console.log("💡 Once connected, you'll see 'INSIDIOUS IS ONLINE'\n");
});
                        return;
                    }
                    
                    const pairBtn = document.getElementById('pairBtn');
                    const originalText = pairBtn.textContent;
                    pairBtn.disabled = true;
                    pairBtn.textContent = '⏳ Generating Code...';
                    document.getElementById('codeContainer').style.display = 'none';
                    
                    try {
                        const res = await fetch('/pair?num=' + cleanPhone);
                        const data = await res.json();
                        
                        if (data.success) {
                            document.getElementById('pairingCode').textContent = data.code;
                            document.getElementById('codeContainer').style.display = 'block';
                            showMessage('✅ Pairing code generated! Enter it in WhatsApp', 'success');
                            
                            setTimeout(() => {
                                document.getElementById('codeContainer').style.display = 'none';
                            }, 600000);
                        } else {
                            showMessage('❌ ' + (data.error || 'Failed to generate code. Try again.'), 'error');
                        }
                    } catch(e) {
                        showMessage('❌ Connection error. Make sure the bot is running.', 'error');
                    } finally {
                        pairBtn.disabled = false;
                        pairBtn.textContent = originalText;
                    }
                }
                
                function showMessage(msg, type) {
                    const msgDiv = document.getElementById('message');
                    msgDiv.style.color = type === 'error' ? '#f44336' : '#4caf50';
                    msgDiv.innerHTML = msg;
                    setTimeout(() => {
                        msgDiv.innerHTML = '';
                    }, 5000);
                }
                
                checkBotStatus();
                checkInterval = setInterval(checkBotStatus, 3000);
            </script>
        </body>
        </html>
    `);
});

// API Endpoints
app.get('/status', (req, res) => {
    res.json({ 
        ready: isReady && globalConn !== null,
        connected: globalConn !== null
    });
});

app.get('/pair', async (req, res) => {
    const num = req.query.num;
    if (!num) {
        return res.json({ error: 'Phone number required' });
    }
    
    try {
        const cleanNum = num.replace(/[^0-9]/g, '');
        
        if (!globalConn || !isReady) {
            return res.json({ error: 'Bot is not connected. Please wait 1 minute.' });
        }
        
        console.log(`\n📱 Generating pairing code for +${cleanNum}...`);
        const code = await globalConn.requestPairingCode(cleanNum);
        console.log(`✅ Pairing code: ${code}`);
        console.log(`📝 Tell user to enter this code in WhatsApp\n`);
        
        // Save to database
        const jid = cleanNum + '@s.whatsapp.net';
        try {
            await User.findOneAndUpdate(
                { jid },
                { jid, linkedAt: new Date(), isActive: true },
                { upsert: true }
            );
        } catch(e) {}
        
        res.json({ success: true, code: code });
    } catch (err) {
        console.error('Pairing error:', err.message);
        res.json({ error: 'Connection failed. Bot may be reconnecting. Try again in 30 seconds.' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: isReady ? 'online' : 'connecting',
        uptime: process.uptime()
    });
});

// WhatsApp Connection
async function startBot() {
    try {
        console.log("\n🚀 Starting INSIDIOUS Bot...");
        console.log("⏳ Connecting to WhatsApp...");
        
        const { state, saveCreds } = await useMultiFileAuthState("session");
        const { version } = await fetchLatestBaileysVersion();
        
        const conn = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
            },
            logger: pino({ level: "silent" }),
            browser: ["INSIDIOUS BOT", "Chrome", "120.0.0"],
            markOnlineOnConnect: true,
            printQRInTerminal: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
        });
        
        globalConn = conn;
        
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                isReady = true;
                retryCount = 0;
                console.log("\n✅✅✅ INSIDIOUS IS ONLINE! ✅✅✅\n");
                console.log(`🌐 Web Panel: http://fi13.bot-hosting.cloud:${PORT}`);
                console.log("📱 You can now generate pairing codes!\n");
                
                // Notify owner
                try {
                    const ownerJid = config.ownerNumber + '@s.whatsapp.net';
                    await conn.sendMessage(ownerJid, { 
                        text: `✅ INSIDIOUS BOT IS ONLINE!\n🌐 http://fi13.bot-hosting.cloud:${PORT}\n\nUse the web panel to pair new devices.`
                    });
                    console.log("✅ Owner notified");
                } catch(e) {
                    console.log("⚠️ Owner not notified (number not saved in contacts)");
                }
            }
            
            if (connection === 'close') {
                isReady = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`⚠️ Connection closed. Code: ${statusCode}`);
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log("❌ Session expired! Please delete session folder and restart.");
                } else if (retryCount < 5) {
                    retryCount++;
                    const delay = 10000;
                    console.log(`🔄 Reconnecting in ${delay/1000}s... (Attempt ${retryCount}/5)`);
                    setTimeout(startBot, delay);
                } else {
                    console.log("❌ Max reconnection attempts reached. Please restart manually.");
                }
            }
        });
        
        conn.ev.on('creds.update', saveCreds);
        
        // Handle messages – dynamic import to avoid missing file error
        try {
            const handler = require('./handler');
            conn.ev.on('messages.upsert', async (m) => {
                try {
                    await handler(conn, m);
                } catch(e) {
                    console.error("Handler error:", e.message);
                }
            });
        } catch(e) {
            console.warn("⚠️ No handler module found – message processing disabled");
        }
        
        // Anti-call
        if (config.anticall) {
            conn.ev.on('call', async (calls) => {
                for (let call of calls) {
                    if (call.status === 'offer') {
                        try {
                            await conn.rejectCall(call.id, call.from);
                            console.log(`📞 Rejected call from ${call.from}`);
                        } catch(e) {}
                    }
                }
            });
        }
        
    } catch(err) {
        console.error("Start error:", err);
        if (retryCount < 5) {
            retryCount++;
            setTimeout(startBot, 10000);
        }
    }
}

// Start everything
startBot();

app.listen(PORT, HOST, () => {
    console.log(`\n🌐 Web Dashboard: http://fi13.bot-hosting.cloud:${PORT}`);
    console.log("📱 PAIRING CODE SYSTEM ACTIVE");
    console.log("⏳ Waiting for WhatsApp connection...");
    console.log("💡 Once connected, you'll see 'INSIDIOUS IS ONLINE'\n");
});    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>INSIDIOUS BOT - Pairing</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
                    font-family: 'Courier New', monospace;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    padding: 20px;
                }
                .container {
                    background: rgba(0,0,0,0.95);
                    border-radius: 20px;
                    padding: 40px;
                    max-width: 500px;
                    width: 100%;
                    text-align: center;
                    border: 2px solid #8b0000;
                    box-shadow: 0 0 30px rgba(139,0,0,0.3);
                }
                h1 { 
                    color: #8b0000; 
                    font-size: 2.5em; 
                    margin-bottom: 10px;
                    text-shadow: 0 0 10px rgba(139,0,0,0.5);
                }
                .subtitle {
                    color: #888;
                    margin-bottom: 20px;
                    font-size: 12px;
                }
                .status {
                    margin: 20px 0;
                    padding: 12px;
                    border-radius: 10px;
                    font-size: 14px;
                }
                .ready { 
                    background: #1a3a1a; 
                    color: #4caf50; 
                    border-left: 4px solid #4caf50;
                }
                .waiting { 
                    background: #3a2a1a; 
                    color: #ff9800; 
                    border-left: 4px solid #ff9800;
                }
                .error { 
                    background: #3a1a1a; 
                    color: #f44336; 
                    border-left: 4px solid #f44336;
                }
                input {
                    width: 100%;
                    padding: 15px;
                    margin: 10px 0;
                    background: #2a2a2a;
                    border: 2px solid #8b0000;
                    color: white;
                    border-radius: 10px;
                    font-size: 16px;
                    text-align: center;
                }
                input:focus {
                    outline: none;
                    border-color: #ff0000;
                }
                button {
                    background: linear-gradient(135deg, #8b0000 0%, #cc0000 100%);
                    color: white;
                    padding: 15px;
                    border: none;
                    border-radius: 10px;
                    font-size: 18px;
                    font-weight: bold;
                    cursor: pointer;
                    width: 100%;
                    margin-top: 10px;
                    transition: all 0.3s;
                }
                button:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 20px rgba(139,0,0,0.4);
                }
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .code-container {
                    margin-top: 20px;
                    padding: 20px;
                    background: #0a0a0a;
                    border-radius: 15px;
                    border: 2px dashed #8b0000;
                    display: none;
                }
                .code {
                    font-size: 42px;
                    font-weight: bold;
                    color: #ff4444;
                    background: #000;
                    padding: 20px;
                    border-radius: 10px;
                    letter-spacing: 8px;
                    margin: 15px 0;
                    font-family: monospace;
                }
                .footer {
                    margin-top: 20px;
                    font-size: 10px;
                    color: #555;
                }
                .info {
                    background: #1a1a2a;
                    padding: 10px;
                    border-radius: 8px;
                    font-size: 11px;
                    margin-top: 15px;
                }
                .spinner {
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    border: 2px solid #fff;
                    border-top: 2px solid #8b0000;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-right: 8px;
                    vertical-align: middle;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🥀 INSIDIOUS</h1>
                <div class="subtitle">WhatsApp Bot - Pairing System</div>
                
                <div id="status" class="status waiting">
                    <span class="spinner"></span> Bot is starting...
                </div>
                
                <div class="info">
                    <strong>📱 How to connect your WhatsApp:</strong><br><br>
                    1️⃣ Enter your phone number below (with country code)<br>
                    2️⃣ Click "Get Pairing Code"<br>
                    3️⃣ Open WhatsApp on your phone<br>
                    4️⃣ Go to Settings → Linked Devices<br>
                    5️⃣ Tap "Link with Phone Number"<br>
                    6️⃣ Enter the 8-digit code<br>
                    7️⃣ Wait 5 seconds - Bot will connect!
                </div>
                
                <input type="text" id="phone" placeholder="254712345678" />
                <button id="pairBtn" onclick="getPairingCode()" disabled>
                    🔗 Get Pairing Code
                </button>
                
                <div id="codeContainer" class="code-container">
                    <div style="color: #8b0000; margin-bottom: 10px;">✦ YOUR PAIRING CODE ✦</div>
                    <div id="pairingCode" class="code"></div>
                    <small>Enter this code in WhatsApp → Linked Devices → Link with Phone Number</small>
                </div>
                
                <div id="message" style="margin-top: 15px; font-size: 12px;"></div>
                <div class="footer">Powered by INSIDIOUS BOT | Developed by STANYTZ</div>
            </div>

            <script>
                let checkInterval;
                
                async function checkBotStatus() {
                    try {
                        const res = await fetch('/status');
                        const data = await res.json();
                        const statusDiv = document.getElementById('status');
                        const pairBtn = document.getElementById('pairBtn');
                        
                        if (data.ready) {
                            statusDiv.innerHTML = '✅ BOT IS READY - Enter your number';
                            statusDiv.className = 'status ready';
                            pairBtn.disabled = false;
                            if (checkInterval) clearInterval(checkInterval);
                        } else if (data.connected) {
                            statusDiv.innerHTML = '<span class="spinner"></span> Connecting to WhatsApp... Please wait';
                            statusDiv.className = 'status waiting';
                            pairBtn.disabled = true;
                        } else {
                            statusDiv.innerHTML = '<span class="spinner"></span> Bot is starting... Please wait 30 seconds';
                            statusDiv.className = 'status waiting';
                            pairBtn.disabled = true;
                        }
                    } catch(e) {
                        console.log('Status check failed');
                    }
                }
                
                async function getPairingCode() {
                    const phone = document.getElementById('phone').value;
                    if (!phone) {
                        showMessage('❌ Please enter your phone number', 'error');
                        return;
                    }
                    
                    const cleanPhone = phone.replace(/[^0-9]/g, '');
                    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
                        showMessage('❌ Invalid phone number (10-15 digits required)', 'error');
                        return;
                    }
                    
                    const pairBtn = document.getElementById('pairBtn');
                    const originalText = pairBtn.textContent;
                    pairBtn.disabled = true;
                    pairBtn.textContent = '⏳ Generating Code...';
                    document.getElementById('codeContainer').style.display = 'none';
                    
                    try {
                        const res = await fetch('/pair?num=' + cleanPhone);
                        const data = await res.json();
                        
                        if (data.success) {
                            document.getElementById('pairingCode').textContent = data.code;
                            document.getElementById('codeContainer').style.display = 'block';
                            showMessage('✅ Pairing code generated! Enter it in WhatsApp', 'success');
                            
                            // Auto hide after 10 minutes
                            setTimeout(() => {
                                document.getElementById('codeContainer').style.display = 'none';
                            }, 600000);
                        } else {
                            showMessage('❌ ' + (data.error || 'Failed to generate code. Try again.'), 'error');
                        }
                    } catch(e) {
                        showMessage('❌ Connection error. Make sure the bot is running.', 'error');
                    } finally {
                        pairBtn.disabled = false;
                        pairBtn.textContent = originalText;
                    }
                }
                
                function showMessage(msg, type) {
                    const msgDiv = document.getElementById('message');
                    msgDiv.style.color = type === 'error' ? '#f44336' : '#4caf50';
                    msgDiv.innerHTML = msg;
                    setTimeout(() => {
                        msgDiv.innerHTML = '';
                    }, 5000);
                }
                
                checkBotStatus();
                checkInterval = setInterval(checkBotStatus, 3000);
            </script>
        </body>
        </html>
    `);
});

// API Endpoints
app.get('/status', (req, res) => {
    res.json({ 
        ready: isReady && globalConn !== null,
        connected: globalConn !== null
    });
});

app.get('/pair', async (req, res) => {
    const num = req.query.num;
    if (!num) {
        return res.json({ error: 'Phone number required' });
    }
    
    try {
        const cleanNum = num.replace(/[^0-9]/g, '');
        
        if (!globalConn || !isReady) {
            return res.json({ error: 'Bot is not connected. Please wait 1 minute.' });
        }
        
        console.log(`\n📱 Generating pairing code for +${cleanNum}...`);
        const code = await globalConn.requestPairingCode(cleanNum);
        console.log(`✅ Pairing code: ${code}`);
        console.log(`📝 Tell user to enter this code in WhatsApp\n`);
        
        // Save to database
        const jid = cleanNum + '@s.whatsapp.net';
        try {
            await User.findOneAndUpdate(
                { jid },
                { jid, linkedAt: new Date(), isActive: true },
                { upsert: true }
            );
        } catch(e) {}
        
        res.json({ success: true, code: code });
    } catch (err) {
        console.error('Pairing error:', err.message);
        res.json({ error: 'Connection failed. Bot may be reconnecting. Try again in 30 seconds.' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: isReady ? 'online' : 'connecting',
        uptime: process.uptime()
    });
});

// WhatsApp Connection
async function startBot() {
    try {
        console.log("\n🚀 Starting INSIDIOUS Bot...");
        console.log("⏳ Connecting to WhatsApp...");
        
        const { state, saveCreds } = await useMultiFileAuthState("session");
        const { version } = await fetchLatestBaileysVersion();
        
        const conn = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
            },
            logger: pino({ level: "silent" }),
            browser: ["INSIDIOUS BOT", "Chrome", "120.0.0"],
            markOnlineOnConnect: true,
            printQRInTerminal: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
        });
        
        globalConn = conn;
        
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                isReady = true;
                retryCount = 0;
                console.log("\n✅✅✅ INSIDIOUS IS ONLINE! ✅✅✅\n");
                console.log(`🌐 Web Panel: http://fi13.bot-hosting.cloud:${PORT}`);
                console.log("📱 You can now generate pairing codes!\n");
                
                // Notify owner
                try {
                    const ownerJid = config.ownerNumber + '@s.whatsapp.net';
                    await conn.sendMessage(ownerJid, { 
                        text: `✅ INSIDIOUS BOT IS ONLINE!\n🌐 http://fi13.bot-hosting.cloud:${PORT}\n\nUse the web panel to pair new devices.`
                    });
                    console.log("✅ Owner notified");
                } catch(e) {
                    console.log("⚠️ Owner not notified (number not saved in contacts)");
                }
            }
            
            if (connection === 'close') {
                isReady = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`⚠️ Connection closed. Code: ${statusCode}`);
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log("❌ Session expired! Please delete session folder and restart.");
                } else if (retryCount < 5) {
                    retryCount++;
                    const delay = 10000;
                    console.log(`🔄 Reconnecting in ${delay/1000}s... (Attempt ${retryCount}/5)`);
                    setTimeout(startBot, delay);
                } else {
                    console.log("❌ Max reconnection attempts reached. Please restart manually.");
                }
            }
        });
        
        conn.ev.on('creds.update', saveCreds);
        
        // Handle messages
        conn.ev.on('messages.upsert', async (m) => {
            try {
                const handler = require('./handler');
                await handler(conn, m);
            } catch(e) {
                console.error("Handler error:", e.message);
            }
        });
        
        // Anti-call
        if (config.anticall) {
            conn.ev.on('call', async (calls) => {
                for (let call of calls) {
                    if (call.status === 'offer') {
                        try {
                            await conn.rejectCall(call.id, call.from);
                            console.log(`📞 Rejected call from ${call.from}`);
                        } catch(e) {}
                    }
                }
            });
        }
        
    } catch(err) {
        console.error("Start error:", err);
        if (retryCount < 5) {
            retryCount++;
            setTimeout(startBot, 10000);
        }
    }
}

// Start everything
startBot();

app.listen(PORT, HOST, () => {
    console.log(`\n🌐 Web Dashboard: http://fi13.bot-hosting.cloud:${PORT}`);
    console.log("📱 PAIRING CODE SYSTEM ACTIVE");
    console.log("⏳ Waiting for WhatsApp connection...");
    console.log("💡 Once connected, you'll see 'INSIDIOUS IS ONLINE'\n");
});    });
});

// Database connection
mongoose.connect(config.mongodb, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
}).then(() => console.log("✅ Database Connected")).catch(err => console.log("DB Error:", err.message));

// ============= WHATSAPP CONNECTION =============
async function startBot() {
    try {
        console.log("\n🚀 STARTING INSIDIOUS BOT ON RENDER (Background Worker)...");
        console.log("⏳ CONNECTING TO WHATSAPP...");
        
        const { state, saveCreds } = await useMultiFileAuthState("session");
        const { version } = await fetchLatestBaileysVersion();
        
        const conn = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
            },
            logger: pino({ level: "silent" }),
            browser: ["INSIDIOUS BOT", "Chrome", "120.0.0"],
            markOnlineOnConnect: true,
            printQRInTerminal: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
        });
        
        globalConn = conn;
        
        // Connection timeout handler
        const connectionTimeout = setTimeout(() => {
            if (!isReady) {
                console.log("⚠️ Connection timeout! Retrying...");
                conn.end();
            }
        }, 90000);
        
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                clearTimeout(connectionTimeout);
                isReady = true;
                retryCount = 0;
                console.log("\n✅✅✅ INSIDIOUS IS ONLINE! ✅✅✅\n");
                console.log("📱 BOT IS READY TO PAIR!");
                console.log("💡 Use pairing code from terminal or web panel\n");
                
                // Try to send message to owner via WhatsApp
                try {
                    const ownerJid = config.ownerNumber + '@s.whatsapp.net';
                    await conn.sendMessage(ownerJid, { 
                        text: `✅ INSIDIOUS BOT IS ONLINE!\n\nBot is ready to use. Type .menu for commands.`
                    });
                    console.log("✅ Owner notified via WhatsApp");
                } catch(e) {
                    console.log("⚠️ Owner not notified (number not saved in contacts)");
                    console.log("💡 Send a message to the bot first to save your number");
                }
            }
            
            if (connection === 'close') {
                clearTimeout(connectionTimeout);
                isReady = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`⚠️ Connection closed. Code: ${statusCode}`);
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log("❌ Session expired! Deleting session...");
                    const fs = require('fs-extra');
                    await fs.remove('./session').catch(() => {});
                    setTimeout(startBot, 5000);
                } else if (retryCount < 10) {
                    retryCount++;
                    const delay = 10000;
                    console.log(`🔄 Reconnecting in ${delay/1000}s... (Attempt ${retryCount}/10)`);
                    setTimeout(startBot, delay);
                } else {
                    console.log("❌ Max reconnection attempts reached. Please restart manually.");
                }
            }
        });
        
        conn.ev.on('creds.update', saveCreds);
        
        // Message handler
        conn.ev.on('messages.upsert', async (m) => {
            try {
                const handler = require('./handler');
                await handler(conn, m);
            } catch(e) {
                console.error("Handler error:", e.message);
            }
        });
        
        // Anti-call
        if (config.anticall) {
            conn.ev.on('call', async (calls) => {
                for (let call of calls) {
                    if (call.status === 'offer') {
                        try {
                            await conn.rejectCall(call.id, call.from);
                            console.log(`📞 Rejected call from ${call.from}`);
                        } catch(e) {}
                    }
                }
            });
        }
        
    } catch(err) {
        console.error("Start error:", err);
        if (retryCount < 10) {
            retryCount++;
            setTimeout(startBot, 10000);
        }
    }
}

// Start bot
startBot();

// Start simple web server for health checks (Render needs a port to keep worker alive)
app.listen(PORT, () => {
    console.log(`\n✅ HEALTH SERVER RUNNING ON PORT ${PORT}`);
    console.log("🤖 INSIDIOUS BOT - BACKGROUND WORKER MODE");
    console.log("⏳ WAITING FOR WHATSAPP CONNECTION...");
    console.log("💡 The bot will connect automatically. No pairing needed if already connected.\n");
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    if (globalConn) {
        globalConn.end();
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down...');
    if (globalConn) {
        globalConn.end();
    }
    process.exit(0);
});
// Database connection
mongoose.connect(config.mongodb, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
}).then(() => console.log("✅ Database Connected")).catch(err => console.log("DB Error:", err.message));

// ============= WEB PAGE FOR PAIRING =============
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>INSIDIOUS BOT - Pairing</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
            font-family: 'Courier New', monospace;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        .container {
            background: rgba(0,0,0,0.95);
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
            border: 2px solid #8b0000;
            box-shadow: 0 0 30px rgba(139,0,0,0.3);
            animation: fadeIn 0.5s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        h1 { 
            color: #8b0000; 
            font-size: 2.5em; 
            margin-bottom: 10px;
            text-shadow: 0 0 10px rgba(139,0,0,0.5);
        }
        .subtitle {
            color: #888;
            margin-bottom: 20px;
            font-size: 12px;
        }
        .status {
            margin: 20px 0;
            padding: 12px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: bold;
        }
        .ready { 
            background: #1a3a1a; 
            color: #4caf50; 
            border-left: 4px solid #4caf50;
        }
        .waiting { 
            background: #3a2a1a; 
            color: #ff9800; 
            border-left: 4px solid #ff9800;
        }
        .error { 
            background: #3a1a1a; 
            color: #f44336; 
            border-left: 4px solid #f44336;
        }
        input {
            width: 100%;
            padding: 15px;
            margin: 15px 0;
            background: #2a2a2a;
            border: 2px solid #8b0000;
            color: white;
            border-radius: 10px;
            font-size: 18px;
            text-align: center;
            transition: all 0.3s;
        }
        input:focus {
            outline: none;
            border-color: #ff0000;
            box-shadow: 0 0 10px rgba(255,0,0,0.3);
        }
        button {
            background: linear-gradient(135deg, #8b0000 0%, #cc0000 100%);
            color: white;
            padding: 15px;
            border: none;
            border-radius: 10px;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            width: 100%;
            margin-top: 10px;
            transition: all 0.3s;
        }
        button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(139,0,0,0.4);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .code-container {
            margin-top: 25px;
            padding: 20px;
            background: #0a0a0a;
            border-radius: 15px;
            border: 2px dashed #8b0000;
            display: none;
            animation: fadeIn 0.5s ease;
        }
        .code {
            font-size: 42px;
            font-weight: bold;
            color: #ff4444;
            background: #000;
            padding: 20px;
            border-radius: 10px;
            letter-spacing: 8px;
            margin: 15px 0;
            font-family: monospace;
        }
        .footer {
            margin-top: 25px;
            font-size: 10px;
            color: #555;
        }
        .info {
            background: #1a1a2a;
            padding: 15px;
            border-radius: 10px;
            font-size: 11px;
            margin-top: 20px;
            text-align: left;
        }
        .spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid #fff;
            border-top: 2px solid #8b0000;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 8px;
            vertical-align: middle;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🥀 INSIDIOUS</h1>
        <div class="subtitle">WhatsApp Bot - Pairing System V2</div>
        
        <div id="status" class="status waiting">
            <span class="spinner"></span> Bot is starting...
        </div>
        
        <div class="info">
            <strong>📱 HOW TO CONNECT YOUR WHATSAPP:</strong><br><br>
            1️⃣ Enter your phone number below (with country code)<br>
            2️⃣ Click "Get Pairing Code"<br>
            3️⃣ Open WhatsApp on your phone<br>
            4️⃣ Go to <strong>Settings → Linked Devices</strong><br>
            5️⃣ Tap <strong>"Link with Phone Number"</strong><br>
            6️⃣ Enter the 8-digit code<br>
            7️⃣ ✅ Bot will connect instantly!
        </div>
        
        <input type="text" id="phone" placeholder="254712345678" value="254794376595" />
        <button id="pairBtn" onclick="getPairingCode()" disabled>
            🔗 Get Pairing Code
        </button>
        
        <div id="codeContainer" class="code-container">
            <div style="color: #8b0000; margin-bottom: 10px;">✦ YOUR 8-DIGIT PAIRING CODE ✦</div>
            <div id="pairingCode" class="code"></div>
            <small>Enter this code in WhatsApp → Linked Devices → Link with Phone Number</small>
        </div>
        
        <div id="message" style="margin-top: 15px; font-size: 12px;"></div>
        <div class="footer">Powered by INSIDIOUS BOT | Developed by STANYTZ</div>
    </div>

    <script>
        let statusInterval;
        
        async function checkBotStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                const statusDiv = document.getElementById('status');
                const pairBtn = document.getElementById('pairBtn');
                
                if (data.ready) {
                    statusDiv.innerHTML = '✅ BOT IS READY - You can get pairing code!';
                    statusDiv.className = 'status ready';
                    pairBtn.disabled = false;
                    if (statusInterval) clearInterval(statusInterval);
                } else if (data.connected) {
                    statusDiv.innerHTML = '<span class="spinner"></span> Connecting to WhatsApp... Please wait';
                    statusDiv.className = 'status waiting';
                    pairBtn.disabled = true;
                } else {
                    statusDiv.innerHTML = '<span class="spinner"></span> Bot is starting... Please wait 30 seconds';
                    statusDiv.className = 'status waiting';
                    pairBtn.disabled = true;
                }
            } catch(e) {
                console.log('Status check failed');
            }
        }
        
        async function getPairingCode() {
            const phone = document.getElementById('phone').value;
            if (!phone) {
                showMessage('❌ Please enter your phone number', 'error');
                return;
            }
            
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            if (cleanPhone.length < 10 || cleanPhone.length > 15) {
                showMessage('❌ Invalid phone number (10-15 digits required)', 'error');
                return;
            }
            
            const pairBtn = document.getElementById('pairBtn');
            const originalText = pairBtn.textContent;
            pairBtn.disabled = true;
            pairBtn.textContent = '⏳ Generating Code...';
            document.getElementById('codeContainer').style.display = 'none';
            
            try {
                const res = await fetch('/api/pair?num=' + cleanPhone);
                const data = await res.json();
                
                if (data.success) {
                    document.getElementById('pairingCode').textContent = data.code;
                    document.getElementById('codeContainer').style.display = 'block';
                    showMessage('✅ Pairing code generated! Enter it in WhatsApp', 'success');
                    
                    setTimeout(() => {
                        document.getElementById('codeContainer').style.display = 'none';
                    }, 600000);
                } else {
                    showMessage('❌ ' + (data.error || 'Failed to generate code. Try again.'), 'error');
                }
            } catch(e) {
                showMessage('❌ Connection error: ' + e.message, 'error');
            } finally {
                pairBtn.disabled = false;
                pairBtn.textContent = originalText;
            }
        }
        
        function showMessage(msg, type) {
            const msgDiv = document.getElementById('message');
            msgDiv.style.color = type === 'error' ? '#f44336' : '#4caf50';
            msgDiv.innerHTML = msg;
            setTimeout(() => {
                msgDiv.innerHTML = '';
            }, 5000);
        }
        
        checkBotStatus();
        statusInterval = setInterval(checkBotStatus, 3000);
        
        document.getElementById('phone').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                getPairingCode();
            }
        });
    </script>
</body>
</html>
    `);
});

// ============= API ENDPOINTS =============
app.get('/api/status', (req, res) => {
    res.json({ 
        ready: isReady && globalConn !== null,
        connected: globalConn !== null,
        uptime: process.uptime()
    });
});

app.get('/api/pair', async (req, res) => {
    const num = req.query.num;
    if (!num) {
        return res.status(400).json({ error: 'Phone number required' });
    }
    
    try {
        const cleanNum = num.replace(/[^0-9]/g, '');
        
        if (!globalConn || !isReady) {
            return res.status(503).json({ error: 'Bot is connecting. Please wait 30 seconds.' });
        }
        
        console.log(`\n📱 Generating pairing code for +${cleanNum}...`);
        const code = await globalConn.requestPairingCode(cleanNum);
        console.log(`✅ PAIRING CODE: ${code}`);
        
        res.json({ success: true, code: code });
    } catch (err) {
        console.error('Pairing error:', err.message);
        res.status(500).json({ error: 'Failed to generate code. Try again.' });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: isReady ? 'healthy' : 'starting',
        timestamp: new Date().toISOString()
    });
});

// ============= WHATSAPP CONNECTION =============
async function startBot() {
    try {
        console.log("\n🚀 STARTING INSIDIOUS BOT ON RENDER...");
        
        const { state, saveCreds } = await useMultiFileAuthState("session");
        const { version } = await fetchLatestBaileysVersion();
        
        const conn = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
            },
            logger: pino({ level: "silent" }),
            browser: ["INSIDIOUS BOT", "Chrome", "120.0.0"],
            markOnlineOnConnect: true,
            printQRInTerminal: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
        });
        
        globalConn = conn;
        
        const connectionTimeout = setTimeout(() => {
            if (!isReady) {
                console.log("⚠️ Connection timeout! Retrying...");
                conn.end();
            }
        }, 90000);
        
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                clearTimeout(connectionTimeout);
                isReady = true;
                retryCount = 0;
                console.log("\n✅✅✅ INSIDIOUS IS ONLINE! ✅✅✅\n");
                console.log(`🌐 WEB PANEL: https://insidious-1.onrender.com`);
                
                try {
                    const ownerJid = config.ownerNumber + '@s.whatsapp.net';
                    await conn.sendMessage(ownerJid, { 
                        text: `✅ INSIDIOUS BOT IS ONLINE!\n🌐 https://insidious-1.onrender.com`
                    });
                } catch(e) {}
            }
            
            if (connection === 'close') {
                clearTimeout(connectionTimeout);
                isReady = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`⚠️ Connection closed. Code: ${statusCode}`);
                
                if (statusCode === DisconnectReason.loggedOut) {
                    const fs = require('fs-extra');
                    await fs.remove('./session').catch(() => {});
                    setTimeout(startBot, 5000);
                } else if (retryCount < 5) {
                    retryCount++;
                    setTimeout(startBot, 10000);
                }
            }
        });
        
        conn.ev.on('creds.update', saveCreds);
        
        conn.ev.on('messages.upsert', async (m) => {
            try {
                const handler = require('./handler');
                await handler(conn, m);
            } catch(e) {}
        });
        
        if (config.anticall) {
            conn.ev.on('call', async (calls) => {
                for (let call of calls) {
                    if (call.status === 'offer') {
                        try {
                            await conn.rejectCall(call.id, call.from);
                        } catch(e) {}
                    }
                }
            });
        }
        
    } catch(err) {
        console.error("Start error:", err);
        if (retryCount < 5) {
            retryCount++;
            setTimeout(startBot, 10000);
        }
    }
}

// Start bot
startBot();

// Start server - CRITICAL FIX: Don't use HOST, just listen on PORT
app.listen(PORT, () => {
    console.log(`\n✅ SERVER RUNNING ON PORT ${PORT}`);
    console.log(`🌐 WEB DASHBOARD: https://insidious-1.onrender.com`);
    console.log("📱 PAIRING CODE SYSTEM ACTIVE");
    console.log("⏳ WAITING FOR WHATSAPP CONNECTION...\n");
});// Database connection
mongoose.connect(config.mongodb, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
}).then(() => console.log("✅ Database Connected")).catch(err => console.log("DB Error:", err.message));

// ============= WEB PAGE FOR PAIRING =============
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>INSIDIOUS BOT - Pairing</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
            font-family: 'Courier New', monospace;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        .container {
            background: rgba(0,0,0,0.95);
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
            border: 2px solid #8b0000;
            box-shadow: 0 0 30px rgba(139,0,0,0.3);
            animation: fadeIn 0.5s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        h1 { 
            color: #8b0000; 
            font-size: 2.5em; 
            margin-bottom: 10px;
            text-shadow: 0 0 10px rgba(139,0,0,0.5);
        }
        .subtitle {
            color: #888;
            margin-bottom: 20px;
            font-size: 12px;
        }
        .status {
            margin: 20px 0;
            padding: 12px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: bold;
        }
        .ready { 
            background: #1a3a1a; 
            color: #4caf50; 
            border-left: 4px solid #4caf50;
        }
        .waiting { 
            background: #3a2a1a; 
            color: #ff9800; 
            border-left: 4px solid #ff9800;
        }
        .error { 
            background: #3a1a1a; 
            color: #f44336; 
            border-left: 4px solid #f44336;
        }
        input {
            width: 100%;
            padding: 15px;
            margin: 15px 0;
            background: #2a2a2a;
            border: 2px solid #8b0000;
            color: white;
            border-radius: 10px;
            font-size: 18px;
            text-align: center;
            transition: all 0.3s;
        }
        input:focus {
            outline: none;
            border-color: #ff0000;
            box-shadow: 0 0 10px rgba(255,0,0,0.3);
        }
        button {
            background: linear-gradient(135deg, #8b0000 0%, #cc0000 100%);
            color: white;
            padding: 15px;
            border: none;
            border-radius: 10px;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            width: 100%;
            margin-top: 10px;
            transition: all 0.3s;
        }
        button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(139,0,0,0.4);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .code-container {
            margin-top: 25px;
            padding: 20px;
            background: #0a0a0a;
            border-radius: 15px;
            border: 2px dashed #8b0000;
            display: none;
            animation: fadeIn 0.5s ease;
        }
        .code {
            font-size: 42px;
            font-weight: bold;
            color: #ff4444;
            background: #000;
            padding: 20px;
            border-radius: 10px;
            letter-spacing: 8px;
            margin: 15px 0;
            font-family: monospace;
        }
        .footer {
            margin-top: 25px;
            font-size: 10px;
            color: #555;
        }
        .info {
            background: #1a1a2a;
            padding: 15px;
            border-radius: 10px;
            font-size: 11px;
            margin-top: 20px;
            text-align: left;
        }
        .spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid #fff;
            border-top: 2px solid #8b0000;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 8px;
            vertical-align: middle;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .success-text {
            color: #4caf50;
        }
        .error-text {
            color: #f44336;
        }
        .url-box {
            background: #0a0a0a;
            padding: 10px;
            border-radius: 8px;
            margin-top: 15px;
            font-size: 11px;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🥀 INSIDIOUS</h1>
        <div class="subtitle">WhatsApp Bot - Pairing System V2</div>
        
        <div id="status" class="status waiting">
            <span class="spinner"></span> Bot is starting...
        </div>
        
        <div class="url-box" id="urlDisplay">
            🔗 Connecting to Render...
        </div>
        
        <div class="info">
            <strong>📱 HOW TO CONNECT YOUR WHATSAPP:</strong><br><br>
            1️⃣ Enter your phone number below (with country code)<br>
            2️⃣ Click "Get Pairing Code"<br>
            3️⃣ Open WhatsApp on your phone<br>
            4️⃣ Go to <strong>Settings → Linked Devices</strong><br>
            5️⃣ Tap <strong>"Link with Phone Number"</strong><br>
            6️⃣ Enter the 8-digit code<br>
            7️⃣ ✅ Bot will connect instantly!
        </div>
        
        <input type="text" id="phone" placeholder="254712345678" value="254794376595" />
        <button id="pairBtn" onclick="getPairingCode()" disabled>
            🔗 Get Pairing Code
        </button>
        
        <div id="codeContainer" class="code-container">
            <div style="color: #8b0000; margin-bottom: 10px;">✦ YOUR 8-DIGIT PAIRING CODE ✦</div>
            <div id="pairingCode" class="code"></div>
            <small>Enter this code in WhatsApp → Linked Devices → Link with Phone Number</small>
        </div>
        
        <div id="message" style="margin-top: 15px; font-size: 12px;"></div>
        <div class="footer">Powered by INSIDIOUS BOT | Developed by STANYTZ</div>
    </div>

    <script>
        let statusInterval;
        
        // Show current URL
        document.getElementById('urlDisplay').innerHTML = '🌐 Current URL: ' + window.location.href;
        
        async function checkBotStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                const statusDiv = document.getElementById('status');
                const pairBtn = document.getElementById('pairBtn');
                
                if (data.ready) {
                    statusDiv.innerHTML = '✅ BOT IS READY - You can get pairing code!';
                    statusDiv.className = 'status ready';
                    pairBtn.disabled = false;
                    if (statusInterval) clearInterval(statusInterval);
                } else if (data.connected) {
                    statusDiv.innerHTML = '<span class="spinner"></span> Connecting to WhatsApp... Please wait';
                    statusDiv.className = 'status waiting';
                    pairBtn.disabled = true;
                } else {
                    statusDiv.innerHTML = '<span class="spinner"></span> Bot is starting... Please wait 30 seconds';
                    statusDiv.className = 'status waiting';
                    pairBtn.disabled = true;
                }
            } catch(e) {
                console.log('Status check failed');
                document.getElementById('status').innerHTML = '⚠️ Waiting for server...';
            }
        }
        
        async function getPairingCode() {
            const phone = document.getElementById('phone').value;
            if (!phone) {
                showMessage('❌ Please enter your phone number', 'error');
                return;
            }
            
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            if (cleanPhone.length < 10 || cleanPhone.length > 15) {
                showMessage('❌ Invalid phone number (10-15 digits required)', 'error');
                return;
            }
            
            const pairBtn = document.getElementById('pairBtn');
            const originalText = pairBtn.textContent;
            pairBtn.disabled = true;
            pairBtn.textContent = '⏳ Generating Code...';
            document.getElementById('codeContainer').style.display = 'none';
            
            try {
                const res = await fetch('/api/pair?num=' + cleanPhone);
                const data = await res.json();
                
                if (data.success) {
                    document.getElementById('pairingCode').textContent = data.code;
                    document.getElementById('codeContainer').style.display = 'block';
                    showMessage('✅ Pairing code generated! Enter it in WhatsApp', 'success');
                    
                    // Auto hide after 10 minutes
                    setTimeout(() => {
                        document.getElementById('codeContainer').style.display = 'none';
                    }, 600000);
                } else {
                    showMessage('❌ ' + (data.error || 'Failed to generate code. Try again.'), 'error');
                }
            } catch(e) {
                showMessage('❌ Connection error: ' + e.message, 'error');
            } finally {
                pairBtn.disabled = false;
                pairBtn.textContent = originalText;
            }
        }
        
        function showMessage(msg, type) {
            const msgDiv = document.getElementById('message');
            msgDiv.style.color = type === 'error' ? '#f44336' : '#4caf50';
            msgDiv.innerHTML = msg;
            setTimeout(() => {
                msgDiv.innerHTML = '';
            }, 5000);
        }
        
        // Check status every 3 seconds
        checkBotStatus();
        statusInterval = setInterval(checkBotStatus, 3000);
        
        // Enter key support
        document.getElementById('phone').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                getPairingCode();
            }
        });
    </script>
</body>
</html>
    `);
});

// ============= API ENDPOINTS =============
app.get('/api/status', (req, res) => {
    res.json({ 
        ready: isReady && globalConn !== null,
        connected: globalConn !== null,
        uptime: process.uptime()
    });
});

app.get('/api/pair', async (req, res) => {
    const num = req.query.num;
    if (!num) {
        return res.status(400).json({ error: 'Phone number required' });
    }
    
    try {
        const cleanNum = num.replace(/[^0-9]/g, '');
        
        if (!globalConn || !isReady) {
            return res.status(503).json({ error: 'Bot is connecting. Please wait 30 seconds.' });
        }
        
        console.log(`\n📱 Generating pairing code for +${cleanNum}...`);
        const code = await globalConn.requestPairingCode(cleanNum);
        console.log(`✅ PAIRING CODE: ${code}`);
        console.log(`📝 Tell user to enter this code in WhatsApp\n`);
        
        res.json({ success: true, code: code });
    } catch (err) {
        console.error('Pairing error:', err.message);
        res.status(500).json({ error: 'Failed to generate code. Try again.' });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: isReady ? 'healthy' : 'starting',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============= WHATSAPP CONNECTION =============
async function startBot() {
    try {
        console.log("\n🚀 STARTING INSIDIOUS BOT ON RENDER...");
        console.log("⏳ CONNECTING TO WHATSAPP...");
        
        const { state, saveCreds } = await useMultiFileAuthState("session");
        const { version } = await fetchLatestBaileysVersion();
        
        const conn = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
            },
            logger: pino({ level: "silent" }),
            browser: ["INSIDIOUS BOT", "Chrome", "120.0.0"],
            markOnlineOnConnect: true,
            printQRInTerminal: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
        });
        
        globalConn = conn;
        
        // Connection timeout handler
        const connectionTimeout = setTimeout(() => {
            if (!isReady) {
                console.log("⚠️ Connection timeout! Retrying...");
                conn.end();
            }
        }, 90000);
        
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                clearTimeout(connectionTimeout);
                isReady = true;
                retryCount = 0;
                console.log("\n✅✅✅ INSIDIOUS IS ONLINE! ✅✅✅\n");
                console.log(`🌐 WEB PANEL: https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'insidious-1.onrender.com'}`);
                console.log("📱 YOU CAN NOW GENERATE PAIRING CODES!\n");
                
                // Notify owner
                try {
                    const ownerJid = config.ownerNumber + '@s.whatsapp.net';
                    await conn.sendMessage(ownerJid, { 
                        text: `✅ INSIDIOUS BOT IS ONLINE!\n🌐 https://insidious-1.onrender.com\n\nUse the web panel to pair new devices.`
                    });
                    console.log("✅ Owner notified");
                } catch(e) {
                    console.log("⚠️ Owner not notified (number not saved in contacts)");
                }
            }
            
            if (connection === 'close') {
                clearTimeout(connectionTimeout);
                isReady = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`⚠️ Connection closed. Code: ${statusCode}`);
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log("❌ Session expired! Deleting session...");
                    const fs = require('fs-extra');
                    await fs.remove('./session').catch(() => {});
                    setTimeout(startBot, 5000);
                } else if (retryCount < 5) {
                    retryCount++;
                    const delay = 10000;
                    console.log(`🔄 Reconnecting in ${delay/1000}s... (Attempt ${retryCount}/5)`);
                    setTimeout(startBot, delay);
                }
            }
        });
        
        conn.ev.on('creds.update', saveCreds);
        
        // Message handler
        conn.ev.on('messages.upsert', async (m) => {
            try {
                const handler = require('./handler');
                await handler(conn, m);
            } catch(e) {
                console.error("Handler error:", e.message);
            }
        });
        
        // Anti-call
        if (config.anticall) {
            conn.ev.on('call', async (calls) => {
                for (let call of calls) {
                    if (call.status === 'offer') {
                        try {
                            await conn.rejectCall(call.id, call.from);
                            console.log(`📞 Rejected call from ${call.from}`);
                        } catch(e) {}
                    }
                }
            });
        }
        
    } catch(err) {
        console.error("Start error:", err);
        if (retryCount < 5) {
            retryCount++;
            setTimeout(startBot, 10000);
        }
    }
}

// Start bot
startBot();

// Start web server - IMPORTANT for Render
app.listen(PORT, HOST, () => {
    console.log(`\n✅ SERVER RUNNING ON PORT ${PORT}`);
    console.log(`🌐 WEB DASHBOARD: http://${HOST}:${PORT}`);
    console.log(`📱 PUBLIC URL: https://insidious-1.onrender.com`);
    console.log("📱 PAIRING CODE SYSTEM ACTIVE");
    console.log("⏳ WAITING FOR WHATSAPP CONNECTION...");
    console.log("💡 Once connected, use the web page to get pairing code\n");
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, closing server...');
    process.exit(0);
});// Database connection
mongoose.connect(config.mongodb, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
}).then(() => console.log("✅ Database Connected")).catch(err => console.log("DB Error:", err.message));

// ============= WEB PAGE FOR PAIRING =============
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>INSIDIOUS BOT - Pairing</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
            font-family: 'Courier New', monospace;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        .container {
            background: rgba(0,0,0,0.95);
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
            border: 2px solid #8b0000;
            box-shadow: 0 0 30px rgba(139,0,0,0.3);
            animation: fadeIn 0.5s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        h1 { 
            color: #8b0000; 
            font-size: 2.5em; 
            margin-bottom: 10px;
            text-shadow: 0 0 10px rgba(139,0,0,0.5);
        }
        .subtitle {
            color: #888;
            margin-bottom: 20px;
            font-size: 12px;
        }
        .status {
            margin: 20px 0;
            padding: 12px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: bold;
        }
        .ready { 
            background: #1a3a1a; 
            color: #4caf50; 
            border-left: 4px solid #4caf50;
        }
        .waiting { 
            background: #3a2a1a; 
            color: #ff9800; 
            border-left: 4px solid #ff9800;
        }
        .error { 
            background: #3a1a1a; 
            color: #f44336; 
            border-left: 4px solid #f44336;
        }
        input {
            width: 100%;
            padding: 15px;
            margin: 15px 0;
            background: #2a2a2a;
            border: 2px solid #8b0000;
            color: white;
            border-radius: 10px;
            font-size: 18px;
            text-align: center;
            transition: all 0.3s;
        }
        input:focus {
            outline: none;
            border-color: #ff0000;
            box-shadow: 0 0 10px rgba(255,0,0,0.3);
        }
        button {
            background: linear-gradient(135deg, #8b0000 0%, #cc0000 100%);
            color: white;
            padding: 15px;
            border: none;
            border-radius: 10px;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            width: 100%;
            margin-top: 10px;
            transition: all 0.3s;
        }
        button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(139,0,0,0.4);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .code-container {
            margin-top: 25px;
            padding: 20px;
            background: #0a0a0a;
            border-radius: 15px;
            border: 2px dashed #8b0000;
            display: none;
            animation: fadeIn 0.5s ease;
        }
        .code {
            font-size: 42px;
            font-weight: bold;
            color: #ff4444;
            background: #000;
            padding: 20px;
            border-radius: 10px;
            letter-spacing: 8px;
            margin: 15px 0;
            font-family: monospace;
        }
        .footer {
            margin-top: 25px;
            font-size: 10px;
            color: #555;
        }
        .info {
            background: #1a1a2a;
            padding: 15px;
            border-radius: 10px;
            font-size: 11px;
            margin-top: 20px;
            text-align: left;
        }
        .spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid #fff;
            border-top: 2px solid #8b0000;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 8px;
            vertical-align: middle;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .success-text {
            color: #4caf50;
        }
        .error-text {
            color: #f44336;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🥀 INSIDIOUS</h1>
        <div class="subtitle">WhatsApp Bot - Pairing System V2</div>
        
        <div id="status" class="status waiting">
            <span class="spinner"></span> Bot is starting...
        </div>
        
        <div class="info">
            <strong>📱 HOW TO CONNECT YOUR WHATSAPP:</strong><br><br>
            1️⃣ Enter your phone number below (with country code)<br>
            2️⃣ Click "Get Pairing Code"<br>
            3️⃣ Open WhatsApp on your phone<br>
            4️⃣ Go to <strong>Settings → Linked Devices</strong><br>
            5️⃣ Tap <strong>"Link with Phone Number"</strong><br>
            6️⃣ Enter the 8-digit code<br>
            7️⃣ ✅ Bot will connect instantly!
        </div>
        
        <input type="text" id="phone" placeholder="254712345678" value="254794376595" />
        <button id="pairBtn" onclick="getPairingCode()" disabled>
            🔗 Get Pairing Code
        </button>
        
        <div id="codeContainer" class="code-container">
            <div style="color: #8b0000; margin-bottom: 10px;">✦ YOUR 8-DIGIT PAIRING CODE ✦</div>
            <div id="pairingCode" class="code"></div>
            <small>Enter this code in WhatsApp → Linked Devices → Link with Phone Number</small>
        </div>
        
        <div id="message" style="margin-top: 15px; font-size: 12px;"></div>
        <div class="footer">Powered by INSIDIOUS BOT | Developed by STANYTZ</div>
    </div>

    <script>
        let statusInterval;
        
        async function checkBotStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                const statusDiv = document.getElementById('status');
                const pairBtn = document.getElementById('pairBtn');
                
                if (data.ready) {
                    statusDiv.innerHTML = '✅ BOT IS READY - You can get pairing code!';
                    statusDiv.className = 'status ready';
                    pairBtn.disabled = false;
                    if (statusInterval) clearInterval(statusInterval);
                } else if (data.connected) {
                    statusDiv.innerHTML = '<span class="spinner"></span> Connecting to WhatsApp... Please wait';
                    statusDiv.className = 'status waiting';
                    pairBtn.disabled = true;
                } else {
                    statusDiv.innerHTML = '<span class="spinner"></span> Bot is starting... Please wait 30 seconds';
                    statusDiv.className = 'status waiting';
                    pairBtn.disabled = true;
                }
            } catch(e) {
                console.log('Status check failed');
            }
        }
        
        async function getPairingCode() {
            const phone = document.getElementById('phone').value;
            if (!phone) {
                showMessage('❌ Please enter your phone number', 'error');
                return;
            }
            
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            if (cleanPhone.length < 10 || cleanPhone.length > 15) {
                showMessage('❌ Invalid phone number (10-15 digits required)', 'error');
                return;
            }
            
            const pairBtn = document.getElementById('pairBtn');
            const originalText = pairBtn.textContent;
            pairBtn.disabled = true;
            pairBtn.textContent = '⏳ Generating Code...';
            document.getElementById('codeContainer').style.display = 'none';
            
            try {
                const res = await fetch('/api/pair?num=' + cleanPhone);
                const data = await res.json();
                
                if (data.success) {
                    document.getElementById('pairingCode').textContent = data.code;
                    document.getElementById('codeContainer').style.display = 'block';
                    showMessage('✅ Pairing code generated! Enter it in WhatsApp', 'success');
                    
                    // Auto hide after 10 minutes
                    setTimeout(() => {
                        document.getElementById('codeContainer').style.display = 'none';
                    }, 600000);
                } else {
                    showMessage('❌ ' + (data.error || 'Failed to generate code. Try again.'), 'error');
                }
            } catch(e) {
                showMessage('❌ Connection error. Make sure the bot is running.', 'error');
            } finally {
                pairBtn.disabled = false;
                pairBtn.textContent = originalText;
            }
        }
        
        function showMessage(msg, type) {
            const msgDiv = document.getElementById('message');
            msgDiv.style.color = type === 'error' ? '#f44336' : '#4caf50';
            msgDiv.innerHTML = msg;
            setTimeout(() => {
                msgDiv.innerHTML = '';
            }, 5000);
        }
        
        // Check status every 3 seconds
        checkBotStatus();
        statusInterval = setInterval(checkBotStatus, 3000);
        
        // Enter key support
        document.getElementById('phone').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                getPairingCode();
            }
        });
    </script>
</body>
</html>
    `);
});

// ============= API ENDPOINTS =============
app.get('/api/status', (req, res) => {
    res.json({ 
        ready: isReady && globalConn !== null,
        connected: globalConn !== null,
        uptime: process.uptime()
    });
});

app.get('/api/pair', async (req, res) => {
    const num = req.query.num;
    if (!num) {
        return res.status(400).json({ error: 'Phone number required' });
    }
    
    try {
        const cleanNum = num.replace(/[^0-9]/g, '');
        
        if (!globalConn || !isReady) {
            return res.status(503).json({ error: 'Bot is connecting. Please wait 30 seconds.' });
        }
        
        console.log(`\n📱 Generating pairing code for +${cleanNum}...`);
        const code = await globalConn.requestPairingCode(cleanNum);
        console.log(`✅ PAIRING CODE: ${code}`);
        console.log(`📝 Tell user to enter this code in WhatsApp\n`);
        
        res.json({ success: true, code: code });
    } catch (err) {
        console.error('Pairing error:', err.message);
        res.status(500).json({ error: 'Failed to generate code. Try again.' });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: isReady ? 'healthy' : 'starting',
        timestamp: new Date().toISOString()
    });
});

// ============= WHATSAPP CONNECTION =============
async function startBot() {
    try {
        console.log("\n🚀 STARTING INSIDIOUS BOT ON RENDER...");
        console.log("⏳ CONNECTING TO WHATSAPP...");
        
        const { state, saveCreds } = await useMultiFileAuthState("session");
        const { version } = await fetchLatestBaileysVersion();
        
        const conn = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
            },
            logger: pino({ level: "silent" }),
            browser: ["INSIDIOUS BOT", "Chrome", "120.0.0"],
            markOnlineOnConnect: true,
            printQRInTerminal: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
        });
        
        globalConn = conn;
        
        // Connection timeout handler
        const connectionTimeout = setTimeout(() => {
            if (!isReady) {
                console.log("⚠️ Connection timeout! Retrying...");
                conn.end();
            }
        }, 90000);
        
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                clearTimeout(connectionTimeout);
                isReady = true;
                retryCount = 0;
                console.log("\n✅✅✅ INSIDIOUS IS ONLINE! ✅✅✅\n");
                console.log(`🌐 WEB PANEL: https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}:${PORT}`);
                console.log("📱 YOU CAN NOW GENERATE PAIRING CODES!\n");
                
                // Notify owner
                try {
                    const ownerJid = config.ownerNumber + '@s.whatsapp.net';
                    await conn.sendMessage(ownerJid, { 
                        text: `✅ INSIDIOUS BOT IS ONLINE!\n🌐 https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}:${PORT}`
                    });
                    console.log("✅ Owner notified");
                } catch(e) {
                    console.log("⚠️ Owner not notified (number not saved)");
                }
            }
            
            if (connection === 'close') {
                clearTimeout(connectionTimeout);
                isReady = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`⚠️ Connection closed. Code: ${statusCode}`);
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log("❌ Session expired! Deleting session...");
                    const fs = require('fs-extra');
                    await fs.remove('./session').catch(() => {});
                    setTimeout(startBot, 5000);
                } else if (retryCount < 5) {
                    retryCount++;
                    const delay = 10000;
                    console.log(`🔄 Reconnecting in ${delay/1000}s... (Attempt ${retryCount}/5)`);
                    setTimeout(startBot, delay);
                }
            }
        });
        
        conn.ev.on('creds.update', saveCreds);
        
        // Message handler
        conn.ev.on('messages.upsert', async (m) => {
            try {
                const handler = require('./handler');
                await handler(conn, m);
            } catch(e) {
                console.error("Handler error:", e.message);
            }
        });
        
        // Anti-call
        if (config.anticall) {
            conn.ev.on('call', async (calls) => {
                for (let call of calls) {
                    if (call.status === 'offer') {
                        try {
                            await conn.rejectCall(call.id, call.from);
                            console.log(`📞 Rejected call from ${call.from}`);
                        } catch(e) {}
                    }
                }
            });
        }
        
    } catch(err) {
        console.error("Start error:", err);
        if (retryCount < 5) {
            retryCount++;
            setTimeout(startBot, 10000);
        }
    }
}

// Start bot
startBot();

// Start web server
app.listen(PORT, HOST, () => {
    console.log(`\n🌐 WEB DASHBOARD: http://${HOST}:${PORT}`);
    console.log("📱 PAIRING CODE SYSTEM ACTIVE");
    console.log("⏳ WAITING FOR WHATSAPP CONNECTION...");
    console.log("💡 Once connected, use the web page to get pairing code\n");
});
