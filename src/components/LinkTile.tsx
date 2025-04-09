// src/components/LinkTile.tsx
import React, { useState } from 'react';
import { Button, Stack, Text, TextInput, Group, ActionIcon, Tooltip } from '@mantine/core';
import { IconCopy } from '@tabler/icons-react';
import { TileWrapper } from './TileWrapper';

interface LinkTileProps {
    title: string;
    roomId: string;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
}

export function LinkTile({ title, roomId, defaultSpan = 2, onSpanChange }: LinkTileProps) {
    const [revealed, setRevealed] = useState(false);
    const roomUrl = `${window.location.origin}?roomId=${roomId}`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(roomUrl);
    };

    return (
        <TileWrapper title={title} defaultSpan={defaultSpan} onSpanChange={onSpanChange}>
            <Stack align="center">
                {!revealed ? (
                    <Button onClick={() => setRevealed(true)}>Raum-Link anzeigen</Button>
                ) : (
                    <Group>
                        <TextInput value={roomUrl} readOnly style={{ width: 280 }} />
                        <Tooltip label="In Zwischenablage kopieren">
                            <ActionIcon onClick={copyToClipboard} variant="light">
                                <IconCopy size={18} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                )}
            </Stack>
        </TileWrapper>
    );
}