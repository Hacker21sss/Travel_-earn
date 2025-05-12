const smpp = require('smpp');

// SMPP Connection Details
const smppHost = 'sms6.rmlconnect.net';
const smppPort = 7005;
const systemId = 'timestring';
const password = 'c7*HKy)6';

// Create an SMPP session
const session = smpp.connect(`smpp://${smppHost}:${smppPort}`);

session.on('connect', () => {
    console.log('Connected to SMPP server');

    // Bind as a transceiver
    session.bind_transceiver({
        system_id: systemId,
        password: password
    }, (pdu) => {
        if (pdu.command_status === 0) {
            console.log('SMPP Bind Successful');

            // Send Enquire Link every 60 seconds
            setInterval(() => {
                session.enquire_link({}, (response) => {
                    console.log('Enquire Link Response:', response);
                });
            }, 60000);
        } else {
            console.log('SMPP Bind Failed:', pdu.command_status);
        }
    });
});

// Handle errors
session.on('error', (err) => {
    console.error('SMPP Error:', err);
});

// Handle unbind and close events
session.on('close', () => {
    console.log('SMPP Connection Closed');
});

// Handle Enquire Link from the server
session.on('pdu', (pdu) => {
    if (pdu.command === 'enquire_link') {
        session.send(pdu.response());
    }
});

