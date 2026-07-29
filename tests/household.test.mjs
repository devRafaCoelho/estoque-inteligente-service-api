import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

process.env.DATABASE_URL ||= "postgresql://localhost/test";
process.env.JWT_SECRET ||= "test-secret";

const AppError = require("../src/utils/AppError");
const HouseholdService = require("../src/services/HouseholdService");
const HouseholdRepository = require("../src/repositories/HouseholdRepository");
const HouseholdMemberRepository = require("../src/repositories/HouseholdMemberRepository");
const HouseholdInviteRepository = require("../src/repositories/HouseholdInviteRepository");
const UserRepository = require("../src/repositories/UserRepository");
const EmailService = require("../src/services/EmailService");
const db = require("../src/config/db");

const { ROLES } = HouseholdService;

// ── Roles owner / member ────────────────────────────────────────────────────
{
  assert.equal(HouseholdService.isOwnerRole(ROLES.OWNER), true);
  assert.equal(HouseholdService.isOwnerRole(ROLES.MEMBER), false);
  assert.equal(HouseholdService.isMemberRole(ROLES.OWNER), true);
  assert.equal(HouseholdService.isMemberRole(ROLES.MEMBER), true);
  assert.equal(HouseholdService.isMemberRole("admin"), false);
}

// ── create: 422 sem nome ────────────────────────────────────────────────────
{
  let caught = null;
  try {
    await HouseholdService.create("u1", { name: "  " });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof AppError);
  assert.equal(caught.statusCode, 422);
}

// ── create: 409 se já é dono ─────────────────────────────────────────────────
{
  const orig = HouseholdRepository.findOwnedByUser;
  HouseholdRepository.findOwnedByUser = async () => ({ id: "h1" });
  let caught = null;
  try {
    await HouseholdService.create("u1", { name: "Casa" });
  } catch (err) {
    caught = err;
  }
  HouseholdRepository.findOwnedByUser = orig;
  assert.ok(caught instanceof AppError);
  assert.equal(caught.statusCode, 409);
}

// ── create: sucesso cria owner ───────────────────────────────────────────────
{
  const origOwned = HouseholdRepository.findOwnedByUser;
  const origForUser = HouseholdRepository.findForUser;
  const origCreate = HouseholdRepository.create;
  const origMember = HouseholdMemberRepository.create;
  const origTx = db.withTransaction;
  const ProductRepository = require("../src/repositories/ProductRepository");
  const ShoppingListRepository = require("../src/repositories/ShoppingListRepository");
  const origAttachProducts = ProductRepository.attachSoloToHousehold;
  const origAttachLists = ShoppingListRepository.attachSoloToHousehold;

  HouseholdRepository.findOwnedByUser = async () => null;
  HouseholdRepository.findForUser = async () => null;
  HouseholdRepository.create = async ({ name, ownerUserId }) => ({
    id: "h-new",
    name,
    owner_user_id: ownerUserId,
    created_at: new Date(),
    updated_at: new Date(),
  });
  let memberRole = null;
  let attachedHouseholdId = null;
  HouseholdMemberRepository.create = async ({ role }) => {
    memberRole = role;
    return { id: "m1", role };
  };
  ProductRepository.attachSoloToHousehold = async (_uid, hid) => {
    attachedHouseholdId = hid;
    return 2;
  };
  ShoppingListRepository.attachSoloToHousehold = async () => 1;
  db.withTransaction = async (fn) => fn({});

  const result = await HouseholdService.create("owner-1", { name: "Família Coelho" });

  HouseholdRepository.findOwnedByUser = origOwned;
  HouseholdRepository.findForUser = origForUser;
  HouseholdRepository.create = origCreate;
  HouseholdMemberRepository.create = origMember;
  ProductRepository.attachSoloToHousehold = origAttachProducts;
  ShoppingListRepository.attachSoloToHousehold = origAttachLists;
  db.withTransaction = origTx;

  assert.equal(result.household.name, "Família Coelho");
  assert.equal(memberRole, ROLES.OWNER);
  assert.equal(attachedHouseholdId, "h-new");
}

// ── invite: não-owner → 403 ──────────────────────────────────────────────────
{
  const origMem = HouseholdMemberRepository.findByHouseholdAndUser;
  HouseholdMemberRepository.findByHouseholdAndUser = async () => ({
    role: ROLES.MEMBER,
    user_id: "u2",
  });
  let caught = null;
  try {
    await HouseholdService.invite("u2", "h1", { email: "a@b.com" });
  } catch (err) {
    caught = err;
  }
  HouseholdMemberRepository.findByHouseholdAndUser = origMem;
  assert.ok(caught instanceof AppError);
  assert.equal(caught.statusCode, 403);
}

// ── invite: duplicata pendente → 409 ─────────────────────────────────────────
{
  const origMem = HouseholdMemberRepository.findByHouseholdAndUser;
  const origHouse = HouseholdRepository.findById;
  const origUser = UserRepository.findById;
  const origByEmail = UserRepository.findByEmail;
  const origOpen = HouseholdInviteRepository.findOpenByHouseholdAndEmail;

  HouseholdMemberRepository.findByHouseholdAndUser = async () => ({
    role: ROLES.OWNER,
    user_id: "owner",
  });
  HouseholdRepository.findById = async () => ({
    id: "h1",
    name: "Casa",
    owner_user_id: "owner",
  });
  UserRepository.findById = async () => ({
    id: "owner",
    email: "owner@x.com",
    first_name: "Rafa",
  });
  UserRepository.findByEmail = async () => null;
  HouseholdInviteRepository.findOpenByHouseholdAndEmail = async () => ({
    id: "inv1",
    expires_at: new Date(Date.now() + 86400000),
  });

  let caught = null;
  try {
    await HouseholdService.invite("owner", "h1", { email: "membro@x.com" });
  } catch (err) {
    caught = err;
  }

  HouseholdMemberRepository.findByHouseholdAndUser = origMem;
  HouseholdRepository.findById = origHouse;
  UserRepository.findById = origUser;
  UserRepository.findByEmail = origByEmail;
  HouseholdInviteRepository.findOpenByHouseholdAndEmail = origOpen;

  assert.ok(caught instanceof AppError);
  assert.equal(caught.statusCode, 409);
}

// ── invite: sucesso envia e-mail e retorna token ─────────────────────────────
{
  const origMem = HouseholdMemberRepository.findByHouseholdAndUser;
  const origHouse = HouseholdRepository.findById;
  const origUser = UserRepository.findById;
  const origByEmail = UserRepository.findByEmail;
  const origOpen = HouseholdInviteRepository.findOpenByHouseholdAndEmail;
  const origCreate = HouseholdInviteRepository.create;
  const origSend = EmailService.send;
  let sentTo = null;

  HouseholdMemberRepository.findByHouseholdAndUser = async () => ({
    role: ROLES.OWNER,
    user_id: "owner",
  });
  HouseholdRepository.findById = async () => ({
    id: "h1",
    name: "Casa",
    owner_user_id: "owner",
  });
  UserRepository.findById = async () => ({
    id: "owner",
    email: "owner@x.com",
    first_name: "Rafa",
    last_name: "Coelho",
  });
  UserRepository.findByEmail = async () => null;
  HouseholdInviteRepository.findOpenByHouseholdAndEmail = async () => null;
  HouseholdInviteRepository.create = async (payload) => ({
    id: "inv-new",
    household_id: payload.householdId,
    email: payload.email,
    role: payload.role,
    expires_at: payload.expiresAt,
    created_at: new Date(),
  });
  EmailService.send = async ({ to }) => {
    sentTo = to;
    return { delivered: true };
  };

  const result = await HouseholdService.invite("owner", "h1", {
    email: "Membro@X.com",
  });

  HouseholdMemberRepository.findByHouseholdAndUser = origMem;
  HouseholdRepository.findById = origHouse;
  UserRepository.findById = origUser;
  UserRepository.findByEmail = origByEmail;
  HouseholdInviteRepository.findOpenByHouseholdAndEmail = origOpen;
  HouseholdInviteRepository.create = origCreate;
  EmailService.send = origSend;

  assert.equal(result.invite.email, "membro@x.com");
  assert.ok(result.token && result.token.length >= 32);
  assert.equal(sentTo, "membro@x.com");
}

// ── accept: convite expirado → 410 ───────────────────────────────────────────
{
  const crypto = require("node:crypto");
  const raw = "a".repeat(64);
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const origFind = HouseholdInviteRepository.findByHash;
  HouseholdInviteRepository.findByHash = async (h) => {
    assert.equal(h, hash);
    return {
      id: "inv",
      email: "m@x.com",
      accepted_at: null,
      revoked_at: null,
      expires_at: new Date(Date.now() - 1000),
    };
  };

  let caught = null;
  try {
    await HouseholdService.acceptInvite("u1", { token: raw });
  } catch (err) {
    caught = err;
  }
  HouseholdInviteRepository.findByHash = origFind;
  assert.ok(caught instanceof AppError);
  assert.equal(caught.statusCode, 410);
}

// ── accept: e-mail diferente → 403 ───────────────────────────────────────────
{
  const crypto = require("node:crypto");
  const raw = "b".repeat(64);
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const origByHash = HouseholdInviteRepository.findByHash;
  const origValid = HouseholdInviteRepository.findValidByHash;
  const origUser = UserRepository.findById;

  HouseholdInviteRepository.findByHash = async () => ({
    id: "inv",
    email: "convidado@x.com",
    accepted_at: null,
    revoked_at: null,
    expires_at: new Date(Date.now() + 86400000),
    household_id: "h1",
    role: "member",
  });
  HouseholdInviteRepository.findValidByHash = async () => ({
    id: "inv",
    email: "convidado@x.com",
    household_id: "h1",
    role: "member",
    expires_at: new Date(Date.now() + 86400000),
  });
  UserRepository.findById = async () => ({
    id: "u1",
    email: "outro@x.com",
  });

  let caught = null;
  try {
    await HouseholdService.acceptInvite("u1", { token: raw });
  } catch (err) {
    caught = err;
  }

  HouseholdInviteRepository.findByHash = origByHash;
  HouseholdInviteRepository.findValidByHash = origValid;
  UserRepository.findById = origUser;

  assert.ok(caught instanceof AppError);
  assert.equal(caught.statusCode, 403);
}

// ── smoke: invite → accept → list members ────────────────────────────────────
{
  const crypto = require("node:crypto");
  const state = {
    household: {
      id: "h-smoke",
      name: "Casa Smoke",
      owner_user_id: "owner",
      created_at: new Date(),
      updated_at: new Date(),
    },
    members: [
      {
        id: "m-owner",
        household_id: "h-smoke",
        user_id: "owner",
        role: ROLES.OWNER,
        joined_at: new Date(),
        email: "owner@x.com",
        first_name: "Rafa",
        last_name: null,
        avatar_url: null,
      },
    ],
    invite: null,
  };

  const origMemFind = HouseholdMemberRepository.findByHouseholdAndUser;
  const origHouse = HouseholdRepository.findById;
  const origForUser = HouseholdRepository.findForUser;
  const origUserId = UserRepository.findById;
  const origByEmail = UserRepository.findByEmail;
  const origOpen = HouseholdInviteRepository.findOpenByHouseholdAndEmail;
  const origCreateInv = HouseholdInviteRepository.create;
  const origByHash = HouseholdInviteRepository.findByHash;
  const origValid = HouseholdInviteRepository.findValidByHash;
  const origAccept = HouseholdInviteRepository.markAccepted;
  const origMemCreate = HouseholdMemberRepository.create;
  const origList = HouseholdMemberRepository.listByHousehold;
  const origSend = EmailService.send;
  const origTx = db.withTransaction;

  HouseholdMemberRepository.findByHouseholdAndUser = async (hid, uid) =>
    state.members.find((m) => m.household_id === hid && m.user_id === uid) || null;
  HouseholdRepository.findById = async () => state.household;
  HouseholdRepository.findForUser = async (uid) =>
    state.members.some((m) => m.user_id === uid) ? state.household : null;
  UserRepository.findById = async (id) => {
    if (id === "owner") {
      return { id: "owner", email: "owner@x.com", first_name: "Rafa", last_name: "C" };
    }
    return { id: "member", email: "membro@x.com", first_name: "Ana", last_name: "S" };
  };
  UserRepository.findByEmail = async (email) =>
    email === "membro@x.com"
      ? { id: "member", email: "membro@x.com", first_name: "Ana" }
      : null;
  HouseholdInviteRepository.findOpenByHouseholdAndEmail = async () =>
    state.invite && !state.invite.accepted_at && !state.invite.revoked_at
      ? state.invite
      : null;
  HouseholdInviteRepository.create = async (payload) => {
    state.invite = {
      id: "inv-smoke",
      household_id: payload.householdId,
      email: payload.email,
      token_hash: payload.tokenHash,
      role: payload.role,
      expires_at: payload.expiresAt,
      accepted_at: null,
      revoked_at: null,
      created_at: new Date(),
    };
    return state.invite;
  };
  HouseholdInviteRepository.findByHash = async (hash) =>
    state.invite && state.invite.token_hash === hash ? state.invite : null;
  HouseholdInviteRepository.findValidByHash = async (hash) => {
    if (!state.invite || state.invite.token_hash !== hash) return null;
    if (state.invite.accepted_at || state.invite.revoked_at) return null;
    if (new Date(state.invite.expires_at) <= new Date()) return null;
    return state.invite;
  };
  HouseholdInviteRepository.markAccepted = async (id) => {
    if (state.invite?.id === id) state.invite.accepted_at = new Date();
    return state.invite;
  };
  HouseholdMemberRepository.create = async ({ householdId, userId, role }) => {
    const row = {
      id: `m-${userId}`,
      household_id: householdId,
      user_id: userId,
      role,
      joined_at: new Date(),
      email: "membro@x.com",
      first_name: "Ana",
      last_name: "S",
      avatar_url: null,
    };
    state.members.push(row);
    return row;
  };
  HouseholdMemberRepository.listByHousehold = async () => state.members;
  EmailService.send = async () => ({ delivered: true });
  db.withTransaction = async (fn) => fn({});

  const invited = await HouseholdService.invite("owner", "h-smoke", {
    email: "membro@x.com",
  });
  assert.ok(invited.token);

  // member ainda não está na casa para accept
  state.members = state.members.filter((m) => m.user_id === "owner");
  HouseholdRepository.findForUser = async (uid) =>
    uid === "owner" ? state.household : null;

  const accepted = await HouseholdService.acceptInvite("member", {
    token: invited.token,
  });
  assert.equal(accepted.membership.role, ROLES.MEMBER);

  const listed = await HouseholdService.listMembers("owner", "h-smoke");
  assert.equal(listed.members.length, 2);
  assert.ok(listed.members.some((m) => m.role === ROLES.OWNER));
  assert.ok(listed.members.some((m) => m.role === ROLES.MEMBER));

  HouseholdMemberRepository.findByHouseholdAndUser = origMemFind;
  HouseholdRepository.findById = origHouse;
  HouseholdRepository.findForUser = origForUser;
  UserRepository.findById = origUserId;
  UserRepository.findByEmail = origByEmail;
  HouseholdInviteRepository.findOpenByHouseholdAndEmail = origOpen;
  HouseholdInviteRepository.create = origCreateInv;
  HouseholdInviteRepository.findByHash = origByHash;
  HouseholdInviteRepository.findValidByHash = origValid;
  HouseholdInviteRepository.markAccepted = origAccept;
  HouseholdMemberRepository.create = origMemCreate;
  HouseholdMemberRepository.listByHousehold = origList;
  EmailService.send = origSend;
  db.withTransaction = origTx;
}

// ── remove: member não pode remover → 403 ────────────────────────────────────
{
  const orig = HouseholdMemberRepository.findByHouseholdAndUser;
  HouseholdMemberRepository.findByHouseholdAndUser = async () => ({
    role: ROLES.MEMBER,
  });
  let caught = null;
  try {
    await HouseholdService.removeMember("m1", "h1", "m2");
  } catch (err) {
    caught = err;
  }
  HouseholdMemberRepository.findByHouseholdAndUser = orig;
  assert.ok(caught instanceof AppError);
  assert.equal(caught.statusCode, 403);
}

// ── leave: member sai e perde acesso ─────────────────────────────────────────
{
  const origMem = HouseholdMemberRepository.findByHouseholdAndUser;
  const origRemove = HouseholdMemberRepository.remove;
  let removed = null;
  HouseholdMemberRepository.findByHouseholdAndUser = async () => ({
    role: ROLES.MEMBER,
    user_id: "m1",
  });
  HouseholdMemberRepository.remove = async (hid, uid) => {
    removed = { hid, uid };
    return { id: "x" };
  };

  const result = await HouseholdService.leave("m1", "h1");
  HouseholdMemberRepository.findByHouseholdAndUser = origMem;
  HouseholdMemberRepository.remove = origRemove;

  assert.equal(result.left, true);
  assert.equal(result.dissolved, false);
  assert.deepEqual(removed, { hid: "h1", uid: "m1" });
}

// ── leave: owner com outros membros → 422 ────────────────────────────────────
{
  const origMem = HouseholdMemberRepository.findByHouseholdAndUser;
  const origCount = HouseholdMemberRepository.countByHousehold;
  HouseholdMemberRepository.findByHouseholdAndUser = async () => ({
    role: ROLES.OWNER,
  });
  HouseholdMemberRepository.countByHousehold = async () => 2;

  let caught = null;
  try {
    await HouseholdService.leave("owner", "h1");
  } catch (err) {
    caught = err;
  }
  HouseholdMemberRepository.findByHouseholdAndUser = origMem;
  HouseholdMemberRepository.countByHousehold = origCount;

  assert.ok(caught instanceof AppError);
  assert.equal(caught.statusCode, 422);
}

// ── leave: owner solo dissolve a casa ────────────────────────────────────────
{
  const origMem = HouseholdMemberRepository.findByHouseholdAndUser;
  const origCount = HouseholdMemberRepository.countByHousehold;
  const origRemove = HouseholdMemberRepository.remove;
  const origDelete = HouseholdRepository.deleteById;
  const origTx = db.withTransaction;
  let deletedId = null;

  HouseholdMemberRepository.findByHouseholdAndUser = async () => ({
    role: ROLES.OWNER,
  });
  HouseholdMemberRepository.countByHousehold = async () => 1;
  HouseholdMemberRepository.remove = async () => ({ id: "m" });
  HouseholdRepository.deleteById = async (id) => {
    deletedId = id;
    return { id };
  };
  db.withTransaction = async (fn) => fn({});

  const result = await HouseholdService.leave("owner", "h-solo");
  HouseholdMemberRepository.findByHouseholdAndUser = origMem;
  HouseholdMemberRepository.countByHousehold = origCount;
  HouseholdMemberRepository.remove = origRemove;
  HouseholdRepository.deleteById = origDelete;
  db.withTransaction = origTx;

  assert.equal(result.dissolved, true);
  assert.equal(deletedId, "h-solo");
}

// ── revokeInvite: member → 403 ───────────────────────────────────────────────
{
  const orig = HouseholdMemberRepository.findByHouseholdAndUser;
  HouseholdMemberRepository.findByHouseholdAndUser = async () => ({
    role: ROLES.MEMBER,
  });
  let caught = null;
  try {
    await HouseholdService.revokeInvite("m1", "h1", "inv1");
  } catch (err) {
    caught = err;
  }
  HouseholdMemberRepository.findByHouseholdAndUser = orig;
  assert.ok(caught instanceof AppError);
  assert.equal(caught.statusCode, 403);
}

// ── assertCanDeleteAccount: owner com membros → 409 ──────────────────────────
{
  const origForUser = HouseholdRepository.findForUser;
  const origMem = HouseholdMemberRepository.findByHouseholdAndUser;
  const origCount = HouseholdMemberRepository.countByHousehold;

  HouseholdRepository.findForUser = async () => ({ id: "h1" });
  HouseholdMemberRepository.findByHouseholdAndUser = async () => ({
    role: ROLES.OWNER,
  });
  HouseholdMemberRepository.countByHousehold = async () => 3;

  let caught = null;
  try {
    await HouseholdService.assertCanDeleteAccount("owner");
  } catch (err) {
    caught = err;
  }

  HouseholdRepository.findForUser = origForUser;
  HouseholdMemberRepository.findByHouseholdAndUser = origMem;
  HouseholdMemberRepository.countByHousehold = origCount;

  assert.ok(caught instanceof AppError);
  assert.equal(caught.statusCode, 409);
}

console.log("household.test.mjs: ok");
