// src/components/StatusTile.tsx
import React from 'react';
import { NumberInput, Stack, Text } from '@mantine/core';
import { TileWrapper } from './TileWrapper';
import { formatRoomIdForDisplay } from '../utils/roomCode';

interface StatusTileProps {
    title: string;
    roomId: string;
    kvKey: string;
    version: number;
    kvStatus: string;
    lastSyncAt: Date | null;
    nextPollInSeconds: number | null;
    pollIntervalSeconds: number;
    onPollIntervalChange: (value: number) => void;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
    onClose?: () => void;
}

export function StatusTile({
                               title,
                               roomId,
                               kvKey,
                               version,
                               kvStatus,
                               lastSyncAt,
                               nextPollInSeconds,
                               pollIntervalSeconds,
                               onPollIntervalChange,
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
                    <strong>Raum-ID:</strong>{' '}
                    {roomId ? formatRoomIdForDisplay(roomId) : 'Nicht verbunden'}
                </Text>
                <Text>
                    <strong>Key:</strong>{' '}
                    {kvKey ? formatRoomIdForDisplay(kvKey) : 'Nicht gesetzt'}
                </Text>
                <Text>
                    <strong>Version:</strong> {version}
                </Text>
                <Text>
                    <strong>KV-Status:</strong> {kvStatus || 'Keine aktuellen Updates'}
                </Text>
                <Text>
                    <strong>Nächster Abruf in:</strong>{' '}
                    {nextPollInSeconds === null ? '—' : `${nextPollInSeconds} Sek.`}
                </Text>
                <Text>
                    <strong>Letzter Sync:</strong>{' '}
                    {lastSyncAt ? lastSyncAt.toLocaleTimeString('de-DE') : 'Noch nicht synchronisiert'}
                </Text>
                <NumberInput
                    label="Aktualisierung (nur lokal)"
                    description="Intervall für den automatischen Abruf in Sekunden."
                    min={1}
                    max={300}
                    value={pollIntervalSeconds}
                    onChange={(value) => {
                        const nextValue = typeof value === 'number' ? value : Number(value);
                        if (!Number.isFinite(nextValue)) return;
                        onPollIntervalChange(nextValue);
                    }}
                />
            </Stack>
        </TileWrapper>
    );
}
