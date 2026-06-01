export const defaultPreferences = {
  notifications: true,
  theme: "light",
  privacyMode: false,
  securityAlerts: true,
  linkedPaymentMethods: true,
  autoSaveEnabled: true,
};

export function toApiRole(role) {
  return String(role || "USER").toLowerCase();
}

export function toApiStatus(status) {
  return String(status || "ACTIVE").toLowerCase();
}

export function normalizePreferencePayload(input = {}, currentPreferences = {}) {
  const nextPreferences = {
    ...defaultPreferences,
    ...(currentPreferences || {}),
  };

  ["notifications", "privacyMode", "securityAlerts", "linkedPaymentMethods", "autoSaveEnabled"].forEach((field) => {
    if (typeof input[field] === "boolean") {
      nextPreferences[field] = input[field];
    }
  });

  if (["light", "dark", "system"].includes(input.theme)) {
    nextPreferences.theme = input.theme;
  }

  return nextPreferences;
}

export function sanitizePrismaUser(user, walletBalance = 0) {
  if (!user) return null;

  const walletId = user.wallet?.id || user.walletId || null;
  const preferences = normalizePreferencePayload({}, user.preferences || {});

  return {
    id: user.id,
    _id: user.id,
    fullName: user.fullName || "",
    email: user.email || "",
    phone: user.phone,
    role: toApiRole(user.role),
    wallet: walletId,
    status: toApiStatus(user.status),
    createdAt: user.createdAt,
    roundUpRule: user.roundUpRule || 50,
    avatar: user.avatarUrl || "",
    walletBalance: Number(walletBalance || 0),
    preferences,
  };
}
