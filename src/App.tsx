// src/App.tsx
import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { AppShell, SimpleGrid, Container, Title, Stack, Text, TextInput, Button, Divider } from '@mantine/core';
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
    const [toilet, setToilet] = useState(false);
    const [examEnd, setExamEnd] = useState<Date | null>(null);
    const [tiles, setTiles] = useState<any>({});
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [connectedPeers, setConnectedPeers] = useState<string[]>([]);

    const peerRef = useRef<Peer | null>(null);
    const connections = useRef<Record<string, Peer.DataConnection>>({});
    const knownPeers = useRef<Set<string>>(new Set());

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlRoomId = params.get('roomId');
        if (urlRoomId) {
            setRoomId(urlRoomId);
            setRoomIdInput(urlRoomId);
        }
    }, []);

    const broadcast = (type: string, data: any) => {
        const msg = JSON.stringify({ type, data });
        Object.values(connections.current).forEach((conn) => {
            if (conn.open) conn.send(msg);
        });
    };

    const handleJoin = (customRoomId?: string) => {
        const peer = new Peer();
        peerRef.current = peer;

        peer.on('open', (id) => {
            const isHost = !customRoomId;
            const finalRoomId = isHost ? id : customRoomId;
            setRoomId(finalRoomId);
            setJoined(true);

            if (!isHost) {
                const conn = peer.connect(finalRoomId);
                connections.current[conn.peer] = conn;
                knownPeers.current.add(finalRoomId);
                setupConnection(conn);
            }

            window.history.replaceState({}, document.title, window.location.pathname);
        });

        peer.on('connection', (conn) => {
            connections.current[conn.peer] = conn;
            knownPeers.current.add(conn.peer);
            setupConnection(conn);
        });
    };

    const setupConnection = (conn: Peer.DataConnection) => {
        conn.on('open', () => {
            setConnectedPeers(Object.keys(connections.current));
            broadcast('toilet', toilet);
            broadcast('examEnd', examEnd);
            broadcast('tiles', tiles);

            // Teile allen bekannten Peers eigene Peer-ID mit
            const myId = peerRef.current?.id;
            if (myId) {
                conn.send(JSON.stringify({ type: 'peer-announce', data: myId }));
            }
        });

        conn.on('data', (data) => {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'toilet') setToilet(msg.data);
                if (msg.type === 'examEnd') setExamEnd(new Date(msg.data));
                if (msg.type === 'tiles') setTiles(msg.data);
                if (msg.type === 'chat') setMessages((prev) => [...prev, msg.data]);

                if (msg.type === 'peer-announce') {
                    const newPeerId = msg.data;
                    const myId = peerRef.current?.id;
                    if (newPeerId && newPeerId !== myId && !connections.current[newPeerId]) {
                        if (!knownPeers.current.has(newPeerId)) {
                            knownPeers.current.add(newPeerId);
                            const conn = peerRef.current?.connect(newPeerId);
                            if (conn) {
                                connections.current[newPeerId] = conn;
                                setupConnection(conn);
                            }
                        }
                    }
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

    if (!joined) {
        const hasRoomFromUrl = !!roomId;
        return (
            <Container size="xs" mt="xl">
                <Title order={2} mb="md">Prüfungsaufsichts-Dashboard</Title>
                <Stack>
                    <Text>Gib deinen Namen ein:</Text>
                    <TextInput value={nickname} onChange={(e) => setNickname(e.currentTarget.value)} />

                    <Divider my="sm" label="Raum beitreten" labelPosition="center" />

                    {hasRoomFromUrl ? (
                        <Button onClick={() => handleJoin(roomId)}>Raum beitreten</Button>
                    ) : (
                        <>
                            <TextInput
                                placeholder="Raum-ID eingeben"
                                value={roomIdInput}
                                onChange={(e) => setRoomIdInput(e.currentTarget.value)}
                            />
                            <Button onClick={() => handleJoin(roomIdInput)}>Raum beitreten</Button>
                        </>
                    )}

                    {!hasRoomFromUrl && (
                        <>
                            <Divider my="sm" label="Oder neuen Raum erstellen" labelPosition="center" />
                            <Button onClick={() => handleJoin()}>Neuen Raum erstellen</Button>
                        </>
                    )}
                </Stack>
            </Container>
        );
    }

    return (
        <AppShell padding="md">
            <SimpleGrid cols={6} spacing="md">
                <LinkTile title="Raum-Link" roomId={roomId} />
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
