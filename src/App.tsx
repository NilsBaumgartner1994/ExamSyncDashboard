// src/App.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
    Checkbox,
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
import {
    formatRoomIdForDisplay,
    isValidRoomCode,
    normalizeRoomCode,
    ROOM_ID_MAX_LENGTH,
    ROOM_ID_MIN_LENGTH,
} from './utils/roomCode';

type StoredState = {
    version: number;
    examEnd: string | null;
    examWarningMinutes: number;
    showSecondsNormal: boolean;
    showSecondsWarning: boolean;
    tiles: Record<string, unknown>;
    toiletOccupants: string[];
    toiletBlocked: boolean;
    roomStatuses: RoomStatus[];
    messages: ChatMessage[];
    notesText: string;
    notesLockedBy: string | null;
    notesLockedByName: string | null;
    announcementText: string;
    announcementLockedBy: string | null;
    announcementLockedByName: string | null;
};

const initialStoredState: StoredState = {
    version: 0,
    examEnd: null,
    examWarningMinutes: 5,
    showSecondsNormal: false,
    showSecondsWarning: true,
    tiles: {},
    toiletOccupants: [],
    toiletBlocked: false,
    roomStatuses: [],
    messages: [],
    notesText: '',
    notesLockedBy: null,
    notesLockedByName: null,
    announcementText: '',
    announcementLockedBy: null,
    announcementLockedByName: null,
};

const localStateStore: Record<string, StoredState> = {};

const defaultPollIntervalSeconds = 5;
const pollIntervalStorageKey = 'kvPollIntervalSeconds';
const localSyncStorageKey = 'localDebugStateSync';

function App() {
    const [nickname, setNickname] = useState('Anonym');
    const [roomIdInput, setRoomIdInput] = useState('');
    const [roomId, setRoomId] = useState('');
    const [joined, setJoined] = useState(false);
    const [joining, setJoining] = useState(false);
    const [joinError, setJoinError] = useState('');
    const [joinCanCreate, setJoinCanCreate] = useState(false);
    const [toiletOccupants, setToiletOccupants] = useState<string[]>([]);
    const [toiletBlocked, setToiletBlocked] = useState(false);
    const [roomStatuses, setRoomStatuses] = useState<RoomStatus[]>([]);
    const [examEnd, setExamEnd] = useState<Date | null>(null);
    const [examWarningMinutes, setExamWarningMinutes] = useState(5);
    const [showSecondsNormal, setShowSecondsNormal] = useState(false);
    const [showSecondsWarning, setShowSecondsWarning] = useState(true);
    const [tiles, setTiles] = useState<Record<string, unknown>>({});
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [protocolEntries, setProtocolEntries] = useState<string[]>([]);
    const [notesText, setNotesText] = useState('');
    const [notesLockedBy, setNotesLockedBy] = useState<string | null>(null);
    const [notesLockedByName, setNotesLockedByName] = useState<string | null>(null);
    const [announcementText, setAnnouncementText] = useState('');
    const [announcementLockedBy, setAnnouncementLockedBy] = useState<string | null>(null);
    const [announcementLockedByName, setAnnouncementLockedByName] = useState<string | null>(null);
    const [scanOpened, setScanOpened] = useState(false);
    const [scanError, setScanError] = useState('');
    const [hiddenTiles, setHiddenTiles] = useState<Record<string, boolean>>({});
    const [createRoomDebug, setCreateRoomDebug] = useState('Debug: bereit.');
    const [lastConnectedRoom, setLastConnectedRoom] = useState<string | null>(null);
    const [lastConnectedRooms, setLastConnectedRooms] = useState<string[]>([]);
    const [authScreen, setAuthScreen] = useState<'join' | 'experimental' | 'kv'>('join');
    const [stateVersion, setStateVersion] = useState(initialStoredState.version);
    const [kvSyncStatus, setKvSyncStatus] = useState('');
    const [kvSyncError, setKvSyncError] = useState('');
    const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
    const [useLocalStateSync, setUseLocalStateSync] = useState(() => {
        if (typeof localStorage === 'undefined') return false;
        return localStorage.getItem(localSyncStorageKey) === 'true';
    });
    const [pollIntervalSeconds, setPollIntervalSeconds] = useState(() => {
        if (typeof localStorage === 'undefined') return defaultPollIntervalSeconds;
        const stored = Number(localStorage.getItem(pollIntervalStorageKey));
        return Number.isFinite(stored) && stored > 0 ? stored : defaultPollIntervalSeconds;
    });
    const [nextPollAt, setNextPollAt] = useState<Date | null>(null);
    const [nextPollInSeconds, setNextPollInSeconds] = useState<number | null>(null);
    const [showDebugProtocol, setShowDebugProtocol] = useState(false);
    const [exportNotes, setExportNotes] = useState(true);
    const [exportAnnouncements, setExportAnnouncements] = useState(true);
    const defaultKvWorkerUrl = (() => {
        const envUrl = (import.meta.env.VITE_KV_WORKER_URL as string | undefined)?.trim();
        if (envUrl) return envUrl;
        if (typeof window !== 'undefined' && window.location.hostname.endsWith('.workers.dev')) {
            return window.location.origin;
        }
        return 'https://exam-sync-dashboard.nilsbaumgartner1994.workers.dev';
    })();
    const [kvWorkerUrl, setKvWorkerUrl] = useState(() => localStorage.getItem('kvWorkerUrl') ?? defaultKvWorkerUrl);
    const [kvKey, setKvKey] = useState('');
    const [kvValue, setKvValue] = useState('');
    const [kvStatus, setKvStatus] = useState('');
    const [kvResponse, setKvResponse] = useState('');
    const [kvLoading, setKvLoading] = useState(false);
    const [p2pRole, setP2pRole] = useState<'host' | 'client' | null>(null);
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
    const p2pPeerRef = useRef<SimplePeer.Instance | null>(null);
    const p2pCopyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const p2pReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const p2pKeepAliveRef = useRef<NodeJS.Timeout | null>(null);
    const storedStateRef = useRef<StoredState>(initialStoredState);
    const clientIdRef = useRef(
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );

    const tileDefinitions = [
        { key: 'link', label: 'Mein Raum-Link' },
        { key: 'toilet', label: 'Toilette' },
        { key: 'room-status', label: 'Raum-Status' },
        { key: 'timer', label: 'Klausurzeit' },
        { key: 'chat', label: 'Aufsicht Chat' },
        { key: 'notes', label: 'Interne Notizen' },
        { key: 'announcement', label: 'Ankündigung' },
        { key: 'protocol', label: 'Protokoll' },
        { key: 'status', label: 'Verbindung' },
    ];

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
        const sections: string[] = [];
        const protocolContent =
            protocolEntries.length > 0 ? protocolEntries.join('\n') : 'Keine Einträge vorhanden.';

        sections.push(`Protokoll:\n${protocolContent}`);

        if (exportNotes) {
            const notesContent = notesText.trim() ? notesText.trim() : 'Keine Notizen vorhanden.';
            sections.push(`Interne Notizen:\n${notesContent}`);
        }

        if (exportAnnouncements) {
            const announcementContent = announcementText.trim()
                ? announcementText.trim()
                : 'Keine Ankündigung vorhanden.';
            sections.push(`Ankündigungen:\n${announcementContent}`);
        }

        const content = sections.join('\n\n');
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

    const normalizeWorkerUrl = (url: string) => url.replace(/\/+$/, '');
    const normalizeKvKey = (rawKey: string) => {
        const trimmed = rawKey.trim();
        if (!trimmed) return '';
        const urlMatch = trimmed.match(/^https?:\/\/[^/]+(\/.*)?$/i);
        const path = urlMatch ? urlMatch[1] ?? '' : trimmed;
        const kvPrefixMatch = path.match(/^\/?kv\/(.+)$/i);
        return (kvPrefixMatch ? kvPrefixMatch[1] : trimmed).trim();
    };
    const resolveWorkerUrl = useCallback(() => {
        const trimmed = kvWorkerUrl.trim();
        if (trimmed) return trimmed;
        return defaultKvWorkerUrl.trim();
    }, [defaultKvWorkerUrl, kvWorkerUrl]);

    const resetKvState = () => {
        setKvKey('');
        setKvValue('');
        setKvStatus('');
        setKvResponse('');
    };

    const handlePollIntervalChange = useCallback((value: number) => {
        const rounded = Math.round(value);
        if (!Number.isFinite(rounded) || rounded <= 0) return;
        setPollIntervalSeconds(rounded);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(pollIntervalStorageKey, String(rounded));
        }
    }, []);

    useEffect(() => {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(localSyncStorageKey, String(useLocalStateSync));
    }, [useLocalStateSync]);

    const buildStoredState = useCallback(
        () => ({
            version: stateVersion,
            examEnd: examEnd ? examEnd.toISOString() : null,
            examWarningMinutes,
            showSecondsNormal,
            showSecondsWarning,
            tiles,
            toiletOccupants,
            toiletBlocked,
            roomStatuses,
            messages,
            notesText,
            notesLockedBy,
            notesLockedByName,
            announcementText,
            announcementLockedBy,
            announcementLockedByName,
        }),
        [
            stateVersion,
            examEnd,
            examWarningMinutes,
            showSecondsNormal,
            showSecondsWarning,
            tiles,
            toiletOccupants,
            toiletBlocked,
            roomStatuses,
            messages,
            notesText,
            notesLockedBy,
            notesLockedByName,
            announcementText,
            announcementLockedBy,
            announcementLockedByName,
        ],
    );

    useEffect(() => {
        storedStateRef.current = buildStoredState();
    }, [buildStoredState]);

    const applyStoredState = useCallback((next: StoredState) => {
        setStateVersion(next.version);
        setExamEnd(next.examEnd ? new Date(next.examEnd) : null);
        setExamWarningMinutes(next.examWarningMinutes ?? initialStoredState.examWarningMinutes);
        setShowSecondsNormal(next.showSecondsNormal ?? initialStoredState.showSecondsNormal);
        setShowSecondsWarning(next.showSecondsWarning ?? initialStoredState.showSecondsWarning);
        setTiles(next.tiles ?? {});
        setToiletOccupants(Array.isArray(next.toiletOccupants) ? next.toiletOccupants : []);
        setToiletBlocked(Boolean(next.toiletBlocked));
        setRoomStatuses(Array.isArray(next.roomStatuses) ? next.roomStatuses : []);
        setMessages(Array.isArray(next.messages) ? next.messages : []);
        setNotesText(next.notesText ?? '');
        setNotesLockedBy(next.notesLockedBy ?? null);
        setNotesLockedByName(next.notesLockedByName ?? null);
        setAnnouncementText(next.announcementText ?? '');
        setAnnouncementLockedBy(next.announcementLockedBy ?? null);
        setAnnouncementLockedByName(next.announcementLockedByName ?? null);
    }, []);

    const parseStoredState = (rawValue: unknown): StoredState | null => {
        if (!rawValue) return null;
        if (typeof rawValue === 'string') {
            try {
                const parsed = JSON.parse(rawValue) as StoredState;
                return typeof parsed?.version === 'number' ? parsed : null;
            } catch {
                return null;
            }
        }
        if (typeof rawValue === 'object') {
            const parsed = rawValue as StoredState;
            return typeof parsed?.version === 'number' ? parsed : null;
        }
        return null;
    };

    const performKvRequest = async (method: 'GET' | 'PUT' | 'DELETE', key?: string, value?: string) => {
        const trimmedUrl = resolveWorkerUrl();
        if (!trimmedUrl) {
            setKvStatus('Fehler');
            setKvResponse('Bitte Worker-URL angeben.');
            return;
        }
        const normalizedKey = key ? normalizeKvKey(key) : '';
        if (method !== 'GET' && method !== 'DELETE' && !normalizedKey) {
            setKvStatus('Fehler');
            setKvResponse('Bitte einen Key angeben.');
            return;
        }
        if (method === 'DELETE' && !normalizedKey) {
            const confirmed = window.confirm('Wirklich alle Keys im KV Store löschen?');
            if (!confirmed) {
                return;
            }
        }
        setKvLoading(true);
        setKvStatus('Wird geladen...');
        setKvResponse('');
        try {
            const baseUrl = normalizeWorkerUrl(trimmedUrl);
            const endpoint = normalizedKey
                ? `${baseUrl}/kv/${encodeURIComponent(normalizedKey)}`
                : `${baseUrl}/kv`;
            console.debug('[KV]', 'Request', { method, endpoint, key, hasValue: Boolean(value) });
            const options: RequestInit = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                cache: 'no-store',
            };
            if (method === 'PUT') {
                options.body = JSON.stringify({ value });
            }
            const response = await fetch(endpoint, options);
            const contentType = response.headers.get('content-type') ?? '';
            const body = contentType.includes('application/json')
                ? JSON.stringify(await response.json(), null, 2)
                : await response.text();
            console.debug('[KV]', 'Response', {
                method,
                endpoint,
                status: response.status,
                ok: response.ok,
                contentType,
            });
            setKvStatus(response.ok ? 'OK' : `Fehler (${response.status})`);
            setKvResponse(body || (response.ok ? 'Keine Antwort.' : 'Leere Antwort vom Worker.'));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
            console.error('[KV]', 'Request failed', {
                method,
                url: trimmedUrl,
                key: normalizedKey || key,
                error: message,
            });
            setKvStatus('Fehler');
            setKvResponse(message);
        } finally {
            setKvLoading(false);
        }
    };

    useEffect(() => {
        const trimmedUrl = kvWorkerUrl.trim();
        if (trimmedUrl) {
            localStorage.setItem('kvWorkerUrl', trimmedUrl);
        } else {
            localStorage.removeItem('kvWorkerUrl');
        }
    }, [kvWorkerUrl]);

    const rememberLastRoom = (nextRoomId: string) => {
        const normalized = normalizeRoomCode(nextRoomId);
        setLastConnectedRooms((prev) => {
            const next = [normalized, ...prev.filter((id) => id !== normalized)].slice(0, 5);
            localStorage.setItem('lastConnectedRooms', JSON.stringify(next));
            const [mostRecent] = next;
            if (mostRecent) {
                localStorage.setItem('lastConnectedRoom', mostRecent);
            }
            setLastConnectedRoom(mostRecent ?? null);
            return next;
        });
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
        if (p2pReconnectTimeoutRef.current) {
            clearTimeout(p2pReconnectTimeoutRef.current);
            p2pReconnectTimeoutRef.current = null;
        }
        if (p2pKeepAliveRef.current) {
            clearInterval(p2pKeepAliveRef.current);
            p2pKeepAliveRef.current = null;
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

    const stopP2pKeepAlive = () => {
        if (p2pKeepAliveRef.current) {
            clearInterval(p2pKeepAliveRef.current);
            p2pKeepAliveRef.current = null;
        }
    };

    const scheduleExperimentalReconnect = (reason: string) => {
        if (!p2pRole) return;
        if (p2pReconnectTimeoutRef.current) return;
        stopP2pKeepAlive();
        p2pPeerRef.current?.destroy();
        p2pPeerRef.current = null;
        setP2pConnected(false);
        setP2pLocalSignal('');
        setP2pRemoteSignal('');
        setP2pQrCode('');
        setP2pError('');
        setP2pStatus(`Verbindung verloren (${reason}). Neuer Handshake wird vorbereitet…`);
        setP2pChatMessages((prev) => [
            ...prev,
            {
                id: `${Date.now()}-reconnect`,
                user: 'Debug',
                text: `Verbindung verloren (${reason}). Bitte Signal neu austauschen.`,
            },
        ]);
        p2pReconnectTimeoutRef.current = setTimeout(() => {
            p2pReconnectTimeoutRef.current = null;
            ensureExperimentalPeer(p2pRole === 'host');
        }, 1000);
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
            stopP2pKeepAlive();
            p2pKeepAliveRef.current = setInterval(() => {
                if (!p2pPeerRef.current || !p2pPeerRef.current.connected) {
                    return;
                }
                try {
                    p2pPeerRef.current.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
                    setP2pError(`Keep-Alive fehlgeschlagen: ${message}`);
                }
            }, 15000);
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
            scheduleExperimentalReconnect('Datenkanal geschlossen');
        });
        peer.on('error', (error) => {
            setP2pError(`Peer-Fehler: ${error.message}`);
            scheduleExperimentalReconnect('Peer-Fehler');
        });
        peer.on('data', (data) => {
            try {
                const payload = JSON.parse(String(data));
                if (payload?.type === 'ping') {
                    return;
                }
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
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && p2pRole && !p2pConnected) {
                scheduleExperimentalReconnect('App wieder aktiv');
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [p2pConnected, p2pRole]);

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

    const saveSharedState = useCallback(
        async (nextState: StoredState, expectedVersion?: number, targetRoomId?: string) => {
            const roomKey = targetRoomId ?? roomId;
            if (!roomKey) {
                return { ok: false, status: 0, message: 'Raum-ID fehlt.' };
            }
            if (useLocalStateSync) {
                const existing = localStateStore[roomKey];
                const currentVersion = existing?.version ?? 0;
                if (typeof expectedVersion === 'number' && currentVersion !== expectedVersion) {
                    return { ok: false, status: 409, message: 'Lokaler Konflikt: Version stimmt nicht überein.' };
                }
                localStateStore[roomKey] = nextState;
                return { ok: true, status: 200 };
            }
            const trimmedUrl = resolveWorkerUrl();
            if (!trimmedUrl) {
                return { ok: false, status: 0, message: 'KV Worker URL fehlt.' };
            }
            const endpoint = `${normalizeWorkerUrl(trimmedUrl)}/kv/${encodeURIComponent(roomKey)}`;
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                body: JSON.stringify({ value: nextState, expectedVersion }),
            });
            const payload = response.headers.get('content-type')?.includes('application/json')
                ? await response.json().catch(() => null)
                : null;
            if (!response.ok) {
                const message = payload?.error ?? `Speichern fehlgeschlagen (${response.status}).`;
                return { ok: false, status: response.status, message };
            }
            return { ok: true, status: response.status };
        },
        [resolveWorkerUrl, roomId, useLocalStateSync],
    );

    const fetchSharedState = useCallback(
        async (targetRoomId?: string, options?: { silent?: boolean; force?: boolean }) => {
            const roomKey = targetRoomId ?? roomId;
            if (!roomKey) {
                return null;
            }
            if (useLocalStateSync) {
                if (!options?.silent) {
                    setKvSyncStatus('Lade lokalen Status…');
                }
                const next = localStateStore[roomKey] ?? null;
                if (!next) {
                    const errorMessage = 'Kein lokaler Status gefunden.';
                    setKvSyncError(errorMessage);
                    if (!options?.silent) {
                        setKvSyncStatus(errorMessage);
                    }
                    return null;
                }
                setLastSyncAt(new Date());
                const currentVersion = storedStateRef.current.version;
                if (options?.force || next.version > currentVersion) {
                    applyStoredState(next);
                }
                setKvSyncError('');
                if (!options?.silent) {
                    setKvSyncStatus('Lokaler Status geladen');
                }
                return next;
            }
            const trimmedUrl = resolveWorkerUrl();
            if (!trimmedUrl) {
                return null;
            }
            const endpoint = `${normalizeWorkerUrl(trimmedUrl)}/kv/${encodeURIComponent(roomKey)}`;
            try {
                if (!options?.silent) {
                    setKvSyncStatus('Lade aktuellen Status…');
                }
                const response = await fetch(endpoint, { cache: 'no-store' });
                if (!response.ok) {
                    const errorMessage = `Laden fehlgeschlagen (${response.status}).`;
                    setKvSyncError(errorMessage);
                    if (!options?.silent) {
                        setKvSyncStatus(errorMessage);
                    }
                    return null;
                }
                const payload = await response.json();
                const next = parseStoredState(payload?.value ?? payload?.stored ?? payload);
                if (!next) {
                    const errorMessage = 'Ungültige Daten im KV Store.';
                    setKvSyncError(errorMessage);
                    if (!options?.silent) {
                        setKvSyncStatus(errorMessage);
                    }
                    return null;
                }
                setLastSyncAt(new Date());
                const currentVersion = storedStateRef.current.version;
                if (options?.force || next.version > currentVersion) {
                    applyStoredState(next);
                }
                setKvSyncError('');
                if (!options?.silent) {
                    setKvSyncStatus('Aktualisiert');
                }
                return next;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
                setKvSyncError(message);
                if (!options?.silent) {
                    setKvSyncStatus(`Laden fehlgeschlagen: ${message}`);
                }
                return null;
            }
        },
        [applyStoredState, resolveWorkerUrl, roomId, useLocalStateSync],
    );

    const fetchSharedStateForJoin = useCallback(
        async (targetRoomId: string) => {
            if (!targetRoomId) {
                return { state: null, status: 0, message: 'Raum-ID fehlt.' };
            }
            if (useLocalStateSync) {
                const existing = localStateStore[targetRoomId];
                if (!existing) {
                    return { state: null, status: 404, message: 'Lokaler Raum nicht gefunden.' };
                }
                applyStoredState(existing);
                setLastSyncAt(new Date());
                return { state: existing, status: 200, message: '' };
            }
            const trimmedUrl = resolveWorkerUrl();
            if (!trimmedUrl) {
                return { state: null, status: 0, message: 'KV Worker URL fehlt.' };
            }
            const endpoint = `${normalizeWorkerUrl(trimmedUrl)}/kv/${encodeURIComponent(targetRoomId)}`;
            try {
                const response = await fetch(endpoint, { cache: 'no-store' });
                if (!response.ok) {
                    return {
                        state: null,
                        status: response.status,
                        message: `Laden fehlgeschlagen (${response.status}).`,
                    };
                }
                const payload = await response.json();
                const next = parseStoredState(payload?.value ?? payload?.stored ?? payload);
                if (!next) {
                    return {
                        state: null,
                        status: response.status,
                        message: 'Ungültige Daten im KV Store.',
                    };
                }
                applyStoredState(next);
                setLastSyncAt(new Date());
                return { state: next, status: response.status, message: '' };
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
                return { state: null, status: 0, message };
            }
        },
        [applyStoredState, resolveWorkerUrl, useLocalStateSync],
    );

    const isStateValueEqual = useCallback((left: unknown, right: unknown) => {
        if (left === right) return true;
        if (typeof left !== 'object' || typeof right !== 'object' || !left || !right) {
            return false;
        }
        try {
            return JSON.stringify(left) === JSON.stringify(right);
        } catch (error) {
            return false;
        }
    }, []);

    const getChangedFields = useCallback(
        (base: StoredState, updated: StoredState) => {
            return (Object.keys(base) as Array<keyof StoredState>)
                .filter((key) => key !== 'version')
                .filter((key) => !isStateValueEqual(base[key], updated[key]))
                .map((key) => [key, updated[key]] as const);
        },
        [isStateValueEqual],
    );

    const updateSharedState = useCallback(
        async (updater: (prev: StoredState) => StoredState) => {
            if (!roomId) return;
            const current = storedStateRef.current;
            const updated = updater(current);
            if (updated === current) return;
            const changedFields = getChangedFields(current, updated);
            if (changedFields.length === 0) return;
            const next = { ...updated, version: current.version + 1 };
            applyStoredState(next);
            setKvSyncStatus(useLocalStateSync ? 'Speichere lokal…' : 'Speichere Änderungen…');
            const result = await saveSharedState(next, current.version);
            if (!result.ok) {
                if (result.status !== 409) {
                    setKvSyncError(result.message);
                    setKvSyncStatus('Speichern fehlgeschlagen.');
                    return;
                }
                setKvSyncError(result.message);
                setKvSyncStatus('Konflikt erkannt, prüfe Änderungen…');
                const latest = await fetchSharedState(roomId, { silent: true, force: true });
                if (!latest) {
                    setKvSyncStatus('Konflikt erkannt, lade neu…');
                    return;
                }
                const hasFieldConflict = changedFields.some(([key]) => !isStateValueEqual(current[key], latest[key]));
                if (hasFieldConflict) {
                    setKvSyncStatus('Konflikt erkannt, lade neu…');
                    return;
                }
                const mergedUpdates = Object.fromEntries(changedFields) as Partial<StoredState>;
                const merged = { ...latest, ...mergedUpdates, version: latest.version + 1 };
                applyStoredState(merged);
                setKvSyncStatus('Konfliktfrei, speichere zusammengeführt…');
                const retry = await saveSharedState(merged, latest.version);
                if (!retry.ok) {
                    setKvSyncError(retry.message);
                    setKvSyncStatus('Speichern nach Konflikt fehlgeschlagen.');
                    return;
                }
            }
            setKvSyncError('');
            setKvSyncStatus(useLocalStateSync ? 'Lokal gespeichert' : 'Gespeichert');
        },
        [applyStoredState, fetchSharedState, getChangedFields, isStateValueEqual, roomId, saveSharedState, useLocalStateSync],
    );

    const generateRoomId = () => {
        const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const length = 20;
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
    };

    const ensureRoomExists = useCallback(
        async (targetRoomId: string) => {
            const existing = await fetchSharedStateForJoin(targetRoomId);
            if (existing.state) {
                return { ok: true, created: false };
            }
            if (existing.status !== 404) {
                return { ok: false, created: false, message: existing.message || 'Raum konnte nicht geladen werden.' };
            }
            const initialState = { ...initialStoredState };
            applyStoredState(initialState);
            const saved = await saveSharedState(initialState, 0, targetRoomId);
            if (!saved.ok) {
                return { ok: false, created: false, message: saved.message };
            }
            return { ok: true, created: true };
        },
        [applyStoredState, fetchSharedStateForJoin, saveSharedState],
    );

    const createRoomWithId = useCallback(
        async (requestedRoomId: string) => {
            const normalizedCode = normalizeRoomCode(requestedRoomId);
            if (!isValidRoomCode(normalizedCode)) {
                setJoinError(
                    `Bitte eine Raum-ID mit ${ROOM_ID_MIN_LENGTH}-${ROOM_ID_MAX_LENGTH} Zeichen eingeben (a-z, A-Z, 0-9).`,
                );
                setJoinCanCreate(false);
                return;
            }
            setJoining(true);
            setJoinError('');
            setJoinCanCreate(false);
            setKvSyncError('');
            setKvSyncStatus('');
            setRoomId(normalizedCode);
            setKvKey(normalizedCode);
            const ensureResult = await ensureRoomExists(normalizedCode);
            if (!ensureResult.ok) {
                setJoinError(ensureResult.message ?? 'Raum konnte nicht erstellt werden.');
                setJoining(false);
                return;
            }
            setCreateRoomDebug(
                `Debug: Raum ${ensureResult.created ? 'erstellt' : 'geladen'} (ID ${formatRoomIdForDisplay(normalizedCode)}).`,
            );
            setJoined(true);
            setJoining(false);
            rememberLastRoom(normalizedCode);
            window.history.replaceState({}, document.title, window.location.pathname);
        },
        [ensureRoomExists, rememberLastRoom],
    );

    const handleJoin = useCallback(
        async (connectToCode?: string) => {
            const normalizedCode = connectToCode ? normalizeRoomCode(connectToCode) : '';
            if (connectToCode) {
                setRoomIdInput(normalizedCode);
            }
            if (connectToCode && !isValidRoomCode(normalizedCode)) {
                setJoinError(
                    `Bitte eine Raum-ID mit ${ROOM_ID_MIN_LENGTH}-${ROOM_ID_MAX_LENGTH} Zeichen eingeben (a-z, A-Z, 0-9).`,
                );
                setJoinCanCreate(false);
                return;
            }
            setJoining(true);
            setJoinError('');
            setJoinCanCreate(false);
            setKvSyncError('');
            setKvSyncStatus('');
            const nextRoomId = normalizedCode || generateRoomId();
            setRoomId(nextRoomId);
            setKvKey(nextRoomId);
            const ensureResult = await ensureRoomExists(nextRoomId);
            if (!ensureResult.ok) {
                setJoinError(ensureResult.message ?? 'Raum konnte nicht geladen werden.');
                setJoining(false);
                return;
            }
            setCreateRoomDebug(
                `Debug: Raum ${ensureResult.created ? 'erstellt' : 'geladen'} (ID ${formatRoomIdForDisplay(nextRoomId)}).`,
            );
            setJoined(true);
            setJoining(false);
            rememberLastRoom(nextRoomId);
            window.history.replaceState({}, document.title, window.location.pathname);
        },
        [ensureRoomExists, rememberLastRoom],
    );

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get('roomId') ?? params.get('peerId');
        if (roomParam) {
            const normalized = normalizeRoomCode(roomParam);
            setRoomIdInput(normalized);
            handleJoin(normalized);
        }
    }, [handleJoin]);

    useEffect(() => {
        const storedList = localStorage.getItem('lastConnectedRooms');
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
            const stored = localStorage.getItem('lastConnectedRoom');
            if (stored) {
                normalized = normalizeList([stored]);
            }
        }

        if (normalized.length > 0) {
            setLastConnectedRooms(normalized);
            setLastConnectedRoom(normalized[0] ?? null);
        }
    }, []);

    useEffect(() => {
        if (scanOpened) {
            setScanError('');
        }
    }, [scanOpened]);

    useEffect(() => {
        if (!joined || !roomId || useLocalStateSync) {
            setNextPollAt(null);
            return;
        }
        const intervalMs = pollIntervalSeconds * 1000;
        const scheduleNextPoll = () => {
            setNextPollAt(new Date(Date.now() + intervalMs));
        };
        scheduleNextPoll();
        const intervalId = setInterval(() => {
            fetchSharedState(roomId, { silent: true });
            scheduleNextPoll();
        }, intervalMs);
        return () => clearInterval(intervalId);
    }, [fetchSharedState, joined, pollIntervalSeconds, roomId, useLocalStateSync]);

    useEffect(() => {
        if (!nextPollAt) {
            setNextPollInSeconds(null);
            return;
        }
        const updateCountdown = () => {
            const diffMs = nextPollAt.getTime() - Date.now();
            setNextPollInSeconds(Math.max(0, Math.ceil(diffMs / 1000)));
        };
        updateCountdown();
        const timerId = setInterval(updateCountdown, 1000);
        return () => clearInterval(timerId);
    }, [nextPollAt]);

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

    const handleNotesLock = (force = false) => {
        const displayName = nickname.trim() || 'Anonym';
        updateSharedState((prev) => {
            if (prev.notesLockedBy && prev.notesLockedBy !== clientIdRef.current && !force) {
                return prev;
            }
            return {
                ...prev,
                notesLockedBy: clientIdRef.current,
                notesLockedByName: displayName,
            };
        });
    };

    const handleNotesSave = (nextText: string) => {
        const displayName = nickname.trim() || 'Anonym';
        updateSharedState((prev) => {
            if (prev.notesLockedBy !== clientIdRef.current) {
                return prev;
            }
            addProtocolEntry('Notizen', `Interne Notizen gespeichert von ${displayName}`);
            return {
                ...prev,
                notesText: nextText,
                notesLockedBy: null,
                notesLockedByName: null,
            };
        });
    };

    const handleAnnouncementLock = (force = false) => {
        const displayName = nickname.trim() || 'Anonym';
        updateSharedState((prev) => {
            if (prev.announcementLockedBy && prev.announcementLockedBy !== clientIdRef.current && !force) {
                return prev;
            }
            return {
                ...prev,
                announcementLockedBy: clientIdRef.current,
                announcementLockedByName: displayName,
            };
        });
    };

    const handleAnnouncementSave = (nextText: string) => {
        const displayName = nickname.trim() || 'Anonym';
        updateSharedState((prev) => {
            if (prev.announcementLockedBy !== clientIdRef.current) {
                return prev;
            }
            addProtocolEntry('Notizen', `Ankündigung gespeichert von ${displayName}`);
            return {
                ...prev,
                announcementText: nextText,
                announcementLockedBy: null,
                announcementLockedByName: null,
            };
        });
    };

    if (joining) {
        return (
            <Container size="xs" mt="xl">
                <Center>
                    <Stack align="center">
                        <Loader size="xl" />
                        <Text>Raum wird geladen…</Text>
                        {joinError && (
                            <Text size="sm" c="red">
                                {joinError}
                            </Text>
                        )}
                        <Button
                            variant="light"
                            color="red"
                            onClick={() => {
                                setJoining(false);
                                setJoinError('');
                                setJoinCanCreate(false);
                                setRoomIdInput('');
                            }}
                        >
                            Abbrechen
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
        if (authScreen === 'kv') {
            return (
                <Container size="md" mt="xl">
                    <Stack>
                        <Group justify="space-between">
                            <Title order={2}>Experimental KV Storage</Title>
                            <Button
                                variant="light"
                                onClick={() => {
                                    resetKvState();
                                    setAuthScreen('join');
                                }}
                            >
                                Zurück zum Login
                            </Button>
                        </Group>
                        <Text size="sm" c="dimmed">
                            Dieser Screen sendet Requests an deinen Cloudflare Worker. Der Worker sollte die
                            Endpunkte <code>/kv</code> (Liste, DELETE alle Keys) sowie <code>/kv/&lt;key&gt;</code>{' '}
                            (GET/PUT/DELETE) unterstützen.
                        </Text>
                        <TextInput
                            label="Worker-URL"
                            placeholder="https://dein-worker.example.workers.dev"
                            value={kvWorkerUrl}
                            onChange={(event) => setKvWorkerUrl(event.currentTarget.value)}
                        />
                        <Text size="sm" c="dimmed">
                            Automatisch erkannt: {defaultKvWorkerUrl || 'Nicht gesetzt'}
                        </Text>
                        <SimpleGrid cols={{ base: 1, sm: 2 }}>
                            <TextInput
                                label="Key"
                                placeholder="z. B. ExamRoom123"
                                value={kvKey}
                                onChange={(event) => setKvKey(normalizeKvKey(event.currentTarget.value))}
                            />
                            <Textarea
                                label="Value (JSON oder Text)"
                                placeholder={'{ "status": "ready" }'}
                                minRows={3}
                                value={kvValue}
                                onChange={(event) => setKvValue(event.currentTarget.value)}
                            />
                        </SimpleGrid>
                        <Group grow>
                            <Button
                                loading={kvLoading}
                                onClick={() => {
                                    if (!kvKey.trim()) {
                                        setKvStatus('Fehler');
                                        setKvResponse('Bitte einen Key angeben.');
                                        return;
                                    }
                                    performKvRequest('GET', kvKey);
                                }}
                            >
                                Lesen
                            </Button>
                            <Button
                                loading={kvLoading}
                                onClick={() => performKvRequest('PUT', kvKey, kvValue)}
                            >
                                Speichern
                            </Button>
                            <Button
                                color="red"
                                variant="light"
                                loading={kvLoading}
                                onClick={() => performKvRequest('DELETE', kvKey)}
                            >
                                Löschen
                            </Button>
                            <Button
                                color="red"
                                variant="light"
                                loading={kvLoading}
                                onClick={() => performKvRequest('DELETE')}
                            >
                                Alle löschen
                            </Button>
                            <Button
                                variant="light"
                                loading={kvLoading}
                                onClick={() => performKvRequest('GET')}
                            >
                                Alle Keys
                            </Button>
                        </Group>
                        {kvStatus && (
                            <Text size="sm" c={kvStatus.startsWith('Fehler') ? 'red' : 'dimmed'}>
                                Status: {kvStatus}
                            </Text>
                        )}
                        <Textarea
                            label="Antwort"
                            minRows={6}
                            value={kvResponse}
                            readOnly
                        />
                    </Stack>
                </Container>
            );
        }
        return (
            <Container size="xs" mt="xl">
                <Title order={2} mb="md">Prüfungsaufsichts-Dashboard</Title>
                <Stack>
                    {!useLocalStateSync && (
                        <>
                            <Divider my="sm" label="Raum beitreten" labelPosition="center" />

                            <TextInput
                                placeholder="Raum-ID eingeben (a-z, A-Z, 0-9)"
                                value={roomIdInput}
                                onChange={(e) => {
                                    setRoomIdInput(normalizeRoomCode(e.currentTarget.value));
                                    if (joinCanCreate) {
                                        setJoinCanCreate(false);
                                    }
                                }}
                                maxLength={ROOM_ID_MAX_LENGTH}
                            />
                            <Group grow>
                                <Button onClick={() => handleJoin(roomIdInput)}>Beitreten</Button>
                                <Button variant="light" onClick={() => setScanOpened(true)}>
                                    QR-Code scannen
                                </Button>
                            </Group>
                            {joinError && (
                                <Text size="sm" c="red">
                                    {joinError}
                                </Text>
                            )}
                            {joinCanCreate && (
                                <Button
                                    variant="light"
                                    onClick={() => createRoomWithId(roomIdInput)}
                                >
                                    Raum erstellen mit eingegebener Raum-ID
                                </Button>
                            )}
                            <Divider my="sm" label="Zuletzt verbunden mit" labelPosition="center" />
                            {lastConnectedRoom ? (
                                <Stack gap="xs">
                                    <Button variant="outline" onClick={() => handleJoin(lastConnectedRoom)}>
                                        {formatRoomIdForDisplay(lastConnectedRoom)}
                                    </Button>
                                </Stack>
                            ) : (
                                <Text size="sm" c="dimmed">
                                    Kein zuletzt verbundener Raum gespeichert.
                                </Text>
                            )}
                        </>
                    )}
                    <Divider my="sm" label="Oder neuen Link erstellen" labelPosition="center" />
                    <Button onClick={() => handleJoin()}>
                        {useLocalStateSync ? 'offline Raum erstellen' : 'Eigenen Link erstellen'}
                    </Button>
                    <Text size="xs" c="dimmed">
                        {createRoomDebug}
                    </Text>
                    <Divider my="sm" label="Lokales Debugging" labelPosition="center" />
                    <Checkbox
                        label="Offline Modus"
                        checked={useLocalStateSync}
                        onChange={(event) => setUseLocalStateSync(event.currentTarget.checked)}
                    />
                    <Text size="xs" c="dimmed">
                        Aktiviert lokale Synchronisation über ein In-Memory-Dictionary, ohne Netzwerkzugriffe.
                    </Text>
                    <Divider my="sm" label="Experimentell" labelPosition="center" />
                    <Group grow>
                        <Button
                            variant="light"
                            onClick={() => {
                                resetExperimentalState();
                                setAuthScreen('experimental');
                            }}
                        >
                            Experimental Peer-to-Peer
                        </Button>
                        <Button
                            variant="light"
                            onClick={() => {
                                resetKvState();
                                setAuthScreen('kv');
                            }}
                        >
                            Experimental KV Storage
                        </Button>
                    </Group>
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
                            updateSharedState((prev) => ({
                                ...prev,
                                toiletBlocked: next,
                            }));
                            addProtocolEntry(
                                'Debug',
                                `Status gesendet: toilet-blocked (${next ? 'gesperrt' : 'frei'})`,
                            );
                        }}
                        onOccupy={(name) => {
                            updateSharedState((prev) => {
                                if (prev.toiletOccupants.includes(name)) {
                                    return prev;
                                }
                                const next = [...prev.toiletOccupants, name];
                                addProtocolEntry('Toilette', `besetzt (${name})`);
                                addProtocolEntry('Debug', `Status gesendet: toilet-occupants (+${name})`);
                                return {
                                    ...prev,
                                    toiletOccupants: next,
                                };
                            });
                        }}
                        onRelease={(name) => {
                            updateSharedState((prev) => {
                                const index = prev.toiletOccupants.indexOf(name);
                                if (index === -1) return prev;
                                const next = [...prev.toiletOccupants];
                                next.splice(index, 1);
                                addProtocolEntry('Toilette', `frei (${name} zurück)`);
                                addProtocolEntry('Debug', `Status gesendet: toilet-occupants (-${name})`);
                                return {
                                    ...prev,
                                    toiletOccupants: next,
                                };
                            });
                        }}
                        onClose={() => hideTile('toilet')}
                    />
                )}
                {!hiddenTiles['room-status'] && (
                    <RoomStatusTile
                        title="Raum-Status"
                        rooms={roomStatuses}
                        onAddRoom={(name) => {
                            updateSharedState((prev) => {
                                if (prev.roomStatuses.some((room) => room.name === name)) {
                                    return prev;
                                }
                                const next = [...prev.roomStatuses, { name, needsHelp: false, isResolved: false }];
                                addProtocolEntry('Raum-Status', `Raum ${name} hinzugefügt`);
                                return { ...prev, roomStatuses: next };
                            });
                        }}
                        onToggleHelp={(name) => {
                            updateSharedState((prev) => {
                                const target = prev.roomStatuses.find((room) => room.name === name);
                                if (!target) return prev;
                                const nextNeedsHelp = !target.needsHelp;
                                const next = prev.roomStatuses.map((room) =>
                                    room.name === name
                                        ? { ...room, needsHelp: nextNeedsHelp, isResolved: false }
                                        : room,
                                );
                                addProtocolEntry(
                                    'Raum-Status',
                                    `${name}: ${nextNeedsHelp ? 'Hilfe angefordert' : 'Hilfe zurückgenommen'}`,
                                );
                                return { ...prev, roomStatuses: next };
                            });
                        }}
                        onClearHelp={(name) => {
                            updateSharedState((prev) => {
                                const target = prev.roomStatuses.find((room) => room.name === name);
                                if (!target) return prev;
                                const next = prev.roomStatuses.map((room) =>
                                    room.name === name
                                        ? { ...room, needsHelp: false, isResolved: true }
                                        : room,
                                );
                                addProtocolEntry('Raum-Status', `${name}: Hilfe erledigt`);
                                return { ...prev, roomStatuses: next };
                            });
                        }}
                        onResetStatus={(name) => {
                            updateSharedState((prev) => {
                                const target = prev.roomStatuses.find((room) => room.name === name);
                                if (!target) return prev;
                                const next = prev.roomStatuses.map((room) =>
                                    room.name === name
                                        ? { ...room, needsHelp: false, isResolved: false }
                                        : room,
                                );
                                addProtocolEntry('Raum-Status', `${name}: Status zurückgesetzt`);
                                return { ...prev, roomStatuses: next };
                            });
                        }}
                        onRemoveRoom={(name) => {
                            updateSharedState((prev) => {
                                const target = prev.roomStatuses.find((room) => room.name === name);
                                if (!target) return prev;
                                const next = prev.roomStatuses.filter((room) => room.name !== name);
                                addProtocolEntry('Raum-Status', `Raum ${name} entfernt`);
                                return { ...prev, roomStatuses: next };
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
                            updateSharedState((prev) => ({
                                ...prev,
                                examEnd: end.toISOString(),
                            }));
                            addProtocolEntry(
                                'Klausurzeit',
                                `Ende gesetzt auf ${end.toLocaleTimeString('de-DE', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })} (in ${min} min)`,
                            );
                        }}
                        warningMinutes={examWarningMinutes}
                        onSetWarningMinutes={(min) => {
                            updateSharedState((prev) => ({
                                ...prev,
                                examWarningMinutes: min,
                            }));
                            addProtocolEntry('Klausurzeit', `Warnung gesetzt auf ${min} min`);
                        }}
                        showSecondsNormal={showSecondsNormal}
                        showSecondsWarning={showSecondsWarning}
                        onSetShowSecondsNormal={(value) => {
                            updateSharedState((prev) => ({
                                ...prev,
                                showSecondsNormal: value,
                            }));
                            addProtocolEntry('Klausurzeit', `Sekunden normal: ${value ? 'an' : 'aus'}`);
                        }}
                        onSetShowSecondsWarning={(value) => {
                            updateSharedState((prev) => ({
                                ...prev,
                                showSecondsWarning: value,
                            }));
                            addProtocolEntry('Klausurzeit', `Sekunden Warnung: ${value ? 'an' : 'aus'}`);
                        }}
                        onClose={() => hideTile('timer')}
                    />
                )}
                {!hiddenTiles.chat && (
                    <ChatTile
                        title="Aufsicht Chat"
                        messages={messages}
                        onSend={(msg) => {
                            updateSharedState((prev) => ({
                                ...prev,
                                messages: [...prev.messages, msg],
                            }));
                            addProtocolEntry('Chat', `von ${msg.user}: ${msg.text}`);
                        }}
                        nickname={nickname}
                        onNicknameChange={setNickname}
                        onClose={() => hideTile('chat')}
                    />
                )}
                {!hiddenTiles.notes && (
                    <NotesTile
                        title="Interne Notizen"
                        text={notesText}
                        lockedBy={notesLockedBy}
                        lockedByName={notesLockedByName}
                        myPeerId={clientIdRef.current}
                        onRequestLock={() => handleNotesLock(false)}
                        onForceLock={() => handleNotesLock(true)}
                        onSave={handleNotesSave}
                        onClose={() => hideTile('notes')}
                    />
                )}
                {!hiddenTiles.announcement && (
                    <NotesTile
                        title="Ankündigung"
                        text={announcementText}
                        lockedBy={announcementLockedBy}
                        lockedByName={announcementLockedByName}
                        myPeerId={clientIdRef.current}
                        onRequestLock={() => handleAnnouncementLock(false)}
                        onForceLock={() => handleAnnouncementLock(true)}
                        onSave={handleAnnouncementSave}
                        onClose={() => hideTile('announcement')}
                    />
                )}
                {!hiddenTiles.protocol && (
                    <ProtocolTile
                        title="Protokoll"
                        entries={visibleProtocolEntries}
                        onExport={exportProtocol}
                        showDebug={showDebugProtocol}
                        onToggleDebug={setShowDebugProtocol}
                        exportNotes={exportNotes}
                        onToggleExportNotes={setExportNotes}
                        exportAnnouncements={exportAnnouncements}
                        onToggleExportAnnouncements={setExportAnnouncements}
                        onClose={() => hideTile('protocol')}
                    />
                )}
                {!hiddenTiles.status && (
                    <StatusTile
                        title="Verbindung"
                        roomId={roomId}
                        kvKey={kvKey}
                        version={stateVersion}
                        kvStatus={kvSyncError || kvSyncStatus}
                        lastSyncAt={lastSyncAt}
                        nextPollInSeconds={nextPollInSeconds}
                        pollIntervalSeconds={pollIntervalSeconds}
                        onPollIntervalChange={handlePollIntervalChange}
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
