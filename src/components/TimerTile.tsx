// src/components/TimerTile.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Button, Center, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconEye, IconZoomIn, IconZoomOut } from '@tabler/icons-react';
import { TileWrapper } from './TileWrapper';

interface TimerTileProps {
    title: string;
    endTime: Date | null;
    onSetMinutes: (minutes: number) => void;
    warningMinutes: number;
    onSetWarningMinutes: (minutes: number) => void;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
    onClose?: () => void;
}

export function TimerTile({
                              title,
                              endTime,
                              onSetMinutes,
                              warningMinutes,
                              onSetWarningMinutes,
                              defaultSpan = 2,
                              onSpanChange,
                              onClose,
                          }: TimerTileProps) {
    const [viewMode, setViewMode] = useState<'admin' | 'exam'>('admin');
    const [input, setInput] = useState('');
    const [warningInput, setWarningInput] = useState(`${warningMinutes}`);
    const [remaining, setRemaining] = useState('');
    const [remainingMs, setRemainingMs] = useState<number | null>(null);
    const [examFontScale, setExamFontScale] = useState(1);

    const quickMinutes = [30, 40, 60, 70, 90];
    const warningThresholdMs = warningMinutes * 60000;
    const minFontScale = 0.8;
    const fontScaleStep = 0.1;

    useEffect(() => {
        const interval = setInterval(() => {
            if (!endTime) {
                setRemaining('nicht gesetzt');
                setRemainingMs(null);
                return;
            }
            const diff = Math.max(0, endTime.getTime() - Date.now());
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            const showSeconds = viewMode === 'admin'
                || diff < 60000
                || (warningMinutes > 0 && diff <= warningThresholdMs);
            setRemaining(showSeconds ? `${minutes}:${seconds.toString().padStart(2, '0')} min` : `${minutes} min`);
            setRemainingMs(diff);
        }, 1000);
        return () => clearInterval(interval);
    }, [endTime, viewMode, warningMinutes, warningThresholdMs]);

    useEffect(() => {
        setWarningInput(`${warningMinutes}`);
    }, [warningMinutes]);

    const handleSet = () => {
        const min = parseInt(input);
        if (!isNaN(min) && min > 0) {
            onSetMinutes(min);
            setInput('');
        }
    };

    const handleWarningSet = () => {
        const min = parseInt(warningInput);
        if (!isNaN(min) && min >= 0) {
            onSetWarningMinutes(min);
            setWarningInput(`${min}`);
        }
    };

    const updateExamFontScale = (delta: number) => {
        setExamFontScale((prev) => {
            const next = Math.max(minFontScale, prev + delta);
            return Number(next.toFixed(2));
        });
    };

    const examCardStyle = useMemo(() => {
        if (viewMode !== 'exam' || remainingMs === null) return undefined;
        if (remainingMs <= 0) {
            return { backgroundColor: '#f03e3e', color: '#fff' };
        }
        if (warningMinutes > 0 && remainingMs <= warningThresholdMs) {
            return { backgroundColor: '#fab005', color: '#1c1c1c' };
        }
        return undefined;
    }, [remainingMs, viewMode, warningMinutes, warningThresholdMs]);

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
            cardStyle={examCardStyle}
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
                <Center>
                    <Stack align="center" gap="xs" w="100%">
                        <Text size="sm" c="dimmed">Restzeit</Text>
                        <Text size="xl" fw={600} style={{ fontSize: `${2 * examFontScale}em` }}>
                            {remaining}
                        </Text>
                    </Stack>
                </Center>
            ) : (
                <Stack>
                    <Text ta="center">Restzeit: {remaining}</Text>
                    <Group gap="xs" justify="center">
                        {quickMinutes.map((minutes) => (
                            <Button
                                key={minutes}
                                size="xs"
                                variant="light"
                                onClick={() => {
                                    onSetMinutes(minutes);
                                    setInput('');
                                }}
                            >
                                {minutes}m
                            </Button>
                        ))}
                    </Group>
                    <TextInput
                        placeholder="Minuten eingeben"
                        value={input}
                        onChange={(e) => setInput(e.currentTarget.value)}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        type="number"
                        min={1}
                    />
                    <Button onClick={handleSet}>Klausurzeit setzen</Button>
                    <Group gap="xs" grow>
                        <TextInput
                            placeholder="Warnung bei weniger als (Minuten)"
                            label="Warnung bei weniger als (Minuten)"
                            value={warningInput}
                            onChange={(e) => setWarningInput(e.currentTarget.value)}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            type="number"
                            min={0}
                        />
                        <Button onClick={handleWarningSet}>Warnung speichern</Button>
                    </Group>
                </Stack>
            )}
        </TileWrapper>
    );
}
