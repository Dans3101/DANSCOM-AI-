import PDFDocument from 'pdfkit';
import { Response } from 'express';

/**
 * Programmatically compiles a publication-quality PDF containing DANSCOM Core's 
 * comprehensive file specifications, database mappings, workflow blueprints, and architectural diagrams.
 * Uses native Helvetica typography and robust drawing vectors to prevent external package or file-path failures.
 */
export async function generateSpecificationPdf(res: Response): Promise<void> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 55, bottom: 55, left: 50, right: 50 },
    bufferPages: true // Allows total page counts in headers/footers
  });

  // Set appropriate download headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="DANSCOM_System_Specification.pdf"');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  // Pipe the PDF document directly into the Express response stream
  doc.pipe(res);

  // Palette colors for executive, elegant corporate styling
  const BRAND_PRIMARY = '#10172A';  // Deep Slate Navy
  const BRAND_SECONDARY = '#4338CA'; // Indigo Active Accent
  const BRAND_GREEN = '#059669';     // Emerald Success
  const TEXT_MAIN = '#334155';       // Charcoal Slate Body text
  const TEXT_MUTED = '#64748B';      // Grey Muted
  const LINE_COLOR = '#E2E8F0';      // Border Light Grey
  const CARD_BG = '#F8FAFC';         // Soft warm off-white

  // ==========================================
  // PAGE 1: EXECUTIVE COVER PAGE
  // ==========================================
  
  // Outer decorative border
  doc.rect(25, 25, 545, 792).lineWidth(1).strokeColor(LINE_COLOR).stroke();
  doc.rect(30, 30, 535, 782).lineWidth(1.5).strokeColor(BRAND_PRIMARY).stroke();

  // Top header label
  doc.fillColor(BRAND_SECONDARY)
     .font('Helvetica-Bold')
     .fontSize(10)
     .text('ENTERPRISE DISTRIBUTED SYSTEMS DOCUMENTATION', 50, 80, { align: 'center' });

  doc.moveDown(5);

  // Decorative Accent bar
  doc.rect(197, 130, 200, 3).fill(BRAND_SECONDARY);

  doc.moveDown(4);

  // Document title
  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(32)
     .text('DANSCOM NETWORK', { align: 'center', lineGap: 8 });

  doc.fillColor(TEXT_MAIN)
     .font('Helvetica')
     .fontSize(16)
     .text('Core WhatsApp automation & Multi-Tenant Terminal Engine', { align: 'center', lineGap: 6 });

  doc.fillColor(BRAND_GREEN)
     .font('Helvetica-Bold')
     .fontSize(12)
     .text('FULL ARCHITECTURE & SYSTEM SPECIFICATIONS', { align: 'center' });

  // Large centered vector logo/diagram placeholder
  const centerX = 297;
  const centerY = 410;
  
  // Concentric structural lines suggesting circular network nodes
  doc.lineWidth(1.5).strokeColor(LINE_COLOR);
  doc.circle(centerX, centerY, 80).stroke();
  doc.circle(centerX, centerY, 50).stroke();

  doc.lineWidth(2).strokeColor(BRAND_SECONDARY);
  doc.circle(centerX, centerY, 65).stroke();

  // Draw node pins programmatically
  doc.fillColor(BRAND_SECONDARY);
  doc.circle(centerX, centerY - 65, 5).fill();
  doc.circle(centerX - 56, centerY + 32, 5).fill();
  doc.circle(centerX + 56, centerY + 32, 5).fill();

  // Core title in circle
  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(13)
     .text('CORE ENGINE', centerX - 45, centerY - 6, { width: 90, align: 'center' });

  // Move cursor to bottom metadata block
  doc.y = 660;
  
  doc.lineWidth(1).strokeColor(LINE_COLOR);
  doc.moveTo(80, 640).lineTo(515, 640).stroke();

  doc.fillColor(TEXT_MUTED)
     .font('Helvetica')
     .fontSize(10);

  doc.text('PREPARED FOR:', 80, 660)
     .fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .text('MUSEMBI DANIEL (System Admin)', 80, 675);

  doc.fillColor(TEXT_MUTED)
     .font('Helvetica')
     .text('ENGINE LEVEL:', 350, 660)
     .fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .text('Production v1.5.0 Standalone Containerized CJS', 350, 675);

  doc.fillColor(TEXT_MUTED)
     .font('Helvetica')
     .text('DATE:', 80, 715)
     .fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .text('May 29, 2026', 80, 730);

  doc.fillColor(TEXT_MUTED)
     .font('Helvetica')
     .text('DOCUMENT CLASSIFICATION:', 350, 715)
     .fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .text('RESTRICTED - Technical Reference Manual', 350, 730);

  // ==========================================
  // PAGE 2: TABLE OF CONTENTS & ARCHITECTURAL SPECS
  // ==========================================
  doc.addPage();
  
  // Section Title
  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(20)
     .text('TABLE OF CONTENTS', 50, 55);

  doc.rect(50, 80, 495, 2).fill(BRAND_SECONDARY);

  // TOC Rows
  const tocItems = [
    { num: '1.0', title: 'EXECUTIVE SYSTEM OVERVIEW', page: 3 },
    { num: '2.0', title: 'VISUAL SYSTEM LAYOUT & ARCHITECTURE DIAGRAM', page: 4 },
    { num: '3.0', title: 'FRONTEND DASHBOARD PORTAL (App.tsx)', page: 5 },
    { num: '4.0', title: 'NODE/EXPRESS INTEGRATION INGRESS (server.ts & server-api.ts)', page: 6 },
    { num: '5.0', title: 'WHATSAPP CONNECTION & BAILEYS PROTOCOL (whatsapp.ts)', page: 7 },
    { num: '6.0', title: 'MESSAGE HANDLER PIPELINE (messageHandler.ts)', page: 8 },
    { num: '7.0', title: 'COMMAND ROUTER ENGINE & DISPATCHER (commands/index.ts)', page: 9 },
    { num: '8.0', title: 'PERSISTENCE DESIGN & FIRESTORE SCHEMAS (firebase.ts & firestoreStore.ts)', page: 10 },
    { num: '9.0', title: 'UTILITIES & SYSTEM CRON LOOPS (autobio, contactService, commandTracker)', page: 11 },
    { num: '10.0', title: 'FINANCIAL ROUTINE INTERFACES (PayHero, IntaSend, M-Pesa)', page: 12 }
  ];

  let currentY = 110;
  tocItems.forEach((item) => {
    doc.fillColor(BRAND_PRIMARY)
       .font('Helvetica-Bold')
       .fontSize(11)
       .text(`${item.num} ${item.title}`, 50, currentY);

    // Dotted line connecting to page number
    doc.lineWidth(1).strokeColor(LINE_COLOR).dash(3, { space: 3 });
    doc.moveTo(380, currentY + 8).lineTo(500, currentY + 8).stroke();
    doc.undash();

    doc.fillColor(BRAND_SECONDARY)
       .font('Helvetica-Bold')
       .fontSize(11)
       .text(`PAGE ${item.page}`, 510, currentY, { align: 'right' });

    currentY += 32;
  });

  // Brief introductory paragraph beneath TOC
  doc.fillColor(TEXT_MAIN)
     .font('Helvetica')
     .fontSize(10.5)
     .text(
       'This systems documentation serves as the single source of truth for the DANSCOM Core messaging application. It details the modular separation of responsibilities, operational boundaries, security mechanisms, real-time feedback loops, and automated subscription processing channels that power the service.',
       50, 480, { width: 495, align: 'justify', lineGap: 5 }
     );

  // Key architectural design properties
  doc.rect(50, 560, 495, 120).fillColor(CARD_BG).fill();
  doc.rect(50, 560, 495, 120).lineWidth(1).strokeColor(LINE_COLOR).stroke();

  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(11)
     .text('CORE SYSTEM PRINCIPLES:', 65, 575);

  const bulletPoints = [
    'Modular Division: Decoupled controllers separation from direct WhatsApp protocol runtimes.',
    'Durable Connection Resiliency: Dynamic exponential backoff autorecover cycles.',
    'Enhanced Privacy Control: Server-side public/private permission registers per session.',
    'State Isolation: Independent sandboxed context scopes preventing memory bleed.'
  ];

  let bulletY = 595;
  bulletPoints.forEach(pt => {
    doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(11).text('•', 70, bulletY);
    doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(9.5).text(pt, 85, bulletY, { width: 440 });
    bulletY += 18;
  });

  // ==========================================
  // PAGE 3: 1.0 SYSTEM EXECUTIVE OVERVIEW
  // ==========================================
  doc.addPage();
  
  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(16)
     .text('1.0 EXECUTIVE SYSTEM OVERVIEW', 50, 55);
  doc.rect(50, 75, 495, 1.5).fill(BRAND_PRIMARY);

  doc.fillColor(TEXT_MAIN)
     .font('Helvetica')
     .fontSize(10.5)
     .text(
       'DANSCOM Core is a scalable, cloud-native WhatsApp automation service that allows independent operators to launch and manage highly customizable standalone message bots. The service leverages a customized execution pipeline of Whiskeysockets Baileys (the industry-standard open-source WhatsApp API library), paired with a central administrative dashboard built in React and Tailwind CSS.',
       50, 100, { width: 495, align: 'justify', lineGap: 5 }
     );

  doc.moveDown(1.5);

  doc.text(
     'Traditional WhatsApp bots require continuous on-premise execution, command-line tracking, and manually generated QR credentials. DANSCOM Core replaces this paradigm with Web-based Standalone Pairings. Administrators create dedicated Virtual Terminal structures (for example, to group devices, subscriptions, or operators), register custom WhatsApp Session Identifiers, configure recipient features, and connect client accounts programmatically using elegant stand-alone browser interfaces.',
     { width: 495, align: 'justify', lineGap: 5 }
  );

  doc.moveDown(1.5);

  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(12)
     .text('SYSTEM SCOPE BOUNDARIES & INTENT INTEGRITY');

  doc.moveDown(0.7);

  doc.fillColor(TEXT_MAIN)
     .font('Helvetica')
     .fontSize(10)
     .text(
       'The execution pipeline enforces strict isolation boundaries to maintain security. To protect developer keys against inspection, all third-party endpoints or AI operations are executed exclusively server-side. High-frequency in-memory trackers record command executions instantly, sync with persistent Firestore collections defensively, and broadcast changes to the UI via optimized background polling to deliver a highly interactive, responsive administrative control panel.',
       { width: 495, align: 'justify', lineGap: 5 }
     );

  doc.moveDown(1.5);

  // Draw Highlight stat cards
  const cardW = 150;
  const cardH = 75;
  const cardSpacing = 22;

  // Active Users Box
  doc.rect(50, 395, cardW, cardH).fillColor(CARD_BG).fill();
  doc.rect(50, 395, cardW, cardH).lineWidth(1).strokeColor(LINE_COLOR).stroke();
  doc.fillColor(TEXT_MUTED).font('Helvetica-Bold').fontSize(8.5).text('DATA PERSISTENCE', 62, 410);
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(16).text('Cloud Firestore', 62, 425);
  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(7.5).text('Multi-collection structured records', 62, 445);

  // Sessions Box
  doc.rect(50 + cardW + cardSpacing, 395, cardW, cardH).fillColor(CARD_BG).fill();
  doc.rect(50 + cardW + cardSpacing, 395, cardW, cardH).lineWidth(1).strokeColor(LINE_COLOR).stroke();
  doc.fillColor(TEXT_MUTED).font('Helvetica-Bold').fontSize(8.5).text('MESSAGE ENGINE', 232, 410);
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(16).text('Baileys Sockets', 232, 425);
  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(7.5).text('Robust WebSocket implementation', 232, 445);

  // Latency Box
  doc.rect(50 + (cardW * 2) + (cardSpacing * 2), 395, cardW, cardH).fillColor(CARD_BG).fill();
  doc.rect(50 + (cardW * 2) + (cardSpacing * 2), 395, cardW, cardH).lineWidth(1).strokeColor(LINE_COLOR).stroke();
  doc.fillColor(TEXT_MUTED).font('Helvetica-Bold').fontSize(8.5).text('PAYMENTS INGRESS', 395 + 7, 410);
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(16).text('PayHero M-Pesa', 395 + 7, 425);
  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(7.5).text('Instant carrier checkout API', 395 + 7, 445);

  doc.y = 500;
  doc.moveDown(2);

  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(12)
     .text('SUMMARY OF OPERATIONAL MODES');

  doc.moveDown(0.5);

  doc.fillColor(TEXT_MAIN)
     .font('Helvetica')
     .fontSize(10)
     .text('The server acts as both an application server and a proxy gateway. In development mode, the server integrates the Vite engine to act as a development middleware, dynamically compiling hot modules and executing static client code. In production, the client code compiles to static assets saved in /dist/, and is served directly by our custom Express server. Consequently, client applications and connection controllers are ran synchronously inside a single container, bypassing external latency caps and allowing streamlined vertical scaling.', { width: 495, align: 'justify', lineGap: 5 });

  // ==========================================
  // PAGE 4: 2.0 VISUAL SYSTEM LAYOUT DIAGRAM
  // ==========================================
  doc.addPage();
  
  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(16)
     .text('2.0 VISUAL SYSTEM LAYOUT & DIAGRAMS', 50, 55);
  doc.rect(50, 75, 495, 1.5).fill(BRAND_PRIMARY);

  doc.fillColor(TEXT_MAIN)
     .font('Helvetica')
     .fontSize(10.5)
     .text(
       'The block diagram below details DANSCOM Core\'s flow of execution. We trace actions from client interaction elements, through REST interfaces, to session controllers, message routers, databases, and external financial networks:',
       50, 95, { width: 495, lineGap: 4 }
     );

  // Let's draw the block diagram using PDFKit vectors!
  doc.lineWidth(1.2).strokeColor(BRAND_PRIMARY);
  
  // Layer 1: Front-end dashboard [App.tsx, browser view]
  doc.rect(70, 160, 180, 50).fillColor(CARD_BG).fillAndStroke();
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(10)
     .text('REACT WEB PORTAL', 85, 175)
     .font('Helvetica').fontSize(8.5).text('(App.tsx - Slate Design)', 85, 190);

  // Arrow down to Express Ingress [server-api.ts]
  doc.moveTo(160, 210).lineTo(160, 250).stroke();
  doc.moveTo(157, 246).lineTo(160, 250).lineTo(163, 246).fill(BRAND_PRIMARY);

  // Label for arrow
  doc.fillColor(TEXT_MUTED).font('Helvetica-Bold').fontSize(7.5).text('HTTPS / JSON Polling', 168, 225);

  // Layer 2: API Ingress [server-api.ts]
  doc.lineWidth(1.2).strokeColor(BRAND_PRIMARY);
  doc.rect(70, 250, 180, 50).fillColor(CARD_BG).fillAndStroke();
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(10)
     .text('EXPRESS API INGRESS', 85, 265)
     .font('Helvetica').fontSize(8.5).text('(server-api.ts Router)', 85, 280);

  // Arrow from Ingress to Connection Layer [whatsapp.ts]
  doc.moveTo(160, 300).lineTo(160, 340).stroke();
  doc.moveTo(157, 336).lineTo(160, 340).lineTo(163, 336).fill(BRAND_PRIMARY);
  doc.fillColor(TEXT_MUTED).font('Helvetica-Bold').fontSize(7.5).text('Session Life Commands', 168, 315);

  // Layer 3: Connection Server [whatsapp.ts]
  doc.lineWidth(1.2).strokeColor(BRAND_PRIMARY);
  doc.rect(70, 340, 180, 50).fillColor(CARD_BG).fillAndStroke();
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(10)
     .text('CONNECTION SENSE', 85, 355)
     .font('Helvetica').fontSize(8.5).text('(whatsapp.ts - Baileys Loop)', 85, 370);

  // Arrow right to messageHandler and commands/index
  doc.moveTo(250, 365).lineTo(340, 365).stroke();
  doc.moveTo(336, 362).lineTo(340, 365).lineTo(336, 368).fill(BRAND_PRIMARY);
  doc.fillColor(TEXT_MUTED).font('Helvetica-Bold').fontSize(7.5).text('Trigger Core Event', 260, 350);

  // Layer 4: Pipeline [messageHandler.ts -> commands]
  doc.lineWidth(1.2).strokeColor(BRAND_PRIMARY);
  doc.rect(340, 340, 180, 50).fillColor(CARD_BG).fillAndStroke();
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(10)
     .text('PIPELINE DISPATCH', 355, 355)
     .font('Helvetica').fontSize(8.5).text('(messageHandler & commands)', 355, 370);

  // Database Nodes (Right of everything)
  doc.lineWidth(1.2).strokeColor(BRAND_PRIMARY);
  doc.rect(340, 250, 180, 50).fillColor(CARD_BG).fillAndStroke();
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(10)
     .text('DATA ENGINE', 355, 265)
     .font('Helvetica').fontSize(8.5).text('(Firestore Database Store)', 355, 280);

  // Connect Layer 3 & Layer 4 to Database
  doc.moveTo(250, 275).lineTo(340, 275).stroke(); // API to DB
  doc.moveTo(336, 272).lineTo(340, 275).lineTo(336, 278).fill(BRAND_PRIMARY);

  doc.moveTo(430, 340).lineTo(430, 300).stroke(); // Pipeline to DB
  doc.moveTo(427, 304).lineTo(430, 300).lineTo(433, 304).fill(BRAND_PRIMARY);
  doc.fillColor(TEXT_MUTED).font('Helvetica-Bold').fontSize(7)
     .text('Read/Write state', 438, 317);

  // External services node (payhero and gemini)
  doc.lineWidth(1.2).strokeColor(BRAND_PRIMARY);
  doc.rect(340, 160, 180, 50).fillColor(CARD_BG).fillAndStroke();
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(9.5)
     .text('EXTERNAL CORE SERVICES', 355, 175)
     .font('Helvetica').fontSize(8.5).text('(M-Pesa, IntaSend, Gemini API)', 355, 190);

  doc.moveTo(430, 250).lineTo(430, 210).stroke(); // DB/API to External Services
  doc.moveTo(427, 214).lineTo(430, 210).lineTo(433, 214).fill(BRAND_PRIMARY);

  // Add flow explanation details at the bottom of the schematic
  doc.y = 440;
  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(11)
     .text('OPERATIONAL FLOW STEPS DESCRIPTION:');

  doc.moveDown(0.5);

  const stepsList = [
    '1. Client request initiated inside React Portal (App.tsx), using secure shortened base64 tokens.',
    '2. Request parsed by Express endpoints in server-api.ts after applying custom security rules and CORS limits.',
    '3. Control commands routed to whatsapp.ts to initialize, suspend, restart or request a multi-device link PIN code.',
    '4. Baileys socket listens to incoming events, streaming messages to messageHandler.ts for filtering and command match.',
    '5. Command router indices trigger appropriate responses, updating Firestore state and logging command telemetry counts.',
    '6. Subscriptions activate dynamically by processing secure automated PayHero / M-Pesa checkout hooks instantly.'
  ];

  stepsList.forEach(step => {
    doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(9.5).text(step, { width: 495, lineGap: 3.5 });
    doc.moveDown(0.2);
  });

  // ==========================================
  // PAGE 5: 3.0 FRONTEND DASHBOARD PORTAL (App.tsx)
  // ==========================================
  doc.addPage();
  
  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(16)
     .text('3.0 FRONTEND DASHBOARD PORTAL (App.tsx)', 50, 55);
  doc.rect(50, 75, 495, 1.5).fill(BRAND_PRIMARY);

  doc.fillColor(TEXT_MAIN)
     .font('Helvetica')
     .fontSize(10.5)
     .text(
       'The user interface is a single-screen dashboard built in React 19 and styled with Tailwind CSS utility classes. It provides a visual terminal command-and-control portal designed for system operators.',
       50, 95, { width: 495, align: 'justify', lineGap: 4 }
     );

  doc.moveDown(1.5);

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(12).text('KEY VISUAL LAYOUT & SECTIONS:');
  doc.moveDown(0.5);

  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(10).text(
    '• System Health Cards: Displays server telemetry in real-time. Displays Active Connected Bots, latency metrics, server uptime, and a high-frequency (1.5s refresh) "Total Commands Executed" load meter styled with a blinking pulse animation.\n\n' +
    '• Terminal Grid: Renders independent, structured Operator Terminal frames. Each terminal controls specific weekly subscription billing, setup fee logs, and maps sessions explicitly to the terminal node.\n\n' +
    '• Standalone Pairing Panel: An isolated client configuration interface. Users who access via unique shortened obscured base64 pairing links can view device details, insert their WhatsApp phone number, trigger secure pairing code requests, and receive pairing PINs. This panel is deeply sandboxed, hiding all administrative controllers against inspect hazards.\n\n' +
    '• Transaction Center & Action Logs: Houses the audit logs tracking live connection updates, subscription status codes, and manual restart configurations.'
    , { width: 495, lineGap: 4 }
  );

  doc.moveDown(1.5);

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(12).text('STANDALONE SECURE PAIRING LINK TECHNOLOGY:');
  doc.moveDown(0.5);

  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(10).text(
    'To guarantee secure device integration without exposing administrative layouts, the frontend incorporates a Token Obfuscator utility. Administrators can share standalone pairing links formatted with obscured tokens. The encoder maps coordinates of a targeted terminal and device session identifier to a minimized base64 representation. When compiled, it prevents unauthorized exploration of parent server metrics. \n\n' +
    'A fallback translation matrix checks base64 headers. If valid, the frontend renders a dedicated pairing component, keeping other tabs fully inaccessible.', 
    { width: 495, align: 'justify', lineGap: 5 }
  );

  // ==========================================
  // PAGE 6: 4.0 NODE/EXPRESS INTEGRATION INGRESS
  // ==========================================
  doc.addPage();
  
  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(16)
     .text('4.0 NODE/EXPRESS INTEGRATION INGRESS', 50, 55);
  doc.rect(50, 75, 495, 1.5).fill(BRAND_PRIMARY);

  doc.fillColor(TEXT_MAIN)
     .font('Helvetica')
     .fontSize(10.5)
     .text(
       'The backend architecture operates as a modern Node.js service written in TypeScript. It is booted through server.ts and exposes REST API controllers organized in server-api.ts.',
       50, 95, { width: 495, align: 'justify', lineGap: 4 }
     );

  doc.moveDown(1.5);

  // Split into left and right description tables
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(12).text('MODULE RESPONSIBILITY MATRIX:');
  doc.moveDown(0.5);

  // Styled Table Header
  doc.rect(50, 160, 495, 20).fillColor(BRAND_PRIMARY).fill();
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9)
     .text('FILE ENTRY', 60, 166)
     .text('PRIMARY SERVICE FUNCTION', 180, 166)
     .text('SUBROUTINES DETAILS', 380, 166);

  // Table Row 1: server.ts
  doc.rect(50, 180, 495, 45).fillColor(CARD_BG).fill();
  doc.rect(50, 180, 495, 45).lineWidth(1).strokeColor(LINE_COLOR).stroke();
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(8.5).text('src/server.ts', 60, 195);
  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(8).text('Binds host port 3000, initializes API sub-Routers, mounts Vite middleware, and commands Baileys session bootstrap loops.', 180, 188, { width: 190, lineGap: 2.5 });
  doc.fillColor(TEXT_MUTED).font('Courier').fontSize(7.5).text('bootstrap()\nprocess.on("SIGINT")', 380, 195);

  // Table Row 2: server-api.ts (Part 1 - Sessions)
  doc.rect(50, 225, 495, 55).fillColor('#FFFFFF').fill();
  doc.rect(50, 225, 495, 55).lineWidth(1).strokeColor(LINE_COLOR).stroke();
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(8.5).text('src/server-api.ts\n(Sessions)', 60, 240);
  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(8).text('Receives controller request parameters. Creates, reads, logs, or purges Baileys instances. Returns real-time metadata counts & system plugin registries.', 180, 233, { width: 190, lineGap: 2.5 });
  doc.fillColor(TEXT_MUTED).font('Courier').fontSize(7.5).text('GET /api/stats\nPOST /api/sessions\nGET /api/plugins', 380, 240);

  // Table Row 3: server-api.ts (Part 2 - Terminals)
  doc.rect(50, 280, 495, 50).fillColor(CARD_BG).fill();
  doc.rect(50, 280, 495, 50).lineWidth(1).strokeColor(LINE_COLOR).stroke();
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(8.5).text('src/server-api.ts\n(Terminals & Pay)', 60, 290);
  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(8).text('Maps virtual operator boundaries, handles terminal assignment fees, triggers Intasend gateways, and captures carrier IPN postbacks.', 180, 286, { width: 190, lineGap: 2.5 });
  doc.fillColor(TEXT_MUTED).font('Courier').fontSize(7.5).text('GET /api/terminals\nPOST /api/payments\nPOST /api/payhero/callback', 380, 290);

  doc.y = 350;
  doc.moveDown(1.5);

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(11).text('SECURE HOOKING & LOG PROTECTION GUIDELINES');
  doc.moveDown(0.5);

  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(9.5).text(
    'A custom request logger logs incoming transactions securely. It records timestamp footprints, duration margins, HTTP verbs, origin hosts, and user-agents inside api-requests.log directly.\n\n' +
    'To guarantee proper authorization during subscription requests, Vite caching proxies are turned off globally on client requests via custom Cache-Control headers, preventing state mismatch or obsolete validation caches inside sandboxed frames.\n\n' +
    'An extensive global error exception boundary is registered directly before Vite server mounting to intercept unhandled operational errors, returning clean JSON failure messages instead of stack traces to client inquiries.',
    { width: 495, align: 'justify', lineGap: 5 }
  );

  // ==========================================
  // PAGE 7: 5.0 WHATSAPP CONNECTION & BAILEYS PROTOCOL (whatsapp.ts)
  // ==========================================
  doc.addPage();
  
  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(16)
     .text('5.0 WHATSAPP CONNECTION ENGINE (whatsapp.ts)', 50, 55);
  doc.rect(50, 75, 495, 1.5).fill(BRAND_PRIMARY);

  doc.fillColor(TEXT_MAIN)
     .font('Helvetica')
     .fontSize(10.5)
     .text(
       'The application utilizes Whiskeysockets Baileys (the industry-standard open-source WhatsApp API library) to maintain active socket connections. This integration is handled in src/services/whatsapp.ts.',
       50, 95, { width: 495, align: 'justify', lineGap: 4 }
     );

  doc.moveDown(1.5);

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(12).text('ENGINE LIFE-CYCLE SPECS:');
  doc.moveDown(0.5);

  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(10).text(
    '1. Multi-Device Initialization: Calls makeWASocket dynamically to create an independent connection session for each tenant. Spawns custom logger threads with Pino logger structures.\n\n' +
    '2. Authentication Storage: Integrates dynamic database adapters inside Baileys config. Uses custom Firestore authentication collections to save login keys, credentials, and pairing settings, preventing workspace loss during process restarts.\n\n' +
    '3. Connection Listeners: Hooks deep events (connection.update) to intercept connection transitions. When disconnected, the system evaluates the disconnect code (e.g., Logged Out, Bad Session, Stream Errored) and automatically schedules exponential backoff reconnect attempts.\n\n' +
    '4. Link PIN Generation: Triggers requestPairingCode automatically when client number setups are updated, serving generated 8-character terminal PIN codes programmatically to client dashboards.',
    { width: 495, lineGap: 4 }
  );

  doc.moveDown(1.5);

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(12).text('STATE TRACKER SCHEMES:');
  doc.moveDown(0.5);

  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(10).text(
    'An active in-memory map pools all session coordinates (sock, connectionStatus, qrCode, pairingCode, metadata). This acts as a centralized coordinate cache that synchronizes with Firestore, ensuring consistent dashboard updates.\n\n' +
    'If a tenant delete routine is executed, the engine triggers a teardown process: it blocks incoming socket events, disconnects the socket loop, purges in-memory caches, and executes cleanup cycles to wipe related Firestore authentication credentials.',
    { width: 495, align: 'justify', lineGap: 5 }
  );

  // ==========================================
  // PAGE 8: 6.0 MESSAGE HANDLER PIPELINE (messageHandler.ts)
  // ==========================================
  doc.addPage();
  
  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(16)
     .text('6.0 MESSAGE HANDLER PIPELINE (messageHandler.ts)', 50, 55);
  doc.rect(50, 75, 495, 1.5).fill(BRAND_PRIMARY);

  doc.fillColor(TEXT_MAIN)
     .font('Helvetica')
     .fontSize(10.5)
     .text(
       'Incoming chat messages from standard active sessions are captured and filtered by the messaging pipeline configured in src/handlers/messageHandler.ts.',
       50, 95, { width: 495, align: 'justify', lineGap: 4 }
     );

  doc.moveDown(1.5);

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(12).text('PIPELINE PARSING STEPS:');
  doc.moveDown(0.5);

  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(10).text(
    '• Extraction and Cleaning: Parses incoming message envelopes (upsert events). Extracts the sender JID, remote chat string, and message body. Sanitizes inputs to prevent command injection.\n\n' +
    '• Prefix Analysis: Supports configurable triggers (e.g., . / ! #). Checks if the message starts with one of these symbols. If found, isolates the trigger, identifies the command word, and separates extra parameters into a clean string array.\n\n' +
    '• Group chat Safeguards: To prevent bots from triggering unintentionally during standard conversations in group chats, commands without prefixes (e.g., numeric submenus) are blocked. In groups, all bot interactions must use a prefix (e.g. .menu).\n\n' +
    '• Access Level Validation: Queries isEnabled(\'public_mode\', sessionId) defensively. If a bot is toggled to PRIVATE mode, only authorized owners or designated users can trigger commands.'
    , { width: 495, lineGap: 4.5 }
  );

  doc.moveDown(1.5);

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(12).text('SECURITY VALIDATOR PIPELINE BLUEPRINT:');
  doc.moveDown(0.5);

  // Programmatic drawing of validation workflow
  doc.rect(50, 480, 495, 90).fillColor(CARD_BG).fill();
  doc.rect(50, 480, 495, 90).lineWidth(1).strokeColor(LINE_COLOR).stroke();

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(9).text('VALIDATOR CHECKLIST FOR INCOMING COMMAND COMMANDS:', 60, 495);
  
  const valChecklist = [
    '1. Rate Limiting check: Restricts command frequency to prevent socket flood blocks.',
    '2. Authentication check: Validates owner permissions using the JID registry.',
    '3. Access check: Ensures non-owners cannot issue administrative commands in Private Mode.',
    '4. License check: Assesses subscription state to restrict premium commands if payment has expired.'
  ];

  let checkY = 515;
  valChecklist.forEach(chk => {
    doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(11).text('✔', 65, checkY);
    doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(8.5).text(chk, 80, checkY);
    checkY += 15;
  });

  // ==========================================
  // PAGE 9: 7.0 COMMAND ROUTER ENGINE & DISPATCHER (commands/index.ts)
  // ==========================================
  doc.addPage();
  
  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(16)
     .text('7.0 COMMAND ROUTER ENGINE (commands/index.ts)', 50, 55);
  doc.rect(50, 75, 495, 1.5).fill(BRAND_PRIMARY);

  doc.fillColor(TEXT_MAIN)
     .font('Helvetica')
     .fontSize(10.5)
     .text(
       'The main command router and action dispatcher is housed inside src/commands/index.ts. This module routes valid triggers to specific execution services.',
       50, 95, { width: 495, align: 'justify', lineGap: 4 }
     );

  doc.moveDown(1.5);

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(12).text('SUPPORTED SYSTEM UTILITIES CATEGORIES:');
  doc.moveDown(0.5);

  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(10).text(
    '• Administrative Overrides: Admin-only commands to manage global bot behavior. These include blocking users, unblocking users, changing active triggers (.setprefix), updating profiles, and shutting down or restarting the host process safely.\n\n' +
    '• Media Download Utility: Integrates download helpers. Automatically parses links from platforms like YouTube, Facebook, TikTok, or Instagram and streams the downloaded media back to the requester.\n\n' +
    '• Gemini AI Integration: Routes unstructured questions to the Gemini API when chatbot features are active. This delivers conversational automated replies with context-awareness and smart instructions.\n\n' +
    '• Live Signals Controls: Activates or deactivates connection flags (.autoread, .autotyping, .autorecord), adjusting the socket output behavior in real-time.\n\n' +
    '• Security Toggles: Configures anti-delete listeners (.antidelete) or call blockers (.anticall) to intercept and block incoming calls.'
    , { width: 495, lineGap: 4.5 }
  );

  doc.moveDown(1.5);

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(12).text('METRICS & COMMAND TELEMETRY UPDATES:');
  doc.moveDown(0.5);

  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(10).text(
    'Every command dispatched triggers an atomic counter update in our local state engine. This function: \n' +
    '1. Calls incrementCommandCount() instantly to update the process counter.\n' +
    '2. Executes background query checks against Firestore to increment commands count.\n' +
    '3. Updates state so that subsequent high-frequency dashboard queries receive real-time, accurate metrics.', 
    { width: 495, align: 'justify', lineGap: 5 }
  );

  // ==========================================
  // PAGE 10: 8.0 PERSISTENCE DESIGN & SCHEMAS (firebase.ts & firestoreStore.ts)
  // ==========================================
  doc.addPage();
  
  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(16)
     .text('8.0 PERSISTENCE DESIGN & SCHEMAS', 50, 55);
  doc.rect(50, 75, 495, 1.5).fill(BRAND_PRIMARY);

  doc.fillColor(TEXT_MAIN)
     .font('Helvetica')
     .fontSize(10.5)
     .text(
       'DANSCOM Core uses Google Cloud Firestore for persistent storage, using the server-side firebase-admin SDK. Let\'s review the database structure and schema mappings below.',
       50, 95, { width: 495, align: 'justify', lineGap: 4 }
     );

  doc.moveDown(1.5);

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(12).text('FIRESTORE PRIMARY COLLECTIONS MAP:');
  doc.moveDown(0.5);

  // Styled collection schemas
  const schemas = [
    { title: 'analytics (System Command Telemetry Records)', fields: 'usageCount: number, firstUse: timestamp, lastUpdated: timestamp' },
    { title: 'terminals (Virtual Operator Enclosures)', fields: 'id: string, name: string, operatorName: string, weeklyRate: number, sessionIds: array' },
    { title: 'sessions_metadata (User Session Registers)', fields: 'clientName: string, clientPhone: string, disabled: boolean, controlCode: string' },
    { title: 'payments (Financial Audit Trails)', fields: 'id: string, amount: number, sessionId: string, status: string, type: text, completedAt: timestamp' },
    { title: 'auth_store (Baileys Credentials Multi-file Store)', fields: 'sessionId_creds: map (base64 token pairs, dynamic credentials, active security keymaps)' }
  ];

  schemas.forEach(sc => {
    doc.fillColor(BRAND_SECONDARY).font('Helvetica-Bold').fontSize(9.5).text(`• Collection: ${sc.title}`, { width: 495 });
    doc.fillColor(TEXT_MAIN).font('Courier').fontSize(8.5).text(`  Schema Data: { ${sc.fields} }`, { width: 495 });
    doc.moveDown(0.5);
  });

  doc.moveDown(1.2);

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(12).text('THE CUSTOM FIRESTORE AUTH STORE ENGINE:');
  doc.moveDown(0.5);

  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(10).text(
    'By default, Baileys uses file-system caches to save session credentials. However, containerized web servers run on ephemeral storage, meaning file-system caches are wiped on rebuilds or scale events. \n\n' +
    'DANSCOM Core solves this by routing all credential updates through a custom Firestore auth store (src/database/firestoreStore.ts). The store maps credentials directly to Firestore documents. This secures authentication state across multiple host instances, allowing seamless, persistent container scaled operations without session loss.',
    { width: 495, align: 'justify', lineGap: 5 }
  );

  // ==========================================
  // PAGE 11: 9.0 UTILITIES & SYSTEM CRON LOOPS (autobio, contactService, commandTracker)
  // ==========================================
  doc.addPage();
  
  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(16)
     .text('9.0 UTILITIES & BACKGROUND PROCS', 50, 55);
  doc.rect(50, 75, 495, 1.5).fill(BRAND_PRIMARY);

  doc.fillColor(TEXT_MAIN)
     .font('Helvetica')
     .fontSize(10.5)
     .text(
       'The application runs automated processes in the background to handle periodic updates and status changes. These utilities run in separate execution threads.',
       50, 95, { width: 495, align: 'justify', lineGap: 4 }
     );

  doc.moveDown(1.5);

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(12).text('BACKGROUND CORE UTILITIES DESCRIPTION:');
  doc.moveDown(0.5);

  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(10).text(
    '• Dynamically Updated Status Bios (autobio.ts): Periodically modifies the connected user\'s bio status based on preset state lists or UTC time clocks. Runs on interval loops, updating status text without disrupting active user sessions.\n\n' +
    '• Contacts Sync Tool (contactService.ts): Automatically syncs group membership logs and client profiles to Firestore collections. This makes participant directories available to operators through the administrative panel without query delays.\n\n' +
    '• Real-Time Command Tracker (commandTracker.ts): Keeps an accurate in-memory record of commands run during the container session. On startup, it reads the current command count from the database and acts as a fast cache for the dashboard. This structure prevents database read-quota exhaustion during high-frequency polling.\n\n' +
    '• Internal Buffer (messageStore.ts): Temporarily holds incoming chats in an in-memory buffer. This allows the system to support "anti-delete" features, sending a copy of deleted messages back to the operator if the sender retracts them.'
    , { width: 495, lineGap: 5 }
  );

  doc.moveDown(1.5);

  // Background Tasks Layout diagram
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(11).text('INTERVAL WORKFLOW MATRIX:');
  doc.moveDown(0.5);

  doc.rect(50, 480, 495, 75).fillColor(CARD_BG).fill();
  doc.rect(50, 480, 495, 75).lineWidth(1).strokeColor(LINE_COLOR).stroke();

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(9).text('INTERVAL', 60, 495).text('UTILITY TARGET', 150, 495).text('PRIMARY OUTCOME ACTION', 290, 495);
  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(8.5)
     .text('Every 60 Seconds', 60, 515).text('autobio.ts', 150, 515).text('Syncs clock status line changes.', 290, 515)
     .text('Daily Sync Event', 60, 532).text('contactService.ts', 150, 532).text('Syncs contact documents and metadata.', 290, 532);

  // ==========================================
  // PAGE 12: 10.0 FINANCIAL ROUTINE INTERFACES (PayHero, IntaSend, M-Pesa)
  // ==========================================
  doc.addPage();
  
  doc.fillColor(BRAND_PRIMARY)
     .font('Helvetica-Bold')
     .fontSize(16)
     .text('10.0 FINANCIAL INTERFACES & PAYMENT (PayHero, IntaSend)', 50, 55);
  doc.rect(50, 75, 495, 1.5).fill(BRAND_PRIMARY);

  doc.fillColor(TEXT_MAIN)
     .font('Helvetica')
     .fontSize(10.5)
     .text(
       'The DANSCOM Core platform processes real-time payments through carrier and gateway connections, allowing automated subscription changes.',
       50, 95, { width: 495, align: 'justify', lineGap: 4 }
     );

  doc.moveDown(1.5);

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(12).text('INTEGRATED PAYMENT PLATFORMS:');
  doc.moveDown(0.5);

  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(10).text(
    '1. Carrier API Gateway (PayHero): Integrates secure automated M-Pesa STK push checkouts. When users click pay on their dashboard, the system initiates an online express query via the provider. This sends a carrier password prompt to the client device.\n\n' +
    '2. Dynamic Callback endpoint (/api/payhero/callback): Listens for postback requests from our gateway. If the transaction status is "Success", the system parses the reference number, matches it to the user session, and extends active subscription limits.\n\n' +
    '3. Gateway Proxy (IntaSend): Provides fallback card and wallet checks. This handles checkout validations, monitors transactions, and updates subscription records in Firestore.'
    , { width: 495, lineGap: 5 }
  );

  doc.moveDown(1.5);

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(12).text('TRANSACTION VALIDATION FLOW BLUEPRINT:');
  doc.moveDown(0.7);

  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(10).text(
    'All purchase requests are logged to the payments collection in Firestore. This maintains an auditable record of setup fees and weekly payments on the operator dashboard. \n\n' +
    'To secure financial workflows and prevent replay attacks, payment references must complete a cryptographic validation check with the provider API before subscription changes are applied.',
    { width: 495, align: 'justify', lineGap: 5 }
  );

  // ==========================================
  // FINAL FOOTERS & SYSTEM HEALTH GUARANTEE
  // ==========================================
  
  doc.moveDown(3);
  doc.lineWidth(1.2).strokeColor(BRAND_PRIMARY);
  doc.rect(50, 500, 495, 110).fillColor(CARD_BG).fillAndStroke();
  
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(11).text('DANSCOM SPECIFICATION COMPLIANCE SIGN-OFF', 65, 515);
  
  doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(8.5).text(
    'This system documentation document accurately describes the complete, updated v1.5.0 Standalone core. All software modules run securely inside a single container, bypassing external latency caps and allowing streamlined vertical scaling.',
    65, 532, { width: 460, lineGap: 3.5 }
  );

  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(9).text('APPROVED BY: DANSCOM CORE ENGINE AUTOMATION AGENT', 65, 585);


  // ==========================================
  // HEADER/FOOTER EVENTS (Page Numbering Injection)
  // ==========================================
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    
    // Header for pages after the cover
    if (i > 0) {
      doc.fillColor(TEXT_MUTED)
         .font('Helvetica-Bold')
         .fontSize(8)
         .text('DANSCOM ENGINE TECHNICAL REFERENCE MANUAL', 50, 30, { align: 'left' });
      
      doc.lineWidth(0.5).strokeColor(LINE_COLOR);
      doc.moveTo(50, 42).lineTo(545, 42).stroke();
    }

    // Footer for all pages
    doc.lineWidth(0.5).strokeColor(LINE_COLOR);
    doc.moveTo(50, 792 - 40).lineTo(545, 792 - 40).stroke();

    doc.fillColor(TEXT_MUTED)
       .font('Helvetica')
       .fontSize(8);

    doc.text('CONFIDENTIAL - PROPRIETARY ARCHITECTURE MANUAL', 50, 792 - 32, { align: 'left' });
    
    doc.text(`PAGE ${i + 1} OF ${range.count}`, 450, 792 - 32, { align: 'right', width: 95 });
  }

  // End the document stream
  doc.end();
}
