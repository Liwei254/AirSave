import { beforeEach, describe, expect, jest, test } from "@jest/globals";

process.env.DATA_STORE = "postgres";

const state = {
  counter: 0,
  notifications: [],
  outboxEvents: [],
};

function resetState() {
  state.counter = 0;
  state.notifications = [];
  state.outboxEvents = [];
}

function nextId(prefix) {
  state.counter += 1;
  return `${prefix}-${state.counter}`;
}

function withTimestamps(record) {
  const now = new Date();
  return {
    createdAt: now,
    updatedAt: now,
    ...record,
  };
}

function matchesNotification(notification, where = {}) {
  if (where.id && notification.id !== where.id) return false;
  if (where.userId && notification.userId !== where.userId) return false;
  if (typeof where.read === "boolean" && notification.read !== where.read) return false;
  if (where.sourceEventId && notification.sourceEventId !== where.sourceEventId) return false;
  return true;
}

const fakePrisma = {
  notification: {
    async findUnique({ where } = {}) {
      if (where?.sourceEventId) {
        return state.notifications.find((notification) => notification.sourceEventId === where.sourceEventId) || null;
      }

      if (where?.id) {
        return state.notifications.find((notification) => notification.id === where.id) || null;
      }

      return null;
    },
    async create({ data }) {
      const notification = withTimestamps({
        id: nextId("notification"),
        ...data,
      });
      state.notifications.push(notification);
      return notification;
    },
    async findMany({ where = {}, skip = 0, take = 50 } = {}) {
      return state.notifications
        .filter((notification) => matchesNotification(notification, where))
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .slice(skip, skip + take);
    },
    async count({ where = {} } = {}) {
      return state.notifications.filter((notification) => matchesNotification(notification, where)).length;
    },
    async findFirst({ where = {} } = {}) {
      return state.notifications.find((notification) => matchesNotification(notification, where)) || null;
    },
    async update({ where, data }) {
      const notification = state.notifications.find((record) => record.id === where.id);
      Object.assign(notification, data, { updatedAt: new Date() });
      return notification;
    },
    async updateMany({ where = {}, data }) {
      let count = 0;
      state.notifications.forEach((notification) => {
        if (!matchesNotification(notification, where)) return;
        Object.assign(notification, data, { updatedAt: new Date() });
        count += 1;
      });
      return { count };
    },
    async delete({ where }) {
      const index = state.notifications.findIndex((notification) => notification.id === where.id);
      if (index === -1) return null;
      const [notification] = state.notifications.splice(index, 1);
      return notification;
    },
  },
  outboxEvent: {
    async findMany({ where = {}, take = 20 } = {}) {
      return state.outboxEvents
        .filter((event) => (typeof where.published === "boolean" ? event.published === where.published : true))
        .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
        .slice(0, take);
    },
    async update({ where, data }) {
      const event = state.outboxEvents.find((record) => record.id === where.id);
      Object.assign(event, data, { updatedAt: new Date() });
      return event;
    },
  },
};

jest.unstable_mockModule("../config/prisma.js", () => ({
  default: fakePrisma,
  getPrisma: () => fakePrisma,
  disconnectPrisma: async () => {},
}));

const {
  countUnreadNotifications,
  createNotification,
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} = await import("../services/notificationService.js");
const { processOutboxBatch } = await import("../workers/outboxWorker.js");

beforeEach(() => {
  process.env.DATA_STORE = "postgres";
  resetState();
});

function addOutboxEvent(eventType, payload = {}, overrides = {}) {
  const event = withTimestamps({
    id: nextId("outbox"),
    eventType,
    payload,
    published: false,
    ...overrides,
  });
  state.outboxEvents.push(event);
  return event;
}

describe("Prisma notifications and outbox worker", () => {
  test("creates, lists, counts, marks, and deletes notifications in Postgres mode", async () => {
    const first = await createNotification({
      userId: "user-1",
      message: "First update",
      type: "system",
    });
    await createNotification({
      userId: "user-1",
      message: "Savings update",
      type: "saving",
    });
    await createNotification({
      userId: "user-2",
      message: "Other user update",
      type: "system",
    });

    await expect(getNotifications("user-1")).resolves.toHaveLength(2);
    await expect(getNotifications("user-1", { unread: true })).resolves.toHaveLength(2);
    await expect(countUnreadNotifications("user-1")).resolves.toBe(2);

    const marked = await markNotificationRead("user-1", first.id);
    expect(marked).toMatchObject({ id: first.id, _id: first.id, read: true });
    await expect(countUnreadNotifications("user-1")).resolves.toBe(1);

    const allRead = await markAllNotificationsRead("user-1");
    expect(allRead.every((notification) => notification.read)).toBe(true);
    await expect(countUnreadNotifications("user-1")).resolves.toBe(0);

    const deleted = await deleteNotification("user-1", first.id);
    expect(deleted.id).toBe(first.id);
    await expect(getNotifications("user-1")).resolves.toHaveLength(1);
  });

  test("outbox event creates a notification and marks the event published", async () => {
    const event = addOutboxEvent("savings.allocated", {
      userId: "user-1",
      amount: "27.00",
    });

    const result = await processOutboxBatch({ limit: 10, tx: fakePrisma });

    expect(result).toMatchObject({ scanned: 1, processed: 1, failed: 0 });
    expect(state.outboxEvents.find((record) => record.id === event.id)).toMatchObject({ published: true });
    expect(state.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "user-1",
          type: "saving",
          sourceEventId: event.id,
        }),
      ])
    );
  });

  test("failed outbox event is not marked published", async () => {
    const event = addOutboxEvent("payment.confirmed", {
      amount: "100.00",
    });

    const result = await processOutboxBatch({ limit: 10, tx: fakePrisma });

    expect(result).toMatchObject({ scanned: 1, processed: 0, failed: 1 });
    expect(state.outboxEvents.find((record) => record.id === event.id)).toMatchObject({ published: false });
    expect(state.notifications).toHaveLength(0);
  });

  test("duplicate worker run does not duplicate notifications for the same outbox event", async () => {
    const event = addOutboxEvent("goal.completed", {
      userId: "user-1",
    });

    await processOutboxBatch({ limit: 10, tx: fakePrisma });
    event.published = false;
    await processOutboxBatch({ limit: 10, tx: fakePrisma });

    expect(state.notifications.filter((notification) => notification.sourceEventId === event.id)).toHaveLength(1);
    expect(state.outboxEvents.find((record) => record.id === event.id)).toMatchObject({ published: true });
  });
});
