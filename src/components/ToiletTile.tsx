// src/components/ToiletTile.tsx
import React, { useMemo, useState } from 'react';
import { ActionIcon, Button, Center, Stack, Text, TextInput } from '@mantine/core';
import { IconEye, IconToiletPaper } from '@tabler/icons-react';
import { TileWrapper } from './TileWrapper';

type ToiletViewMode = 'admin' | 'exam';

interface ToiletTileProps {
    title: string;
    occupant: string | null;
    onOccupy: (name: string) => void;
    onRelease: () => void;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
}

export function ToiletTile({
                               title,
                               occupant,
                               onOccupy,
                               onRelease,
                               defaultSpan = 2,
                               onSpanChange,
                           }: ToiletTileProps) {
    const [viewMode, setViewMode] = useState<ToiletViewMode>('admin');
    const [nameInput, setNameInput] = useState('');
    const isOccupied = Boolean(occupant);

    const examCardStyle = useMemo(() => {
        if (viewMode !== 'exam') return undefined;
        return {
            backgroundColor: isOccupied ? '#f03e3e' : '#2f9e44',
            color: '#fff',
        };
    }, [isOccupied, viewMode]);

    const handleOccupy = () => {
        const trimmed = nameInput.trim();
        if (!trimmed) return;
        onOccupy(trimmed);
        setNameInput('');
    };

    return (
        <TileWrapper
            title={title}
            defaultSpan={defaultSpan}
            onSpanChange={onSpanChange}
            cardStyle={examCardStyle}
            headerActions={(
                <ActionIcon
                    onClick={() => setViewMode((prev) => (prev === 'admin' ? 'exam' : 'admin'))}
                    variant="light"
                    aria-label="Ansicht wechseln"
                >
                    <IconEye size={16} />
                </ActionIcon>
            )}
        >
            {viewMode === 'exam' ? (
                <Center>
                    <Stack align="center" gap="xs">
                        <IconToiletPaper size={48} />
                        <Text fw={600}>{isOccupied ? 'Besetzt' : 'Frei'}</Text>
                    </Stack>
                </Center>
            ) : (
                <Stack>
                    {isOccupied ? (
                        <>
                            <Text ta="center">
                                <strong>Auf Toilette:</strong> {occupant}
                            </Text>
                            <Button color="green" onClick={onRelease} fullWidth>
                                Person zurück
                            </Button>
                        </>
                    ) : (
                        <>
                            <TextInput
                                placeholder="Name eingeben"
                                value={nameInput}
                                onChange={(event) => setNameInput(event.currentTarget.value)}
                                onKeyDown={(event) => event.key === 'Enter' && handleOccupy()}
                            />
                            <Button onClick={handleOccupy} disabled={!nameInput.trim()} fullWidth>
                                Auf Toilette eintragen
                            </Button>
                        </>
                    )}
                </Stack>
            )}
        </TileWrapper>
    );
}
