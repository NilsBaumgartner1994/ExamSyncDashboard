// src/components/ToiletTile.tsx
import React, { Fragment, useState } from 'react';
import { ActionIcon, Button, Center, Checkbox, Divider, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconEye, IconToiletPaper, IconZoomIn, IconZoomOut } from '@tabler/icons-react';
import { TileWrapper } from './TileWrapper';

type ToiletViewMode = 'admin' | 'exam';

interface ToiletTileProps {
    title: string;
    occupants: string[];
    isBlocked: boolean;
    useStatusBackground: boolean;
    onToggleBlocked: (next: boolean) => void;
    onToggleUseStatusBackground: (next: boolean) => void;
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
    useStatusBackground,
    onToggleBlocked,
    onToggleUseStatusBackground,
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
    const examStatusLabel = isBlocked ? 'Nicht möglich' : statusLabel;
    const minFontScale = 0.8;
    const fontScaleStep = 0.1;
    const iconSize = 48 * examFontScale;
    const showStatusBackground = useStatusBackground;
    const isUnavailable = isBlocked || isOccupied;
    const examBackgroundColor = showStatusBackground
        ? isUnavailable
            ? '#fa5252'
            : '#40c057'
        : undefined;
    const examTextColor = showStatusBackground ? '#fff' : undefined;
    const lineColor = showStatusBackground ? '#fff' : '#fa5252';

    const handleOccupy = () => {
        const trimmed = nameInput.trim();
        if (!trimmed) return;
        onOccupy(trimmed);
        setNameInput('');
    };

    const updateExamFontScale = (delta: number) => {
        setExamFontScale((prev) => {
            const next = Math.max(minFontScale, prev + delta);
            return Number(next.toFixed(2));
        });
    };

    const examFontControls = viewMode === 'exam' ? (
        <>
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
            >
                <IconZoomIn size={16} />
            </ActionIcon>
        </>
    ) : null;

    return (
        <TileWrapper
            title={title}
            defaultSpan={defaultSpan}
            onSpanChange={onSpanChange}
            onClose={onClose}
            secondaryHeaderActions={examFontControls}
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
                <Center
                    w="100%"
                    style={showStatusBackground ? { backgroundColor: examBackgroundColor, borderRadius: 12, padding: '24px 16px' } : undefined}
                >
                    <Stack align="center" gap="xs" w="100%">
                        <div style={{ position: 'relative', width: iconSize + 8, height: iconSize + 8 }}>
                            <IconToiletPaper
                                size={iconSize}
                                color={examTextColor}
                                style={{ position: 'absolute', inset: 4 }}
                            />
                            {isUnavailable && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '-10%',
                                        width: '120%',
                                        height: 4,
                                        backgroundColor: lineColor,
                                        transform: 'rotate(-45deg)',
                                        transformOrigin: 'center',
                                    }}
                                />
                            )}
                            {isBlocked && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '-10%',
                                        width: '120%',
                                        height: 4,
                                        backgroundColor: lineColor,
                                        transform: 'rotate(45deg)',
                                        transformOrigin: 'center',
                                    }}
                                />
                            )}
                        </div>
                        <Text fw={600} c={examTextColor} style={{ fontSize: `${1.1 * examFontScale}em` }}>
                            {examStatusLabel}
                        </Text>
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
                    <Checkbox
                        label="Verwende Hintergrundfarbe zum Anzeigen"
                        checked={useStatusBackground}
                        onChange={(event) => onToggleUseStatusBackground(event.currentTarget.checked)}
                    />
                </Stack>
            )}
        </TileWrapper>
    );
}
