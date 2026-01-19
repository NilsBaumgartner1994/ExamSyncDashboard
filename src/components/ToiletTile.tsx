// src/components/ToiletTile.tsx
import React, { Fragment, useMemo, useState } from 'react';
import { ActionIcon, Button, Center, Checkbox, Divider, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconEye, IconToiletPaper, IconZoomIn, IconZoomOut } from '@tabler/icons-react';
import { TileWrapper } from './TileWrapper';

type ToiletViewMode = 'admin' | 'exam';

interface ToiletTileProps {
    title: string;
    occupants: string[];
    isBlocked: boolean;
    onToggleBlocked: (next: boolean) => void;
    onOccupy: (name: string) => void;
    onRelease: (name: string) => void;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
    onClose?: () => void;
}

export function ToiletTile({
    title,
    occupants,
    isBlocked,
    onToggleBlocked,
    onOccupy,
    onRelease,
    defaultSpan = 2,
    onSpanChange,
    onClose,
}: ToiletTileProps) {
    const [viewMode, setViewMode] = useState<ToiletViewMode>('admin');
    const [nameInput, setNameInput] = useState('');
    const [examFontScale, setExamFontScale] = useState(1);
    const isOccupied = occupants.length > 0;
    const statusLabel = isOccupied ? `Besetzt (${occupants.length})` : 'Frei';
    const examStatusLabel = isBlocked ? 'nicht möglich' : statusLabel;
    const minFontScale = 0.8;
    const maxFontScale = 1.6;
    const fontScaleStep = 0.1;
    const iconSize = 48 * examFontScale;

    const examCardStyle = useMemo(() => {
        if (viewMode !== 'exam' || isBlocked) return undefined;
        return {
            backgroundColor: isOccupied ? '#f03e3e' : '#2f9e44',
            color: '#fff',
        };
    }, [isBlocked, isOccupied, viewMode]);

    const handleOccupy = () => {
        const trimmed = nameInput.trim();
        if (!trimmed) return;
        onOccupy(trimmed);
        setNameInput('');
    };

    const updateExamFontScale = (delta: number) => {
        setExamFontScale((prev) => {
            const next = Math.min(maxFontScale, Math.max(minFontScale, prev + delta));
            return Number(next.toFixed(2));
        });
    };

    return (
        <TileWrapper
            title={title}
            defaultSpan={defaultSpan}
            onSpanChange={onSpanChange}
            cardStyle={examCardStyle}
            onClose={onClose}
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
                    <Stack align="center" gap="xs" w="100%">
                        <div style={{ position: 'relative', width: iconSize + 8, height: iconSize + 8 }}>
                            <IconToiletPaper size={iconSize} style={{ position: 'absolute', inset: 4 }} />
                            {isBlocked && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '-10%',
                                        width: '120%',
                                        height: 4,
                                        backgroundColor: '#fa5252',
                                        transform: 'rotate(-45deg)',
                                        transformOrigin: 'center',
                                    }}
                                />
                            )}
                        </div>
                        <Text fw={600} style={{ fontSize: `${1.1 * examFontScale}em` }}>
                            {examStatusLabel}
                        </Text>
                        <Group gap={6} justify="flex-end" w="100%">
                            <ActionIcon
                                variant="light"
                                onClick={() => updateExamFontScale(-fontScaleStep)}
                                aria-label="Schrift verkleinern"
                                disabled={examFontScale <= minFontScale}
                            >
                                <IconZoomOut size={16} />
                            </ActionIcon>
                            <ActionIcon
                                variant="light"
                                onClick={() => updateExamFontScale(fontScaleStep)}
                                aria-label="Schrift vergrößern"
                                disabled={examFontScale >= maxFontScale}
                            >
                                <IconZoomIn size={16} />
                            </ActionIcon>
                        </Group>
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
                    <Checkbox
                        label="Toilettengang nicht möglich"
                        checked={isBlocked}
                        onChange={(event) => onToggleBlocked(event.currentTarget.checked)}
                    />
                </Stack>
            )}
        </TileWrapper>
    );
}
