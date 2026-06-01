export async function findUserByEmailOrPhone(tx, { email, phone }) {
  const filters = [];

  if (email) {
    filters.push({ email });
  }

  if (phone) {
    filters.push({ phone });
  }

  if (!filters.length) {
    return null;
  }

  return tx.user.findFirst({
    where: {
      OR: filters,
    },
    include: {
      wallet: true,
    },
  });
}

export async function findUserByIdentifier(tx, { email, phoneCandidates = [] }) {
  if (email) {
    return tx.user.findUnique({
      where: {
        email,
      },
      include: {
        wallet: true,
      },
    });
  }

  if (!phoneCandidates.length) {
    return null;
  }

  return tx.user.findFirst({
    where: {
      phone: {
        in: phoneCandidates,
      },
    },
    include: {
      wallet: true,
    },
  });
}

export async function findUserById(tx, userId) {
  return tx.user.findUnique({
    where: {
      id: String(userId),
    },
    include: {
      wallet: true,
    },
  });
}
