// src/components/StatusTile.tsx
import React from 'react';
import { Badge, Stack, Text } from '@mantine/core';
import { TileWrapper } from './TileWrapper';

interface StatusTileProps {
    title: string;
    peerId: string | undefined;
    connectedPeers: string[];
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
}

export function StatusTile({
                               title,
                               peerId,
                               connectedPeers,
                               defaultSpan = 2,
                               onSpanChange,
                           }: StatusTileProps) {
    return (
        <TileWrapper title={title} defaultSpan={defaultSpan} onSpanChange={onSpanChange}>
            <Stack>
                <Text><strong>Eigene ID:</strong> {peerId || 'Nicht verbunden'}</Text>
                <Text><strong>Verbunden mit:</strong></Text>
                {connectedPeers.length > 0 ? (
                    connectedPeers.map((pid, i) => <Badge key={i}>{pid}</Badge>)
                ) : (
                    <Text>Keine weiteren Peers verbunden</Text>
                )}
            </Stack>
        </TileWrapper>
    );
}
