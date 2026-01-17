// src/components/StatusTile.tsx
import React from 'react';
import { Badge, Stack, Text } from '@mantine/core';
import { TileWrapper } from './TileWrapper';
import { formatRoomIdForDisplay } from '../utils/roomCode';

interface StatusTileProps {
    title: string;
    peerId: string | undefined;
    connectedPeers: string[];
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
    onClose?: () => void;
}

export function StatusTile({
                               title,
                               peerId,
                               connectedPeers,
                               defaultSpan = 2,
                               onSpanChange,
                               onClose,
                           }: StatusTileProps) {
    return (
        <TileWrapper
            title={title}
            defaultSpan={defaultSpan}
            onSpanChange={onSpanChange}
            onClose={onClose}
        >
            <Stack>
                <Text>
                    <strong>Eigene ID:</strong>{' '}
                    {peerId ? formatRoomIdForDisplay(peerId) : 'Nicht verbunden'}
                </Text>
                <Text><strong>Verbunden mit:</strong></Text>
                {connectedPeers.length > 0 ? (
                    connectedPeers.map((pid, i) => (
                        <Badge key={i}>{formatRoomIdForDisplay(pid)}</Badge>
                    ))
                ) : (
                    <Text>Keine weiteren Peers verbunden</Text>
                )}
            </Stack>
        </TileWrapper>
    );
}
