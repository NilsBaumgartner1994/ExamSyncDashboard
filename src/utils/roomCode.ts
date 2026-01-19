export const ROOM_ID_MIN_LENGTH = 6;
export const ROOM_ID_MAX_LENGTH = 64;

export const normalizeRoomCode = (code: string) =>
    code.replace(/[^a-zA-Z0-9]/g, '').trim().slice(0, ROOM_ID_MAX_LENGTH);

export const isValidRoomCode = (code: string) =>
    /^[a-zA-Z0-9]+$/.test(code) &&
    code.length >= ROOM_ID_MIN_LENGTH &&
    code.length <= ROOM_ID_MAX_LENGTH;

export const formatRoomIdForDisplay = (roomId: string) => {
    const normalized = normalizeRoomCode(roomId);
    if (!/^\d+$/.test(normalized)) return normalized;
    return normalized.replace(/(\d{3})(?=\d)/g, '$1 ');
};
