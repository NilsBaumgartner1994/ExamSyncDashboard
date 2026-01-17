// src/components/ProtocolTile.tsx
import React from 'react';
import { Button, ScrollArea, Stack, Text } from '@mantine/core';
import { TileWrapper } from './TileWrapper';

interface ProtocolTileProps {
    title: string;
    entries: string[];
    onExport: () => void;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
    onClose?: () => void;
}

export function ProtocolTile({
                                 title,
                                 entries,
                                 onExport,
                                 defaultSpan = 3,
                                 onSpanChange,
                                 onClose,
                             }: ProtocolTileProps) {
    return (
        <TileWrapper
            title={title}
            defaultSpan={defaultSpan}
            onSpanChange={onSpanChange}
            onClose={onClose}
        >
            <Stack>
                <ScrollArea h={150}>
                    {entries.length > 0 ? (
                        entries.map((entry, index) => (
                            <Text key={`${entry}-${index}`}>{entry}</Text>
                        ))
                    ) : (
                        <Text ta="center" c="dimmed">
                            Keine Einträge vorhanden
                        </Text>
                    )}
                </ScrollArea>
                <Button onClick={onExport}>Protokoll exportieren</Button>
            </Stack>
        </TileWrapper>
    );
}
