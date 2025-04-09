// src/peer/useMultiPeer.ts
import { useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';

export interface PeerMessage {
    type: string;
    data: any;
}

export function useMultiPeer(
    roomId: string | null,
    onData?: (msg: PeerMessage, senderId: string) => void,
    onConnectedChange?: (peerIds: string[]) => void,
    maxPeers: number = 10
) {
    const peerRef = useRef<Peer | null>(null);
    const connections = useRef<Record<string, DataConnection>>({});

    useEffect(() => {
        if (!roomId) return;

        const peer = new Peer();
        peerRef.current = peer;

        peer.on('open', (id) => {
            console.log('Eigenes Peer-ID:', id);
            if (id === roomId) return;
            const conn = peer.connect(roomId);
            registerConnection(conn);
        });

        peer.on('connection', (conn) => {
            registerConnection(conn);
        });

        function registerConnection(conn: DataConnection) {
            if (!conn) return;
            const id = conn.peer;
            if (Object.keys(connections.current).length >= maxPeers) return;

            connections.current[id] = conn;

            conn.on('open', () => {
                onConnectedChange?.(Object.keys(connections.current));
            });

            conn.on('data', (data) => {
                try {
                    const msg: PeerMessage = JSON.parse(data);
                    onData?.(msg, id);
                } catch (e) {
                    console.warn('Fehler beim Parsen von Nachricht', e);
                }
            });

            conn.on('close', () => {
                delete connections.current[id];
                onConnectedChange?.(Object.keys(connections.current));
            });
        }

        return () => {
            peer.destroy();
        };
    }, [roomId]);

    const sendToAll = (msg: PeerMessage) => {
        const data = JSON.stringify(msg);
        Object.values(connections.current).forEach((conn) => {
            if (conn.open) conn.send(data);
        });
    };

    return {
        get peerId() {
            return peerRef.current?.id;
        },
        sendToAll,
        get connectionCount() {
            return Object.keys(connections.current).length;
        },
    };
}