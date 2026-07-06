import { faker } from '@faker-js/faker';

export function genUser(overrides: Record<string, unknown> = {}) {
  return {
    id: faker.number.int({ min: 1, max: 1000 }),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    role: faker.helpers.arrayElement(['admin', 'member', 'viewer']),
    status: faker.helpers.weightedArrayElement([
      { value: 'active', weight: 80 }, { value: 'invited', weight: 15 }, { value: 'disabled', weight: 5 },
    ]),
    created_at: faker.date.past().toISOString(),
    ...overrides,
  };
}

export function genApiKey(overrides: Record<string, unknown> = {}) {
  return {
    id: faker.number.int({ min: 1, max: 100 }),
    name: faker.helpers.arrayElement(['CI/CD Pipeline', 'Terraform', 'Monitoring Bot', 'Local Dev', 'Staging Deploy']),
    key_prefix: 'zt_' + faker.string.alphanumeric(8),
    scopes: faker.helpers.arrayElements(['read:metrics', 'read:logs', 'read:apm', 'write:events', 'admin'], { min: 1, max: 3 }),
    status: faker.helpers.weightedArrayElement([
      { value: 'active', weight: 80 }, { value: 'revoked', weight: 20 },
    ]),
    created_at: faker.date.past().toISOString(),
    last_used_at: faker.helpers.maybe(() => faker.date.recent().toISOString(), { probability: 0.7 }) ?? null,
    ...overrides,
  };
}

export function genApiKeyReveal() {
  return { key: 'zt_' + faker.string.alphanumeric(32) };
}

export function genOrganization() {
  return {
    organization: {
      id: 1,
      name: 'Zerotrace Demo',
      slug: 'zerotrace-demo',
      created_at: '2025-01-15T00:00:00Z',
      updated_at: faker.date.recent().toISOString(),
    },
    stats: {
      users: faker.number.int({ min: 3, max: 20 }),
      active_subscriptions: faker.number.int({ min: 1, max: 3 }),
    },
    current_user_role: 'admin',
  };
}

export function genAgentStatus() {
  return {
    agents: Array.from({ length: 12 }, () => ({
      NAME: `${faker.helpers.arrayElement(['web', 'db', 'cache', 'worker'])}-${String(faker.number.int({ min: 1, max: 99 })).padStart(2, '0')}.prod`,
      CTRL_IP: faker.internet.ip(),
      STATE: faker.helpers.weightedArrayElement([{ value: 1, weight: 85 }, { value: 0, weight: 15 }]),
      SYNCED_CONTROLLER_AT: new Date(Date.now() - faker.number.int({ min: 1, max: 300 }) * 1000).toISOString().replace('T', ' ').slice(0, 19),
    })),
    DATA: Array.from({ length: 12 }, () => ({
      hostname: faker.internet.domainName(),
      cpu: faker.number.float({ min: 5, max: 90, fractionDigits: 1 }),
      memory: faker.number.float({ min: 10, max: 85, fractionDigits: 1 }),
    })),
  };
}
