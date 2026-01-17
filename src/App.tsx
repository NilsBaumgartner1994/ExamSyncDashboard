// src/App.tsx
import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import {
    AppShell,
    SimpleGrid,
    Container,
    Title,
    Stack,
    Text,
    TextInput,
    Button,
    Divider,
    Loader,
    Center,
    Modal,
    Group,
} from '@mantine/core';
import QrScanner from 'qr-scanner';
import { TimerTile } from './components/TimerTile';
import { LinkTile } from './components/LinkTile';
import { StatusTile } from './components/StatusTile';
import { ChatTile, ChatMessage } from './components/ChatTile';
import { ProtocolTile } from './components/ProtocolTile';
import { ToiletTile } from './components/ToiletTile';
import { decodeRoomCode, encodeRoomId, normalizeRoomCode } from './utils/roomCode';

QrScanner.WORKER_PATH = new URL('qr-scanner/qr-scanner-worker.min.js', import.meta.url).toString();

function App() {
    const [nickname, setNickname] = useState('Anonym');
    const [roomIdInput, setRoomIdInput] = useState('');
    const [roomId, setRoomId] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [joined, setJoined] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('');
    const [toiletOccupants, setToiletOccupants] = useState<string[]>([]);
    const [examEnd, setExamEnd] = useState<Date | null>(null);
    const [tiles, setTiles] = useState<any>({});
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
    const [protocolEntries, setProtocolEntries] = useState<string[]>([]);
    const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [scanOpened, setScanOpened] = useState(false);
    const [scanError, setScanError] = useState('');
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const scannerRef = useRef<QrScanner | null>(null);

    const peerRef = useRef<Peer | null>(null);
    const connections = useRef<Record<string, Peer.DataConnection>>({});

    const broadcast = (type: string, data: any) => {
        const msg = JSON.stringify({ type, data });
        Object.values(connections.current).forEach((conn) => {
            if (conn.open) conn.send(msg);
        });
    };

    const addProtocolEntry = (message: string) => {
        const timestamp = new Date().toLocaleString('de-DE');
        setProtocolEntries((prev) => [...prev, `${timestamp} - ${message}`]);
    };

    const exportProtocol = () => {
        const content = protocolEntries.length > 0 ? protocolEntries.join('\n') : 'Keine Einträge vorhanden.';
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.href = url;
        link.download = `protokoll-${timestamp}.txt`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const extractRoomCode = (rawValue: string) => {
        try {
            const url = new URL(rawValue);
            const param = url.searchParams.get('roomId') ?? url.searchParams.get('peerId');
            if (param) return normalizeRoomCode(param);
        } catch (error) {
            // Not a URL, fall back to raw value.
        }
        return normalizeRoomCode(rawValue);
    };

    const stopScan = () => {
        scannerRef.current?.stop();
        scannerRef.current?.destroy();
        scannerRef.current = null;
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const connectToPeer = (peerId: string) => {
        if (peerRef.current && !connections.current[peerId]) {
            const conn = peerRef.current.connect(peerId);
            connections.current[peerId] = conn;
            setupConnection(conn);
        }
    };

    const handleJoin = (connectToCode?: string) => {
        const normalizedCode = connectToCode ? normalizeRoomCode(connectToCode) : '';
        const connectToId = normalizedCode ? decodeRoomCode(normalizedCode) : undefined;
        if (normalizedCode && !connectToId) {
            alert('Ungültiger Raum-Code. Bitte nur die erlaubten Buchstaben ohne O und I verwenden.');
            return;
        }
        const myPeerId = `${Date.now()}`;
        const peer = new Peer(myPeerId);
        peerRef.current = peer;

        if (connectToId) {
            setConnecting(true);
            setConnectionStatus(`Verbindung mit Raum-Code ${normalizedCode} wird aufgebaut...`);
            connectionTimeoutRef.current = setTimeout(() => {
                setConnecting(false);
                setConnectionStatus('');
                setRoomIdInput('');
                alert('Der Peer ist offline oder antwortet nicht.');
                peer.disconnect();
                peer.destroy();
                peerRef.current = null;
            }, 10000);
        }

        peer.on('open', (id) => {
            setRoomId(id);
            setRoomCode(encodeRoomId(id));
            if (!connectToId) {
                setJoined(true);
                window.history.replaceState({}, document.title, window.location.pathname);
            } else if (connectToId !== id) {
                connectToPeer(connectToId);
            }
        });

        peer.on('connection', (conn) => {
            setupConnection(conn);
            // Sobald sich jemand verbindet, senden wir die welcome-Nachricht
            conn.on('open', () => {
                conn.send(JSON.stringify({ type: 'welcome' }));
            });
        });
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get('roomId') ?? params.get('peerId');
        if (roomParam) {
            const normalized = normalizeRoomCode(roomParam);
            setRoomIdInput(normalized);
            handleJoin(normalized);
        }
    }, []);

    useEffect(() => {
        if (!scanOpened) {
            stopScan();
            return;
        }

        let isActive = true;

        const startScan = async () => {
            setScanError('');
            if (!videoRef.current) {
                setScanError('Videoelement konnte nicht gestartet werden.');
                return;
            }
            try {
                const hasCamera = await QrScanner.hasCamera();
                if (!hasCamera) {
                    setScanError('Keine Kamera verfügbar.');
                    return;
                }

                const scanner = new QrScanner(
                    videoRef.current,
                    (result) => {
                        if (!isActive) return;
                        const roomCode = extractRoomCode(result.data);
                        if (roomCode) {
                            stopScan();
                            setRoomIdInput(roomCode);
                            setScanOpened(false);
                            handleJoin(roomCode);
                            return;
                        }
                        setScanError('QR-Code enthält keine Raum-ID.');
                    },
                    {
                        preferredCamera: 'environment',
                        returnDetailedScanResult: true,
                    },
                );
                scannerRef.current = scanner;
                await scanner.start();
            } catch (error) {
                setScanError('Kamera konnte nicht gestartet werden.');
            }
        };

        startScan();

        return () => {
            isActive = false;
            stopScan();
        };
    }, [scanOpened]);

    const setupConnection = (conn: Peer.DataConnection) => {
        conn.on('open', () => {
            setConnectedPeers(Object.keys(connections.current));
            const myId = peerRef.current?.id;
            if (myId) {
                const allPeers = Object.keys(connections.current).concat(myId);
                conn.send(JSON.stringify({ type: 'known-peers', data: allPeers }));
            }
            broadcast('new-peer', conn.peer);
            broadcast('examEnd', examEnd);
            broadcast('tiles', tiles);
        });

        conn.on('data', (data) => {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'examEnd') setExamEnd(new Date(msg.data));
                if (msg.type === 'tiles') setTiles(msg.data);
                if (msg.type === 'chat') {
                    setMessages((prev) => [...prev, msg.data]);
                    addProtocolEntry(`Chat von ${msg.data.user}: ${msg.data.text}`);
                }

                if (msg.type === 'known-peers') {
                    const peerIds: string[] = msg.data;
                    peerIds.forEach((pid) => {
                        if (pid && pid !== peerRef.current?.id && !connections.current[pid]) {
                            connectToPeer(pid);
                        }
                    });
                }

                if (msg.type === 'new-peer') {
                    const newPeerId = msg.data;
                    if (newPeerId && newPeerId !== peerRef.current?.id && !connections.current[newPeerId]) {
                        connectToPeer(newPeerId);
                    }
                }

                if (msg.type === 'welcome') {
                    clearTimeout(connectionTimeoutRef.current!);
                    setConnecting(false);
                    setJoined(true);
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } catch (e) {
                console.warn('Fehler beim Parsen:', e);
            }
        });

        conn.on('close', () => {
            delete connections.current[conn.peer];
            setConnectedPeers(Object.keys(connections.current));
        });
    };

    if (connecting) {
        return (
            <Container size="xs" mt="xl">
                <Center>
                    <Stack align="center">
                        <Loader size="xl" />
                        <Text>{connectionStatus}</Text>
                        <Button
                            variant="light"
                            color="red"
                            onClick={() => {
                                clearTimeout(connectionTimeoutRef.current!);
                                setConnecting(false);
                                setConnectionStatus('');
                                setRoomIdInput('');
                                peerRef.current?.disconnect();
                                peerRef.current?.destroy();
                                peerRef.current = null;
                            }}
                        >
                            Verbindung abbrechen
                        </Button>
                    </Stack>
                </Center>
            </Container>
        );
    }

    if (!joined) {
        return (
            <Container size="xs" mt="xl">
                <Title order={2} mb="md">Prüfungsaufsichts-Dashboard</Title>
                <Stack>
                    <Divider my="sm" label="Raum beitreten" labelPosition="center" />

                    <TextInput
                        placeholder="Raum-Code eingeben"
                        value={roomIdInput}
                        onChange={(e) => setRoomIdInput(normalizeRoomCode(e.currentTarget.value))}
                    />
                    <Group grow>
                        <Button onClick={() => handleJoin(roomIdInput)}>Beitreten</Button>
                        <Button variant="light" onClick={() => setScanOpened(true)}>
                            QR-Code scannen
                        </Button>
                    </Group>

                    <Divider my="sm" label="Oder neuen Link erstellen" labelPosition="center" />
                    <Button onClick={() => handleJoin()}>Eigenen Link erstellen</Button>
                </Stack>
                <Modal
                    opened={scanOpened}
                    onClose={() => setScanOpened(false)}
                    title="QR-Code scannen"
                    centered
                >
                    <Stack>
                        <Text size="sm">Kamera auf den QR-Code mit dem Raum-Link richten.</Text>
                        <video
                            ref={videoRef}
                            style={{ width: '100%', borderRadius: 8 }}
                            muted
                            playsInline
                        />
                        {scanError && (
                            <Text size="sm" c="red">
                                {scanError}
                            </Text>
                        )}
                    </Stack>
                </Modal>
            </Container>
        );
    }

    return (
        <AppShell padding={{ base: 'md', sm: 'lg' }}>
            <SimpleGrid cols={{ base: 1, sm: 6 }} spacing="md">
                <LinkTile title="Mein Raum-Link" roomId={roomCode} />
                <ToiletTile
                    title="Toilette"
                    occupants={toiletOccupants}
                    onOccupy={(name) => {
                        setToiletOccupants((prev) => [...prev, name]);
                        addProtocolEntry(`Toilette besetzt (${name})`);
                    }}
                    onRelease={(name) => {
                        setToiletOccupants((prev) => {
                            const index = prev.indexOf(name);
                            if (index === -1) return prev;
                            const next = [...prev];
                            next.splice(index, 1);
                            return next;
                        });
                        addProtocolEntry(`Toilette frei (${name} zurück)`);
                    }}
                />
                <TimerTile
                    title="Klausurzeit"
                    endTime={examEnd}
                    onSetMinutes={(min) => {
                        const end = new Date(Date.now() + min * 60000);
                        setExamEnd(end);
                        broadcast('examEnd', end);
                    }}
                />
                <ChatTile
                    title="Dozenten-Chat"
                    messages={messages}
                    onSend={(msg) => {
                        setMessages((prev) => [...prev, msg]);
                        addProtocolEntry(`Chat von ${msg.user}: ${msg.text}`);
                        broadcast('chat', msg);
                    }}
                    nickname={nickname}
                    onNicknameChange={setNickname}
                />
                <ProtocolTile
                    title="Protokoll"
                    entries={protocolEntries}
                    onExport={exportProtocol}
                />
                <StatusTile
                    title="Verbindung"
                    peerId={peerRef.current?.id ? encodeRoomId(peerRef.current.id) : undefined}
                    connectedPeers={connectedPeers.map((peerId) => encodeRoomId(peerId))}
                />
            </SimpleGrid>
        </AppShell>
    );
}

export default App;
