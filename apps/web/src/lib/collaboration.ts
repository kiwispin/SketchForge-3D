export const INVITE_CODE_LENGTH = 8;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type CollaborationRole = "host" | "guest";

export type CollaborationParticipant = {
  id: string;
  name: string;
  role: CollaborationRole;
};

export type CollaborationRoom = {
  id: string;
  code: string;
  hostId: string;
  participants: CollaborationParticipant[];
};

export function normalizeInviteCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z2-9]/g, "").replace(/[ILO]/g, "");
}

export function formatInviteCode(value: string) {
  const code = normalizeInviteCode(value).slice(0, INVITE_CODE_LENGTH);
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function createInviteCode(random: () => number = Math.random) {
  let code = "";
  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    code += ALPHABET[Math.floor(random() * ALPHABET.length)] ?? "A";
  }
  return formatInviteCode(code);
}

export function isValidDisplayName(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 24;
}
