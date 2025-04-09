import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';

export default function App() {
    const [nickname, setNickname] = useState('Anonym');
    const [joined, setJoined] = useState(false);
    const [room, setRoom] = useState('');
    const [showChat, setShowChat] = useState(false);
    const [examEndTime, setExamEndTime] = useState(null);
    const [toiletOccupied, setToiletOccupied] = useState(false);
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [timeLeft, setTimeLeft] = useState(null);
    const [peers, setPeers] = useState([]);
    const [durationInput, setDurationInput] = useState('');
    const [connected, setConnected] = useState(false);
    const [log, setLog] = useState([]);

    const peerRef = useRef();
    const connRef = useRef();

    const safeSend = (data) => {
        if (connRef.current && connRef.current.open) {
            connRef.current.send(JSON.stringify(data));
            setLog(log => [...log, `Gesendet: ${JSON.stringify(data)}`]);
        } else {
            setLog(log => [...log, `Nicht gesendet (nicht verbunden): ${JSON.stringify(data)}`]);
        }
    };

    const broadcastPresence = () => {
        safeSend({ type: 'nickname', data: nickname });
        safeSend({ type: 'examEndTime', data: examEndTime });
        safeSend({ type: 'toiletOccupied', data: toiletOccupied });
    };

    const connectToRoom = () => {
        const peer = new Peer();
        peerRef.current = peer;

        peer.on('open', (id) => {
            setLog(log => [...log, `Peer geöffnet mit ID ${id}`]);
            if (room === id) return; // verhindert Selbstverbindung

            const conn = peer.connect(room);
            connRef.current = conn;

            conn.on('open', () => {
                setConnected(true);
                broadcastPresence();
                setLog(log => [...log, 'Verbindung zu anderem Peer geöffnet.']);
            });

            conn.on('data', handleIncoming);
        });

        peer.on('connection', (conn) => {
            connRef.current = conn;
            conn.on('open', () => {
                setConnected(true);
                broadcastPresence();
                setLog(log => [...log, 'Eingehende Verbindung akzeptiert.']);
            });

            conn.on('data', handleIncoming);
        });
    };

    const handleIncoming = (data) => {
        const msg = JSON.parse(data);
        setLog(log => [...log, 'Empfangen: ' + JSON.stringify(msg)]);
        if (msg.type === 'chat') {
            setMessages(prev => [...prev, msg.data]);
        } else if (msg.type === 'examEndTime') {
            setExamEndTime(new Date(msg.data));
        } else if (msg.type === 'toiletOccupied') {
            setToiletOccupied(msg.data);
        } else if (msg.type === 'nickname') {
            setPeers(prev => [...new Set([...prev, msg.data, nickname])]);
        }
    };

    useEffect(() => {
        if (!examEndTime) return;
        const interval = setInterval(() => {
            const now = new Date();
            const diff = Math.max(0, examEndTime - now);
            setTimeLeft(diff);
        }, 1000);
        return () => clearInterval(interval);
    }, [examEndTime]);

    const handleSend = () => {
        if (messageInput.trim()) {
            const chatMessage = { user: nickname, text: messageInput };
            const msg = { type: 'chat', data: chatMessage };
            safeSend(msg);
            setMessages(prev => [...prev, chatMessage]);
            setMessageInput('');
        }
    };

    const handleSetDuration = () => {
        const minutes = parseInt(durationInput);
        if (!isNaN(minutes) && minutes > 0) {
            const end = new Date(Date.now() + minutes * 60000);
            setExamEndTime(end);
            safeSend({ type: 'examEndTime', data: end });
        }
    };

    const toggleToilet = () => {
        const newStatus = !toiletOccupied;
        setToiletOccupied(newStatus);
        safeSend({ type: 'toiletOccupied', data: newStatus });
    };

    const renderDashboard = () => (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
            <p>Status: <strong>{connected ? 'Verbunden ✅' : 'Nicht verbunden ⏳'}</strong></p>
            <p>Nickname: <strong>{nickname}</strong></p>
            <p>Raum: <strong>{room}</strong></p>
            <p>Teilnehmer im Raum: {peers.join(', ')}</p>
            <p>Toilette: {toiletOccupied ? 'Besetzt' : 'Frei'}</p>
            <button onClick={toggleToilet} className="mt-2 bg-yellow-500 text-white px-4 py-1 rounded">
                Toilette umschalten
            </button>

            <div className="mt-4">
                <label className="block mb-2">Klausur-Dauer (Minuten):</label>
                <input
                    type="number"
                    value={durationInput}
                    onChange={(e) => setDurationInput(e.target.value)}
                    className="border p-1 mr-2"
                />
                <button onClick={handleSetDuration} className="bg-purple-600 text-white px-4 py-1 rounded">
                    Setzen
                </button>
            </div>

            <p className="mt-2">
                Restzeit der Klausur: {
                timeLeft !== null
                    ? `${Math.floor(timeLeft / 3600000)}h ${Math.floor((timeLeft % 3600000) / 60000)}m ${Math.floor((timeLeft % 60000) / 1000)}s`
                    : 'nicht gesetzt'
            }
            </p>

            <button onClick={() => setShowChat(!showChat)} className="mt-4 bg-blue-500 text-white px-4 py-2 rounded">
                {showChat ? 'Chat ausblenden' : 'Chat einblenden'}
            </button>

            {showChat && (
                <div className="mt-4 border-t pt-4">
                    <h2 className="text-xl font-semibold">Dozenten-Chat</h2>
                    <div className="border h-40 overflow-y-scroll p-2 bg-gray-100">
                        {messages.map((msg, i) => (
                            <div key={i}><strong>{msg.user}:</strong> {msg.text}</div>
                        ))}
                    </div>
                    <input
                        className="border w-full mt-2 p-1"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Nachricht eingeben"
                    />
                    <button onClick={handleSend} className="mt-2 bg-green-500 text-white px-4 py-1 rounded">Senden</button>
                </div>
            )}

            <div className="mt-4 border-t pt-4 text-sm text-gray-500">
                <h2 className="text-md font-semibold">Verbindungsprotokoll</h2>
                <div className="border h-40 overflow-y-scroll p-2 bg-gray-100 whitespace-pre-wrap">
                    {log.map((entry, i) => <div key={i}>{entry}</div>)}
                </div>
            </div>
        </div>
    );

    if (!joined) {
        return (
            <div className="p-4">
                <h1 className="text-xl font-bold">Willkommen zur Prüfungsaufsicht</h1>
                <input
                    className="border p-2 my-2 w-full"
                    placeholder="Nickname wählen"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                />
                <input
                    className="border p-2 my-2 w-full"
                    placeholder="Raumname (Peer ID) eingeben"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                />
                <button
                    onClick={() => { setJoined(true); connectToRoom(); }}
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                >
                    Raum betreten / Peer verbinden
                </button>
            </div>
        );
    }

    return renderDashboard();
}