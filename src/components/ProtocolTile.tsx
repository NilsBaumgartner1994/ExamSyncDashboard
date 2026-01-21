// src/components/ProtocolTile.tsx
import React, { useEffect, useRef } from 'react';
import { Button, Checkbox, ScrollArea, Stack, Text } from '@mantine/core';
import { TileWrapper } from './TileWrapper';

interface ProtocolTileProps {
    title: string;
    entries: string[];
    onExport: () => void;
    showDebug: boolean;
    onToggleDebug: (next: boolean) => void;
    exportNotes: boolean;
    onToggleExportNotes: (next: boolean) => void;
    exportAnnouncements: boolean;
    onToggleExportAnnouncements: (next: boolean) => void;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
    onClose?: () => void;
}

export function ProtocolTile({
    title,
    entries,
    onExport,
    showDebug,
    onToggleDebug,
    exportNotes,
    onToggleExportNotes,
    exportAnnouncements,
    onToggleExportAnnouncements,
    defaultSpan = 3,
    onSpanChange,
    onClose,
}: ProtocolTileProps) {
    const viewportRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (viewportRef.current) {
            viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight });
        }
    }, [entries]);

    return (
        <TileWrapper
            title={title}
            defaultSpan={defaultSpan}
            onSpanChange={onSpanChange}
            onClose={onClose}
        >
            <Stack>
                <Checkbox
                    label="Debug-Protokoll anzeigen"
                    checked={showDebug}
                    onChange={(event) => onToggleDebug(event.currentTarget.checked)}
                />
                <Checkbox
                    label="Interne Notizen exportieren"
                    checked={exportNotes}
                    onChange={(event) => onToggleExportNotes(event.currentTarget.checked)}
                />
                <Checkbox
                    label="Ankündigungen exportieren"
                    checked={exportAnnouncements}
                    onChange={(event) => onToggleExportAnnouncements(event.currentTarget.checked)}
                />
                <ScrollArea h={150} viewportRef={viewportRef}>
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
