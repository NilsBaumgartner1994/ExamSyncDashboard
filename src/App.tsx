// src/App.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import SimplePeer from 'simple-peer';
import QRCode from 'qrcode';
import pako from 'pako';
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
    Card,
    Textarea,
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
    const [toiletBlocked, setToiletBlocked] = useState(false);
    const [roomStatuses, setRoomStatuses] = useState<RoomStatus[]>([]);
    const [examEnd, setExamEnd] = useState<Date | null>(null);
    const [examWarningMinutes, setExamWarningMinutes] = useState(5);
    const [tiles, setTiles] = useState<any>({});
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
    const [protocolEntries, setProtocolEntries] = useState<string[]>([]);
    const [notesText, setNotesText] = useState('');
    const [notesLockedBy, setNotesLockedBy] = useState<string | null>(null);
    const [notesLockedByName, setNotesLockedByName] = useState<string | null>(null);
    const [isHost, setIsHost] = useState(false);
    const [hostPeerId, setHostPeerId] = useState<string | null>(null);
    const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [scanOpened, setScanOpened] = useState(false);
    const [scanError, setScanError] = useState('');
    const [hiddenTiles, setHiddenTiles] = useState<Record<string, boolean>>({});
    const [createRoomDebug, setCreateRoomDebug] = useState('Debug: bereit.');
    const [createRoomError, setCreateRoomError] = useState('');
    const [lastConnectedHost, setLastConnectedHost] = useState<string | null>(null);
    const [lastConnectedHosts, setLastConnectedHosts] = useState<string[]>([]);
    const [lastHostStatus, setLastHostStatus] = useState<'idle' | 'checking' | 'reachable' | 'unreachable'>(
        'idle',
    );
    const initialRoomParamRef = useRef<string | null>(null);
    const createRoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const recentHostsLimit = 5;
    const [showDebugProtocol, setShowDebugProtocol] = useState(false);
    const [lastHostsLoaded, setLastHostsLoaded] = useState(false);
    const [lastHostsLogged, setLastHostsLogged] = useState(false);
    const [p2pStatus, setP2pStatus] = useState('Bereit.');
    const [p2pError, setP2pError] = useState('');
    const [p2pLocalSignal, setP2pLocalSignal] = useState('');
    const [p2pRemoteSignal, setP2pRemoteSignal] = useState('');
    const [p2pQrCode, setP2pQrCode] = useState('');
    const [p2pScanOpened, setP2pScanOpened] = useState(false);
    const [p2pSignalCopied, setP2pSignalCopied] = useState(false);
    const [p2pConnected, setP2pConnected] = useState(false);
    const [p2pChatInput, setP2pChatInput] = useState('');
    const [p2pChatMessages, setP2pChatMessages] = useState<
        Array<{ id: string; user: string; text: string }>
    >([]);
    const [authScreen, setAuthScreen] = useState<'join' | 'experimental'>('join');
    const [p2pRole, setP2pRole] = useState<'host' | 'client' | null>(null);
    const p2pPeerRef = useRef<SimplePeer.Instance | null>(null);
    const p2pCopyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    const sendToHost = (type: string, data: any) => {
        if (!hostPeerId) return;
        const payload = JSON.stringify({ type, data });
        const conn = connections.current[hostPeerId];
        if (conn?.open) {
            conn.send(payload);
            addProtocolEntry('Debug', `Sende Host-Anfrage: ${type}`);
            return;
        }
        addProtocolEntry('Debug', `Host-Verbindung nicht bereit für ${type}.`);
        if (conn && !conn.open) {
            delete connections.current[hostPeerId];
        }
        if (peerRef.current) {
            const reconnect = peerRef.current.connect(hostPeerId);
            connections.current[hostPeerId] = reconnect;
            setupConnection(reconnect);
            reconnect.once('open', () => {
                reconnect.send(payload);
                addProtocolEntry('Debug', `Sende Host-Anfrage nach Verbindungsaufbau: ${type}`);
            });
        }
    };

    const addProtocolEntry = useCallback((card: string, message: string) => {
        const now = new Date();
        const date = now.toLocaleDateString('de-DE');
        const time = now.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
        });
        setProtocolEntries((prev) => [...prev, `${date} - ${time} [${card}]: ${message}`]);
    }, []);

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

    const rememberLastHost = (peerId: string) => {
        const normalized = normalizeRoomCode(peerId);
        setLastConnectedHosts((prev) => {
            const next = [normalized, ...prev.filter((id) => id !== normalized)].slice(0, recentHostsLimit);
            localStorage.setItem('lastConnectedHosts', JSON.stringify(next));
            const [mostRecent] = next;
            if (mostRecent) {
                localStorage.setItem('lastConnectedHost', mostRecent);
            }
            setLastConnectedHost(mostRecent ?? null);
            return next;
        });
    };

    const clearCreateRoomTimeout = () => {
        if (createRoomTimeoutRef.current) {
            clearTimeout(createRoomTimeoutRef.current);
            createRoomTimeoutRef.current = null;
        }
    };

    const connectToPeer = (peerId: string) => {
        if (peerRef.current && !connections.current[peerId]) {
            const conn = peerRef.current.connect(peerId);
            connections.current[peerId] = conn;
            setupConnection(conn);
        }
    };

    const resetExperimentalState = () => {
        p2pPeerRef.current?.destroy();
        p2pPeerRef.current = null;
        setP2pStatus('Bereit.');
        setP2pError('');
        setP2pLocalSignal('');
        setP2pRemoteSignal('');
        setP2pQrCode('');
        setP2pSignalCopied(false);
        setP2pConnected(false);
        setP2pChatInput('');
        setP2pChatMessages([]);
        if (p2pCopyTimeoutRef.current) {
            clearTimeout(p2pCopyTimeoutRef.current);
            p2pCopyTimeoutRef.current = null;
        }
    };

    const encodeP2pSignal = (rawSignal: string) => {
        const encoder = new TextEncoder();
        const encoded = encoder.encode(rawSignal);
        const compressed = pako.gzip(encoded);
        const binary = String.fromCharCode(...compressed);
        return `gz:${btoa(binary)}`;
    };

    const decodeP2pSignal = (rawSignal: string) => {
        if (!rawSignal.startsWith('gz:')) {
            return rawSignal;
        }
        const base64 = rawSignal.slice(3);
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        const decompressed = pako.ungzip(bytes);
        const decoder = new TextDecoder();
        return decoder.decode(decompressed);
    };

    const handleSelectExperimentalRole = (role: 'host' | 'client') => {
        resetExperimentalState();
        setP2pRole(role);
    };

    const ensureExperimentalPeer = (initiator: boolean) => {
        if (p2pPeerRef.current) {
            return;
        }
        const peer = new SimplePeer({ initiator, trickle: false });
        p2pPeerRef.current = peer;
        setP2pStatus(initiator ? 'Angebot wird erstellt…' : 'Warte auf Angebot…');
        peer.on('signal', (data) => {
            const payload = JSON.stringify(data);
            try {
                const encoded = encodeP2pSignal(payload);
                setP2pLocalSignal(encoded);
                setP2pStatus(initiator ? 'Angebot bereit.' : 'Antwort bereit.');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
                setP2pError(`Signal konnte nicht komprimiert werden: ${message}`);
            }
        });
        peer.on('connect', () => {
            setP2pStatus('Peer-to-Peer verbunden.');
            setP2pConnected(true);
            setP2pChatMessages((prev) => [
                ...prev,
                {
                    id: `${Date.now()}-connected`,
                    user: 'Debug',
                    text: 'Datenkanal geöffnet.',
                },
            ]);
        });
        peer.on('close', () => {
            setP2pStatus('Verbindung geschlossen.');
            setP2pConnected(false);
        });
        peer.on('error', (error) => {
            setP2pError(`Peer-Fehler: ${error.message}`);
        });
        peer.on('data', (data) => {
            try {
                const payload = JSON.parse(String(data));
                if (payload?.type === 'chat') {
                    setP2pChatMessages((prev) => [
                        ...prev,
                        {
                            id: `${Date.now()}-remote`,
                            user: 'Gegenüber',
                            text: String(payload.text ?? ''),
                        },
                    ]);
                }
            } catch (error) {
                setP2pChatMessages((prev) => [
                    ...prev,
                    {
                        id: `${Date.now()}-remote-raw`,
                        user: 'Debug',
                        text: `Unlesbare Daten empfangen: ${String(data).slice(0, 200)}`,
                    },
                ]);
            }
        });
    };

    const applyExperimentalSignal = (rawSignal: string) => {
        if (!rawSignal.trim()) return;
        try {
            const decoded = decodeP2pSignal(rawSignal.trim());
            const parsed = JSON.parse(decoded);
            if (!p2pPeerRef.current) {
                ensureExperimentalPeer(false);
            }
            p2pPeerRef.current?.signal(parsed);
            setP2pStatus('Signal verarbeitet.');
            setP2pError('');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
            setP2pError(`Signal konnte nicht gelesen werden: ${message}`);
        }
    };

    useEffect(() => {
        if (!p2pLocalSignal) {
            setP2pQrCode('');
            return;
        }
        setP2pSignalCopied(false);
        if (p2pCopyTimeoutRef.current) {
            clearTimeout(p2pCopyTimeoutRef.current);
            p2pCopyTimeoutRef.current = null;
        }
        QRCode.toDataURL(p2pLocalSignal, { margin: 2, width: 320 })
            .then((url) => setP2pQrCode(url))
            .catch((error) => {
                setP2pError(`QR-Code konnte nicht erstellt werden: ${error instanceof Error ? error.message : 'Fehler'}`);
            });
    }, [p2pLocalSignal]);

    const handleCopyP2pSignal = async () => {
        if (!p2pLocalSignal) return;
        if (!navigator.clipboard?.writeText) {
            setP2pError('Kopieren ist in diesem Browser nicht verfügbar.');
            return;
        }
        try {
            await navigator.clipboard.writeText(p2pLocalSignal);
            setP2pSignalCopied(true);
            if (p2pCopyTimeoutRef.current) {
                clearTimeout(p2pCopyTimeoutRef.current);
            }
            p2pCopyTimeoutRef.current = setTimeout(() => {
                setP2pSignalCopied(false);
                p2pCopyTimeoutRef.current = null;
            }, 2000);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
            setP2pError(`Signal konnte nicht kopiert werden: ${message}`);
        }
    };

    const sendNotesState = (conn?: Peer.DataConnection) => {
        if (!isHost) return;
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
        if (!isHost) return;
        broadcast('room-status', nextStatuses);
        addProtocolEntry('Debug', `Status gesendet: room-status (${nextStatuses.length})`);
    };

    const applyRoomAdd = (name: string) => {
        setRoomStatuses((prev) => {
            if (prev.some((room) => room.name === name)) return prev;
            const next = [...prev, { name, needsHelp: false, isResolved: false }];
            broadcastRoomStatuses(next);
            addProtocolEntry('Raum-Status', `Raum ${name} hinzugefügt`);
            return next;
        });
    };

    const applyRoomToggleHelp = (name: string) => {
        setRoomStatuses((prev) => {
            const target = prev.find((room) => room.name === name);
            if (!target) return prev;
            const nextNeedsHelp = !target.needsHelp;
            const next = prev.map((room) =>
                room.name === name
                    ? { ...room, needsHelp: nextNeedsHelp, isResolved: false }
                    : room,
            );
            broadcastRoomStatuses(next);
            addProtocolEntry(
                'Raum-Status',
                `${name}: ${nextNeedsHelp ? 'Hilfe angefordert' : 'Hilfe zurückgenommen'}`,
            );
            return next;
        });
    };

    const applyRoomClearHelp = (name: string) => {
        setRoomStatuses((prev) => {
            const target = prev.find((room) => room.name === name);
            if (!target) return prev;
            const next = prev.map((room) =>
                room.name === name
                    ? { ...room, needsHelp: false, isResolved: true }
                    : room,
            );
            broadcastRoomStatuses(next);
            addProtocolEntry('Raum-Status', `${name}: Hilfe erledigt`);
            return next;
        });
    };

    const applyRoomReset = (name: string) => {
        setRoomStatuses((prev) => {
            const target = prev.find((room) => room.name === name);
            if (!target) return prev;
            const next = prev.map((room) =>
                room.name === name
                    ? { ...room, needsHelp: false, isResolved: false }
                    : room,
            );
            broadcastRoomStatuses(next);
            addProtocolEntry('Raum-Status', `${name}: Status zurückgesetzt`);
            return next;
        });
    };

    const applyRoomRemove = (name: string) => {
        setRoomStatuses((prev) => {
            const target = prev.find((room) => room.name === name);
            if (!target) return prev;
            const next = prev.filter((room) => room.name !== name);
            broadcastRoomStatuses(next);
            addProtocolEntry('Raum-Status', `Raum ${name} entfernt`);
            return next;
        });
    };

    const handleNotesLock = (force = false) => {
        const myId = peerRef.current?.id;
        if (!myId) return;
        const displayName = nickname.trim() || 'Anonym';
        if (isHost) {
            if (notesLockedBy && notesLockedBy !== myId && !force) return;
            setNotesLockedBy(myId);
            setNotesLockedByName(displayName);
            sendNotesState();
            return;
        }
        sendToHost('notes-lock-request', { force, name: displayName });
    };

    const handleNotesSave = (nextText: string) => {
        const myId = peerRef.current?.id;
        if (!myId) return;
        const displayName = nickname.trim() || 'Anonym';
        if (isHost) {
            if (notesLockedBy !== myId) return;
            setNotesText(nextText);
            setNotesLockedBy(null);
            setNotesLockedByName(null);
            sendNotesState();
            addProtocolEntry('Notizen', `Notizen gespeichert von ${displayName}`);
            return;
        }
        sendToHost('notes-save-request', { text: nextText, name: displayName });
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
        clearCreateRoomTimeout();
        if (!connectToId) {
            setCreateRoomDebug('Debug: Raum-Erstellung gestartet. Warte auf Peer-ID...');
            setCreateRoomError('');
            setIsHost(true);
            setHostPeerId(null);
        } else {
            setIsHost(false);
            setHostPeerId(connectToId);
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
        } else {
            createRoomTimeoutRef.current = setTimeout(() => {
                setCreateRoomDebug('Debug: Raum-Erstellung dauert zu lange.');
                setCreateRoomError('Timeout beim Erstellen des Raums.');
                peer.disconnect();
                peer.destroy();
                peerRef.current = null;
            }, 10000);
        }

        peer.on('open', (id) => {
            setRoomId(id);
            if (!connectToId) {
                setJoined(true);
                clearCreateRoomTimeout();
                setCreateRoomDebug(
                    `Debug: Raum erstellt (ID ${formatRoomIdForDisplay(id)}).`,
                );
                setHostPeerId(id);
                window.history.replaceState({}, document.title, window.location.pathname);
            } else if (connectToId !== id) {
                connectToPeer(connectToId);
            }
        });
        peer.on('error', (err) => {
            if (!connectToId) {
                const errorMessage =
                    (err as { message?: string; type?: string }).message ??
                    (err as { message?: string; type?: string }).type ??
                    'Unbekannter Fehler';
                clearCreateRoomTimeout();
                setCreateRoomDebug('Debug: Raum-Erstellung fehlgeschlagen.');
                setCreateRoomError(errorMessage);
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
            initialRoomParamRef.current = normalized;
            setRoomIdInput(normalized);
            handleJoin(normalized);
            return;
        }
        initialRoomParamRef.current = null;
    }, []);

    useEffect(() => {
        const storedList = localStorage.getItem('lastConnectedHosts');
        const normalizeList = (list: Array<string | null | undefined>) =>
            Array.from(
                new Set(list.map((item) => normalizeRoomCode(String(item ?? ''))).filter(Boolean)),
            );
        let normalized: string[] = [];

        if (storedList) {
            try {
                const parsed = JSON.parse(storedList);
                if (Array.isArray(parsed)) {
                    normalized = normalizeList(parsed.map((item) => String(item)));
                }
            } catch (error) {
                // ignore invalid storage
            }
        }

        if (normalized.length === 0) {
            const stored = localStorage.getItem('lastConnectedHost');
            if (stored) {
                normalized = normalizeList([stored]);
            }
        }

        if (normalized.length > 0) {
            setLastConnectedHosts(normalized);
            setLastConnectedHost(normalized[0] ?? null);
        }
        setLastHostsLoaded(true);
    }, []);

    useEffect(() => {
        if (!joined || !lastHostsLoaded || lastHostsLogged) return;
        setLastHostsLogged(true);
        if (lastConnectedHosts.length > 0) {
            addProtocolEntry(
                'Login',
                `Zuletzt beigetretene Räume (lokaler Speicher): ${lastConnectedHosts.join(', ')}`,
            );
            return;
        }
        addProtocolEntry('Login', 'Keine zuletzt beigetretenen Räume im lokalen Speicher gefunden.');
    }, [addProtocolEntry, joined, lastConnectedHosts, lastHostsLoaded, lastHostsLogged]);

    useEffect(() => {
        if (scanOpened) {
            setScanError('');
        }
    }, [scanOpened]);

    useEffect(() => {
        if (!lastConnectedHost) {
            setLastHostStatus('idle');
            return;
        }
        let cancelled = false;
        setLastHostStatus('checking');
        const probePeer = new Peer(`${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const cleanup = () => {
            probePeer.disconnect();
            probePeer.destroy();
        };
        const timeoutId = setTimeout(() => {
            if (!cancelled) {
                setLastHostStatus('unreachable');
            }
            cleanup();
        }, 5000);

        probePeer.on('open', () => {
            const conn = probePeer.connect(lastConnectedHost);
            conn.on('open', () => {
                if (!cancelled) {
                    setLastHostStatus('reachable');
                }
                clearTimeout(timeoutId);
                conn.close();
                cleanup();
            });
            conn.on('error', () => {
                if (!cancelled) {
                    setLastHostStatus('unreachable');
                }
                clearTimeout(timeoutId);
                cleanup();
            });
        });

        probePeer.on('error', () => {
            if (!cancelled) {
                setLastHostStatus('unreachable');
            }
            clearTimeout(timeoutId);
            cleanup();
        });

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
            cleanup();
        };
    }, [lastConnectedHost]);

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
            if (!connections.current[conn.peer]) {
                connections.current[conn.peer] = conn;
            }
            setConnectedPeers(Object.keys(connections.current));
            if (isHost) {
                addProtocolEntry('Verbindung', `Teilnehmer ${conn.peer} beigetreten`);
            }
            if (!isHost && hostPeerId && conn.peer === hostPeerId) {
                rememberLastHost(hostPeerId);
            }
            if (isHost) {
                broadcast('examEnd', examEnd);
                broadcast('examWarningMinutes', examWarningMinutes);
                broadcast('tiles', tiles);
                conn.send(JSON.stringify({ type: 'toilet-blocked', data: toiletBlocked }));
                conn.send(JSON.stringify({ type: 'toilet-occupants', data: toiletOccupants }));
                conn.send(JSON.stringify({ type: 'room-status', data: roomStatuses }));
                sendNotesState(conn);
            } else if (hostPeerId && conn.peer === hostPeerId) {
                conn.send(JSON.stringify({ type: 'room-status-request' }));
            }
        });

        conn.on('data', (data) => {
            try {
                const msg = JSON.parse(data);
                const isAuthoritative =
                    isHost || (hostPeerId && conn.peer === hostPeerId);
                if (!isAuthoritative) {
                    return;
                }
                if (msg.type === 'examEnd') setExamEnd(new Date(msg.data));
                if (msg.type === 'examWarningMinutes') setExamWarningMinutes(Number(msg.data));
                if (msg.type === 'tiles') setTiles(msg.data);
                if (msg.type === 'toilet-blocked') setToiletBlocked(Boolean(msg.data));
                if (msg.type === 'toilet-occupants') {
                    setToiletOccupants(Array.isArray(msg.data) ? msg.data : []);
                }
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
                if (msg.type === 'room-status-request' && isHost) {
                    conn.send(JSON.stringify({ type: 'room-status', data: roomStatuses }));
                }
                if (msg.type === 'room-status-add-request' && isHost) {
                    const name = String(msg.data ?? '');
                    if (!name) return;
                    applyRoomAdd(name);
                }
                if (msg.type === 'room-status-toggle-help-request' && isHost) {
                    const name = String(msg.data ?? '');
                    if (!name) return;
                    applyRoomToggleHelp(name);
                }
                if (msg.type === 'room-status-clear-help-request' && isHost) {
                    const name = String(msg.data ?? '');
                    if (!name) return;
                    applyRoomClearHelp(name);
                }
                if (msg.type === 'room-status-reset-request' && isHost) {
                    const name = String(msg.data ?? '');
                    if (!name) return;
                    applyRoomReset(name);
                }
                if (msg.type === 'room-status-remove-request' && isHost) {
                    const name = String(msg.data ?? '');
                    if (!name) return;
                    applyRoomRemove(name);
                }
                if (msg.type === 'toilet-blocked-request' && isHost) {
                    const next = Boolean(msg.data);
                    setToiletBlocked(next);
                    broadcast('toilet-blocked', next);
                    addProtocolEntry('Debug', `Status gesendet: toilet-blocked (${next ? 'gesperrt' : 'frei'})`);
                }
                if (msg.type === 'toilet-occupy-request' && isHost) {
                    const name = String(msg.data ?? '');
                    if (!name) return;
                    setToiletOccupants((prev) => {
                        if (prev.includes(name)) return prev;
                        const next = [...prev, name];
                        broadcast('toilet-occupants', next);
                        addProtocolEntry('Debug', `Status gesendet: toilet-occupants (+${name})`);
                        return next;
                    });
                    addProtocolEntry('Toilette', `besetzt (${name})`);
                }
                if (msg.type === 'toilet-release-request' && isHost) {
                    const name = String(msg.data ?? '');
                    if (!name) return;
                    setToiletOccupants((prev) => {
                        const index = prev.indexOf(name);
                        if (index === -1) return prev;
                        const next = [...prev];
                        next.splice(index, 1);
                        broadcast('toilet-occupants', next);
                        addProtocolEntry('Debug', `Status gesendet: toilet-occupants (-${name})`);
                        return next;
                    });
                    addProtocolEntry('Toilette', `frei (${name} zurück)`);
                }
                if (msg.type === 'chat-request' && isHost) {
                    setMessages((prev) => [...prev, msg.data]);
                    addProtocolEntry('Chat', `von ${msg.data.user}: ${msg.data.text}`);
                    broadcast('chat', msg.data);
                }
                if (msg.type === 'exam-end-request' && isHost) {
                    const next = new Date(msg.data);
                    setExamEnd(next);
                    broadcast('examEnd', next);
                }
                if (msg.type === 'exam-warning-request' && isHost) {
                    const next = Number(msg.data);
                    setExamWarningMinutes(next);
                    broadcast('examWarningMinutes', next);
                }
                if (msg.type === 'notes-lock-request' && isHost) {
                    const requestedName = String(msg.data?.name ?? 'Anonym');
                    const force = Boolean(msg.data?.force);
                    if (notesLockedBy && notesLockedBy !== conn.peer && !force) return;
                    setNotesLockedBy(conn.peer);
                    setNotesLockedByName(requestedName);
                    sendNotesState();
                }
                if (msg.type === 'notes-save-request' && isHost) {
                    if (notesLockedBy !== conn.peer) return;
                    const nextText = String(msg.data?.text ?? '');
                    const requestedName = String(msg.data?.name ?? 'Anonym');
                    setNotesText(nextText);
                    setNotesLockedBy(null);
                    setNotesLockedByName(null);
                    sendNotesState();
                    addProtocolEntry('Notizen', `Notizen gespeichert von ${requestedName}`);
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
        if (authScreen === 'experimental') {
            return (
                <Container size="md" mt="xl">
                    <Stack>
                        <Group justify="space-between">
                            <Title order={2}>Experimental Peer-to-Peer</Title>
                            <Button
                                variant="light"
                                onClick={() => {
                                    resetExperimentalState();
                                    setAuthScreen('join');
                                }}
                            >
                                Zurück zum Login
                            </Button>
                        </Group>
                        <Text size="sm" c="dimmed">
                            Dieser Modus nutzt manuelles SDP/ICE-Sharing per QR-Code (ohne Signaling-Server).
                            Beide Geräte tauschen nacheinander Angebot und Antwort aus.
                        </Text>
                        <Text size="sm" c="dimmed">
                            Signale werden vor dem Anzeigen/QR-Code komprimiert, um kleinere Codes zu erzeugen.
                        </Text>
                        <Stack gap="xs">
                            <Text size="sm" fw={600}>
                                Rolle wählen
                            </Text>
                            <Group grow>
                                <Button
                                    variant={p2pRole === 'host' ? 'filled' : 'light'}
                                    onClick={() => handleSelectExperimentalRole('host')}
                                >
                                    Host
                                </Button>
                                <Button
                                    variant={p2pRole === 'client' ? 'filled' : 'light'}
                                    onClick={() => handleSelectExperimentalRole('client')}
                                >
                                    Client
                                </Button>
                            </Group>
                        </Stack>
                        <Text size="sm" c="dimmed">
                            Status: {p2pStatus}
                        </Text>
                        {p2pError && (
                            <Text size="sm" c="red">
                                {p2pError}
                            </Text>
                        )}
                        {p2pRole === 'host' && (
                            <Card shadow="sm" radius="md" withBorder>
                                <Stack gap="xs">
                                    <Title order={4}>1. Schritt</Title>
                                    <Text size="sm">QR-Code erstellen und vom Client scannen lassen.</Text>
                                    <Button
                                        onClick={() => {
                                            resetExperimentalState();
                                            ensureExperimentalPeer(true);
                                        }}
                                    >
                                        QR-Code neu erstellen
                                    </Button>
                                    <Text size="xs" c="dimmed">
                                        Erstellt ein neues Angebot für den Host-QR-Code.
                                    </Text>
                                    {p2pQrCode ? (
                                        <Center>
                                            <img
                                                src={p2pQrCode}
                                                alt="Peer-to-Peer Signal QR-Code"
                                                style={{ width: 320 }}
                                            />
                                        </Center>
                                    ) : (
                                        <Text size="xs" c="dimmed">
                                            Noch kein QR-Code erzeugt.
                                        </Text>
                                    )}
                                    {p2pLocalSignal && (
                                        <Stack gap={4}>
                                            <Text size="xs" c="dimmed">
                                                Komprimiertes Signal (zum Teilen): {p2pLocalSignal.slice(0, 180)}
                                                {p2pLocalSignal.length > 180 ? '…' : ''}
                                            </Text>
                                            <Group gap="xs">
                                                <Button size="xs" variant="light" onClick={handleCopyP2pSignal}>
                                                    Signal kopieren
                                                </Button>
                                                {p2pSignalCopied && (
                                                    <Text size="xs" c="green">
                                                        Kopiert
                                                    </Text>
                                                )}
                                            </Group>
                                        </Stack>
                                    )}
                                </Stack>
                            </Card>
                        )}
                        {p2pRole === 'client' && (
                            <Card shadow="sm" radius="md" withBorder>
                                <Stack gap="xs">
                                    <Title order={4}>2. Schritt</Title>
                                    <Text size="sm">Angebot vom Host scannen oder einfügen.</Text>
                                    <TextInput
                                        placeholder="Angebot/Signal einfügen"
                                        value={p2pRemoteSignal}
                                        onChange={(event) => setP2pRemoteSignal(event.currentTarget.value)}
                                    />
                                    <Group grow>
                                        <Button
                                            variant="light"
                                            onClick={() => applyExperimentalSignal(p2pRemoteSignal)}
                                        >
                                            Signal übernehmen
                                        </Button>
                                        <Button
                                            variant="light"
                                            onClick={() => setP2pScanOpened(true)}
                                        >
                                            QR-Code scannen
                                        </Button>
                                    </Group>
                                    <Text size="xs" c="dimmed">
                                        Nach dem Übernehmen wird die Antwort erzeugt und angezeigt.
                                    </Text>
                                </Stack>
                            </Card>
                        )}
                        {p2pRole === 'client' && p2pLocalSignal && (
                            <Card shadow="sm" radius="md" withBorder>
                                <Stack gap="xs">
                                    <Title order={4}>Antwort für den Host</Title>
                                    <Text size="sm">Teile diesen QR-Code mit dem Host.</Text>
                                    {p2pQrCode && (
                                        <Center>
                                            <img
                                                src={p2pQrCode}
                                                alt="Peer-to-Peer Antwort QR-Code"
                                                style={{ width: 320 }}
                                            />
                                        </Center>
                                    )}
                                    <Stack gap={4}>
                                        <Text size="xs" c="dimmed">
                                            Komprimiertes Signal (zum Teilen): {p2pLocalSignal.slice(0, 180)}
                                            {p2pLocalSignal.length > 180 ? '…' : ''}
                                        </Text>
                                        <Group gap="xs">
                                            <Button size="xs" variant="light" onClick={handleCopyP2pSignal}>
                                                Signal kopieren
                                            </Button>
                                            {p2pSignalCopied && (
                                                <Text size="xs" c="green">
                                                    Kopiert
                                                </Text>
                                            )}
                                        </Group>
                                    </Stack>
                                </Stack>
                            </Card>
                        )}
                        {p2pRole === 'host' && p2pQrCode && (
                            <Card shadow="sm" radius="md" withBorder>
                                <Stack gap="xs">
                                    <Title order={4}>3. Schritt</Title>
                                    <Text size="sm">Antwort vom Client scannen oder einfügen.</Text>
                                    <TextInput
                                        placeholder="Antwort/Signal einfügen"
                                        value={p2pRemoteSignal}
                                        onChange={(event) => setP2pRemoteSignal(event.currentTarget.value)}
                                    />
                                    <Group grow>
                                        <Button
                                            variant="light"
                                            onClick={() => applyExperimentalSignal(p2pRemoteSignal)}
                                        >
                                            Signal übernehmen
                                        </Button>
                                        <Button
                                            variant="light"
                                            onClick={() => setP2pScanOpened(true)}
                                        >
                                            QR-Code scannen
                                        </Button>
                                    </Group>
                                </Stack>
                            </Card>
                        )}
                        {p2pConnected && (
                            <Card shadow="sm" radius="md" withBorder>
                                <Stack gap="xs">
                                    <Title order={5}>Chat</Title>
                                    <Stack gap={4}>
                                        {p2pChatMessages.length === 0 ? (
                                            <Text size="sm" c="dimmed">
                                                Noch keine Nachrichten.
                                            </Text>
                                        ) : (
                                            p2pChatMessages.map((message) => (
                                                <Text size="sm" key={message.id}>
                                                    <strong>{message.user}:</strong> {message.text}
                                                </Text>
                                            ))
                                        )}
                                    </Stack>
                                    <Textarea
                                        minRows={2}
                                        placeholder="Nachricht senden"
                                        value={p2pChatInput}
                                        onChange={(event) => setP2pChatInput(event.currentTarget.value)}
                                    />
                                    <Group justify="space-between">
                                        <Text size="xs" c="dimmed">
                                            Debug: {p2pStatus}
                                            {p2pError ? ` | ${p2pError}` : ''}
                                        </Text>
                                        <Button
                                            size="xs"
                                            onClick={() => {
                                                if (!p2pChatInput.trim()) return;
                                                const payload = {
                                                    type: 'chat',
                                                    text: p2pChatInput.trim(),
                                                };
                                                p2pPeerRef.current?.send(JSON.stringify(payload));
                                                setP2pChatMessages((prev) => [
                                                    ...prev,
                                                    {
                                                        id: `${Date.now()}-local`,
                                                        user: 'Ich',
                                                        text: payload.text,
                                                    },
                                                ]);
                                                setP2pChatInput('');
                                            }}
                                        >
                                            Senden
                                        </Button>
                                    </Group>
                                </Stack>
                            </Card>
                        )}
                    </Stack>
                    <Modal
                        opened={p2pScanOpened}
                        onClose={() => setP2pScanOpened(false)}
                        title="Signal-QR-Code scannen"
                        centered
                    >
                        <Stack>
                            <Text size="sm">QR-Code des Gegenübers scannen.</Text>
                            {p2pScanOpened && (
                                <Scanner
                                    onScan={(result) => {
                                        if (!result?.[0]?.rawValue) return;
                                        const value = result[0].rawValue;
                                        setP2pRemoteSignal(value);
                                        applyExperimentalSignal(value);
                                        setP2pScanOpened(false);
                                    }}
                                    onError={() => setP2pError('Kamera konnte nicht gestartet werden.')}
                                    constraints={{ facingMode: 'environment' }}
                                    formats={['qr_code']}
                                    styles={{
                                        container: { width: '100%', borderRadius: 8, overflow: 'hidden' },
                                        video: { width: '100%' },
                                    }}
                                />
                            )}
                        </Stack>
                    </Modal>
                </Container>
            );
        }
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
                    <Divider my="sm" label="Zuletzt verbunden mit" labelPosition="center" />
                    {lastConnectedHost ? (
                        <Stack gap="xs">
                            <Button variant="outline" onClick={() => handleJoin(lastConnectedHost)}>
                                {formatRoomIdForDisplay(lastConnectedHost)}
                            </Button>
                            <Text
                                size="sm"
                                c={
                                    lastHostStatus === 'reachable'
                                        ? 'green'
                                        : lastHostStatus === 'unreachable'
                                          ? 'red'
                                          : 'dimmed'
                                }
                            >
                                {lastHostStatus === 'checking'
                                    ? 'Erreichbarkeit des letzten Raums wird geprüft...'
                                    : lastHostStatus === 'reachable'
                                      ? 'Letzter Raum erreichbar'
                                      : 'Letzter Raum antwortet nicht'}
                            </Text>
                        </Stack>
                    ) : (
                        <Text size="sm" c="dimmed">
                            Kein zuletzt verbundener Raum gespeichert.
                        </Text>
                    )}
                    {lastConnectedHosts.length > 0 && (
                        <>
                            <Divider my="sm" label="Zuletzt beigetretene Räume" labelPosition="center" />
                            <Group gap="xs" wrap="wrap">
                                {lastConnectedHosts.map((hostId) => (
                                    <Button
                                        key={hostId}
                                        variant={hostId === lastConnectedHost ? 'outline' : 'light'}
                                        onClick={() => handleJoin(hostId)}
                                    >
                                        {formatRoomIdForDisplay(hostId)}
                                    </Button>
                                ))}
                            </Group>
                        </>
                    )}
                    <Divider my="sm" label="Oder neuen Link erstellen" labelPosition="center" />
                    <Button onClick={() => handleJoin()}>Eigenen Link erstellen</Button>
                    <Text size="xs" c={createRoomError ? 'red' : 'dimmed'}>
                        {createRoomDebug}
                        {createRoomError ? ` Fehler: ${createRoomError}` : ''}
                    </Text>
                    <Divider my="sm" label="Experimentell" labelPosition="center" />
                    <Button
                        variant="light"
                        onClick={() => {
                            resetExperimentalState();
                            setAuthScreen('experimental');
                        }}
                    >
                        Experimental Peer-to-Peer
                    </Button>
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
    const visibleProtocolEntries = showDebugProtocol
        ? protocolEntries
        : protocolEntries.filter((entry) => !entry.includes('[Debug]'));

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
                        isBlocked={toiletBlocked}
                        onToggleBlocked={(next) => {
                            if (isHost) {
                                setToiletBlocked(next);
                                broadcast('toilet-blocked', next);
                                addProtocolEntry(
                                    'Debug',
                                    `Status gesendet: toilet-blocked (${next ? 'gesperrt' : 'frei'})`,
                                );
                            } else {
                                sendToHost('toilet-blocked-request', next);
                            }
                        }}
                        onOccupy={(name) => {
                            if (isHost) {
                                setToiletOccupants((prev) => {
                                    const next = [...prev, name];
                                    broadcast('toilet-occupants', next);
                                    addProtocolEntry('Debug', `Status gesendet: toilet-occupants (+${name})`);
                                    return next;
                                });
                                addProtocolEntry('Toilette', `besetzt (${name})`);
                            } else {
                                sendToHost('toilet-occupy-request', name);
                            }
                        }}
                        onRelease={(name) => {
                            if (isHost) {
                                setToiletOccupants((prev) => {
                                    const index = prev.indexOf(name);
                                    if (index === -1) return prev;
                                    const next = [...prev];
                                    next.splice(index, 1);
                                    broadcast('toilet-occupants', next);
                                    addProtocolEntry('Debug', `Status gesendet: toilet-occupants (-${name})`);
                                    return next;
                                });
                                addProtocolEntry('Toilette', `frei (${name} zurück)`);
                            } else {
                                sendToHost('toilet-release-request', name);
                            }
                        }}
                        onClose={() => hideTile('toilet')}
                    />
                )}
                {!hiddenTiles['room-status'] && (
                    <RoomStatusTile
                        title="Raum-Status"
                        rooms={roomStatuses}
                        onAddRoom={(name) => {
                            if (isHost) {
                                applyRoomAdd(name);
                            } else {
                                sendToHost('room-status-add-request', name);
                            }
                        }}
                        onToggleHelp={(name) => {
                            if (isHost) {
                                applyRoomToggleHelp(name);
                            } else {
                                sendToHost('room-status-toggle-help-request', name);
                            }
                        }}
                        onClearHelp={(name) => {
                            if (isHost) {
                                applyRoomClearHelp(name);
                            } else {
                                sendToHost('room-status-clear-help-request', name);
                            }
                        }}
                        onResetStatus={(name) => {
                            if (isHost) {
                                applyRoomReset(name);
                            } else {
                                sendToHost('room-status-reset-request', name);
                            }
                        }}
                        onRemoveRoom={(name) => {
                            if (isHost) {
                                applyRoomRemove(name);
                            } else {
                                sendToHost('room-status-remove-request', name);
                            }
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
                            if (isHost) {
                                setExamEnd(end);
                                broadcast('examEnd', end);
                            } else {
                                sendToHost('exam-end-request', end.toISOString());
                            }
                        }}
                        warningMinutes={examWarningMinutes}
                        onSetWarningMinutes={(min) => {
                            if (isHost) {
                                setExamWarningMinutes(min);
                                broadcast('examWarningMinutes', min);
                            } else {
                                sendToHost('exam-warning-request', min);
                            }
                        }}
                        onClose={() => hideTile('timer')}
                    />
                )}
                {!hiddenTiles.chat && (
                    <ChatTile
                        title="Dozenten-Chat"
                        messages={messages}
                        onSend={(msg) => {
                            if (isHost) {
                                setMessages((prev) => [...prev, msg]);
                                addProtocolEntry('Chat', `von ${msg.user}: ${msg.text}`);
                                broadcast('chat', msg);
                            } else {
                                sendToHost('chat-request', msg);
                            }
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
                        entries={visibleProtocolEntries}
                        onExport={exportProtocol}
                        showDebug={showDebugProtocol}
                        onToggleDebug={setShowDebugProtocol}
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
