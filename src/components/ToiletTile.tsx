// src/components/ToiletTile.tsx
import React, { Fragment, useMemo, useState } from 'react';
import { ActionIcon, Button, Center, Divider, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconEye, IconToiletPaper } from '@tabler/icons-react';
import { TileWrapper } from './TileWrapper';

type ToiletViewMode = 'admin' | 'exam';

interface ToiletTileProps {
    title: string;
    occupants: string[];
    onOccupy: (name: string) => void;
    onRelease: (name: string) => void;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
}

export function ToiletTile({
                               title,
                               occupants,
                               onOccupy,
                               onRelease,
                               defaultSpan = 2,
                               onSpanChange,
                           }: ToiletTileProps) {
    const [viewMode, setViewMode] = useState<ToiletViewMode>('admin');
    const [nameInput, setNameInput] = useState('');
    const isOccupied = occupants.length > 0;
    const statusLabel = isOccupied ? `Besetzt (${occupants.length})` : 'Frei';

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
                        <Text fw={600}>{statusLabel}</Text>
                    </Stack>
                </Center>
            ) : (
                <Stack>
                    {isOccupied && (
                        <Stack gap="xs">
                            <Text ta="center">
                                <strong>Auf Toilette:</strong>
                            </Text>
                            {occupants.map((name, index) => (
                                <Fragment key={`${name}-${index}`}>
                                    <Group justify="space-between" wrap="nowrap">
                                        <Text fw={500}>{name}</Text>
                                        <Button
                                            color="green"
                                            size="xs"
                                            onClick={() => onRelease(name)}
                                        >
                                            Zurück
                                        </Button>
                                    </Group>
                                    {index < occupants.length - 1 && (
                                        <Divider size="xs" />
                                    )}
                                </Fragment>
                            ))}
                        </Stack>
                    )}
                    <TextInput
                        placeholder="Name eingeben"
                        value={nameInput}
                        onChange={(event) => setNameInput(event.currentTarget.value)}
                        onKeyDown={(event) => event.key === 'Enter' && handleOccupy()}
                    />
                    <Button onClick={handleOccupy} disabled={!nameInput.trim()} fullWidth>
                        Auf Toilette eintragen
                    </Button>
                </Stack>
            )}
        </TileWrapper>
    );
}
