// src/components/TileWrapper.tsx
import React, { ReactNode, useState } from 'react';
import { Card, Group, Text, ActionIcon, Collapse } from '@mantine/core';
import { IconMinus, IconPlus, IconChevronDown, IconChevronUp } from "@tabler/icons-react";

interface TileWrapperProps {
    title: string;
    children: ReactNode;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
    headerActions?: ReactNode;
    cardStyle?: React.CSSProperties;
}

export function TileWrapper({
                                title,
                                children,
                                defaultSpan = 2,
                                onSpanChange,
                                headerActions,
                                cardStyle,
                            }: TileWrapperProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [span, setSpan] = useState(defaultSpan);

    const changeSpan = (delta: number) => {
        const newSpan = Math.min(6, Math.max(1, span + delta));
        setSpan(newSpan);
        onSpanChange?.(newSpan);
    };

    return (
        <Card
            shadow="sm"
            radius="md"
            withBorder
            style={{ gridColumn: `span ${span}`, ...cardStyle }}
        >
            <Group justify="space-between" mb="xs">
                <Text fw={500}>{title}</Text>
                <Group gap="xs">
                    <ActionIcon onClick={() => changeSpan(-1)} variant="light"><IconMinus size={16} /></ActionIcon>
                    <ActionIcon onClick={() => changeSpan(1)} variant="light"><IconPlus size={16} /></ActionIcon>
                    {headerActions}
                    <ActionIcon onClick={() => setCollapsed((c) => !c)} variant="light">
                        {collapsed ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
                    </ActionIcon>
                </Group>
            </Group>
            <Collapse in={!collapsed}>
                {children}
            </Collapse>
        </Card>

    );
}
