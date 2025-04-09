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
} from '@mantine/core';
import { TileWrapper } from './components/TileWrapper';
import { BooleanTile } from './components/BooleanTile';
import { TimerTile } from './components/TimerTile';
import { LinkTile } from './components/LinkTile';
import { StatusTile } from './components/StatusTile';
import { ChatTile, ChatMessage } from './components/ChatTile';

function App() {
    const [nickname, setNickname] = useState('Anonym');
    const [roomIdInput, setRoomIdInput] = useState('');
    const [roomId, setRoomId] = useState('');
    const [joined, setJoined] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('');
    const [toilet, setToilet] = useState(false);
    const [examEnd, setExamEnd] = useState<Date | null>(null);
    const [tiles, setTiles] = useState<any>({});
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
    const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const peerRef = useRef<Peer | null>(null);
    const connections = useRef<Record<string, Peer.DataConnection>>({});

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const peerId = params.get('peerId');
        if (peerId) {
            setRoomIdInput(peerId);
        }
    }, []);

    const broadcast = (type: string, data: any) => {
        const msg = JSON.stringify({ type, data });
        Object.values(connections.current).forEach((conn) => {
            if (conn.open) conn.send(msg);
        });
    };

    const connectToPeer = (peerId: string) => {
        if (peerRef.current && !connections.current[peerId]) {
            const conn = peerRef.current.connect(peerId);
            connections.current[peerId] = conn;
            setupConnection(conn);
        }
    };

    const handleJoin = (connectToId?: string) => {
        const myPeerId = `${Date.now()}`;
        const peer = new Peer(myPeerId);
        peerRef.current = peer;

        if (connectToId) {
            setConnecting(true);
            setConnectionStatus(`Verbindung mit Peer ${connectToId} wird aufgebaut...`);
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

    const setupConnection = (conn: Peer.DataConnection) => {
        conn.on('open', () => {
            setConnectedPeers(Object.keys(connections.current));
            const myId = peerRef.current?.id;
            if (myId) {
                const allPeers = Object.keys(connections.current).concat(myId);
                conn.send(JSON.stringify({ type: 'known-peers', data: allPeers }));
            }
            broadcast('new-peer', conn.peer);
            broadcast('toilet', toilet);
            broadcast('examEnd', examEnd);
            broadcast('tiles', tiles);
        });

        conn.on('data', (data) => {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'toilet') setToilet(msg.data);
                if (msg.type === 'examEnd') setExamEnd(new Date(msg.data));
                if (msg.type === 'tiles') setTiles(msg.data);
                if (msg.type === 'chat') setMessages((prev) => [...prev, msg.data]);

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
                    <Text>Gib deinen Namen ein:</Text>
                    <TextInput value={nickname} onChange={(e) => setNickname(e.currentTarget.value)} />

                    <Divider my="sm" label="Raum beitreten" labelPosition="center" />

                    <TextInput
                        placeholder="Peer-ID eingeben"
                        value={roomIdInput}
                        onChange={(e) => setRoomIdInput(e.currentTarget.value)}
                    />
                    <Button onClick={() => handleJoin(roomIdInput)}>Beitreten</Button>

                    <Divider my="sm" label="Oder neuen Link erstellen" labelPosition="center" />
                    <Button onClick={() => handleJoin()}>Eigenen Link erstellen</Button>
                </Stack>
            </Container>
        );
    }

    return (
        <AppShell padding="md">
            <SimpleGrid cols={6} spacing="md">
                <LinkTile title="Mein Raum-Link" roomId={roomId} />
                <BooleanTile
                    title="Toilette"
                    value={toilet}
                    onToggle={() => {
                        const newVal = !toilet;
                        setToilet(newVal);
                        broadcast('toilet', newVal);
                    }}
                    onText="Toilette besetzt"
                    offText="Toilette frei"
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
                        broadcast('chat', msg);
                    }}
                    nickname={nickname}
                />
                <StatusTile
                    title="Verbindung"
                    peerId={peerRef.current?.id}
                    connectedPeers={connectedPeers}
                />
            </SimpleGrid>
        </AppShell>
    );
}

export default App;
