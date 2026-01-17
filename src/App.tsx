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
import { Scanner } from '@yudiel/react-qr-scanner';
import { TimerTile } from './components/TimerTile';
import { LinkTile } from './components/LinkTile';
import { StatusTile } from './components/StatusTile';
import { ChatTile, ChatMessage } from './components/ChatTile';
import { ProtocolTile } from './components/ProtocolTile';
import { ToiletTile } from './components/ToiletTile';
import { RoomStatus, RoomStatusTile } from './components/RoomStatusTile';
import { NotesTile } from './components/NotesTile';
import { TileWrapper } from './components/TileWrapper';
import { formatRoomIdForDisplay, normalizeRoomCode } from './utils/roomCode';

function App() {
    const [nickname, setNickname] = useState('Anonym');
    const [roomIdInput, setRoomIdInput] = useState('');
    const [roomId, setRoomId] = useState('');
    const [joined, setJoined] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('');
    const [toiletOccupants, setToiletOccupants] = useState<string[]>([]);
    const [roomStatuses, setRoomStatuses] = useState<RoomStatus[]>([]);
    const [examEnd, setExamEnd] = useState<Date | null>(null);
    const [tiles, setTiles] = useState<any>({});
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
    const [protocolEntries, setProtocolEntries] = useState<string[]>([]);
    const [notesText, setNotesText] = useState('');
    const [notesLockedBy, setNotesLockedBy] = useState<string | null>(null);
    const [notesLockedByName, setNotesLockedByName] = useState<string | null>(null);
    const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [scanOpened, setScanOpened] = useState(false);
    const [scanError, setScanError] = useState('');
    const [hiddenTiles, setHiddenTiles] = useState<Record<string, boolean>>({});

    const tileDefinitions = [
        { key: 'link', label: 'Mein Raum-Link' },
        { key: 'toilet', label: 'Toilette' },
        { key: 'room-status', label: 'Raum-Status' },
        { key: 'timer', label: 'Klausurzeit' },
        { key: 'chat', label: 'Dozenten-Chat' },
        { key: 'notes', label: 'Notizen' },
        { key: 'protocol', label: 'Protokoll' },
        { key: 'status', label: 'Verbindung' },
    ];

    const peerRef = useRef<Peer | null>(null);
    const connections = useRef<Record<string, Peer.DataConnection>>({});

    const broadcast = (type: string, data: any) => {
        const msg = JSON.stringify({ type, data });
        Object.values(connections.current).forEach((conn) => {
            if (conn.open) conn.send(msg);
        });
    };

    const addProtocolEntry = (card: string, message: string) => {
        const now = new Date();
        const date = now.toLocaleDateString('de-DE');
        const time = now.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
        });
        setProtocolEntries((prev) => [...prev, `${date} - ${time} [${card}]: ${message}`]);
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

    const connectToPeer = (peerId: string) => {
        if (peerRef.current && !connections.current[peerId]) {
            const conn = peerRef.current.connect(peerId);
            connections.current[peerId] = conn;
            setupConnection(conn);
        }
    };

    const sendNotesState = (conn?: Peer.DataConnection) => {
        const payload = {
            text: notesText,
            lockedBy: notesLockedBy,
            lockedByName: notesLockedByName,
        };
        if (conn) {
            conn.send(JSON.stringify({ type: 'notes-state', data: payload }));
        } else {
            broadcast('notes-state', payload);
        }
    };

    const broadcastRoomStatuses = (nextStatuses: RoomStatus[]) => {
        broadcast('room-status', nextStatuses);
    };

    const handleNotesLock = (force = false) => {
        const myId = peerRef.current?.id;
        if (!myId) return;
        if (notesLockedBy && notesLockedBy !== myId && !force) return;
        const displayName = nickname.trim() || 'Anonym';
        setNotesLockedBy(myId);
        setNotesLockedByName(displayName);
        sendNotesState();
    };

    const handleNotesSave = (nextText: string) => {
        const myId = peerRef.current?.id;
        if (!myId || notesLockedBy !== myId) return;
        const displayName = nickname.trim() || 'Anonym';
        setNotesText(nextText);
        setNotesLockedBy(null);
        setNotesLockedByName(null);
        sendNotesState();
        addProtocolEntry('Notizen', `Notizen gespeichert von ${displayName}`);
    };

    const handleJoin = (connectToCode?: string) => {
        const normalizedCode = connectToCode ? normalizeRoomCode(connectToCode) : '';
        const connectToId = normalizedCode || undefined;
        if (connectToCode) {
            setRoomIdInput(normalizedCode);
        }
        if (normalizedCode && !/^\d+$/.test(normalizedCode)) {
            alert('Ungültige Raum-ID. Bitte nur Ziffern verwenden.');
            return;
        }
        const myPeerId = `${Date.now()}`;
        const peer = new Peer(myPeerId);
        peerRef.current = peer;

        if (connectToId) {
            setConnecting(true);
            setConnectionStatus(
                `Verbindung mit Raum-ID ${formatRoomIdForDisplay(normalizedCode)} wird aufgebaut...`,
            );
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
        if (scanOpened) {
            setScanError('');
        }
    }, [scanOpened]);

    const handleScan = (detectedCodes: Array<{ rawValue: string }>) => {
        if (!detectedCodes.length) return;
        const roomCode = extractRoomCode(detectedCodes[0].rawValue);
        if (roomCode) {
            setRoomIdInput(roomCode);
            setScanOpened(false);
            handleJoin(roomCode);
            return;
        }
        setScanError('QR-Code enthält keine Raum-ID.');
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
            broadcast('examEnd', examEnd);
            broadcast('tiles', tiles);
            conn.send(JSON.stringify({ type: 'room-status', data: roomStatuses }));
            sendNotesState(conn);
        });

        conn.on('data', (data) => {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'examEnd') setExamEnd(new Date(msg.data));
                if (msg.type === 'tiles') setTiles(msg.data);
                if (msg.type === 'chat') {
                    setMessages((prev) => [...prev, msg.data]);
                    addProtocolEntry('Chat', `von ${msg.data.user}: ${msg.data.text}`);
                }
                if (msg.type === 'notes-state') {
                    setNotesText(msg.data.text ?? '');
                    setNotesLockedBy(msg.data.lockedBy ?? null);
                    setNotesLockedByName(msg.data.lockedByName ?? null);
                }
                if (msg.type === 'room-status') {
                    setRoomStatuses(Array.isArray(msg.data) ? msg.data : []);
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
                        inputMode="numeric"
                        pattern="[0-9]*"
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
                        {scanOpened && (
                            <Scanner
                                onScan={handleScan}
                                onError={() => setScanError('Kamera konnte nicht gestartet werden.')}
                                constraints={{ facingMode: 'environment' }}
                                formats={['qr_code']}
                                styles={{
                                    container: { width: '100%', borderRadius: 8, overflow: 'hidden' },
                                    video: { width: '100%' },
                                }}
                            />
                        )}
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

    const hideTile = (key: string) => {
        setHiddenTiles((prev) => ({ ...prev, [key]: true }));
    };

    const showTile = (key: string) => {
        setHiddenTiles((prev) => ({ ...prev, [key]: false }));
    };

    const showAllTiles = () => {
        const nextState = tileDefinitions.reduce<Record<string, boolean>>((acc, tile) => {
            acc[tile.key] = false;
            return acc;
        }, {});
        setHiddenTiles(nextState);
    };

    const hiddenTileList = tileDefinitions.filter((tile) => hiddenTiles[tile.key]);

    return (
        <AppShell padding={{ base: 'md', sm: 'lg' }}>
            <SimpleGrid cols={{ base: 1, sm: 6 }} spacing="md">
                {!hiddenTiles.link && (
                    <LinkTile
                        title="Mein Raum-Link"
                        roomId={roomId}
                        onClose={() => hideTile('link')}
                    />
                )}
                {!hiddenTiles.toilet && (
                    <ToiletTile
                        title="Toilette"
                        occupants={toiletOccupants}
                        onOccupy={(name) => {
                            setToiletOccupants((prev) => [...prev, name]);
                            addProtocolEntry('Toilette', `besetzt (${name})`);
                        }}
                        onRelease={(name) => {
                            setToiletOccupants((prev) => {
                                const index = prev.indexOf(name);
                                if (index === -1) return prev;
                                const next = [...prev];
                                next.splice(index, 1);
                                return next;
                            });
                            addProtocolEntry('Toilette', `frei (${name} zurück)`);
                        }}
                        onClose={() => hideTile('toilet')}
                    />
                )}
                {!hiddenTiles['room-status'] && (
                    <RoomStatusTile
                        title="Raum-Status"
                        rooms={roomStatuses}
                        onAddRoom={(name) => {
                            setRoomStatuses((prev) => {
                                if (prev.some((room) => room.name === name)) return prev;
                                const next = [...prev, { name, needsHelp: false }];
                                broadcastRoomStatuses(next);
                                return next;
                            });
                        }}
                        onToggleHelp={(name) => {
                            setRoomStatuses((prev) => {
                                const next = prev.map((room) =>
                                    room.name === name
                                        ? { ...room, needsHelp: !room.needsHelp }
                                        : room,
                                );
                                broadcastRoomStatuses(next);
                                return next;
                            });
                        }}
                        onClearHelp={(name) => {
                            setRoomStatuses((prev) => {
                                const next = prev.map((room) =>
                                    room.name === name
                                        ? { ...room, needsHelp: false }
                                        : room,
                                );
                                broadcastRoomStatuses(next);
                                return next;
                            });
                        }}
                        onRemoveRoom={(name) => {
                            setRoomStatuses((prev) => {
                                const next = prev.filter((room) => room.name !== name);
                                broadcastRoomStatuses(next);
                                return next;
                            });
                        }}
                        onClose={() => hideTile('room-status')}
                    />
                )}
                {!hiddenTiles.timer && (
                    <TimerTile
                        title="Klausurzeit"
                        endTime={examEnd}
                        onSetMinutes={(min) => {
                            const end = new Date(Date.now() + min * 60000);
                            setExamEnd(end);
                            broadcast('examEnd', end);
                        }}
                        onClose={() => hideTile('timer')}
                    />
                )}
                {!hiddenTiles.chat && (
                    <ChatTile
                        title="Dozenten-Chat"
                        messages={messages}
                        onSend={(msg) => {
                            setMessages((prev) => [...prev, msg]);
                            addProtocolEntry('Chat', `von ${msg.user}: ${msg.text}`);
                            broadcast('chat', msg);
                        }}
                        nickname={nickname}
                        onNicknameChange={setNickname}
                        onClose={() => hideTile('chat')}
                    />
                )}
                {!hiddenTiles.notes && (
                    <NotesTile
                        title="Notizen"
                        text={notesText}
                        lockedBy={notesLockedBy}
                        lockedByName={notesLockedByName}
                        myPeerId={peerRef.current?.id}
                        onRequestLock={() => handleNotesLock(false)}
                        onForceLock={() => handleNotesLock(true)}
                        onSave={handleNotesSave}
                        onClose={() => hideTile('notes')}
                    />
                )}
                {!hiddenTiles.protocol && (
                    <ProtocolTile
                        title="Protokoll"
                        entries={protocolEntries}
                        onExport={exportProtocol}
                        onClose={() => hideTile('protocol')}
                    />
                )}
                {!hiddenTiles.status && (
                    <StatusTile
                        title="Verbindung"
                        peerId={peerRef.current?.id}
                        connectedPeers={connectedPeers}
                        onClose={() => hideTile('status')}
                    />
                )}
                <TileWrapper title="Karten verwalten" defaultSpan={2}>
                    <Stack>
                        {hiddenTileList.length > 0 ? (
                            <>
                                <Text size="sm">Ausgeblendete Karten:</Text>
                                <Group gap="xs" wrap="wrap">
                                    {hiddenTileList.map((tile) => (
                                        <Button
                                            key={tile.key}
                                            size="xs"
                                            variant="light"
                                            onClick={() => showTile(tile.key)}
                                        >
                                            {tile.label}
                                        </Button>
                                    ))}
                                </Group>
                                <Button size="xs" variant="subtle" onClick={showAllTiles}>
                                    Alle Karten anzeigen
                                </Button>
                            </>
                        ) : (
                            <Text size="sm" c="dimmed">
                                Alle Karten sind sichtbar.
                            </Text>
                        )}
                    </Stack>
                </TileWrapper>
            </SimpleGrid>
        </AppShell>
    );
}

export default App;
