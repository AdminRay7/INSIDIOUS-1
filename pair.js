const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require("pino");

async function pair() {
    console.log("\n🔐 INSIDIOUS PAIRING TOOL\n");
    
    // Get phone number from command line
    const number = process.argv[2];
    
    if (!number) {
        console.log("❌ Please provide your phone number!");
        console.log("📝 Usage: node pair.js 254XXXXXXXXX");
        console.log("📱 Example: node pair.js 254794376595\n");
        process.exit(1);
    }
    
    // Clean the number
    const cleanNum = number.replace(/[^0-9]/g, '');
    
    if (cleanNum.length < 10 || cleanNum.length > 15) {
        console.log("❌ Invalid phone number! Must be 10-15 digits.");
        process.exit(1);
    }
    
    console.log(`📱 Requesting pairing code for +${cleanNum}...`);
    console.log("⏳ Please wait...\n");
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState("session");
        
        const conn = makeWASocket({
            auth: state,
            logger: pino({ level: "silent" }),
            browser: ["INSIDIOUS", "Chrome", "120.0.0"],
            printQRInTerminal: false,
        });
        
        conn.ev.on('creds.update', saveCreds);
        
        // Request pairing code
        const code = await conn.requestPairingCode(cleanNum);
        
        console.log("\n╔══════════════════════════════════════╗");
        console.log("║     🔐 YOUR PAIRING CODE 🔐          ║");
        console.log("╠══════════════════════════════════════╣");
        console.log(`║        ${code}          ║`);
        console.log("╚══════════════════════════════════════╝\n");
        
        console.log("📱 INSTRUCTIONS:");
        console.log("1. Open WhatsApp on your phone");
        console.log("2. Go to Settings → Linked Devices");
        console.log("3. Tap 'Link with Phone Number'");
        console.log(`4. Enter code: ${code}`);
        console.log("5. Wait 5 seconds...\n");
        console.log("✅ After connecting, your bot will work!");
        
        // Keep connection open for a few seconds to save creds
        setTimeout(() => {
            process.exit(0);
        }, 5000);
        
    } catch (err) {
        console.error("\n❌ Error:", err.message);
        console.log("\n💡 Troubleshooting:");
        console.log("• Make sure you have internet connection");
        console.log("• Try again in a few seconds");
        process.exit(1);
    }
}

pair();
