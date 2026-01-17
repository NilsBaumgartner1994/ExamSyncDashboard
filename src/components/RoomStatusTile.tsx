// src/components/RoomStatusTile.tsx
import React, { Fragment, useMemo, useState } from 'react';
import { ActionIcon, Button, Divider, Group, Stack, Text, TextInput, Box } from '@mantine/core';
import { IconBell, IconCheck, IconTrash } from '@tabler/icons-react';
import { keyframes } from '@emotion/react';
import { TileWrapper } from './TileWrapper';

export interface RoomStatus {
    name: string;
    needsHelp: boolean;
}

interface RoomStatusTileProps {
    title: string;
    rooms: RoomStatus[];
    onAddRoom: (name: string) => void;
    onToggleHelp: (name: string) => void;
    onClearHelp: (name: string) => void;
    onRemoveRoom: (name: string) => void;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
    onClose?: () => void;
}

const helpBlink = keyframes`
  0%, 100% {
    background-color: #ffd43b;
  }
  50% {
    background-color: #f03e3e;
  }
`;

export function RoomStatusTile({
    title,
    rooms,
    onAddRoom,
    onToggleHelp,
    onClearHelp,
    onRemoveRoom,
    defaultSpan = 2,
    onSpanChange,
    onClose,
}: RoomStatusTileProps) {
    const [roomInput, setRoomInput] = useState('');

    const handleAdd = () => {
        const trimmed = roomInput.trim();
        if (!trimmed) return;
        onAddRoom(trimmed);
        setRoomInput('');
    };

    const roomRows = useMemo(
        () =>
            rooms.map((room, index) => {
                const rowStyle = room.needsHelp
                    ? {
                        animation: `${helpBlink} 1.2s infinite`,
                        color: '#fff',
                        border: '1px solid #f03e3e',
                    }
                    : {
                        backgroundColor: '#f1f3f5',
                        border: '1px solid #dee2e6',
                    };

                return (
                    <Fragment key={`${room.name}-${index}`}>
                        <Box
                            style={{
                                ...rowStyle,
                                borderRadius: 8,
                                padding: '8px 12px',
                            }}
                        >
                            <Group justify="space-between" wrap="nowrap">
                                <Text fw={600} style={{ flex: 1 }}>
                                    {room.name}
                                </Text>
                                <ActionIcon
                                    size="lg"
                                    variant={room.needsHelp ? 'filled' : 'light'}
                                    color={room.needsHelp ? 'yellow' : 'gray'}
                                    aria-label="Hilfe anfordern"
                                    onClick={() => onToggleHelp(room.name)}
                                >
                                    <IconBell size={18} />
                                </ActionIcon>
                                <ActionIcon
                                    size="lg"
                                    variant="light"
                                    color="green"
                                    aria-label="Hilfe erledigt"
                                    onClick={() => onClearHelp(room.name)}
                                >
                                    <IconCheck size={18} />
                                </ActionIcon>
                                <Button
                                    size="xs"
                                    color="red"
                                    variant="light"
                                    leftSection={<IconTrash size={14} />}
                                    onClick={() => onRemoveRoom(room.name)}
                                >
                                    Entfernen
                                </Button>
                            </Group>
                        </Box>
                        {index < rooms.length - 1 && <Divider size="xs" />}
                    </Fragment>
                );
            }),
        [rooms, onToggleHelp, onClearHelp, onRemoveRoom],
    );

    return (
        <TileWrapper
            title={title}
            defaultSpan={defaultSpan}
            onSpanChange={onSpanChange}
            onClose={onClose}
        >
            <Stack>
                {rooms.length > 0 ? roomRows : (
                    <Text size="sm" c="dimmed" ta="center">
                        Noch keine Räume eingetragen.
                    </Text>
                )}
                <TextInput
                    placeholder="Raumname eingeben"
                    value={roomInput}
                    onChange={(event) => setRoomInput(event.currentTarget.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleAdd()}
                />
                <Button onClick={handleAdd} disabled={!roomInput.trim()} fullWidth>
                    Raum hinzufügen
                </Button>
            </Stack>
        </TileWrapper>
    );
}
