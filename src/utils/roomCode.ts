const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const ROOM_CODE_BASE = BigInt(ROOM_CODE_ALPHABET.length);

export const normalizeRoomCode = (code: string) => code.trim().toUpperCase();

export const encodeRoomId = (roomId: string) => {
    if (!/^\d+$/.test(roomId)) return roomId;
    let value = BigInt(roomId);
    if (value === 0n) return ROOM_CODE_ALPHABET[0];
    let encoded = '';
    while (value > 0n) {
        const remainder = value % ROOM_CODE_BASE;
        encoded = ROOM_CODE_ALPHABET[Number(remainder)] + encoded;
        value /= ROOM_CODE_BASE;
    }
    return encoded;
};

export const decodeRoomCode = (code: string) => {
    const normalized = normalizeRoomCode(code);
    if (!normalized) return null;
    if (/^\d+$/.test(normalized)) return normalized;
    let value = 0n;
    for (const char of normalized) {
        const index = ROOM_CODE_ALPHABET.indexOf(char);
        if (index === -1) return null;
        value = value * ROOM_CODE_BASE + BigInt(index);
    }
    return value.toString();
};
