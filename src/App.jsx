import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import {
    AppShell, Button, Container, Group, Input, Stack, Text, TextInput, Title,
    Paper, ScrollArea, Badge, Card, SimpleGrid
} from '@mantine/core';
import { useNotifications, showNotification } from '@mantine/notifications';

function useEffectOnce(effect) {
    useEffect(effect, []);
}


export default function App() {
    const [nickname, setNickname] = useState('Anonym');
    const [joined, setJoined] = useState(false);
    const [room, setRoom] = useState('');
    const [examEndTime, setExamEndTime] = useState(null);
    const [toiletOccupied, setToiletOccupied] = useState(false);
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [timeLeft, setTimeLeft] = useState(null);
    const [peers, setPeers] = useState([]);
    const [durationInput, setDurationInput] = useState('');
    const [connected, setConnected] = useState(false);
    const [tiles, setTiles] = useState([]);
    const [tileInput, setTileInput] = useState('');

    const peerRef = useRef();
    const connRef = useRef();

    useEffectOnce(() => {
        const params = new URLSearchParams(window.location.search);
        const idFromUrl = params.get('roomId');
        if (idFromUrl) {
            setRoom(idFromUrl);
        }
    });

    const safeSend = (data) => {
        if (connRef.current && connRef.current.open) {
            connRef.current.send(JSON.stringify(data));
        }
    };

    const broadcastPresence = () => {
        safeSend({ type: 'nickname', data: nickname });
        safeSend({ type: 'examEndTime', data: examEndTime });
        safeSend({ type: 'toiletOccupied', data: toiletOccupied });
        safeSend({ type: 'tiles', data: tiles });
    };

    const connectToRoom = () => {
        const peer = new Peer();
        peerRef.current = peer;

        peer.on('open', (id) => {
            if (!room) {
                setRoom(id);
                setJoined(true);
                showNotification({
                    title: 'Neuer Raum erstellt',
                    message: `Raum-ID: ${id}`,
                    color: 'green'
                });
            } else {
                const conn = peer.connect(room);
                connRef.current = conn;
                conn.on('open', () => {
                    setConnected(true);
                    broadcastPresence();
                });
                conn.on('data', handleIncoming);
                setJoined(true);
            }

            // Entferne roomId aus URL
            window.history.replaceState({}, document.title, window.location.pathname);
        });

        peer.on('connection', (conn) => {
            connRef.current = conn;
            conn.on('open', () => {
                setConnected(true);
                broadcastPresence();
            });
            conn.on('data', handleIncoming);
        });
    };

    const handleIncoming = (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'chat') {
            setMessages(prev => [...prev, msg.data]);
        } else if (msg.type === 'examEndTime') {
            setExamEndTime(new Date(msg.data));
        } else if (msg.type === 'toiletOccupied') {
            setToiletOccupied(msg.data);
        } else if (msg.type === 'nickname') {
            setPeers(prev => [...new Set([...prev, msg.data, nickname])]);
        } else if (msg.type === 'tiles') {
            setTiles(msg.data);
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
            safeSend({ type: 'chat', data: chatMessage });
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

    const addTile = () => {
        if (tileInput.trim()) {
            const newTiles = [...tiles, { text: tileInput }];
            setTiles(newTiles);
            setTileInput('');
            safeSend({ type: 'tiles', data: newTiles });
        }
    };

    if (!joined) {
        return (
            <Container size="xs" mt="xl">
                <Title order={2} mb="md">Willkommen zur Prüfungsaufsicht</Title>
                <Stack>
                    <TextInput label="Nickname" value={nickname} onChange={(e) => setNickname(e.currentTarget.value)} />
                    <TextInput label="Raum-ID (leer lassen zum Erstellen)" value={room} onChange={(e) => setRoom(e.currentTarget.value)} />
                    <Button onClick={connectToRoom}>Raum beitreten oder erstellen</Button>
                </Stack>
            </Container>
        );
    }

    return (
        <AppShell padding="md">
            <Container>
                <Title order={2}>Aufsichts-Dashboard</Title>
                <Text>Nickname: <Badge>{nickname}</Badge></Text>
                <Text>Raum: <Badge color="green">{room}</Badge></Text>
                <Text>Status: {connected ? '✅ Verbunden' : '⏳ Verbindung wird aufgebaut...'}</Text>
                <Text>Teilnehmer: {peers.join(', ')}</Text>

                <Group mt="md">
                    <Button onClick={toggleToilet} color="yellow">
                        Toilette {toiletOccupied ? 'freigeben' : 'besetzen'}
                    </Button>
                    <Input
                        type="number"
                        placeholder="Dauer in Minuten"
                        value={durationInput}
                        onChange={(e) => setDurationInput(e.target.value)}
                    />
                    <Button onClick={handleSetDuration} color="violet">Klausurzeit setzen</Button>
                </Group>

                {timeLeft !== null && (
                    <Text mt="sm">
                        Verbleibende Zeit: {`${Math.floor(timeLeft / 60000)}m ${Math.floor((timeLeft % 60000) / 1000)}s`}
                    </Text>
                )}

                <Paper shadow="xs" p="md" mt="lg">
                    <Title order={4}>Kacheln</Title>
                    <Group mt="sm">
                        <TextInput
                            placeholder="Neue Kachel"
                            value={tileInput}
                            onChange={(e) => setTileInput(e.currentTarget.value)}
                        />
                        <Button onClick={addTile}>Hinzufügen</Button>
                    </Group>
                    <SimpleGrid cols={3} spacing="md" mt="md">
                        {tiles.map((tile, idx) => (
                            <Card key={idx} shadow="sm" padding="lg" radius="md" withBorder>
                                <Text align="center">{tile.text}</Text>
                            </Card>
                        ))}

                        {room && (
                            <Card
                                onClick={() => window.open(`${window.location.origin}?roomId=${room}`, '_blank')}
                                shadow="sm" padding="lg" radius="md" withBorder
                                style={{ cursor: 'pointer' }}
                            >
                                <Text align="center" style={{ fontWeight: 'bold' }}>Raum-Link: ***</Text>
                            </Card>
                        )}
                    </SimpleGrid>
                </Paper>

                <Paper shadow="xs" p="md" mt="lg">
                    <Title order={4}>Chat</Title>
                    <ScrollArea h={150} mb="sm">
                        {messages.map((msg, i) => (
                            <Text key={i}><strong>{msg.user}:</strong> {msg.text}</Text>
                        ))}
                    </ScrollArea>
                    <Group>
                        <TextInput
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.currentTarget.value)}
                            placeholder="Nachricht eingeben"
                            style={{ flex: 1 }}
                        />
                        <Button onClick={handleSend}>Senden</Button>
                    </Group>
                </Paper>
            </Container>
        </AppShell>
    );
}
