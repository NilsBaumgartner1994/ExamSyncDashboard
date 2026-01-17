// src/components/LinkTile.tsx
import React, { useEffect, useState } from 'react';
import { Button, Stack, Text, TextInput, Group, ActionIcon, Tooltip, Image } from '@mantine/core';
import { IconCopy } from '@tabler/icons-react';
import QRCode from 'qrcode';
import { TileWrapper } from './TileWrapper';

interface LinkTileProps {
    title: string;
    roomId: string;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
}

export function LinkTile({ title, roomId, defaultSpan = 2, onSpanChange }: LinkTileProps) {
    const [revealed, setRevealed] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
    baseUrl.searchParams.set('roomId', roomId);
    const roomUrl = baseUrl.toString();

    useEffect(() => {
        let isMounted = true;
        QRCode.toDataURL(roomUrl, { width: 220, margin: 1 })
            .then((url) => {
                if (isMounted) setQrCodeUrl(url);
            })
            .catch(() => {
                if (isMounted) setQrCodeUrl('');
            });
        return () => {
            isMounted = false;
        };
    }, [roomUrl]);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(roomUrl);
    };

    return (
        <TileWrapper title={title} defaultSpan={defaultSpan} onSpanChange={onSpanChange}>
            <Stack align="center">
                {!revealed ? (
                    <Button onClick={() => setRevealed(true)}>Raum-Link anzeigen</Button>
                ) : (
                    <>
                        <Group>
                            <TextInput value={roomUrl} readOnly style={{ width: 280 }} />
                            <Tooltip label="In Zwischenablage kopieren">
                                <ActionIcon onClick={copyToClipboard} variant="light">
                                    <IconCopy size={18} />
                                </ActionIcon>
                            </Tooltip>
                        </Group>
                        {qrCodeUrl ? (
                            <Stack align="center" gap="xs">
                                <Text size="sm">QR-Code für den Raum-Link</Text>
                                <Image src={qrCodeUrl} alt="QR-Code für den Raum-Link" w={180} />
                            </Stack>
                        ) : (
                            <Text size="sm" c="dimmed">QR-Code wird erstellt…</Text>
                        )}
                    </>
                )}
            </Stack>
        </TileWrapper>
    );
}
