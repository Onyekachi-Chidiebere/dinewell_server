const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'production';
process.env.JSON_WEB_SECRET = process.env.JSON_WEB_SECRET || 'test-access-secret';
process.env.JSON_WEB_REFRESH_SECRET = process.env.JSON_WEB_REFRESH_SECRET || 'test-refresh-secret';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
process.env.DB_SSL_ALLOW_SYSTEM_CA = 'true';

const router = require('../router');
const User = require('../models/user');
const clientService = require('../services/clientService');
const merchantService = require('../services/merchantService');
const app = express();
app.use(router);

async function withServer(run) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('health endpoint is public', async () => withServer(async (base) => {
  const response = await fetch(`${base}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
}));

test('public admin creation is absent in production', async () => withServer(async (base) => {
  const response = await fetch(`${base}/admin/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'x@example.com', password: 'password', name: 'x' }),
  });
  assert.equal(response.status, 404);
}));

test('direct card charge is disabled', async () => withServer(async (base) => {
  const response = await fetch(`${base}/cards/charge`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount: 1 }),
  });
  assert.equal(response.status, 410);
}));

test('username availability is public during client signup', async () => {
  const original = clientService.checkUsernameAvailability;
  clientService.checkUsernameAvailability = async () => ({ available: true });
  try {
    await withServer(async (base) => {
      const response = await fetch(`${base}/client/username/check?username=new-user`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { success: true, available: true });
    });
  } finally {
    clientService.checkUsernameAvailability = original;
  }
});

test('merchant me approval status resolves to the authenticated subject', async () => {
  const originalFind = User.findByPk;
  const originalStatus = merchantService.getApprovalStatus;
  User.findByPk = async () => ({ id: 23, type: 'Merchant', approval_status: 0 });
  merchantService.getApprovalStatus = async (id) => ({
    id: Number(id),
    approvalStatus: 'pending',
  });
  try {
    const token = jwt.sign(
      { sub: '23', userId: 23, role: 'Merchant' },
      process.env.JSON_WEB_SECRET,
      { issuer: 'dinewell', audience: 'dinewell-api' }
    );
    await withServer(async (base) => {
      const response = await fetch(`${base}/merchant/me/approval-status`, {
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { id: 23, approvalStatus: 'pending' });
    });
  } finally {
    User.findByPk = originalFind;
    merchantService.getApprovalStatus = originalStatus;
  }
});
